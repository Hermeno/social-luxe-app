import { useState, useCallback, useRef } from 'react'
import { Post } from '../types'
import { syncFeed } from '../db/sync'
import { cachePosts } from '../db/database'
import * as postService from '../services/post.service'

export function useFeed() {
  const [posts, setPosts] = useState<Post[]>([])
  const [loading, setLoading] = useState(false)
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(true)
  const initialised = useRef(false)

  const refresh = useCallback(async () => {
    if (loading) return
    setLoading(true)
    try {
      if (!initialised.current) {
        // First load: serve SQLite cache instantly, then update in background
        initialised.current = true
        const local = await syncFeed((fresh) => {
          setPosts(fresh)
          setPage(1)
          setHasMore(fresh.length >= 10)
        })
        if (local.length > 0) setPosts(local)
      } else {
        // Subsequent refreshes: always hit network
        const data = await postService.getFeed(1)
        setPosts(data)
        setPage(1)
        setHasMore(data.length >= 10)
        await cachePosts(data)
      }
    } catch {}
    finally { setLoading(false) }
  }, [loading])

  const loadMore = useCallback(async () => {
    if (!hasMore || loading) return
    setLoading(true)
    const nextPage = page + 1
    try {
      const data = await postService.getFeed(nextPage)
      if (data.length < 10) setHasMore(false)
      setPosts((prev) => [...prev, ...data])
      setPage(nextPage)
      await cachePosts(data)
    } catch {}
    finally { setLoading(false) }
  }, [hasMore, loading, page])

  return { posts, loading, loadMore, refresh }
}
