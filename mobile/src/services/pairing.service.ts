import { api } from './api'
import { ApiResponse, Pairing, PairingType } from '../types'

export async function getMyPairing(): Promise<Pairing | null> {
  const res = await api.get<ApiResponse<Pairing | null>>('/pairings/me')
  return res.data.data
}

export async function getUserPairing(userId: string): Promise<Pairing | null> {
  const res = await api.get<ApiResponse<Pairing | null>>(`/pairings/user/${userId}`)
  return res.data.data
}

export async function invitePairing(
  targetUserId: string,
  type: PairingType,
  customLabel?: string,
): Promise<Pairing> {
  const res = await api.post<ApiResponse<Pairing>>('/pairings/invite', { targetUserId, type, customLabel })
  return res.data.data
}

export async function respondPairing(id: string, accept: boolean): Promise<Pairing> {
  const res = await api.post<ApiResponse<Pairing>>(`/pairings/${id}/respond`, { accept })
  return res.data.data
}

export async function endPairing(id: string): Promise<Pairing> {
  const res = await api.post<ApiResponse<Pairing>>(`/pairings/${id}/end`)
  return res.data.data
}

export const PAIRING_TYPE_LABELS: Record<PairingType, string> = {
  AMIGOS:    'Amigos',
  AMORES:    'Amores',
  IRMAOS:    'Irmãos',
  BESTS:     'Bests',
  BONITONAS: 'Bonitonas',
  GEMEAS:    'Gémeas',
  OUTRO:     'Par',
}

export function pairingLabel(p: Pick<Pairing, 'type' | 'customLabel'>): string {
  if (p.type === 'OUTRO' && p.customLabel) return p.customLabel
  return PAIRING_TYPE_LABELS[p.type] ?? 'Par'
}

export function pairingPartner(p: Pairing, myUserId: string) {
  return p.userA.id === myUserId ? p.userB : p.userA
}
