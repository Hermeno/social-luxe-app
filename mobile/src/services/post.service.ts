import { api, uploadApi } from './api'
import { ApiResponse, Post, Comment, PostSticker } from '../types'

export async function getFeed(page = 1): Promise<Post[]> {
  const res = await api.get<ApiResponse<Post[]>>(`/posts/feed?page=${page}`)
  return res.data.data
}

export async function createPost(
  mediaUri: string | null,
  mediaType: 'IMAGE' | 'VIDEO' | 'TEXT',
  caption?: string,
  bgColor?: string,
  partnerUserId?: string,
  isAnnouncement?: boolean,
  deviceModel?: string,
  stickersEnabled?: boolean,
) {
  if (mediaType === 'TEXT') {
    const res = await api.post<ApiResponse<Post>>('/posts', { caption, bgColor, partnerUserId, isAnnouncement, deviceModel, stickersEnabled })
    return res.data.data
  }

  const form = new FormData()
  const filename = mediaUri!.split('/').pop() ?? 'media'
  const type = mediaType === 'VIDEO' ? 'video/mp4' : 'image/jpeg'
  form.append('media', { uri: mediaUri, name: filename, type } as unknown as Blob)
  if (caption)          form.append('caption', caption)
  if (partnerUserId)    form.append('partnerUserId', partnerUserId)
  if (isAnnouncement)   form.append('isAnnouncement', 'true')
  if (deviceModel)      form.append('deviceModel', deviceModel)
  if (stickersEnabled)  form.append('stickersEnabled', 'true')
  const res = await uploadApi.post<ApiResponse<Post>>('/posts', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
  return res.data.data
}

export async function getStickers(postId: string): Promise<PostSticker[]> {
  const res = await api.get<ApiResponse<PostSticker[]>>(`/posts/${postId}/stickers`)
  return res.data.data
}

export async function addSticker(postId: string, emoji: string, x: number, y: number, type = 'emoji', content?: string): Promise<PostSticker> {
  const res = await api.post<ApiResponse<PostSticker>>(`/posts/${postId}/stickers`, { emoji, x, y, type, content })
  return res.data.data
}

export async function removeSticker(postId: string, stickerId: string): Promise<void> {
  await api.delete(`/posts/${postId}/stickers/${stickerId}`)
}

export async function getPartnerPostInvites(): Promise<Post[]> {
  const res = await api.get<ApiResponse<Post[]>>('/posts/partner-pending')
  return res.data.data ?? []
}

export async function respondPartnerPost(postId: string, accept: boolean) {
  await api.put(`/posts/${postId}/partner-${accept ? 'accept' : 'reject'}`)
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

export async function deletePost(postId: string) {
  await api.delete(`/posts/${postId}`)
}

export async function updatePost(postId: string, caption: string) {
  await api.patch(`/posts/${postId}`, { caption })
}

export async function voteExtend(postId: string): Promise<{ voted: boolean }> {
  const res = await api.post<ApiResponse<{ voted: boolean }>>(`/posts/${postId}/vote-extend`)
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
