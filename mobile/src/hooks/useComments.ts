import { useState, useCallback } from 'react'
import { Comment } from '../types'
import * as postService from '../services/post.service'
import { getCache, setCache } from '../db/database'
import { isConnected } from '../services/netinfo.service'
import { useAuthStore } from '../store/auth.store'

export function useComments(postId: string) {
  const [comments, setComments] = useState<Comment[]>([])
  const [loading,  setLoading]  = useState(false)
  const [sending,  setSending]  = useState(false)

  const load = useCallback(async () => {
    setLoading(true)

    // 1. SQLite first — instant display
    const cached = await getCache<Comment[]>(`comments:${postId}`).catch(() => null)
    if (cached && cached.length > 0) {
      setComments(cached)
      setLoading(false)
    }

    // 2. Background network sync
    if (!isConnected()) { setLoading(false); return }
    try {
      const fresh = await postService.getComments(postId)
      setComments(fresh)
      setCache(`comments:${postId}`, fresh).catch(() => {})
    } catch {}
    setLoading(false)
  }, [postId])

  const send = useCallback(async (content: string, parentId?: string) => {
    if (!content.trim()) return
    const { user } = useAuthStore.getState()
    setSending(true)

    // Optimistic: add temp comment immediately
    const tempId = `temp-${Date.now()}`
    const optimistic: Comment = {
      id:        tempId,
      userId:    user?.id ?? '',
      postId,
      content,
      parentId:  parentId ?? null,
      createdAt: new Date().toISOString(),
      user:      { id: user?.id ?? '', name: user?.name ?? '', avatar: user?.avatar ?? null },
    }
    setComments((prev) => [optimistic, ...prev])

    try {
      const confirmed = await postService.addComment(postId, content, parentId)
      setComments((prev) => {
        const updated = prev.map((c) => c.id === tempId ? confirmed : c)
        setCache(`comments:${postId}`, updated).catch(() => {})
        return updated
      })
    } catch {
      // Remove optimistic on failure
      setComments((prev) => prev.filter((c) => c.id !== tempId))
    }
    setSending(false)
  }, [postId])

  return { comments, loading, sending, load, send }
}
