import { create } from 'zustand'
import { getCache, setCache, cacheConnections } from '../db/database'
import { toggleFollow, getMyFollowing } from '../services/follow.service'
import type { FollowDuration } from '../services/follow.service'
import type { Connection } from '../types'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface FollowProfile {
  name:   string
  avatar: string | null
}

interface FollowStore {
  followingIds: Set<string>
  loaded:       boolean
  load:    ()                                                                              => Promise<void>
  syncAll: (ids: string[])                                                                 => void
  toggle:  (userId: string, duration?: FollowDuration, profile?: FollowProfile)           => Promise<boolean>
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
  // Pass `profile` when you have the user's name/avatar (e.g. from search/profile)
  // so the chat feed can show them immediately without waiting for an API sync.
  toggle: async (userId, duration, profile) => {
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

      // When following: persist the connection so the chat feed shows it immediately,
      // even if the screen is not currently loaded or the API times out later.
      if (res.following && profile?.name) {
        const conn: Connection = {
          user:        { id: userId, name: profile.name, avatar: profile.avatar },
          lastMessage: null,
          unreadCount: 0,
          postIds:     [],
        }
        cacheConnections([conn]).catch(() => {})
      }

      // Do NOT persist followingIds as bare { id } objects — that would destroy
      // the name/avatar data that load() saved.  Cache is refreshed by load() only.
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
