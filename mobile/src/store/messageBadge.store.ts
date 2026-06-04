import { create } from 'zustand'

interface State {
  totalUnread: number
  setTotalUnread: (n: number) => void
  increment: () => void
  clearConversation: (count: number) => void
}

export const useMessageBadgeStore = create<State>((set) => ({
  totalUnread: 0,
  setTotalUnread: (n) => set({ totalUnread: Math.max(0, n) }),
  increment:      ()  => set((s) => ({ totalUnread: s.totalUnread + 1 })),
  clearConversation: (count) => set((s) => ({ totalUnread: Math.max(0, s.totalUnread - count) })),
}))
