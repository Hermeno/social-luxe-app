import { api, uploadApi } from './api'

export interface CircleTarget {
  id: string
  title: string
  emoji: string
  endsAt: string
}

export interface CircleUser {
  id: string
  name: string
  avatar: string | null
}

export interface CircleCapture {
  id: string
  mediaUrl: string
  status: 'PENDING' | 'LIVE' | 'REJECTED'
  createdAt: string
  user: CircleUser
}

export interface MyCapture {
  id: string
  mediaUrl: string
  status: 'PENDING' | 'LIVE' | 'REJECTED'
  approvals: number
  rejections: number
}

export interface CircleState {
  target: CircleTarget
  captures: CircleCapture[]
  myCapture: MyCapture | null
  toVerify: { id: string; mediaUrl: string }[]
  liveCount: number
}

export async function getCircle(): Promise<CircleState> {
  const res = await api.get('/circle')
  return res.data.data
}

export async function submitCapture(targetId: string, uri: string): Promise<CircleCapture> {
  const form = new FormData()
  form.append('targetId', targetId)
  form.append('media', { uri, name: 'circle.jpg', type: 'image/jpeg' } as unknown as Blob)
  const res = await uploadApi.post('/circle/captures', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
  return res.data.data
}

export async function voteCapture(captureId: string, match: boolean): Promise<{ status: string }> {
  const res = await api.post(`/circle/captures/${captureId}/vote`, { match })
  return res.data.data
}

// Abrir a câmera avisa conexões próximas — o servidor decide quem (e nunca revela distância)
export async function spark(lat?: number, lng?: number): Promise<{ notified: number }> {
  const res = await api.post('/circle/spark', lat != null && lng != null ? { lat, lng } : {})
  return res.data.data ?? { notified: 0 }
}
