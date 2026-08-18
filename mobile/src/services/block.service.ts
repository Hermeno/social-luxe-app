import { api } from './api'
import { ApiResponse } from '../types'

export const BLOCKED_USER_IDS_CACHE_KEY = 'moderation:blocked_user_ids'

export interface BlockedUser {
  id: string
  name: string
  username?: string | null
  avatar: string | null
  blockId?: string
  blockedAt?: string
}

interface LegacyBlockedUser {
  blockId: string
  blockedAt: string
  user: BlockedUser
}

export async function blockUser(targetUserId: string): Promise<void> {
  await api.post('/blocks', { targetUserId })
}

export async function unblockUser(targetUserId: string): Promise<void> {
  await api.delete(`/blocks/${targetUserId}`)
}

export async function getBlockedUsers(): Promise<BlockedUser[]> {
  // O servidor atual devolve a lista plana. A normalização do formato antigo
  // evita deixar instalações em rollout sem conseguir desbloquear: nesse shape
  // o id do utilizador vivia em `item.user.id`, não em `item.id`.
  const res = await api.get<ApiResponse<Array<BlockedUser | LegacyBlockedUser>>>('/blocks')
  return res.data.data.map((item) => ('user' in item ? {
    ...item.user,
    blockId: item.blockId,
    blockedAt: item.blockedAt,
  } : item))
}
