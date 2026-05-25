import { api } from './api'
import { ApiResponse } from '../types'

export interface BlockedUser {
  id: string
  name: string
  avatar: string | null
}

export async function blockUser(targetUserId: string): Promise<void> {
  await api.post('/blocks', { targetUserId })
}

export async function unblockUser(targetUserId: string): Promise<void> {
  await api.delete(`/blocks/${targetUserId}`)
}

export async function getBlockedUsers(): Promise<BlockedUser[]> {
  const res = await api.get<ApiResponse<BlockedUser[]>>('/blocks')
  return res.data.data
}
