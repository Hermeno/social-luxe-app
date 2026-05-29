/**
 * Media Cache — downloads Cloudinary files to device storage.
 *
 * Flow:
 *   1. Check SQLite for a previously downloaded local path
 *   2. If found AND file still exists on disk → return local path immediately
 *   3. If not → return null (caller streams from remote) + trigger background download
 *   4. Call `onCached(localPath)` when download completes so caller can switch
 *
 * Videos stream from Cloudinary on first play, then use local on all subsequent plays.
 * Images use expo-image disk cache (handled transparently by the component).
 */

import * as FileSystem from 'expo-file-system'
import {
  getMediaCacheEntry,
  saveMediaCacheEntry,
  deleteMediaCacheEntry,
  getStaleMediaEntries,
  clearAllMediaCache,
} from './database'

const CACHE_DIR = `${FileSystem.cacheDirectory}luxe_media/`
const MAX_CACHE_AGE_MS = 7 * 24 * 60 * 60 * 1000 // 7 days
const MAX_CACHE_BYTES  = 500 * 1024 * 1024         // 500 MB soft limit

// In-flight downloads — prevent duplicate requests for the same URL
const inFlight = new Map<string, Promise<string | null>>()

async function ensureDir(): Promise<void> {
  const info = await FileSystem.getInfoAsync(CACHE_DIR)
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(CACHE_DIR, { intermediates: true })
  }
}

function urlToLocalPath(url: string): string {
  try {
    const u = new URL(url)
    // Use last two path segments for uniqueness: e.g. luxe_posts_abc123.mp4
    const segs  = u.pathname.split('/').filter(Boolean)
    const fname = segs.slice(-2).join('_')
    return CACHE_DIR + fname
  } catch {
    const hash = Math.abs(url.split('').reduce((a, c) => ((a << 5) - a + c.charCodeAt(0)) | 0, 0))
    return CACHE_DIR + hash
  }
}

/**
 * Try to get a locally cached path.
 * If not cached, kick off a background download.
 * `onCached` is called when the download finishes.
 *
 * Returns the local path if already cached, null otherwise.
 */
export async function getOrDownload(
  remoteUrl: string,
  onCached?: (localPath: string) => void,
): Promise<string | null> {
  if (!remoteUrl || !remoteUrl.startsWith('http')) return null

  await ensureDir()

  // Check DB
  const cached = await getMediaCacheEntry(remoteUrl)
  if (cached) {
    const info = await FileSystem.getInfoAsync(cached)
    if (info.exists) return cached
    // File deleted from disk but record still in DB
    await deleteMediaCacheEntry(remoteUrl)
  }

  // Avoid duplicate in-flight downloads
  if (inFlight.has(remoteUrl)) {
    inFlight.get(remoteUrl)!.then((p) => { if (p) onCached?.(p) })
    return null
  }

  const promise = (async (): Promise<string | null> => {
    try {
      const localPath = urlToLocalPath(remoteUrl)
      const result    = await FileSystem.downloadAsync(remoteUrl, localPath)
      const info      = await FileSystem.getInfoAsync(result.uri)
      const size      = (info as any).size ?? 0
      await saveMediaCacheEntry(remoteUrl, result.uri, size)
      onCached?.(result.uri)
      return result.uri
    } catch {
      return null
    } finally {
      inFlight.delete(remoteUrl)
    }
  })()

  inFlight.set(remoteUrl, promise)
  return null // caller streams while download runs
}

/**
 * Pre-download a batch of URLs in parallel (fire-and-forget).
 * Used to prefetch the next 2-3 posts before the user scrolls to them.
 */
export function prefetchMedia(urls: string[]): void {
  urls.forEach((url) => {
    if (!url || !url.startsWith('http')) return
    getOrDownload(url).catch(() => {})
  })
}

/**
 * Delete media files older than MAX_CACHE_AGE_MS and remove DB records.
 * Call this once on app start (from syncFeed / RootNavigator).
 */
export async function evictStaleMedia(): Promise<void> {
  try {
    const stale = await getStaleMediaEntries(MAX_CACHE_AGE_MS)
    await Promise.allSettled(
      stale.map(async ({ local_path }) => {
        await FileSystem.deleteAsync(local_path, { idempotent: true })
      }),
    )
    // Remove DB records (clearStaleCache handles posts; here we handle media)
    for (const { url } of stale) {
      await deleteMediaCacheEntry(url)
    }
  } catch {}
}

/**
 * Wipe ALL downloaded media (e.g. on logout).
 */
export async function nukeMediaCache(): Promise<void> {
  try {
    await clearAllMediaCache()
    const info = await FileSystem.getInfoAsync(CACHE_DIR)
    if (info.exists) await FileSystem.deleteAsync(CACHE_DIR, { idempotent: true })
  } catch {}
}
