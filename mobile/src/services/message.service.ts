import { api } from './api'
import { ApiResponse, Message } from '../types'

export async function getConversations(): Promise<Message[]> {
  const res = await api.get<ApiResponse<Message[]>>('/messages/conversations')
  return res.data.data
}

export async function getMessages(userId: string, page = 1): Promise<Message[]> {
  const res = await api.get<ApiResponse<Message[]>>(`/messages/${userId}?page=${page}`)
  return res.data.data
}

export async function sendMessage(receiverId: string, content?: string, mediaUri?: string): Promise<Message> {
  if (mediaUri) {
    const form = new FormData()
    form.append('receiverId', receiverId)
    if (content) form.append('content', content)
    const filename = mediaUri.split('/').pop() ?? 'media'
    form.append('media', { uri: mediaUri, name: filename, type: 'image/jpeg' } as unknown as Blob)
    const res = await api.post<ApiResponse<Message>>('/messages', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
    return res.data.data
  }
  const res = await api.post<ApiResponse<Message>>('/messages', { receiverId, content })
  return res.data.data
}
