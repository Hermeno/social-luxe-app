import { Post } from '../types'
import * as postService from '../services/post.service'
import {
  cachePosts,
  getCachedPosts,
  clearStaleCache,
  getPendingLikes,
  removePendingLike,
} from './database'
import { evictStaleMedia } from './mediaCache'

/**
 * Returns cached posts immediately, then fetches from API and updates cache.
 * Calls onRefresh with fresh data once the network request completes.
 */
export async function syncFeed(onRefresh: (posts: Post[]) => void): Promise<Post[]> {
  // Clean stale posts (>24h old) AND posts with old /uploads/ URLs (pre-Cloudinary)
  await clearStaleCache()

  // Evict media files older than 7 days (runs in background, doesn't block)
  evictStaleMedia().catch(() => {})

  // Flush any pending offline likes first
  flushPendingLikes().catch(() => {})

  const cached = await getCachedPosts()

  // Trigger background network refresh
  ;(async () => {
    try {
      const fresh = await postService.getFeed(1)
      await cachePosts(fresh)
      onRefresh(fresh)
    } catch {}
  })()

  return cached
}

async function flushPendingLikes() {
  const pending = await getPendingLikes()
  await Promise.all(
    pending.map(async ({ postId }) => {
      try {
        await postService.likePost(postId)
        await removePendingLike(postId)
      } catch {}
    }),
  )
}
