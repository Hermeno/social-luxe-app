import { create } from 'zustand'
import { getCache, setCache } from '../db/database'
import { toggleFollow, getMyFollowing } from '../services/follow.service'
import type { FollowDuration } from '../services/follow.service'

// ── Types ─────────────────────────────────────────────────────────────────────

interface FollowStore {
  followingIds: Set<string>
  loaded:       boolean
  load:   ()                                          => Promise<void>
  syncAll: (ids: string[])                            => void
  toggle: (userId: string, duration?: FollowDuration) => Promise<boolean>
}

// ── Store ─────────────────────────────────────────────────────────────────────
// Single source of truth for "who the current user follows".
// All screens read from followingIds; any follow/unfollow goes through toggle().
// On any change every subscriber re-renders automatically (Zustand reactive).

export const useFollowStore = create<FollowStore>((set, get) => ({
  followingIds: new Set<string>(),
  loaded:       false,

  // Called once on app boot (authenticated).
  // Fast path: SQLite cache → immediate display.
  // Slow path: API refresh → update in background, persist to SQLite.
  load: async () => {
    try {
      const cached = await getCache<Array<{ id: string }>>('my_following')
      if (cached?.length) {
        set({ followingIds: new Set(cached.map((u) => u.id)), loaded: true })
      }
    } catch {}
    try {
      const fresh = await getMyFollowing()
      set({ followingIds: new Set(fresh.map((u) => u.id)), loaded: true })
      setCache('my_following', fresh).catch(() => {})
    } catch {}
  },

  // Replace the full set (e.g. after an explicit refresh).
  syncAll: (ids) => {
    set({ followingIds: new Set(ids), loaded: true })
  },

  // Optimistic toggle → API call → sync result → rollback on error.
  // Returns the new following state (true = now following).
  toggle: async (userId, duration) => {
    const wasFollowing = get().followingIds.has(userId)

    set((s) => {
      const next = new Set(s.followingIds)
      wasFollowing ? next.delete(userId) : next.add(userId)
      return { followingIds: next }
    })

    try {
      const res = await toggleFollow(userId, duration)
      set((s) => {
        const next = new Set(s.followingIds)
        res.following ? next.add(userId) : next.delete(userId)
        return { followingIds: next }
      })
      // Persist current state to SQLite (fire-and-forget)
      const current = get().followingIds
      setCache('my_following', [...current].map((id) => ({ id }))).catch(() => {})
      return res.following
    } catch (e) {
      // Rollback to original state
      set((s) => {
        const next = new Set(s.followingIds)
        wasFollowing ? next.add(userId) : next.delete(userId)
        return { followingIds: next }
      })
      throw e
    }
  },
}))
