import { create } from 'zustand'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { User } from '../types'
import * as authService from '../services/auth.service'
import { getStoredToken, onTokenExpired } from '../services/api'
import { useNotificationStore } from './notification.store'
import { useFriendsStore } from './friends.store'
import { useOnlineStore } from './online.store'
import { useFeedStore } from './feed.store'
import { useFollowStore } from './follow.store'
import { useSocialPreviewStore } from './socialPreview.store'
import { useMessagesStore } from './messages.store'
import { useProfileUiStore } from './profileUi.store'
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

/** Reset every piece of memory that is scoped to the authenticated identity. */
function resetSessionStores(nextOwnerId: string | null = null): void {
  useNotificationStore.getState().reset()
  useFriendsStore.getState().reset()
  useOnlineStore.getState().reset()
  useFollowStore.getState().reset(nextOwnerId)
  useSocialPreviewStore.getState().reset()
  useFeedStore.getState().reset()
  useMessagesStore.getState().reset()
  useProfileUiStore.getState().reset()
  useMessageBadgeStore.getState().setTotalUnread(0)
}

async function clearAccountCaches(): Promise<void> {
  await Promise.allSettled([
    clearUserCache(),
    clearAllLocalData(),
    nukeMediaCache(),
  ])
}

async function clearPersistedSession(removeOnboarding: boolean): Promise<void> {
  const tasks: Promise<unknown>[] = [
    authService.logout(),
    // Keep an explicit fallback: a failure inside authService.logout must not
    // prevent the rest of the local privacy cleanup.
    AsyncStorage.removeItem('luxe_token'),
    clearUserCache(),
    clearAllLocalData(),
    nukeMediaCache(),
  ]
  if (removeOnboarding) tasks.push(AsyncStorage.removeItem('onboarding_done'))
  await Promise.allSettled(tasks)
}

interface AuthState {
  user: User | null
  token: string | null
  isLoading: boolean
  isAuthenticated: boolean
  login: (phone: string, password: string) => Promise<void>
  register: (name: string, phone: string, countryCode: string, password: string, confirmPassword: string, username?: string) => Promise<void>
  logout: () => Promise<void>
  loadUser: () => Promise<void>
  refreshUser: () => Promise<void>
}

export const useAuthStore = create<AuthState>((set, get) => {
  let authGeneration = 0
  let logoutCleanup: Promise<void> | null = null
  let cleanupQueue: Promise<void> = Promise.resolve()

  const enqueueCleanup = (work: () => Promise<void>) => {
    const cleanup = cleanupQueue.then(work, work)
    cleanupQueue = cleanup.catch(() => {})
    return cleanup
  }

  const waitForPendingCleanup = () => cleanupQueue

  const restoreCurrentToken = () => {
    const token = get().token
    const operation = token
      ? AsyncStorage.setItem('luxe_token', token)
      : AsyncStorage.removeItem('luxe_token')
    operation.catch(() => {})
  }

  const expireIfTokenWasRemoved = async (generation: number) => {
    const token = await getStoredToken().catch(() => null)
    if (generation === authGeneration && !token) get().logout().catch(() => {})
  }

  // A 401 is a logout even when it originates outside this store. The logout
  // action is idempotent and performs its in-memory transition synchronously.
  onTokenExpired(() => { get().logout().catch(() => {}) })

  return {
    user: null,
    token: null,
    isLoading: true,
    isAuthenticated: false,

    // Called once on app start.
    // Reads token + cached user from disk → app opens instantly.
    // Then refreshes from API in background (silent update).
    loadUser: async () => {
      await waitForPendingCleanup()
      const generation = ++authGeneration
      try {
        const [token, cachedUser] = await Promise.all([
          getStoredToken(),
          loadUserCache(),
        ])
        if (generation !== authGeneration) return

        if (!token) {
          set({ user: null, token: null, isAuthenticated: false, isLoading: false })
          resetSessionStores()
          await enqueueCleanup(clearAccountCaches)
          return
        }

        if (cachedUser) {
          // Show app immediately with cached data, but only after all stores are
          // bound to this owner rather than whichever account ran previously.
          resetSessionStores(cachedUser.id)
          set({ user: cachedUser, token, isAuthenticated: true, isLoading: false })
          // Silently refresh from API in background.
          authService.getMe()
            .then(async (fresh) => {
              if (generation !== authGeneration) return
              if (fresh.id !== cachedUser.id) {
                const switchGeneration = ++authGeneration
                set({ user: null, token: null, isAuthenticated: false, isLoading: true })
                resetSessionStores(fresh.id)
                await enqueueCleanup(clearAccountCaches)
                if (switchGeneration !== authGeneration) return
                await Promise.allSettled([
                  AsyncStorage.setItem('luxe_token', token),
                  saveUserCache(fresh),
                ])
                if (switchGeneration !== authGeneration) return
                set({ user: fresh, token, isAuthenticated: true, isLoading: false })
                return
              }
              set({ user: fresh })
              saveUserCache(fresh).catch(() => {})
            })
            .catch(() => { expireIfTokenWasRemoved(generation).catch(() => {}) })
          return
        }

        // No cache yet (first launch after install/update) — must fetch from API.
        const user = await authService.getMe()
        if (generation !== authGeneration) return
        resetSessionStores(user.id)
        set({ user, token, isAuthenticated: true, isLoading: false })
        saveUserCache(user).catch(() => {})
      } catch {
        if (generation !== authGeneration) return
        set({ user: null, token: null, isAuthenticated: false, isLoading: false })
        resetSessionStores()
        await enqueueCleanup(() => clearPersistedSession(false))
      }
    },

    // Force-refresh user from API (called after profile edits)
    refreshUser: async () => {
      await waitForPendingCleanup()
      const generation = ++authGeneration
      const previousUserId = get().user?.id ?? null
      try {
        const fresh = await authService.getMe()
        if (generation !== authGeneration) return
        if (previousUserId && fresh.id !== previousUserId) {
          const switchGeneration = ++authGeneration
          const token = get().token
          set({ user: null, token: null, isAuthenticated: false, isLoading: true })
          resetSessionStores(fresh.id)
          await enqueueCleanup(clearAccountCaches)
          if (switchGeneration !== authGeneration) return
          await Promise.allSettled([
            token ? AsyncStorage.setItem('luxe_token', token) : Promise.resolve(),
            saveUserCache(fresh),
          ])
          if (switchGeneration !== authGeneration) return
          set({ user: fresh, token, isAuthenticated: true, isLoading: false })
          return
        }
        set({ user: fresh })
        await saveUserCache(fresh).catch(() => {})
      } catch {
        await expireIfTokenWasRemoved(generation)
      }
    },

    login: async (phone, password) => {
      await waitForPendingCleanup()
      const generation = ++authGeneration
      const result = await authService.login(phone, password)
      if (generation !== authGeneration) {
        restoreCurrentToken()
        return
      }

      // The generic SQLite/media caches are not owner-scoped. Always wipe them
      // after authentication succeeds and before exposing the new identity.
      set({ user: null, token: null, isAuthenticated: false })
      resetSessionStores(result.user.id)
      await enqueueCleanup(clearAccountCaches)
      if (generation !== authGeneration) {
        restoreCurrentToken()
        return
      }
      await Promise.allSettled([
        AsyncStorage.setItem('luxe_token', result.token),
        saveUserCache(result.user),
      ])
      if (generation !== authGeneration) {
        restoreCurrentToken()
        return
      }
      set({ user: result.user, token: result.token, isAuthenticated: true, isLoading: false })
    },

    register: async (name, phone, countryCode, password, confirmPassword, username) => {
      await waitForPendingCleanup()
      const generation = ++authGeneration
      const result = await authService.register(name, phone, countryCode, password, confirmPassword, username)
      if (generation !== authGeneration) {
        restoreCurrentToken()
        return
      }

      set({ user: null, token: null, isAuthenticated: false })
      resetSessionStores(result.user.id)
      await enqueueCleanup(clearAccountCaches)
      if (generation !== authGeneration) {
        restoreCurrentToken()
        return
      }
      await Promise.allSettled([
        AsyncStorage.setItem('luxe_token', result.token),
        saveUserCache(result.user),
      ])
      if (generation !== authGeneration) {
        restoreCurrentToken()
        return
      }
      set({ user: result.user, token: result.token, isAuthenticated: true, isLoading: false })
    },

    logout: async () => {
      authGeneration += 1
      // Privacy transition is synchronous: screens/socket unmount immediately,
      // even if AsyncStorage, SQLite or media cleanup later fails.
      set({ user: null, token: null, isAuthenticated: false, isLoading: false })
      resetSessionStores()

      if (!logoutCleanup) {
        const cleanup = enqueueCleanup(() => clearPersistedSession(true))
        logoutCleanup = cleanup
        cleanup.finally(() => {
          if (logoutCleanup === cleanup) logoutCleanup = null
        }).catch(() => {})
      }
      await logoutCleanup
    },
  }
})
