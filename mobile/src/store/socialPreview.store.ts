import { create } from 'zustand'

import { getCache, setCache } from '../db/database'
import { getMyFollowers, getMyFollowing } from '../services/follow.service'

export interface SocialPreviewUser {
  id: string
  name: string
  avatar: string | null
}

interface SocialPreviewState {
  followers: SocialPreviewUser[]
  following: SocialPreviewUser[]
  ownerId: string | null
  loaded: boolean
  loading: boolean
  load: (ownerId: string) => Promise<void>
  refresh: (ownerId?: string) => Promise<void>
  rememberFollowing: (user: SocialPreviewUser) => void
  removeFollowing: (userId: string) => void
  retainFollowing: (userIds: string[]) => void
  reset: () => void
}

const cacheKey = (kind: 'followers' | 'following', ownerId: string) =>
  `social_preview_${kind}:${ownerId}`

function compact(users: SocialPreviewUser[]): SocialPreviewUser[] {
  const seen = new Set<string>()
  return users.filter((user) => {
    if (!user?.id || seen.has(user.id)) return false
    seen.add(user.id)
    return true
  }).slice(0, 12)
}

/** Small, cache-first relationship preview used by persistent navigation. */
export const useSocialPreviewStore = create<SocialPreviewState>((set, get) => {
  // ownerId alone is not enough for A -> B -> A: every async run gets a
  // monotonic generation so an older A response cannot become current again.
  let loadGeneration = 0
  let followingMutationVersion = 0

  const persistFollowing = (ownerId: string, following: SocialPreviewUser[]) => {
    setCache(cacheKey('following', ownerId), following).catch(() => {})
  }

  const runLoad = async (ownerId: string, force: boolean) => {
    if (!ownerId) return

    const previous = get()
    if (!force && previous.ownerId === ownerId && (previous.loaded || previous.loading)) return

    const ownerChanged = previous.ownerId !== ownerId
    const generation = ++loadGeneration
    if (ownerChanged) followingMutationVersion += 1
    const mutationVersionAtStart = followingMutationVersion

    set({
      followers: ownerChanged ? [] : previous.followers,
      following: ownerChanged ? [] : previous.following,
      ownerId,
      loaded: false,
      loading: true,
    })

    // Cache is useful only when entering an owner. During refresh, the current
    // in-memory value may include a newer optimistic mutation than SQLite.
    if (ownerChanged) {
      const [cachedFollowers, cachedFollowing] = await Promise.all([
        getCache<SocialPreviewUser[]>(cacheKey('followers', ownerId)).catch(() => null),
        getCache<SocialPreviewUser[]>(cacheKey('following', ownerId)).catch(() => null),
      ])
      if (generation !== loadGeneration || get().ownerId !== ownerId) return

      set({
        followers: compact(cachedFollowers ?? []),
        following: followingMutationVersion === mutationVersionAtStart
          ? compact(cachedFollowing ?? [])
          : get().following,
      })
    }

    const [followersResult, followingResult] = await Promise.allSettled([
      getMyFollowers(),
      getMyFollowing(),
    ])
    if (generation !== loadGeneration || get().ownerId !== ownerId) return

    const current = get()
    const followers = followersResult.status === 'fulfilled'
      ? compact(followersResult.value)
      : current.followers
    const canApplyFollowing = followingResult.status === 'fulfilled'
      && followingMutationVersion === mutationVersionAtStart
    const following = canApplyFollowing
      ? compact(followingResult.value)
      : current.following
    const loaded = followersResult.status === 'fulfilled'
      || followingResult.status === 'fulfilled'

    set({ followers, following, loaded, loading: false })

    const writes: Promise<void>[] = []
    if (followersResult.status === 'fulfilled') {
      writes.push(setCache(cacheKey('followers', ownerId), followers))
    }
    if (canApplyFollowing) {
      writes.push(setCache(cacheKey('following', ownerId), following))
    }
    Promise.all(writes).catch(() => {})
  }

  return {
    followers: [],
    following: [],
    ownerId: null,
    loaded: false,
    loading: false,

    load: (ownerId) => runLoad(ownerId, false),
    refresh: (ownerId) => runLoad(ownerId ?? get().ownerId ?? '', true),

    rememberFollowing: (user) => {
      const ownerId = get().ownerId
      if (!ownerId || !user?.id) return
      followingMutationVersion += 1
      const following = compact([user, ...get().following.filter((item) => item.id !== user.id)])
      set({ following })
      persistFollowing(ownerId, following)
    },

    removeFollowing: (userId) => {
      const ownerId = get().ownerId
      if (!ownerId) return
      followingMutationVersion += 1
      const following = get().following.filter((user) => user.id !== userId)
      set({ following })
      persistFollowing(ownerId, following)
    },

    retainFollowing: (userIds) => {
      const ownerId = get().ownerId
      if (!ownerId) return
      followingMutationVersion += 1
      const allowed = new Set(userIds)
      const following = get().following.filter((user) => allowed.has(user.id))
      set({ following })
      persistFollowing(ownerId, following)
    },

    reset: () => {
      loadGeneration += 1
      followingMutationVersion += 1
      set({
        followers: [],
        following: [],
        ownerId: null,
        loaded: false,
        loading: false,
      })
    },
  }
})
