import { create } from 'zustand'
import { User } from '../types'
import * as authService from '../services/auth.service'
import { getStoredToken } from '../services/api'

interface AuthState {
  user: User | null
  token: string | null
  isLoading: boolean
  isAuthenticated: boolean
  login: (phone: string, password: string) => Promise<void>
  register: (name: string, phone: string, countryCode: string, password: string, confirmPassword: string) => Promise<void>
  logout: () => Promise<void>
  loadUser: () => Promise<void>
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: null,
  isLoading: true,
  isAuthenticated: false,

  loadUser: async () => {
    try {
      const token = await getStoredToken()
      if (!token) return set({ isLoading: false })
      const user = await authService.getMe()
      set({ user, token, isAuthenticated: true, isLoading: false })
    } catch {
      set({ isLoading: false })
    }
  },

  login: async (phone, password) => {
    const result = await authService.login(phone, password)
    set({ user: result.user, token: result.token, isAuthenticated: true })
  },

  register: async (name, phone, countryCode, password, confirmPassword) => {
    const result = await authService.register(name, phone, countryCode, password, confirmPassword)
    set({ user: result.user, token: result.token, isAuthenticated: true })
  },

  logout: async () => {
    await authService.logout()
    set({ user: null, token: null, isAuthenticated: false })
  },
}))
