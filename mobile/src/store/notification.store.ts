import { create } from 'zustand'

export interface AppNotification {
  id: string
  type: 'like' | 'comment' | 'reaction' | 'message' | 'coin' | 'extend_vote'
  message: string
  read: boolean
  createdAt: string
}

interface NotificationState {
  notifications: AppNotification[]
  badge: number
  addNotification: (n: AppNotification) => void
  markAllRead: () => void
}

export const useNotificationStore = create<NotificationState>((set) => ({
  notifications: [],
  badge: 0,

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
}))
