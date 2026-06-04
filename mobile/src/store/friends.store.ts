import { create } from 'zustand'

interface FriendsState {
  newFollowersBadge: number
  lastSeenFollowerCount: number
  setFollowerCount: (current: number) => void
  clearBadge: () => void
  reset: () => void
}

export const useFriendsStore = create<FriendsState>((set, get) => ({
  newFollowersBadge: 0,
  lastSeenFollowerCount: 0,
  setFollowerCount: (current) => {
    const { lastSeenFollowerCount } = get()
    const diff = Math.max(0, current - lastSeenFollowerCount)
    set({ newFollowersBadge: diff })
  },
  clearBadge: () =>
    set((s) => ({ newFollowersBadge: 0, lastSeenFollowerCount: s.lastSeenFollowerCount + s.newFollowersBadge })),
  reset: () => set({ newFollowersBadge: 0, lastSeenFollowerCount: 0 }),
}))
