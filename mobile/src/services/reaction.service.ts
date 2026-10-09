import { api } from './api'
import { ApiResponse } from '../types'

export type ReactionType = 'HEART' | 'FIRE' | 'LAUGH' | 'WOW' | 'SAD' | 'CLAP'

export async function reactToPost(postId: string, type: ReactionType, anonymous = false) {
  const res = await api.post<ApiResponse<any>>(`/posts/${postId}/react`, { type, anonymous })
  return res.data.data
}

