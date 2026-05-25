import { api } from './api'
import { ApiResponse, Post, Comment } from '../types'

export async function getFeed(page = 1): Promise<Post[]> {
  const res = await api.get<ApiResponse<Post[]>>(`/posts/feed?page=${page}`)
  return res.data.data
}

export async function createPost(mediaUri: string, mediaType: 'IMAGE' | 'VIDEO', caption?: string) {
  const form = new FormData()
  const filename = mediaUri.split('/').pop() ?? 'media'
  const type = mediaType === 'VIDEO' ? 'video/mp4' : 'image/jpeg'
  form.append('media', { uri: mediaUri, name: filename, type } as unknown as Blob)
  if (caption) form.append('caption', caption)
  const res = await api.post<ApiResponse<Post>>('/posts', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
  return res.data.data
}

export async function likePost(postId: string): Promise<{ liked: boolean }> {
  const res = await api.post<ApiResponse<{ liked: boolean }>>(`/posts/${postId}/like`)
  return res.data.data
}

export async function addView(postId: string) {
  await api.post(`/posts/${postId}/view`)
}

export async function getComments(postId: string): Promise<Comment[]> {
  const res = await api.get<ApiResponse<Comment[]>>(`/posts/${postId}/comments`)
  return res.data.data
}

export async function addComment(postId: string, content: string, parentId?: string): Promise<Comment> {
  const res = await api.post<ApiResponse<Comment>>(`/posts/${postId}/comments`, { content, parentId })
  return res.data.data
}

export async function sharePost(postId: string) {
  await api.post(`/posts/${postId}/share`)
}

export async function voteExtend(postId: string): Promise<{ votes: number; extended: boolean }> {
  const res = await api.post<ApiResponse<{ votes: number; extended: boolean }>>(`/posts/${postId}/vote-extend`)
  return res.data.data
}

export async function getFlashback(): Promise<Post | null> {
  try {
    const res = await api.get<ApiResponse<Post>>('/posts/flashback')
    return res.data.data
  } catch {
    return null
  }
}
