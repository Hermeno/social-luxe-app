import { api, uploadApi } from './api'
import { Post } from '../types'

export interface EmojiOverlay {
  emoji: string
  x: number
  y: number
}

export interface CircleUser {
  id: string
  name: string
  avatar: string | null
}

export interface CircleMember {
  user: CircleUser
  status: 'INVITED' | 'JOINED'
  photoUrl: string | null
}

export interface CircleSession {
  id: string
  hostId: string
  status: 'OPEN' | 'PUBLISHED' | 'CLOSED'
}

export interface CircleOpenState {
  session: CircleSession
  members: CircleMember[]
  nearby: CircleUser[]
}

export interface CircleState {
  session: CircleSession
  members: CircleMember[]
}

// Abre (ou reutiliza) a minha sessão como anfitrião + vizinhos mútuos a chamar
export async function openCircle(lat?: number, lng?: number): Promise<CircleOpenState> {
  const res = await api.post('/circle/open', lat != null && lng != null ? { lat, lng } : {})
  return res.data.data
}

// Uma chamada pendente para mim (fui chamado por alguém)
export async function getIncoming(): Promise<{ call: { sessionId: string; host: CircleUser } | null }> {
  const res = await api.get('/circle/incoming')
  return res.data.data ?? { call: null }
}

// Anfitrião chama um vizinho para o círculo
export async function callToCircle(sessionId: string, userId: string): Promise<void> {
  await api.post('/circle/call', { sessionId, userId })
}

// Aceitar / entrar numa sessão
export async function joinCircle(sessionId: string): Promise<CircleState> {
  const res = await api.post('/circle/join', { sessionId })
  return res.data.data
}

// Guardar a minha foto (com emojis) na sessão
export async function addCirclePhoto(sessionId: string, uri: string, overlays: EmojiOverlay[] = []): Promise<void> {
  const form = new FormData()
  form.append('sessionId', sessionId)
  form.append('media', { uri, name: 'circle.jpg', type: 'image/jpeg' } as unknown as Blob)
  if (overlays.length > 0) form.append('overlays', JSON.stringify(overlays))
  await uploadApi.post('/circle/photo', form, { headers: { 'Content-Type': 'multipart/form-data' } })
}

// Anfitrião publica → cria o álbum com as fotos de todos, na feed
export async function publishCircle(sessionId: string, caption?: string): Promise<Post> {
  const res = await api.post('/circle/publish', { sessionId, caption })
  return res.data.data
}

export async function getCircleSession(sessionId: string): Promise<CircleState> {
  const res = await api.get(`/circle/session/${sessionId}`)
  return res.data.data
}
