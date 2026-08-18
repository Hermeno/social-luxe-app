import { ApiResponse } from '../types'
import { api } from './api'

export const MUTED_USER_IDS_CACHE_KEY = 'moderation:muted_user_ids'
export const MUTED_USERS_CACHE_KEY = 'moderation:muted_users'

export type MuteDuration = 'ONE_MONTH' | 'FOREVER'

export interface MutedUser {
  id: string
  name: string
  username: string | null
  avatar: string | null
  muteId: string
  mutedAt: string
  expiresAt: string | null
}

export async function getMutedUsers(): Promise<MutedUser[]> {
  const res = await api.get<ApiResponse<MutedUser[]>>('/mutes')
  return res.data.data
}

export async function muteUser(userId: string, duration: MuteDuration): Promise<MutedUser> {
  const res = await api.put<ApiResponse<MutedUser>>(`/mutes/${userId}`, { duration })
  return res.data.data
}

export async function unmuteUser(userId: string): Promise<void> {
  await api.delete(`/mutes/${userId}`)
}
