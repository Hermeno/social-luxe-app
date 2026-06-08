import { create } from 'zustand'

export interface AppNotification {
  id: string
  type: 'like' | 'comment' | 'reaction' | 'message' | 'coin' | 'extend_vote' | 'partner_request'
  message: string
  read: boolean
  createdAt: string
}

interface NotificationState {
  notifications: AppNotification[]
  badge: number
  partnerRequestBadge: number
  addNotification: (n: AppNotification) => void
  markAllRead: () => void
  setPartnerRequestBadge: (count: number) => void
  reset: () => void
}

export const useNotificationStore = create<NotificationState>((set) => ({
  notifications: [],
  badge: 0,
  partnerRequestBadge: 0,

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

  setPartnerRequestBadge: (count) => set({ partnerRequestBadge: count }),

  reset: () => set({ notifications: [], badge: 0, partnerRequestBadge: 0 }),
}))
