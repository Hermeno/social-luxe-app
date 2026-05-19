import { useState, useCallback } from 'react'
import { Post } from '../types'
import * as postService from '../services/post.service'

export function useFeed() {
  const [posts, setPosts] = useState<Post[]>([])
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(false)
  const [hasMore, setHasMore] = useState(true)

  const load = useCallback(async (pageNum: number, reset = false) => {
    if (loading) return
    setLoading(true)
    try {
      const data = await postService.getFeed(pageNum)
      if (data.length < 10) setHasMore(false)
      setPosts((prev) => reset ? data : [...prev, ...data])
      setPage(pageNum)
    } catch {}
    finally { setLoading(false) }
  }, [loading])

  const loadMore = useCallback(() => {
    if (hasMore && !loading) load(page + 1)
  }, [hasMore, loading, page, load])

  const refresh = useCallback(() => {
    setHasMore(true)
    load(1, true)
  }, [load])

  return { posts, loading, loadMore, refresh }
}
