import { api } from './api'
import { ApiResponse, Connection } from '../types'

export interface FollowUser {
  id: string
  name: string
  avatar: string | null
  bio: string | null
  followedAt: string
}

export async function toggleFollow(userId: string): Promise<{ following: boolean }> {
  const res = await api.post(`/users/${userId}/follow`)
  return res.data.data ?? res.data
}

export async function getFollowStatus(userId: string): Promise<{ following: boolean }> {
  const res = await api.get(`/users/${userId}/follow-status`)
  return res.data.data ?? res.data
}

export async function getConnections(): Promise<Connection[]> {
  const res = await api.get<ApiResponse<Connection[]>>('/users/connections')
  return res.data.data
}

export async function getMyFollowers(): Promise<FollowUser[]> {
  const res = await api.get('/users/followers')
  return res.data.data ?? res.data
}

export async function getMyFollowing(): Promise<FollowUser[]> {
  const res = await api.get('/users/following')
  return res.data.data ?? res.data
}

export async function getUserFollowers(userId: string): Promise<FollowUser[]> {
  const res = await api.get(`/users/${userId}/followers`)
  return res.data.data ?? res.data
}

export async function getUserFollowing(userId: string): Promise<FollowUser[]> {
  const res = await api.get(`/users/${userId}/following`)
  return res.data.data ?? res.data
}
