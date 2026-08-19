/**
 * useFeed — Offline-first feed hook
 *
 * Read path:  SQLite → UI (instant, no network wait)
 * Write path: UI update → SQLite → sync_queue → API (when online)
 * Sync:       Background sync updates SQLite, then calls setState
 */

import { useState, useCallback, useRef, useEffect } from 'react'
import Toast from 'react-native-toast-message'
import { Post, type RepostResult } from '../types'
import { syncFeed, forceSyncFeed } from '../db/sync'
import { onConnectivityChange } from '../services/netinfo.service'
import {
  cachePosts,
  getCachedPosts,
  updateCachedPost,
  patchCachedPostInteraction,
  deleteCachedPost,
  enqueueSyncOp,
} from '../db/database'
import * as postService from '../services/post.service'
import { getSocket } from '../socket'
import { isConnected } from '../services/netinfo.service'

export function useFeed() {
  const [posts, setPosts]     = useState<Post[]>([])
  const [loading, setLoading] = useState(false)
  const [page, setPage]       = useState(1)
  const [hasMore, setHasMore] = useState(true)
  const postsRef = useRef<Post[]>([])
  postsRef.current = posts

  const initialised  = useRef(false)
  const loadingRef   = useRef(false)

  // ── Initial load: SQLite first, then background sync ─────────────────────
  const refresh = useCallback(async () => {
    if (loadingRef.current) return
    loadingRef.current = true

    try {
      if (!initialised.current) {
        initialised.current = true
        setLoading(true)  // spinner only on very first load

        const local = await syncFeed((fresh) => {
          setPosts(fresh)
          setPage(1)
          setHasMore(fresh.length >= 10)
        })
        if (local.length > 0) setPosts(local)

      } else {
        // Subsequent focus: SILENT background sync — no spinner, no visible refresh
        if (isConnected()) {
          forceSyncFeed()
            .then(fresh => {
              setPosts(fresh)
              setPage(1)
              setHasMore(fresh.length >= 10)
            })
            .catch(() => {})
        } else {
          getCachedPosts()
            .then(cached => { if (cached.length > 0) setPosts(cached) })
            .catch(() => {})
        }
      }
    } catch {
      try {
        const cached = await getCachedPosts()
        if (cached.length > 0) setPosts(cached)
        else Toast.show({ type: 'error', text1: 'Sem ligação', text2: 'A mostrar dados guardados.', visibilityTime: 3000 })
      } catch {}
    } finally {
      loadingRef.current = false
      setLoading(false)
    }
  }, [])

  // ── Load more pages ───────────────────────────────────────────────────────
  const loadMore = useCallback(async () => {
    if (!hasMore || loadingRef.current || !isConnected()) return
    loadingRef.current = true
    setLoading(true)
    const nextPage = page + 1
    try {
      const data = await postService.getFeed(nextPage)
      if (data.length < 10) setHasMore(false)
      await cachePosts(data)
      setPosts((prev) => {
        const ids = new Set(prev.map((p) => p.id))
        return [...prev, ...data.filter((p) => !ids.has(p.id))]
      })
      setPage(nextPage)
    } catch {
      Toast.show({ type: 'error', text1: 'Sem ligação', text2: 'Não foi possível carregar mais posts.', visibilityTime: 2000 })
    } finally {
      loadingRef.current = false
      setLoading(false)
    }
  }, [hasMore, page])

  // ── Prepend (after publish) ───────────────────────────────────────────────
  const prependPost = useCallback(async (post: Post) => {
    setPosts((prev) => {
      if (prev.find((p) => p.id === post.id)) return prev
      return [post, ...prev]
    })
    await cachePosts([post]).catch(() => {})
  }, [])

  // ── Remove post (optimistic + queue delete) ───────────────────────────────
  const removePost = useCallback(async (postId: string) => {
    const snapshot = postsRef.current
    const target = snapshot.find((p) => p.id === postId)
    const originalPostId = target?.repostOfId ?? postId
    const deletingOriginal = !target?.repostOfId
    const related = snapshot.filter((p) => (p.repostOfId ?? p.id) === originalPostId)
    const removedIds = new Set(
      deletingOriginal ? [postId, ...related.map((p) => p.id)] : [postId],
    )
    // Apagar a própria cópia desfaz o repost. O -1 sai da publicação de onde
    // saiu o +1 — a que tem `userRepostedVia` — e não de um original adivinhado.
    const undoRepost = (p: Post): Post => (!p.userRepostedVia ? p : {
      ...p,
      userRepostedVia: false,
      _count: { ...p._count, reposts: Math.max(0, p._count.reposts - 1) },
    })

    setPosts((prev) => prev
      .filter((p) => !removedIds.has(p.id))
      .map((p) => !target?.repostOfId || (p.repostOfId ?? p.id) !== originalPostId ? p : undoRepost({
        ...p,
        userReposted: false,
        userRepostId: null,
      })))

    // O cache pode conter páginas já descarregadas da memória. Se o original
    // desaparecer, as suas cópias deixam de existir no servidor e saem juntas.
    const cached = await getCachedPosts().catch(() => [] as Post[])
    const cachedRemoved = deletingOriginal
      ? cached.filter((p) => (p.repostOfId ?? p.id) === originalPostId).map((p) => p.id)
      : [postId]
    await Promise.all([...new Set([...removedIds, ...cachedRemoved])]
      .map((id) => deleteCachedPost(id).catch(() => {})))

    if (target?.repostOfId) {
      related.forEach((p) => {
        if (p.id === postId) return
        patchCachedPostInteraction(p.id, {
          userReposted: false,
          userRepostId: null,
          ...(p.userRepostedVia && {
            userRepostedVia: false,
            _count: { ...p._count, reposts: Math.max(0, p._count.reposts - 1) },
          }),
        }).catch(() => {})
      })
    }

    if (!isConnected()) {
      await enqueueSyncOp('post', postId, 'delete', {}).catch(() => {})
      return
    }
    // Online path: queue if API fails (network error, 5xx, etc.)
    postService.deletePost(postId).catch(async () => {
      await enqueueSyncOp('post', postId, 'delete', {}).catch(() => {})
    })
  }, [])

  // ── Update caption (optimistic + queue update) ────────────────────────────
  const updatePost = useCallback(async (postId: string, caption: string) => {
    setPosts((prev) => prev.map((p) => p.id === postId ? { ...p, caption } : p))
    await updateCachedPost(postId, { caption }).catch(() => {})

    if (!isConnected()) {
      await enqueueSyncOp('post', postId, 'update', { caption }).catch(() => {})
      return
    }
    // Online path: queue if API fails (network error, 5xx, etc.)
    postService.updatePost(postId, caption).catch(async () => {
      await enqueueSyncOp('post', postId, 'update', { caption }).catch(() => {})
    })
  }, [])

  // ── Increment view counter (optimistic + persist to SQLite) ─────────────────
  const incrementView = useCallback((postId: string) => {
    setPosts((prev) => prev.map((p) => {
      if (p.id !== postId) return p
      const updated = { ...p, _count: { ...p._count, views: (p._count?.views ?? 0) + 1 } }
      updateCachedPost(postId, { _count: updated._count }).catch(() => {})
      return updated
    }))
  }, [])

  // ── Update like count in memory (called from ActionBar via FeedScreen) ───────
  const updatePostCounts = useCallback((postId: string, delta: Partial<Post['_count']>) => {
    setPosts((prev) => prev.map((p) =>
      p.id !== postId ? p : { ...p, _count: { ...p._count, ...delta } },
    ))
  }, [])

  // Duas coisas diferentes viajam neste resultado e não devem ser confundidas:
  //   · `userReposted` é do CONTEÚDO — vale para o original e para todas as
  //     cópias, e é o que impede repostar duas vezes o mesmo post;
  //   · o contador é da PUBLICAÇÃO tocada (`viaPostId`) — só ela recebe o +1.
  //
  // E uma coisa que isto NÃO faz: mexer na lista que está a ser lida. A cópia
  // criada pelo PUT é uma publicação real, mas fazê-la nascer no meio do pager
  // empurrava todas as células uma para baixo — o post no ecrã deslizava, a
  // FlatList reancorava, a viewability reportava outra célula e o post ativo
  // ia e voltava. Era esse ida-e-volta que se via a piscar e a saltar. A cópia
  // fica no cache e entra na feed na próxima sincronização, como qualquer
  // outra publicação nova. Repostar passa a ser só o que a pessoa pediu:
  // o botão acende e o contador sobe, sem lhe tirarem o post das mãos.
  const updateRepostState = useCallback((result: RepostResult) => {
    const {
      postId: originalPostId,
      viaPostId,
      viaCount,
      reposted,
      repostedPost,
      removedPostId,
    } = result
    const affected = postsRef.current.filter((p) => (p.repostOfId ?? p.id) === originalPostId)
    setPosts((prev) => {
      // Desfazer apaga a cópia no servidor: essa sim tem de sair da lista, se
      // por acaso já lá estiver (veio de uma sincronização anterior).
      const kept = removedPostId && prev.some((p) => p.id === removedPostId)
        ? prev.filter((p) => p.id !== removedPostId)
        : prev

      let touched = kept !== prev
      const next = kept.map((p) => {
        const inChain = (p.repostOfId ?? p.id) === originalPostId
        const isVia   = p.id === viaPostId
        if (!inChain && !isVia) return p
        touched = true
        return {
          ...p,
          ...(inChain && {
            userReposted: reposted,
            userRepostId: repostedPost?.id ?? (reposted ? p.userRepostId : null),
          }),
          ...(isVia && {
            userRepostedVia: reposted,
            _count: { ...p._count, reposts: viaCount ?? p._count.reposts },
          }),
        }
      })

      // Nada desta feed mudou (repostou-se um post aberto de fora, por
      // exemplo): devolver o mesmo array poupa um render de todas as células.
      return touched ? next : prev
    })

    affected.forEach((p) => {
      if (p.id === removedPostId) return
      patchCachedPostInteraction(p.id, {
        userReposted: reposted,
        userRepostId: repostedPost?.id ?? (reposted ? p.userRepostId : null),
        ...(p.id === viaPostId && {
          userRepostedVia: reposted,
          _count: { ...p._count, reposts: viaCount ?? p._count.reposts },
        }),
      }).catch(() => {})
    })
    if (repostedPost) cachePosts([repostedPost], 'synced').catch(() => {})
    if (removedPostId) deleteCachedPost(removedPostId).catch(() => {})
  }, [])

  // ── Purge expired posts from in-memory state every 30s ───────────────────
  useEffect(() => {
    const id = setInterval(() => {
      const now = Date.now()
      setPosts((prev) => prev.filter((p) => {
        if (!p.expiresAt || (p as any).isAnnouncement) return true
        return new Date(p.expiresAt).getTime() > now
      }))
    }, 30_000)
    return () => clearInterval(id)
  }, [])

  // ── Connectivity recovery: re-fetch if we come online after an empty load ─
  useEffect(() => {
    const unsub = onConnectivityChange((connected) => {
      if (connected) refresh()
    })
    return unsub
  }, [refresh])

  // ── Real-time: socket new posts ───────────────────────────────────────────
  useEffect(() => {
    const socket = getSocket()
    if (!socket) return
    function onNewPost(post: Post) { prependPost(post) }
    socket.on('post:new', onNewPost)
    return () => { socket.off('post:new', onNewPost) }
  }, [prependPost])

  return {
    posts, loading, loadMore, refresh, prependPost, removePost, updatePost,
    incrementView, updatePostCounts, updateRepostState,
  }
}
