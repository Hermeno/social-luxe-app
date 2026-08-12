import { create } from 'zustand'
import { getCache, setCache, cacheConnections, enqueueSyncOp } from '../db/database'
import { toggleFollow, getMyFollowing } from '../services/follow.service'
import type { FollowDuration } from '../services/follow.service'
import type { Connection } from '../types'
import { useSocialPreviewStore } from './socialPreview.store'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface FollowProfile {
  name:   string
  avatar: string | null
}

interface FollowStore {
  followingIds: Set<string>
  loaded:       boolean
  ownerId:      string | null
  load:    ()                                                                              => Promise<void>
  syncAll: (ids: string[])                                                                 => void
  getRevision: ()                                                                           => number
  isRevisionCurrent: (observedRevision: number)                                              => boolean
  reconcileSnapshot: (ids: string[], observedRevision: number)                              => void
  reconcileOne: (userId: string, following: boolean, observedRevision: number)              => void
  toggle:  (userId: string, duration?: FollowDuration, profile?: FollowProfile)           => Promise<boolean>
  reset:   (ownerId?: string | null)                                                       => void
}

// ── Store ─────────────────────────────────────────────────────────────────────
// Single source of truth for "who the current user follows".
// All screens read from followingIds; any follow/unfollow goes through toggle().
// On any change every subscriber re-renders automatically (Zustand reactive).

export const useFollowStore = create<FollowStore>((set, get) => {
  let sessionGeneration = 0
  let loadGeneration = 0
  let mutationVersion = 0
  const localDecisions = new Map<string, boolean>()
  const toggleVersions = new Map<string, number>()
  const pendingUserIds = new Set<string>()

  return {
    followingIds: new Set<string>(),
    loaded:       false,
    ownerId:      null,

    // Called once on app boot (authenticated).
    // Fast path: SQLite cache → immediate display.
    // Slow path: API refresh → update in background, persist to SQLite.
    load: async () => {
      const ownerId = get().ownerId
      const sessionAtStart = sessionGeneration
      const generation = ++loadGeneration

      // Never show IDs left in memory by a previous account while cache/API load.
      set({ followingIds: new Set<string>(), loaded: false })
      if (!ownerId) return

      try {
        const cached = await getCache<Array<{ id: string }>>('my_following')
        if (
          sessionAtStart !== sessionGeneration
          || generation !== loadGeneration
          || get().ownerId !== ownerId
        ) return
        // [] is a valid cached result and must still mark the cache as loaded.
        if (cached !== null) {
          const next = new Set(cached.map((user) => user.id))
          localDecisions.forEach((following, userId) => {
            following ? next.add(userId) : next.delete(userId)
          })
          set({ followingIds: next, loaded: true })
        }
      } catch {}

      try {
        const fresh = await getMyFollowing()
        if (
          sessionAtStart !== sessionGeneration
          || generation !== loadGeneration
          || get().ownerId !== ownerId
        ) return

        const next = new Set(fresh.map((user) => user.id))
        localDecisions.forEach((following, userId) => {
          following ? next.add(userId) : next.delete(userId)
        })
        set({ followingIds: next, loaded: true })

        // Preserve rich API objects and only remove locally-unfollowed profiles;
        // locally-followed IDs without a profile are deliberately not invented.
        const cacheValue = fresh.filter((user) => localDecisions.get(user.id) !== false)
        setCache('my_following', cacheValue).catch(() => {})
      } catch {}
    },

    // Replace the full set (e.g. after an explicit refresh).
    syncAll: (ids) => {
      if (!get().ownerId) return
      loadGeneration += 1
      mutationVersion += 1
      localDecisions.clear()
      toggleVersions.clear()
      const uniqueIds = [...new Set(ids)]
      set({ followingIds: new Set(uniqueIds), loaded: true })
      // Reconcile only profiles already known by the preview; never fabricate
      // a name/avatar from a bare relationship ID.
      useSocialPreviewStore.getState().retainFollowing(uniqueIds)
    },

    // Revision captured before a server read. Toggle start and settlement each
    // advance it, so consumers can detect both mutations that begin during a
    // read and mutations that were pending when that read began.
    getRevision: () => mutationVersion,

    isRevisionCurrent: (observedRevision) => (
      mutationVersion === observedRevision && pendingUserIds.size === 0
    ),

    reconcileSnapshot: (ids, observedRevision) => {
      if (!get().ownerId) return
      const next = new Set(ids)
      const current = get().followingIds

      toggleVersions.forEach((version, userId) => {
        if (version <= observedRevision && !pendingUserIds.has(userId)) return
        current.has(userId) ? next.add(userId) : next.delete(userId)
      })

      set({ followingIds: next, loaded: true })
      useSocialPreviewStore.getState().retainFollowing([...next])
    },

    reconcileOne: (userId, following, observedRevision) => {
      if (!get().ownerId) return
      const latestMutation = toggleVersions.get(userId) ?? 0
      if (pendingUserIds.has(userId) || latestMutation > observedRevision) return

      localDecisions.set(userId, following)
      set((state) => {
        const next = new Set(state.followingIds)
        following ? next.add(userId) : next.delete(userId)
        return { followingIds: next }
      })
      if (!following) useSocialPreviewStore.getState().removeFollowing(userId)
    },

    // Optimistic toggle → API call → sync result → rollback on error.
    // Returns the new following state (true = now following).
    // Pass `profile` when you have the user's name/avatar (e.g. from search/profile)
    // so the chat feed can show them immediately without waiting for an API sync.
    toggle: async (userId, duration, profile) => {
      // One request per relationship at a time. A second tap observes the
      // optimistic state instead of sending an out-of-order server toggle.
      if (pendingUserIds.has(userId)) return get().followingIds.has(userId)

      const ownerId = get().ownerId
      const sessionAtStart = sessionGeneration
      const wasFollowing = get().followingIds.has(userId)
      const optimisticFollowing = !wasFollowing
      const operationVersion = ++mutationVersion
      pendingUserIds.add(userId)
      localDecisions.set(userId, optimisticFollowing)
      toggleVersions.set(userId, operationVersion)

      set((s) => {
        const next = new Set(s.followingIds)
        optimisticFollowing ? next.add(userId) : next.delete(userId)
        return { followingIds: next }
      })

      try {
        const res = await toggleFollow(userId, duration)
        const isCurrent = sessionAtStart === sessionGeneration
          && get().ownerId === ownerId
          && toggleVersions.get(userId) === operationVersion
        if (!isCurrent) return res.following

        localDecisions.set(userId, res.following)
        set((s) => {
          const next = new Set(s.followingIds)
          res.following ? next.add(userId) : next.delete(userId)
          return { followingIds: next }
        })

        if (res.following && profile?.name) {
          useSocialPreviewStore.getState().rememberFollowing({
            id: userId,
            name: profile.name,
            avatar: profile.avatar,
          })
        } else if (!res.following) {
          useSocialPreviewStore.getState().removeFollowing(userId)
        }

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
        // the name/avatar data that load() saved. Cache is refreshed by load() only.
        return res.following
      } catch (error) {
        const isCurrent = sessionAtStart === sessionGeneration
          && get().ownerId === ownerId
          && toggleVersions.get(userId) === operationVersion
        // Erro de cliente (404, 403…) é uma recusa real do servidor: desfaz.
        // Falha de rede não é recusa nenhuma — guarda a intenção na fila e
        // mantém o estado otimista, senão a pessoa vê o "Seguir" a saltar para
        // trás só porque estava sem rede.
        const status: number | undefined = (error as any)?.response?.status
        const serverRefused = typeof status === 'number' && status >= 400 && status < 500

        if (!serverRefused) {
          enqueueSyncOp('follow', userId, 'update', {
            following: optimisticFollowing,
            duration,
          }).catch(() => {})
          return optimisticFollowing
        }

        if (isCurrent) {
          localDecisions.set(userId, wasFollowing)
          set((s) => {
            const next = new Set(s.followingIds)
            wasFollowing ? next.add(userId) : next.delete(userId)
            return { followingIds: next }
          })
        }
        throw error
      } finally {
        // Finishing a toggle is itself a state transition. A server read can
        // start after the optimistic mutation (and therefore observe its start
        // revision) while the POST is still pending, then return a stale
        // snapshot after the POST settles. Give the settlement a newer revision
        // before clearing `pending`, so that read cannot be mistaken for current.
        //
        // Only the operation that still owns this user ID may publish the
        // settlement. A reset/sync may have invalidated it in the meantime.
        const stillOwnsMutation = (
          sessionAtStart === sessionGeneration
          && get().ownerId === ownerId
          && toggleVersions.get(userId) === operationVersion
        )
        if (stillOwnsMutation) {
          const settlementVersion = ++mutationVersion
          toggleVersions.set(userId, settlementVersion)
        }
        // `syncAll` may deliberately invalidate `toggleVersions` without
        // changing the authenticated session. The old request still owns the
        // pending lock in that case and must release it when it finishes.
        if (sessionAtStart === sessionGeneration) {
          pendingUserIds.delete(userId)
        }
      }
    },

    reset: (ownerId = null) => {
      sessionGeneration += 1
      loadGeneration += 1
      mutationVersion += 1
      localDecisions.clear()
      toggleVersions.clear()
      pendingUserIds.clear()
      set({ followingIds: new Set<string>(), loaded: false, ownerId })
    },
  }
})
