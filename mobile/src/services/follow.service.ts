import { api } from './api'
import { ApiResponse } from '../types'

export interface Connection {
  user: { id: string; name: string; avatar: string | null }
  lastMessage: {
    id: string
    content: string | null
    senderId: string
    readAt: string | null
    createdAt: string
  } | null
  unreadCount: number
  postIds: string[]
}

export interface FollowUser {
  id: string
  name: string
  avatar: string | null
  bio: string | null
  followedAt: string
}

export async function toggleFollow(userId: string): Promise<{ following: boolean }> {
  const res = await api.post(`/users/${userId}/follow`)
  return res.data
}

export async function getFollowStatus(userId: string): Promise<{ following: boolean }> {
  const res = await api.get(`/users/${userId}/follow-status`)
  return res.data
}

export async function getConnections(): Promise<Connection[]> {
  const res = await api.get<ApiResponse<Connection[]>>('/users/connections')
  return res.data.data
}

export async function getMyFollowers(): Promise<FollowUser[]> {
  const res = await api.get<FollowUser[]>('/users/followers')
  return res.data
}

export async function getMyFollowing(): Promise<FollowUser[]> {
  const res = await api.get<FollowUser[]>('/users/following')
  return res.data
}

export async function getUserFollowers(userId: string): Promise<FollowUser[]> {
  const res = await api.get<FollowUser[]>(`/users/${userId}/followers`)
  return res.data
}

export async function getUserFollowing(userId: string): Promise<FollowUser[]> {
  const res = await api.get<FollowUser[]>(`/users/${userId}/following`)
  return res.data
}
