import { api } from './api'
import { ApiResponse, Post } from '../types'

export async function toggleBookmark(postId: string): Promise<{ bookmarked: boolean }> {
  const res = await api.post<ApiResponse<{ bookmarked: boolean }>>('/bookmarks', { postId })
  return res.data.data
}

export async function getBookmarks(): Promise<Post[]> {
  const res = await api.get<ApiResponse<Post[]>>('/bookmarks')
  return res.data.data
}
