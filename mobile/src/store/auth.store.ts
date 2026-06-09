import { create } from 'zustand'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { User } from '../types'
import * as authService from '../services/auth.service'
import { getStoredToken } from '../services/api'
import { useNotificationStore } from './notification.store'
import { useFriendsStore } from './friends.store'
import { useOnlineStore } from './online.store'
import { useFeedStore } from './feed.store'
import { useMessageBadgeStore } from './messageBadge.store'
import { clearAllLocalData } from '../db/database'
import { nukeMediaCache } from '../db/mediaCache'

const USER_CACHE_KEY = 'luxe_user_cache'

async function saveUserCache(user: User): Promise<void> {
  await AsyncStorage.setItem(USER_CACHE_KEY, JSON.stringify(user))
}

async function loadUserCache(): Promise<User | null> {
  const raw = await AsyncStorage.getItem(USER_CACHE_KEY)
  return raw ? (JSON.parse(raw) as User) : null
}

async function clearUserCache(): Promise<void> {
  await AsyncStorage.removeItem(USER_CACHE_KEY)
}

interface AuthState {
  user: User | null
  token: string | null
  isLoading: boolean
  isAuthenticated: boolean
  login: (phone: string, password: string) => Promise<void>
  register: (name: string, phone: string, countryCode: string, password: string, confirmPassword: string) => Promise<void>
  logout: () => Promise<void>
  loadUser: () => Promise<void>
  refreshUser: () => Promise<void>
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  token: null,
  isLoading: true,
  isAuthenticated: false,

  // Called once on app start.
  // Reads token + cached user from disk → app opens instantly.
  // Then refreshes from API in background (silent update).
  loadUser: async () => {
    try {
      const [token, cachedUser] = await Promise.all([
        getStoredToken(),
        loadUserCache(),
      ])

      if (!token) {
        set({ isLoading: false })
        return
      }

      if (cachedUser) {
        // Show app immediately with cached data
        set({ user: cachedUser, token, isAuthenticated: true, isLoading: false })
        // Silently refresh from API in background
        authService.getMe()
          .then((fresh) => {
            set({ user: fresh })
            saveUserCache(fresh).catch(() => {})
          })
          .catch(() => {}) // keep cached user if network fails
        return
      }

      // No cache yet (first launch after install/update) — must fetch from API
      const user = await authService.getMe()
      set({ user, token, isAuthenticated: true, isLoading: false })
      saveUserCache(user).catch(() => {})
    } catch {
      // Token exists but API failed (expired/revoked) — stay logged out
      set({ isLoading: false })
    }
  },

  // Force-refresh user from API (called after profile edits)
  refreshUser: async () => {
    try {
      const fresh = await authService.getMe()
      set({ user: fresh })
      await saveUserCache(fresh)
    } catch {}
  },

  login: async (phone, password) => {
    const result = await authService.login(phone, password)
    await saveUserCache(result.user)
    set({ user: result.user, token: result.token, isAuthenticated: true })
  },

  register: async (name, phone, countryCode, password, confirmPassword) => {
    const result = await authService.register(name, phone, countryCode, password, confirmPassword)
    await saveUserCache(result.user)
    set({ user: result.user, token: result.token, isAuthenticated: true })
  },

  logout: async () => {
    await authService.logout()
    await clearUserCache()
    // Reset all in-memory stores
    useNotificationStore.getState().reset()
    useFriendsStore.getState().reset()
    useOnlineStore.getState().reset()
    useFeedStore.setState({ pendingPost: null })
    useMessageBadgeStore.getState().setTotalUnread(0)
    // Wipe all local SQLite cache + media files
    await clearAllLocalData().catch(() => {})
    await nukeMediaCache().catch(() => {})
    await AsyncStorage.removeItem('onboarding_done').catch(() => {})
    set({ user: null, token: null, isAuthenticated: false })
  },
}))
