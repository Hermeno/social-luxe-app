import { create } from 'zustand'

interface FriendsState {
  badge: number
  setBadge: (n: number) => void
  clearBadge: () => void
}

export const useFriendsStore = create<FriendsState>((set) => ({
  badge: 0,
  setBadge: (badge) => set({ badge }),
  clearBadge: () => set({ badge: 0 }),
}))
