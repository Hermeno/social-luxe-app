import { getCache, setCache } from '../db/database'

const SAVED_POSTS_CACHE_PREFIX = 'saved_post_ids'

const savedPostIdsByUser = new Map<string, Set<string>>()
const loadingByUser = new Map<string, Promise<Set<string>>>()
const mutationQueueByUser = new Map<string, Promise<void>>()

function cacheKey(userId: string): string {
  return `${SAVED_POSTS_CACHE_PREFIX}:${userId}`
}

function normalizePostIds(value: unknown): Set<string> {
  if (!Array.isArray(value)) return new Set()

  return new Set(
    value.filter((postId): postId is string => typeof postId === 'string' && postId.length > 0),
  )
}

async function getSavedPostIds(userId: string): Promise<Set<string>> {
  const current = savedPostIdsByUser.get(userId)
  if (current) return current

  const pending = loadingByUser.get(userId)
  if (pending) return pending

  const load = getCache<string[]>(cacheKey(userId))
    .then((cached) => {
      const postIds = normalizePostIds(cached)
      savedPostIdsByUser.set(userId, postIds)
      return postIds
    })
    .finally(() => {
      loadingByUser.delete(userId)
    })

  loadingByUser.set(userId, load)
  return load
}

function enqueueMutation<T>(userId: string, mutation: () => Promise<T>): Promise<T> {
  const previous = mutationQueueByUser.get(userId) ?? Promise.resolve()
  const result = previous.catch(() => undefined).then(mutation)
  const queueTail = result.then(() => undefined, () => undefined)

  mutationQueueByUser.set(userId, queueTail)
  queueTail.finally(() => {
    if (mutationQueueByUser.get(userId) === queueTail) {
      mutationQueueByUser.delete(userId)
    }
  })

  return result
}

/** Returns whether a post is saved in the current user's local collection. */
export async function isPostSaved(userId: string, postId: string): Promise<boolean> {
  if (!userId || !postId) return false

  // Observe only settled mutations so a failed optimistic write is not exposed
  // as persisted state to a new caller.
  await mutationQueueByUser.get(userId)
  return (await getSavedPostIds(userId)).has(postId)
}

/** Toggles a locally saved post and returns its new saved state. */
export function toggleSavedPost(userId: string, postId: string): Promise<boolean> {
  if (!userId || !postId) return Promise.resolve(false)

  return enqueueMutation(userId, async () => {
    const postIds = await getSavedPostIds(userId)
    const wasSaved = postIds.has(postId)

    if (wasSaved) postIds.delete(postId)
    else postIds.add(postId)

    try {
      await setCache(cacheKey(userId), Array.from(postIds))
      return !wasSaved
    } catch (error) {
      // The in-memory set is shared by readers; restore it when persistence
      // fails so UI state and the on-device cache cannot drift apart.
      if (wasSaved) postIds.add(postId)
      else postIds.delete(postId)
      throw error
    }
  })
}
