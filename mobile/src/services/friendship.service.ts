import { api } from './api'
import { ApiResponse, Friendship, FriendshipDuration } from '../types'

export interface UserSummary { id: string; name: string; avatar: string | null; bio: string | null }

export async function getAllUsers(): Promise<UserSummary[]> {
  const res = await api.get<ApiResponse<UserSummary[]>>('/users')
  return res.data.data
}

export async function getFriends(): Promise<Friendship[]> {
  const res = await api.get<ApiResponse<Friendship[]>>('/friendships')
  return res.data.data
}

export async function addFriend(targetUserId: string, duration: FriendshipDuration): Promise<Friendship> {
  const res = await api.post<ApiResponse<Friendship>>('/friendships', { targetUserId, duration })
  return res.data.data
}

export async function renewFriendship(friendshipId: string): Promise<Friendship> {
  const res = await api.put<ApiResponse<Friendship>>(`/friendships/${friendshipId}/renew`)
  return res.data.data
}

export async function removeFriendship(friendshipId: string): Promise<void> {
  await api.delete(`/friendships/${friendshipId}`)
}
