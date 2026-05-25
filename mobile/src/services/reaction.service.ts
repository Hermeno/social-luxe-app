import { api } from './api'
import { ApiResponse } from '../types'

export type ReactionType = 'HEART' | 'FIRE' | 'LAUGH' | 'WOW' | 'SAD' | 'CLAP'

export interface ReactionGroup {
  type: ReactionType
  count: number
  users: Array<{ id: string; name: string; avatar: string | null } | null>
}

export async function reactToPost(postId: string, type: ReactionType, anonymous = false) {
  const res = await api.post<ApiResponse<any>>(`/posts/${postId}/react`, { type, anonymous })
  return res.data.data
}

export async function removeReaction(postId: string) {
  await api.delete(`/posts/${postId}/react`)
}

export async function getReactions(postId: string): Promise<ReactionGroup[]> {
  const res = await api.get<ApiResponse<ReactionGroup[]>>(`/posts/${postId}/reactions`)
  return res.data.data
}
