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
  /** A ordem da fotografia entre as da mesma pessoa — 1, 2, 3… sem reutilizar. */
  slot: number
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
  /** Quantas fotografias cada pessoa pode pôr numa ronda. Também do servidor. */
  maxCapturesPerRound?: number
}

export interface CircleState {
  session: CircleSession
  members: CircleMember[]
  currentRound: CircleRound | null
  publishWindowMs?: number
  maxCapturesPerRound?: number
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

/**
 * Uma fotografia do Círculo tem uns 2 MB; os 3 minutos do `uploadApi` são para
 * vídeo. Um envio preso ali segurava a fila inteira — e o publicar, que espera
 * por ela. Assim falha a tempo de a fila tentar outra vez.
 */
const CIRCLE_PHOTO_TIMEOUT_MS = 45_000

// Enviar uma fotografia já tirada. `roundId` null pede ao servidor uma ronda
// individual; um id liga a fotografia à ronda em que foi tirada, sem inferência
// temporal. O `slot` é numerado pelo telemóvel: repetir o mesmo envio (a
// resposta perdeu-se) substitui a fotografia em vez de a duplicar.
export async function addCirclePhoto(
  sessionId: string,
  uri: string,
  roundId: string | null,
  slot: number,
): Promise<{ capture: CircleCapture; roundId: string; round?: CircleRound }> {
  const form = new FormData()
  form.append('sessionId', sessionId)
  form.append('media', { uri, name: 'circle.jpg', type: 'image/jpeg' } as unknown as Blob)
  form.append('roundId', roundId ?? 'solo')
  form.append('slot', String(slot))
  const res = await uploadApi.post('/circle/photo', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: CIRCLE_PHOTO_TIMEOUT_MS,
  })
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

// ─── Círculo publicado: entrar depois e retirar fotografias ──────────────────

export interface CircleJoinRequest {
  id: string
  momentId: string
  mediaUrl: string
  photoWidth: number | null
  photoHeight: number | null
  createdAt: string
  requester: { id: string; name: string; username: string | null; avatar: string | null }
}

export interface MyCircleJoinRequest {
  id: string
  momentId: string
  createdAt: string
}

// Pedir para entrar num Círculo já publicado, com uma fotografia tirada agora.
export async function requestToJoinCircle(momentId: string, uri: string): Promise<MyCircleJoinRequest> {
  const form = new FormData()
  form.append('media', { uri, name: 'circle-join.jpg', type: 'image/jpeg' } as unknown as Blob)
  const res = await uploadApi.post(`/circle/moments/${encodeURIComponent(momentId)}/join`, form, {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: CIRCLE_PHOTO_TIMEOUT_MS,
  })
  return res.data.data ?? res.data
}

export async function cancelJoinRequest(requestId: string): Promise<void> {
  await api.delete(`/circle/join-requests/${encodeURIComponent(requestId)}`)
}

// Os pedidos à espera da minha decisão, como anfitrião.
export async function getIncomingJoinRequests(): Promise<CircleJoinRequest[]> {
  const res = await api.get('/circle/join-requests/incoming')
  return Array.isArray(res.data?.data) ? res.data.data : []
}

// Os meus pedidos ainda por decidir.
export async function getMyJoinRequests(): Promise<MyCircleJoinRequest[]> {
  const res = await api.get('/circle/join-requests/mine')
  return Array.isArray(res.data?.data) ? res.data.data : []
}

export async function decideJoinRequest(requestId: string, accept: boolean): Promise<void> {
  await api.post(`/circle/join-requests/${encodeURIComponent(requestId)}/decision`, { accept })
}

// Retirar as minhas fotografias de um Círculo publicado (ou uma só, pelo id).
// O anfitrião pode retirar também a de quem entrou depois.
export async function removeMomentPhotos(momentId: string, captureId?: string): Promise<{
  removedCaptureIds: string[]
  removedPostIds: string[]
}> {
  const res = await api.post(
    `/circle/moments/${encodeURIComponent(momentId)}/remove-photos`,
    captureId ? { captureId } : {},
  )
  return res.data.data ?? { removedCaptureIds: [], removedPostIds: [] }
}
