/**
 * Sync layer — SQLite ↔ API
 *
 * Principles:
 * - Always serve from SQLite first (zero latency for UI)
 * - Network requests run in background, never block rendering
 * - Incremental sync: only fetch records changed since last_sync
 * - All mutations (like, delete, update) go to SQLite immediately + sync_queue
 */

import { Post } from '../types'
import * as postService from '../services/post.service'
import {
  cachePosts,
  getCachedPosts,
  clearStaleCache,
  purgeSyncedDeletes,
  getSyncMeta,
  setSyncMeta,
  getPendingLocalPostIds,
} from './database'
import { evictStaleMedia } from './mediaCache'
import { processQueue } from './syncQueue'
import { isConnected } from '../services/netinfo.service'

// ── Feed sync ─────────────────────────────────────────────────────────────────

/**
 * Returns cached posts immediately, then triggers incremental background sync.
 * onRefresh is called with merged posts once the network request completes.
 */
export async function syncFeed(onRefresh: (posts: Post[]) => void): Promise<Post[]> {
  // 1. Housekeeping (non-blocking)
  clearStaleCache().catch(() => {})
  purgeSyncedDeletes().catch(() => {})
  evictStaleMedia().catch(() => {})

  // 2. Serve from SQLite immediately
  const cached = await getCachedPosts()

  // 3. Background sync — only if connected
  if (isConnected()) {
    backgroundSyncFeed(onRefresh).catch(() => {})
  }

  return cached
}

async function backgroundSyncFeed(onRefresh: (posts: Post[]) => void): Promise<void> {
  try {
    // Flush any pending offline operations first
    await processQueue()

    const fresh = await postService.getFeed(1)
    if (fresh.length === 0) return

    // Query SQLite directly for pending/updated IDs — Post JSON never has _syncStatus
    const pendingIds = await getPendingLocalPostIds()

    // Cache only the posts that are NOT locally pending (don't overwrite unsync'd edits)
    const toCache = fresh.filter((p) => !pendingIds.has(p.id))
    await cachePosts(toCache, 'synced')
    await setSyncMeta('feed_last_sync', Date.now().toString())

    // Merge for UI: local pending posts + fresh non-pending posts
    const localPosts = await getCachedPosts()
    const merged: Post[] = [
      ...localPosts.filter((p) => pendingIds.has(p.id)),
      ...fresh.filter((p) => !pendingIds.has(p.id)),
    ]

    // Deduplicate by id
    const seen = new Map<string, Post>()
    for (const p of merged) seen.set(p.id, p)
    const deduped = Array.from(seen.values())

    console.log(`[Sync] Feed updated: ${fresh.length} posts from API`)
    onRefresh(deduped)
  } catch (err) {
    console.log('[Sync] Background feed sync failed:', err)
  }
}

// ── Manual force-refresh (e.g. pull-to-refresh) ───────────────────────────────

export async function forceSyncFeed(): Promise<Post[]> {
  if (!isConnected()) {
    console.log('[Sync] Offline — returning cache')
    return getCachedPosts()
  }
  await processQueue()
  const fresh = await postService.getFeed(1)
  await cachePosts(fresh, 'synced')
  await setSyncMeta('feed_last_sync', Date.now().toString())
  return fresh
}
