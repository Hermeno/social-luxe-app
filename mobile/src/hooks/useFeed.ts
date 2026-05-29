import { useState, useCallback, useRef, useEffect } from 'react'
import { Post } from '../types'
import { syncFeed } from '../db/sync'
import { cachePosts } from '../db/database'
import * as postService from '../services/post.service'
import { getSocket } from '../socket'

export function useFeed() {
  const [posts, setPosts]     = useState<Post[]>([])
  const [loading, setLoading] = useState(false)
  const [page, setPage]       = useState(1)
  const [hasMore, setHasMore] = useState(true)

  // Refs — avoid stale closures in callbacks
  const initialised = useRef(false)
  const loadingRef  = useRef(false)   // single source of truth for "busy"

  // Stable reference — no deps, never goes stale
  const refresh = useCallback(async () => {
    if (loadingRef.current) return
    loadingRef.current = true
    setLoading(true)
    try {
      if (!initialised.current) {
        // First load: serve SQLite cache immediately, then update from API
        initialised.current = true
        const local = await syncFeed((fresh) => {
          setPosts(fresh)
          setPage(1)
          setHasMore(fresh.length >= 10)
        })
        if (local.length > 0) setPosts(local)
      } else {
        // Every subsequent focus: always hit network
        const data = await postService.getFeed(1)
        setPosts(data)
        setPage(1)
        setHasMore(data.length >= 10)
        await cachePosts(data)
      }
    } catch {}
    finally {
      loadingRef.current = false
      setLoading(false)
    }
  }, []) // ← stable forever — loadingRef prevents double calls

  // Force a full network refresh (used after publishing a new post)
  const forceRefresh = useCallback(async () => {
    if (loadingRef.current) return
    loadingRef.current = true
    setLoading(true)
    try {
      const data = await postService.getFeed(1)
      setPosts(data)
      setPage(1)
      setHasMore(data.length >= 10)
      await cachePosts(data)
    } catch {}
    finally {
      loadingRef.current = false
      setLoading(false)
    }
  }, [])

  const loadMore = useCallback(async () => {
    if (!hasMore || loadingRef.current) return
    loadingRef.current = true
    setLoading(true)
    const nextPage = page + 1
    try {
      const data = await postService.getFeed(nextPage)
      if (data.length < 10) setHasMore(false)
      setPosts((prev) => [...prev, ...data])
      setPage(nextPage)
      await cachePosts(data)
    } catch {}
    finally {
      loadingRef.current = false
      setLoading(false)
    }
  }, [hasMore, page])

  // Prepend a single post — used by socket listener and optimistic update
  const prependPost = useCallback((post: Post) => {
    setPosts((prev) => {
      if (prev.find((p) => p.id === post.id)) return prev
      return [post, ...prev]
    })
  }, [])

  // ── Real-time: listen for new posts pushed by the server ──────────────────
  useEffect(() => {
    const socket = getSocket()
    if (!socket) return

    function onNewPost(post: Post) {
      prependPost(post)
    }

    socket.on('post:new', onNewPost)
    return () => { socket.off('post:new', onNewPost) }
  }, [prependPost])

  return { posts, loading, loadMore, refresh, forceRefresh, prependPost }
}
