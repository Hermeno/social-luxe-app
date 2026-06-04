import { create } from 'zustand'

interface OnlineState {
  onlineUsers: string[]
  setOnline: (userId: string) => void
  setOffline: (userId: string) => void
  isOnline: (userId: string) => boolean
  reset: () => void
}

export const useOnlineStore = create<OnlineState>((set, get) => ({
  onlineUsers: [],

  setOnline: (userId) =>
    set((state) => ({
      onlineUsers: state.onlineUsers.includes(userId)
        ? state.onlineUsers
        : [...state.onlineUsers, userId],
    })),

  setOffline: (userId) =>
    set((state) => ({
      onlineUsers: state.onlineUsers.filter((id) => id !== userId),
    })),

  isOnline: (userId) => get().onlineUsers.includes(userId),
  reset: () => set({ onlineUsers: [] }),
}))
