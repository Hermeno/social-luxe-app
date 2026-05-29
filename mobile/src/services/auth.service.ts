import { api, saveToken, clearToken } from './api'
import { ApiResponse, User } from '../types'

interface AuthResult {
  user: User
  token: string
}

export async function register(
  name: string,
  phone: string,
  countryCode: string,
  password: string,
  confirmPassword: string
): Promise<AuthResult> {
  const res = await api.post<ApiResponse<AuthResult>>('/auth/register', {
    name,
    phone,
    countryCode,
    password,
    confirmPassword,
  })
  await saveToken(res.data.data.token)
  return res.data.data
}

export async function login(phone: string, password: string): Promise<AuthResult> {
  const res = await api.post<ApiResponse<AuthResult>>('/auth/login', { phone, password })
  await saveToken(res.data.data.token)
  return res.data.data
}

export async function getMe(): Promise<User> {
  const res = await api.get<ApiResponse<User>>('/auth/me')
  return res.data.data
}

export async function checkPhone(phone: string): Promise<{ exists: boolean }> {
  const res = await api.post('/auth/check-phone', { phone })
  return res.data.data ?? res.data
}

export async function logout() {
  await clearToken()
}
