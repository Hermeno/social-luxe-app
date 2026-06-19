import axios from 'axios'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { API_URL } from '../config'

const BASE_URL = API_URL

export const api = axios.create({
  baseURL: BASE_URL,
  timeout: 15000,
})

// Long-timeout instance for media uploads (video upload + Cloudinary processing can take minutes)
export const uploadApi = axios.create({
  baseURL: BASE_URL,
  timeout: 180_000, // 3 minutes
})

// Lightweight pub/sub for token expiry — avoids circular dependency with auth store
const tokenExpiredListeners: Array<() => void> = []

function attachInterceptors(instance: typeof api) {
  instance.interceptors.request.use(async (config) => {
    const token = await AsyncStorage.getItem('luxe_token')
    if (token) config.headers.Authorization = `Bearer ${token}`
    return config
  })
  instance.interceptors.response.use(
    (response) => response,
    async (error) => {
      if (error.response?.status === 401) {
        await AsyncStorage.multiRemove(['luxe_token', 'luxe_user'])
        tokenExpiredListeners.forEach((fn) => fn())
      }
      const isTimeout = error.code === 'ECONNABORTED' || !error.response
      const message = isTimeout
        ? 'Ligação demorou demasiado. Verifica a tua internet e tenta de novo.'
        : (error.response?.data?.message ?? 'Erro de rede')
      return Promise.reject(new Error(message))
    },
  )
}

attachInterceptors(api)
attachInterceptors(uploadApi)

export function onTokenExpired(fn: () => void) {
  tokenExpiredListeners.push(fn)
  return () => {
    const i = tokenExpiredListeners.indexOf(fn)
    if (i >= 0) tokenExpiredListeners.splice(i, 1)
  }
}

export async function saveToken(token: string) {
  await AsyncStorage.setItem('luxe_token', token)
}

export async function clearToken() {
  await AsyncStorage.removeItem('luxe_token')
}

export async function getStoredToken(): Promise<string | null> {
  return AsyncStorage.getItem('luxe_token')
}
