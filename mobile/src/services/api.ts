import axios from 'axios'
import AsyncStorage from '@react-native-async-storage/async-storage'

const BASE_URL = 'http://192.168.43.184:3000/api/v1'

export const api = axios.create({
  baseURL: BASE_URL,
  timeout: 15000,
})

api.interceptors.request.use(async (config) => {
  const token = await AsyncStorage.getItem('luxe_token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const message = error.response?.data?.message ?? 'Network error'
    return Promise.reject(new Error(message))
  }
)

export async function saveToken(token: string) {
  await AsyncStorage.setItem('luxe_token', token)
}

export async function clearToken() {
  await AsyncStorage.removeItem('luxe_token')
}

export async function getStoredToken(): Promise<string | null> {
  return AsyncStorage.getItem('luxe_token')
}
