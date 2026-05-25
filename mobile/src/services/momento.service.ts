import { api } from './api'
import { ApiResponse } from '../types'

export interface Momento {
  id: string
  userId: string
  latitude: number
  longitude: number
  label: string | null
  expiresAt: string
  createdAt: string
  user: { id: string; name: string; avatar: string | null }
  viewCount: number
}

export async function getFriendsMomentos(): Promise<Momento[]> {
  const res = await api.get<ApiResponse<Momento[]>>('/momentos')
  return res.data.data
}

export async function createMomento(
  latitude: number,
  longitude: number,
  label?: string,
): Promise<Momento> {
  const res = await api.post<ApiResponse<Momento>>('/momentos', { latitude, longitude, label })
  return res.data.data
}

export async function deleteMomento(momentoId: string): Promise<void> {
  await api.delete(`/momentos/${momentoId}`)
}
