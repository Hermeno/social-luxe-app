import { api } from './api'
import { ApiResponse } from '../types'

export interface Group {
  id: string
  name: string
  avatar: string | null
  memberCount: number
  lastMessage: { content: string | null; createdAt: string } | null
}

export interface GroupMessage {
  id: string
  groupId: string
  senderId: string
  content: string | null
  mediaUrl: string | null
  createdAt: string
  sender: { id: string; name: string; avatar: string | null }
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
  content?: string,
  mediaUrl?: string,
): Promise<GroupMessage> {
  const res = await api.post<ApiResponse<GroupMessage>>(`/groups/${groupId}/messages`, {
    content,
    mediaUrl,
  })
  return res.data.data
}
