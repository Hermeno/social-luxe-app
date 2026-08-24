import { api } from './api'
import { ApiResponse, Post } from '../types'

export interface UserSummary {
  id: string
  name: string
  username?: string | null
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

/** Todas as publicações ainda vivas e visíveis deste autor. */
export async function getUserPosts(userId: string): Promise<Post[]> {
  const res = await api.get<ApiResponse<Post[]>>(`/users/${encodeURIComponent(userId)}/posts`)
  return res.data.data
}
