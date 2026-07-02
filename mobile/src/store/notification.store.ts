import { create } from 'zustand'

export interface AppNotification {
  id: string
  type: 'like' | 'comment' | 'reaction' | 'message' | 'coin' | 'extend_vote' | 'union_invite'
  message: string
  read: boolean
  createdAt: string
}

interface NotificationState {
  notifications: AppNotification[]
  badge: number
  unionInviteBadge: number
  addNotification: (n: AppNotification) => void
  markAllRead: () => void
  setUnionInviteBadge: (count: number) => void
  reset: () => void
}

export const useNotificationStore = create<NotificationState>((set) => ({
  notifications: [],
  badge: 0,
  unionInviteBadge: 0,

  addNotification: (n) =>
    set((state) => ({
      notifications: [n, ...state.notifications],
      badge: state.badge + 1,
    })),

  markAllRead: () =>
    set((state) => ({
      notifications: state.notifications.map((n) => ({ ...n, read: true })),
      badge: 0,
    })),

  setUnionInviteBadge: (count) => set({ unionInviteBadge: count }),

  reset: () => set({ notifications: [], badge: 0, unionInviteBadge: 0 }),
}))
