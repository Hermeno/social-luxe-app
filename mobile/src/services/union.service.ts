import { api, uploadApi } from './api'
import { ApiResponse, Union, UnionInvite, UnionMessage } from '../types'

// ─── Union CRUD ───────────────────────────────────────────────────────────────

export async function createUnion(
  invitedUserId: string,
  name: string,
  label?: string,
  bio?: string,
): Promise<Union> {
  const res = await api.post<ApiResponse<Union>>('/unions', { invitedUserId, name, label, bio })
  return res.data.data
}

export async function getMyUnions(): Promise<Union[]> {
  const res = await api.get<ApiResponse<Union[]>>('/unions/mine')
  return res.data.data
}

export async function getUnion(id: string): Promise<Union> {
  const res = await api.get<ApiResponse<Union>>(`/unions/${id}`)
  return res.data.data
}

export async function updateUnion(
  id: string,
  data: { name?: string; bio?: string; avatarUri?: string },
): Promise<Union> {
  if (data.avatarUri) {
    const form = new FormData()
    if (data.name)  form.append('name', data.name)
    if (data.bio)   form.append('bio',  data.bio)
    form.append('avatar', { uri: data.avatarUri, type: 'image/jpeg', name: 'avatar.jpg' } as any)
    const res = await uploadApi.patch<ApiResponse<Union>>(`/unions/${id}`, form)
    return res.data.data
  }
  const res = await api.patch<ApiResponse<Union>>(`/unions/${id}`, data)
  return res.data.data
}

export async function dissolveUnion(id: string): Promise<void> {
  await api.delete(`/unions/${id}`)
}

// ─── Invites ──────────────────────────────────────────────────────────────────

export async function sendInvite(unionId: string, toUserId: string): Promise<UnionInvite> {
  const res = await api.post<ApiResponse<UnionInvite>>(`/unions/${unionId}/invite`, { toUserId })
  return res.data.data
}

export async function getPendingInvites(): Promise<UnionInvite[]> {
  const res = await api.get<ApiResponse<UnionInvite[]>>('/unions/invites')
  return res.data.data
}

export async function respondToInvite(
  inviteId: string,
  accept: boolean,
): Promise<{ accepted: boolean; union: Union | null }> {
  const res = await api.post<ApiResponse<{ accepted: boolean; union: Union | null }>>(
    `/unions/invites/${inviteId}/respond`,
    { accept },
  )
  return res.data.data
}

// ─── Messaging ────────────────────────────────────────────────────────────────

export async function getUnionConversations(): Promise<UnionMessage[]> {
  const res = await api.get<ApiResponse<UnionMessage[]>>('/unions/conversations')
  return res.data.data
}

export async function getUnionMessages(
  fromUnionId: string,
  toUnionId: string,
  before?: string,
): Promise<UnionMessage[]> {
  const params = before ? `?before=${encodeURIComponent(before)}` : ''
  const res = await api.get<ApiResponse<UnionMessage[]>>(
    `/unions/${fromUnionId}/messages/${toUnionId}${params}`,
  )
  return res.data.data
}

export async function sendUnionMessage(
  fromUnionId: string,
  toUnionId: string,
  content?: string,
  mediaUri?: string,
): Promise<UnionMessage> {
  if (mediaUri) {
    const form = new FormData()
    form.append('toUnionId', toUnionId)
    if (content) form.append('content', content)
    form.append('media', { uri: mediaUri, type: 'image/jpeg', name: 'media.jpg' } as any)
    const res = await uploadApi.post<ApiResponse<UnionMessage>>(`/unions/${fromUnionId}/messages`, form)
    return res.data.data
  }
  const res = await api.post<ApiResponse<UnionMessage>>(`/unions/${fromUnionId}/messages`, { toUnionId, content })
  return res.data.data
}

export async function markUnionRead(fromUnionId: string, toUnionId: string): Promise<void> {
  await api.post(`/unions/${fromUnionId}/messages/${toUnionId}/read`)
}
