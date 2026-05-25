import { api } from './api'
import { ApiResponse } from '../types'

export interface UserSummary {
  id: string
  name: string
  avatar: string | null
  bio: string | null
}

export async function getAllUsers(): Promise<UserSummary[]> {
  const res = await api.get<ApiResponse<UserSummary[]>>('/users')
  return res.data.data
}

export async function searchUsers(query: string): Promise<UserSummary[]> {
  const res = await api.get<ApiResponse<UserSummary[]>>('/users/search', { params: { q: query } })
  return res.data.data
}
