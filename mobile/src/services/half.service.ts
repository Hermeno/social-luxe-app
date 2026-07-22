import { api, uploadApi } from './api'
import { ApiResponse, Post, User } from '../types'

export type HalfStatus = 'WAITING' | 'COMPLETED' | 'EXPIRED'

export interface Half {
  id: string
  creatorId: string
  mediaUrl: string
  mediaType: 'IMAGE' | 'VIDEO'
  caption: string | null
  targetUserId: string | null
  status: HalfStatus
  expiresAt: string
  createdAt: string
  creator: Pick<User, 'id' | 'name' | 'avatar'>
  targetUser: Pick<User, 'id' | 'name' | 'avatar'> | null
  completedBy: Pick<User, 'id' | 'name' | 'avatar'> | null
}

function mediaForm(uri: string, extra: Record<string, string | undefined> = {}) {
  const form = new FormData()
  const filename = uri.split('/').pop() ?? 'media'
  const type = /\.(mp4|mov)$/i.test(filename) ? 'video/mp4' : 'image/jpeg'
  form.append('media', { uri, name: filename, type } as unknown as Blob)
  for (const [k, v] of Object.entries(extra)) if (v) form.append(k, v)
  return form
}

// Cria uma metade. targetUserId vazio = aberta a qualquer ligação.
export async function createHalf(uri: string, caption?: string, targetUserId?: string): Promise<Half> {
  const res = await uploadApi.post<ApiResponse<Half>>('/halves', mediaForm(uri, { caption, targetUserId }), {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
  return res.data.data
}

export async function getMyHalves(): Promise<Half[]> {
  const res = await api.get<ApiResponse<Half[]>>('/halves/mine')
  return res.data.data ?? []
}

export async function getIncomingHalves(): Promise<Half[]> {
  const res = await api.get<ApiResponse<Half[]>>('/halves/incoming')
  return res.data.data ?? []
}

export async function getHalf(id: string): Promise<Half> {
  const res = await api.get<ApiResponse<Half>>(`/halves/${id}`)
  return res.data.data
}

// Completar devolve o Post já nascido — dos dois.
export async function completeHalf(id: string, uri: string): Promise<Post> {
  const res = await uploadApi.post<ApiResponse<Post>>(`/halves/${id}/complete`, mediaForm(uri), {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
  return res.data.data
}

export async function deleteHalf(id: string): Promise<void> {
  await api.delete(`/halves/${id}`)
}
