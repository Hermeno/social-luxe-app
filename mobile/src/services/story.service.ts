import { api } from './api'
import { ApiResponse } from '../types'

export interface Story {
  id: string
  userId: string
  mediaUrl: string
  mediaType: 'IMAGE' | 'VIDEO'
  expiresAt: string
  createdAt: string
  user: { id: string; name: string; avatar: string | null }
  viewCount: number
  viewedByMe: boolean
}

export interface StoryGroup {
  user: { id: string; name: string; avatar: string | null }
  stories: Story[]
  hasUnviewed: boolean
}

const BASE = 'http://192.168.43.184:3000'

export function storyUrl(s: Story) {
  return s.mediaUrl.startsWith('http') ? s.mediaUrl : `${BASE}${s.mediaUrl}`
}

export async function getFriendsStories(): Promise<StoryGroup[]> {
  const res = await api.get<ApiResponse<StoryGroup[]>>('/stories')
  return res.data.data
}

export async function createStory(uri: string, type: 'image' | 'video'): Promise<Story> {
  const form = new FormData()
  form.append('media', {
    uri,
    type: type === 'video' ? 'video/mp4' : 'image/jpeg',
    name: `story.${type === 'video' ? 'mp4' : 'jpg'}`,
  } as any)
  const res = await api.post<ApiResponse<Story>>('/stories', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
  return res.data.data
}

export async function viewStory(storyId: string): Promise<void> {
  await api.post(`/stories/${storyId}/view`)
}

export async function deleteStory(storyId: string): Promise<void> {
  await api.delete(`/stories/${storyId}`)
}
