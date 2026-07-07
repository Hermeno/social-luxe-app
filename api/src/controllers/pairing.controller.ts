import { Response } from 'express'
import * as pairingService from '../services/pairing.service'
import { ok, created, badRequest, forbidden } from '../utils/response'
import { handleError } from '../utils/errors'
import { AuthRequest } from '../types'
import { emitToUser } from '../socket'
import { sendPush } from '../services/notification.service'
import { prisma } from '../config/database'

const PAIRING_TYPES = new Set(['AMIGOS', 'AMORES', 'IRMAOS', 'BESTS', 'BONITONAS', 'GEMEAS', 'OUTRO'])

function partnerOf(pairing: { userA: { id: string }; userB: { id: string } }, userId: string) {
  return pairing.userA.id === userId ? pairing.userB.id : pairing.userA.id
}

function labelOf(pairing: { type: string; customLabel: string | null }) {
  if (pairing.type === 'OUTRO' && pairing.customLabel) return pairing.customLabel
  const names: Record<string, string> = {
    AMIGOS: 'Amigos', AMORES: 'Amores', IRMAOS: 'Irmãos',
    BESTS: 'Bests', BONITONAS: 'Bonitonas', GEMEAS: 'Gémeas', OUTRO: 'Par',
  }
  return names[pairing.type] ?? 'Par'
}

export async function getMyPairing(req: AuthRequest, res: Response) {
  try {
    const pairing = await pairingService.getMyPairing(req.user!.userId)
    return ok(res, pairing)
  } catch (err) { return handleError(res, err) }
}

export async function getUserPairing(req: AuthRequest, res: Response) {
  try {
    const pairing = await pairingService.getActivePairingForProfile(req.params.id)
    return ok(res, pairing)
  } catch (err) { return handleError(res, err) }
}

export async function invitePairing(req: AuthRequest, res: Response) {
  try {
    const userId = req.user!.userId
    const { targetUserId, type, customLabel } = req.body
    if (!targetUserId || !type) return badRequest(res, 'targetUserId e type são obrigatórios')
    if (!PAIRING_TYPES.has(type)) return badRequest(res, 'Tipo de par inválido')
    if (type === 'OUTRO' && !customLabel?.trim()) return badRequest(res, 'customLabel é obrigatório para o tipo OUTRO')

    const pairing = await pairingService.invitePairing(userId, targetUserId, type, customLabel?.trim())

    const requester = await prisma.user.findUnique({
      where: { id: userId }, select: { id: true, name: true, avatar: true },
    })
    const message = `${requester?.name} quer formar par contigo como "${labelOf(pairing)}"`
    emitToUser(targetUserId, 'pairing:invited', { pairing })
    emitToUser(targetUserId, 'notification:new', {
      id: `pairing_${pairing.id}_${Date.now()}`,
      type: 'pairing_invite',
      message,
      read: false,
      createdAt: new Date().toISOString(),
      fromUser: requester,
    })
    sendPush(targetUserId, '💫 Convite de par', message, { type: 'pairing_invite', pairingId: pairing.id }).catch(() => {})

    return created(res, pairing)
  } catch (err: any) {
    if (err?.message?.includes('já tens') || err?.message?.includes('já tem') || err?.message?.includes('contigo mesmo')) {
      return badRequest(res, err.message)
    }
    return handleError(res, err)
  }
}

export async function respondPairing(req: AuthRequest, res: Response) {
  try {
    const userId = req.user!.userId
    const accept = req.body.accept === true || req.body.accept === 'true'
    const pairing = await pairingService.respondPairing(req.params.id, userId, accept)

    const other = partnerOf(pairing, userId)
    emitToUser(other, accept ? 'pairing:active' : 'pairing:ended', { pairing })
    if (accept) {
      const responder = await prisma.user.findUnique({
        where: { id: userId }, select: { id: true, name: true, avatar: true },
      })
      const message = `${responder?.name} aceitou o teu convite de par!`
      emitToUser(other, 'notification:new', {
        id: `pairing_${pairing.id}_accept_${Date.now()}`,
        type: 'pairing_accept',
        message,
        read: false,
        createdAt: new Date().toISOString(),
        fromUser: responder,
      })
      sendPush(other, '💫 Par aceite', message, { type: 'pairing_accept', pairingId: pairing.id }).catch(() => {})
    }

    return ok(res, pairing)
  } catch (err: any) {
    if (err?.message?.includes('não és') || err?.message?.includes('próprio')) return forbidden(res, err.message)
    if (err?.message?.includes('já foi respondido') || err?.message?.includes('não encontrado')) return badRequest(res, err.message)
    return handleError(res, err)
  }
}

export async function endPairing(req: AuthRequest, res: Response) {
  try {
    const userId = req.user!.userId
    const pairing = await pairingService.endPairing(req.params.id, userId)

    const other = partnerOf(pairing, userId)
    emitToUser(other, 'pairing:ended', { pairing })

    return ok(res, pairing)
  } catch (err: any) {
    if (err?.message?.includes('não és')) return forbidden(res, err.message)
    if (err?.message?.includes('já terminou') || err?.message?.includes('não encontrado')) return badRequest(res, err.message)
    return handleError(res, err)
  }
}
