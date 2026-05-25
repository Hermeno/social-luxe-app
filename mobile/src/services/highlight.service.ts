import { api } from './api'
import { ApiResponse } from '../types'

export interface HighlightPost {
  id: string
  mediaUrl: string
  mediaType: 'IMAGE' | 'VIDEO'
  caption: string | null
}

export interface Highlight {
  id: string
  title: string
  coverUrl: string | null
  posts: HighlightPost[]
}

export async function getUserHighlights(userId: string): Promise<Highlight[]> {
  const res = await api.get<ApiResponse<Highlight[]>>(`/highlights/${userId}`)
  return res.data.data
}

export async function createHighlight(
  title: string,
  posts: Omit<HighlightPost, 'id'>[],
): Promise<Highlight> {
  const res = await api.post<ApiResponse<Highlight>>('/highlights', { title, posts })
  return res.data.data
}

export async function deleteHighlight(highlightId: string): Promise<void> {
  await api.delete(`/highlights/${highlightId}`)
}
