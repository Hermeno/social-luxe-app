import { api } from './api'
import { ApiResponse, Post } from '../types'

/** Todas as publicações ainda vivas e visíveis deste autor. */
export async function getUserPosts(userId: string): Promise<Post[]> {
  const res = await api.get<ApiResponse<Post[]>>(`/users/${encodeURIComponent(userId)}/posts`)
  return res.data.data
}
