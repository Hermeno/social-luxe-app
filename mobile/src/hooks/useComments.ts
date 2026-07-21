import { useState, useCallback, useRef } from 'react'
import { Comment } from '../types'
import * as postService from '../services/post.service'
import { getCache, setCache, enqueueSyncOp } from '../db/database'
import { isConnected } from '../services/netinfo.service'
import { useAuthStore } from '../store/auth.store'

// Aplica uma transformação a um comentário onde quer que ele esteja — topo ou
// dentro das respostas. Sem isto, gostar de uma resposta não mexia em nada.
function mapDeep(list: Comment[], id: string, fn: (c: Comment) => Comment): Comment[] {
  return list.map((c) => {
    if (c.id === id) return fn(c)
    if (c.replies?.length) return { ...c, replies: mapDeep(c.replies, id, fn) }
    return c
  })
}

function removeDeep(list: Comment[], id: string): Comment[] {
  return list
    .filter((c) => c.id !== id)
    .map((c) => (c.replies?.length ? { ...c, replies: removeDeep(c.replies, id) } : c))
}

export function useComments(postId: string) {
  const [comments, setComments] = useState<Comment[]>([])
  const [loading,  setLoading]  = useState(false)
  const [sending,  setSending]  = useState(false)

  // Guarda o estado mais recente para o cache sem o pôr nas dependências
  const commentsRef = useRef<Comment[]>([])
  commentsRef.current = comments

  const persist = useCallback((next: Comment[]) => {
    setCache(`comments:${postId}`, next).catch(() => {})
  }, [postId])

  const apply = useCallback((fn: (prev: Comment[]) => Comment[]) => {
    setComments((prev) => {
      const next = fn(prev)
      persist(next)
      return next
    })
  }, [persist])

  const load = useCallback(async () => {
    setLoading(true)

    // 1. SQLite primeiro — aparece já, mesmo sem rede
    const cached = await getCache<Comment[]>(`comments:${postId}`).catch(() => null)
    if (cached && cached.length > 0) {
      setComments(cached)
      setLoading(false)
    }

    // 2. Sincronização em segundo plano
    if (!isConnected()) { setLoading(false); return }
    try {
      const fresh = await postService.getComments(postId)
      setComments(fresh)
      persist(fresh)
    } catch {}
    setLoading(false)
  }, [postId, persist])

  const send = useCallback(async (content: string, parentId?: string) => {
    if (!content.trim()) return
    const { user } = useAuthStore.getState()
    setSending(true)

    const tempId = `temp-${Date.now()}`
    const optimistic: Comment = {
      id:        tempId,
      userId:    user?.id ?? '',
      postId,
      content,
      parentId:  parentId ?? null,
      createdAt: new Date().toISOString(),
      user:      { id: user?.id ?? '', name: user?.name ?? '', avatar: user?.avatar ?? null },
      likeCount: 0,
      likedByMe: false,
    }
    apply((prev) => [optimistic, ...prev])

    // Sem rede: o comentário fica no ecrã e na fila, e sobe quando houver ligação
    if (!isConnected()) {
      await enqueueSyncOp('comment', tempId, 'create', { postId, content, parentId }).catch(() => {})
      setSending(false)
      return
    }
    try {
      const confirmed = await postService.addComment(postId, content, parentId)
      apply((prev) => prev.map((c) => (c.id === tempId ? confirmed : c)))
    } catch {
      apply((prev) => prev.filter((c) => c.id !== tempId))
    }
    setSending(false)
  }, [postId, apply])

  // ── Gosto ───────────────────────────────────────────────────────────────────
  // Optimista e reversível: o número muda já, e volta atrás se o servidor negar.
  const toggleLike = useCallback(async (commentId: string) => {
    if (commentId.startsWith('temp-')) return   // ainda não existe no servidor

    let wasLiked = false
    apply((prev) => mapDeep(prev, commentId, (c) => {
      wasLiked = !!c.likedByMe
      return { ...c, likedByMe: !wasLiked, likeCount: Math.max(0, (c.likeCount ?? 0) + (wasLiked ? -1 : 1)) }
    }))

    if (!isConnected()) {
      await enqueueSyncOp('commentLike', commentId, 'update', { liked: !wasLiked }).catch(() => {})
      return
    }
    try {
      const res = await postService.toggleCommentLike(commentId)
      apply((prev) => mapDeep(prev, commentId, (c) => ({ ...c, likedByMe: res.liked, likeCount: res.likeCount })))
    } catch {
      apply((prev) => mapDeep(prev, commentId, (c) => ({
        ...c, likedByMe: wasLiked, likeCount: Math.max(0, (c.likeCount ?? 0) + (wasLiked ? 1 : -1)),
      })))
    }
  }, [apply])

  const edit = useCallback(async (commentId: string, content: string) => {
    if (!content.trim() || commentId.startsWith('temp-')) return
    let original = ''
    apply((prev) => mapDeep(prev, commentId, (c) => {
      original = c.content
      return { ...c, content, editedAt: new Date().toISOString() }
    }))
    if (!isConnected()) {
      await enqueueSyncOp('comment', commentId, 'update', { content: content.trim() }).catch(() => {})
      return
    }
    try {
      await postService.editComment(commentId, content.trim())
    } catch {
      apply((prev) => mapDeep(prev, commentId, (c) => ({ ...c, content: original })))
    }
  }, [apply])

  const remove = useCallback(async (commentId: string) => {
    if (commentId.startsWith('temp-')) { apply((prev) => removeDeep(prev, commentId)); return }
    const snapshot = commentsRef.current
    apply((prev) => removeDeep(prev, commentId))
    if (!isConnected()) {
      await enqueueSyncOp('comment', commentId, 'delete', {}).catch(() => {})
      return
    }
    try {
      await postService.deleteComment(commentId)
    } catch {
      apply(() => snapshot)   // repõe a lista inteira: mais seguro do que adivinhar a posição
    }
  }, [apply])

  return { comments, loading, sending, load, send, toggleLike, edit, remove }
}
