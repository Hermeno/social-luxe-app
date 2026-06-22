/**
 * useFeed — Offline-first feed hook
 *
 * Read path:  SQLite → UI (instant, no network wait)
 * Write path: UI update → SQLite → sync_queue → API (when online)
 * Sync:       Background sync updates SQLite, then calls setState
 */

import { useState, useCallback, useRef, useEffect } from 'react'
import Toast from 'react-native-toast-message'
import { Post } from '../types'
import { syncFeed, forceSyncFeed } from '../db/sync'
import { onConnectivityChange } from '../services/netinfo.service'
import {
  cachePosts,
  getCachedPosts,
  updateCachedPost,
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
    setPosts((prev) => prev.filter((p) => p.id !== postId))
    await deleteCachedPost(postId).catch(() => {})

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

  return { posts, loading, loadMore, refresh, prependPost, removePost, updatePost, incrementView, updatePostCounts }
}
