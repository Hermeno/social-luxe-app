import { create } from 'zustand'
import { Union, UnionInvite, UnionMessage } from '../types'
import { getCache, setCache } from '../db/database'

const CACHE_UNIONS  = 'union_my_unions'
const CACHE_INVITES = 'union_pending_invites'

interface UnionStore {
  myUnions:       Union[]
  pendingInvites: UnionInvite[]
  unreadCounts:   Record<string, number>
  hydrated:       boolean

  setMyUnions:       (unions: Union[]) => void
  addUnion:          (union: Union) => void
  removeUnion:       (id: string) => void
  updateUnion:       (union: Union) => void

  setPendingInvites: (invites: UnionInvite[]) => void
  addInvite:         (invite: UnionInvite) => void
  removeInvite:      (id: string) => void

  incrementUnread:   (key: string) => void
  clearUnread:       (key: string) => void
  totalUnreadCount:  () => number

  // Offline-first: load from cache then refresh from API
  hydrateFromCache:  () => Promise<void>
}

export const useUnionStore = create<UnionStore>((set, get) => ({
  myUnions:       [],
  pendingInvites: [],
  unreadCounts:   {},
  hydrated:       false,

  setMyUnions: (unions) => {
    set({ myUnions: unions })
    setCache(CACHE_UNIONS, unions).catch(() => {})
  },

  addUnion: (union) => {
    set((s) => {
      const next = [union, ...s.myUnions]
      setCache(CACHE_UNIONS, next).catch(() => {})
      return { myUnions: next }
    })
  },

  removeUnion: (id) => {
    set((s) => {
      const next = s.myUnions.filter((u) => u.id !== id)
      setCache(CACHE_UNIONS, next).catch(() => {})
      return { myUnions: next }
    })
  },

  updateUnion: (union) => {
    set((s) => {
      const next = s.myUnions.map((u) => u.id === union.id ? union : u)
      setCache(CACHE_UNIONS, next).catch(() => {})
      return { myUnions: next }
    })
  },

  setPendingInvites: (invites) => {
    set({ pendingInvites: invites })
    setCache(CACHE_INVITES, invites).catch(() => {})
  },

  addInvite: (invite) => {
    set((s) => {
      const next = [invite, ...s.pendingInvites.filter((i) => i.id !== invite.id)]
      setCache(CACHE_INVITES, next).catch(() => {})
      return { pendingInvites: next }
    })
  },

  removeInvite: (id) => {
    set((s) => {
      const next = s.pendingInvites.filter((i) => i.id !== id)
      setCache(CACHE_INVITES, next).catch(() => {})
      return { pendingInvites: next }
    })
  },

  incrementUnread: (key) => set((s) => ({
    unreadCounts: { ...s.unreadCounts, [key]: (s.unreadCounts[key] ?? 0) + 1 },
  })),

  clearUnread: (key) => set((s) => {
    const next = { ...s.unreadCounts }
    delete next[key]
    return { unreadCounts: next }
  }),

  totalUnreadCount: () => Object.values(get().unreadCounts).reduce((a, b) => a + b, 0),

  hydrateFromCache: async () => {
    if (get().hydrated) return
    const [unions, invites] = await Promise.all([
      getCache<Union[]>(CACHE_UNIONS).catch(() => null),
      getCache<UnionInvite[]>(CACHE_INVITES).catch(() => null),
    ])
    set({
      myUnions:       unions  ?? [],
      pendingInvites: invites ?? [],
      hydrated:       true,
    })
  },
}))
