import { api } from './api'
import { ApiResponse } from '../types'

export interface Group {
  id: string
  name: string
  avatar: string | null
  description: string | null
  type: 'COMMUNITY' | 'GROUP'
  memberCount: number
  lastMessage: { content: string | null; createdAt: string } | null
}

export interface GroupMessage {
  id: string
  groupId: string
  senderId: string
  content: string | null
  replyToId: string | null
  createdAt: string
  sender:  { id: string; name: string; avatar: string | null }
  replyTo: { id: string; content: string | null; sender: { id: string; name: string; avatar: string | null } } | null
}

export async function getMyGroups(): Promise<Group[]> {
  const res = await api.get<ApiResponse<Group[]>>('/groups')
  return res.data.data
}

export async function createGroup(name: string, memberIds: string[]): Promise<Group> {
  const res = await api.post<ApiResponse<Group>>('/groups', { name, memberIds })
  return res.data.data
}

export async function getGroupMessages(groupId: string, page = 1): Promise<GroupMessage[]> {
  const res = await api.get<ApiResponse<GroupMessage[]>>(
    `/groups/${groupId}/messages?page=${page}`,
  )
  return res.data.data
}

export async function sendGroupMessage(
  groupId: string,
  content: string,
  replyToId?: string,
): Promise<GroupMessage> {
  const res = await api.post<ApiResponse<GroupMessage>>(`/groups/${groupId}/messages`, { content, replyToId })
  return res.data.data
}

export interface GroupMember {
  userId: string
  isAdmin: boolean
  joinedAt: string
  user: { id: string; name: string; avatar: string | null }
}

export interface GroupInfo {
  id: string
  name: string
  avatar: string | null
  description: string | null
  type: 'COMMUNITY' | 'GROUP'
  createdBy: string
  memberCount: number
  myRole: 'admin' | 'member'
  isCreator: boolean
  members: GroupMember[]
}

export async function getGroupInfo(groupId: string): Promise<GroupInfo> {
  const res = await api.get<ApiResponse<GroupInfo>>(`/groups/${groupId}`)
  return res.data.data
}

export async function updateGroup(groupId: string, data: { name?: string; description?: string; avatarUri?: string }): Promise<Group> {
  const form = new FormData()
  if (data.name)        form.append('name', data.name)
  if (data.description !== undefined) form.append('description', data.description)
  if (data.avatarUri)   form.append('avatar', { uri: data.avatarUri, name: 'avatar.jpg', type: 'image/jpeg' } as any)
  const res = await api.patch<ApiResponse<Group>>(`/groups/${groupId}`, form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
  return res.data.data
}

export async function deleteGroup(groupId: string): Promise<void> {
  await api.delete(`/groups/${groupId}`)
}

export async function addGroupMember(groupId: string, userId: string): Promise<void> {
  await api.post(`/groups/${groupId}/members`, { userId })
}

export async function removeGroupMember(groupId: string, userId: string): Promise<void> {
  await api.delete(`/groups/${groupId}/members/${userId}`)
}

export async function promoteToAdmin(groupId: string, userId: string): Promise<void> {
  await api.post(`/groups/${groupId}/admin`, { userId })
}

export async function leaveGroup(groupId: string): Promise<void> {
  await api.delete(`/groups/${groupId}/leave`)
}
