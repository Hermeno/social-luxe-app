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

export interface CircleCapture {
  id: string
  roundId: string
  userId: string
  slot: 1 | 2
  mediaUrl: string
  createdAt: string
  overlays?: EmojiOverlay[]
  photoWidth?: number | null
  photoHeight?: number | null
}

export interface CircleMember {
  user: CircleUser
  status: 'INVITED' | 'JOINED'
  /** Mantidos pelo servidor durante a transição; a UI nova usa `captures`. */
  photoUrl?: string | null
  photoAt?: string | null
  captures: CircleCapture[]
}

export interface CircleSession {
  id: string
  hostId: string
  status: 'OPEN' | 'PUBLISHED' | 'CLOSED'
}

export interface CircleRound {
  id: string
  sessionId: string
  shotAt: string
  expiresAt: string
  isSolo: boolean
  ownerUserId: string | null
}

export interface CircleOpenState {
  session: CircleSession
  members: CircleMember[]
  nearby: CircleUser[]
  currentRound: CircleRound | null
  /** Janela para publicar depois do disparo. Vem do servidor — é ele que a
   *  aplica, e antes o cliente tinha a sua própria cópia do número. */
  publishWindowMs?: number
}

export interface CircleState {
  session: CircleSession
  members: CircleMember[]
  currentRound: CircleRound | null
  publishWindowMs?: number
}

function normalizeMembers(value: unknown): CircleMember[] {
  if (!Array.isArray(value)) return []
  return value.map((member) => ({
    ...member,
    captures: Array.isArray(member?.captures) ? member.captures : [],
  })) as CircleMember[]
}

function normalizeState<T extends CircleState>(value: T): T {
  return {
    ...value,
    members: normalizeMembers(value?.members),
    currentRound: value?.currentRound ?? null,
  }
}

// Abre (ou reutiliza) a minha sessão como anfitrião + vizinhos mútuos a chamar
export async function openCircle(lat?: number, lng?: number): Promise<CircleOpenState> {
  const res = await api.post('/circle/open', lat != null && lng != null ? { lat, lng } : {})
  return normalizeState(res.data.data as CircleOpenState)
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
  return normalizeState(res.data.data as CircleState)
}

// Sair de uma sessão (desfazer o "aceitar")
export async function leaveCircle(sessionId: string): Promise<void> {
  await api.post('/circle/leave', { sessionId })
}

// O anfitrião remove um membro do círculo
export async function removeFromCircle(sessionId: string, userId: string): Promise<void> {
  await api.post('/circle/remove', { sessionId, userId })
}

// O servidor cria/reutiliza a ronda e avisa todos os membros. `roundId` é a
// identidade persistente; `shotAt` serve para a janela e `inMs` só para animar.
export async function startCountdown(sessionId: string): Promise<{
  roundId: string
  shotAt: string
  inMs: number
  expiresAt: string
}> {
  const res = await api.post('/circle/countdown', { sessionId })
  return res.data.data ?? res.data
}

// Guardar a minha foto (com emojis) na sessão
export async function addCirclePhoto(
  sessionId: string,
  uri: string,
  overlays: EmojiOverlay[] = [],
  roundId: string | null,
  slot: 1 | 2,
): Promise<{ capture: CircleCapture; roundId: string }> {
  const form = new FormData()
  form.append('sessionId', sessionId)
  form.append('media', { uri, name: 'circle.jpg', type: 'image/jpeg' } as unknown as Blob)
  // Enviar também [] torna explícito que uma nova foto sem emojis deve limpar
  // os da foto anterior, em vez de deixar o campo ausente.
  form.append('overlays', JSON.stringify(overlays))
  // `solo` pede ao servidor uma ronda individual; uma string liga a fotografia,
  // sem inferência temporal, à ronda sincronizada que originou a prévia.
  form.append('roundId', roundId ?? 'solo')
  form.append('slot', String(slot))
  const res = await uploadApi.post('/circle/photo', form, { headers: { 'Content-Type': 'multipart/form-data' } })
  return res.data.data ?? res.data
}

// Cada participante publica no próprio feed um snapshot da ronda escolhida.
export async function publishCircle(sessionId: string, roundId: string, caption?: string): Promise<Post> {
  const res = await api.post('/circle/publish', { sessionId, roundId, caption })
  return res.data.data
}

// Sem captureId, mantém compatibilidade com a ação antiga de retirar todas.
export async function withdrawMyPhoto(sessionId: string, captureId?: string): Promise<void> {
  await api.post('/circle/photo/withdraw', { sessionId, ...(captureId ? { captureId } : {}) })
}

export async function getCircleSession(sessionId: string): Promise<CircleState> {
  const res = await api.get(`/circle/session/${sessionId}`)
  return normalizeState(res.data.data as CircleState)
}
