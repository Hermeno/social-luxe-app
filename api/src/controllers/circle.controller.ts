import { Response } from 'express'
import * as session from '../services/circleSession.service'
import { ok, created, badRequest } from '../utils/response'
import { handleError } from '../utils/errors'
import { AuthRequest } from '../types'
import { deleteFromCloudinary, uploadToCloudinaryWithMeta } from '../utils/cloudinary.util'
import fs from 'fs'

function cleanupCircleUrls(urls: string[] | undefined) {
  for (const url of urls ?? []) deleteFromCloudinary(url).catch(() => {})
}

export async function open(req: AuthRequest, res: Response) {
  try {
    const lat = typeof req.body?.lat === 'number' ? req.body.lat : undefined
    const lng = typeof req.body?.lng === 'number' ? req.body.lng : undefined
    const state = await session.openSession(req.user!.userId, lat, lng)
    return ok(res, state)
  } catch (err) { return handleError(res, err, 'circle.open') }
}

export async function state(req: AuthRequest, res: Response) {
  try {
    return ok(res, await session.getSessionState(req.params.id, req.user!.userId))
  } catch (err) { return handleError(res, err, 'circle.state') }
}

export async function incoming(req: AuthRequest, res: Response) {
  try {
    return ok(res, await session.incomingCall(req.user!.userId))
  } catch (err) { return handleError(res, err, 'circle.incoming') }
}

export async function call(req: AuthRequest, res: Response) {
  try {
    const { sessionId, userId } = req.body
    if (!sessionId || !userId) return badRequest(res, 'sessionId and userId required')
    return ok(res, await session.callUser(req.user!.userId, sessionId, userId))
  } catch (err) { return handleError(res, err, 'circle.call') }
}

export async function join(req: AuthRequest, res: Response) {
  try {
    const { sessionId } = req.body
    if (!sessionId) return badRequest(res, 'sessionId required')
    return ok(res, await session.joinSession(req.user!.userId, sessionId))
  } catch (err) { return handleError(res, err, 'circle.join') }
}

export async function leave(req: AuthRequest, res: Response) {
  try {
    const { sessionId } = req.body
    if (!sessionId) return badRequest(res, 'sessionId required')
    const result = await session.leaveSession(req.user!.userId, sessionId)
    cleanupCircleUrls(result.discardedPhotoUrls)
    return ok(res, { ok: true, removedCaptureIds: result.removedCaptureIds })
  } catch (err) { return handleError(res, err, 'circle.leave') }
}

export async function remove(req: AuthRequest, res: Response) {
  try {
    const { sessionId, userId } = req.body
    if (!sessionId || !userId) return badRequest(res, 'sessionId and userId required')
    const result = await session.removeMember(req.user!.userId, sessionId, userId)
    cleanupCircleUrls(result.discardedPhotoUrls)
    return ok(res, { ok: true, removedCaptureIds: result.removedCaptureIds })
  } catch (err) { return handleError(res, err, 'circle.remove') }
}

type Overlay = { emoji: string; x: number; y: number }

function parseOverlays(raw: unknown): Overlay[] {
  let arr: unknown = raw
  if (typeof raw === 'string') { try { arr = JSON.parse(raw) } catch { return [] } }
  if (!Array.isArray(arr)) return []
  return arr
    .filter((o): o is Overlay =>
      !!o && typeof (o as any).emoji === 'string' && (o as any).emoji.length <= 8 &&
      typeof (o as any).x === 'number' && typeof (o as any).y === 'number')
    .slice(0, 16)
    .map((o) => ({ emoji: o.emoji, x: Math.max(0, Math.min(1, o.x)), y: Math.max(0, Math.min(1, o.y)) }))
}

export async function photo(req: AuthRequest, res: Response) {
  let uploadedUrl: string | null = null
  try {
    const { sessionId } = req.body
    if (!sessionId) {
      if (req.file) fs.unlink(req.file.path, () => {})
      return badRequest(res, 'sessionId required')
    }
    if (!req.file)  return badRequest(res, 'Photo required')
    if (!req.file.mimetype.startsWith('image/')) {
      fs.unlink(req.file.path, () => {})
      return badRequest(res, 'Photo must be an image')
    }
    // Autorizar antes de pagar o upload. `addPhoto` volta a validar depois,
    // cobrindo uma sessão que feche enquanto o ficheiro sobe.
    const current = await session.getSessionState(sessionId, req.user!.userId)
    if (current.session.status !== 'OPEN') throw new Error('Sessão já fechou')
    const overlays = parseOverlays(req.body.overlays)
    const requestedRoundId = typeof req.body.roundId === 'string' && req.body.roundId
      ? req.body.roundId
      : undefined
    let requestedSlot: 1 | 2 | undefined
    if (req.body.slot != null && req.body.slot !== '') {
      const parsedSlot = Number(req.body.slot)
      if (parsedSlot !== 1 && parsedSlot !== 2) {
        fs.unlink(req.file.path, () => {})
        return badRequest(res, 'slot must be 1 or 2')
      }
      requestedSlot = parsedSlot
    }
    let requestedRoundAt: Date | null | undefined
    if (req.body.roundAt === 'solo') {
      requestedRoundAt = null
    } else if (typeof req.body.roundAt === 'string' && req.body.roundAt) {
      requestedRoundAt = new Date(req.body.roundAt)
      if (Number.isNaN(requestedRoundAt.getTime())) {
        fs.unlink(req.file.path, () => {})
        return badRequest(res, 'Invalid capture round')
      }
    }
    const uploaded = await uploadToCloudinaryWithMeta(req.file, 'luxe/circle')
    uploadedUrl = uploaded.url
    const result = await session.addPhoto(
      req.user!.userId,
      sessionId,
      uploaded.url,
      overlays,
      uploaded.width,
      uploaded.height,
      requestedRoundId ?? (requestedRoundAt === null ? 'solo' : undefined),
      requestedSlot,
      requestedRoundAt,
    )
    // A nova URL já está persistida; uma falha posterior ao escrever a resposta
    // não lhe pode dar o tratamento de upload órfão.
    uploadedUrl = null
    cleanupCircleUrls(result.discardedPhotoUrls)
    return ok(res, { ok: true, roundId: result.roundId, capture: result.capture })
  } catch (err) {
    if (!uploadedUrl && req.file) fs.unlink(req.file.path, () => {})
    // Se a sessão fechou ou a escrita falhou depois do upload, esta URL nunca
    // chegou a nenhum Post e pode ser removida imediatamente.
    if (uploadedUrl) deleteFromCloudinary(uploadedUrl).catch(() => {})
    return handleError(res, err, 'circle.photo')
  }
}

export async function countdown(req: AuthRequest, res: Response) {
  try {
    const { sessionId } = req.body
    if (!sessionId) return badRequest(res, 'sessionId required')
    const result = await session.startCountdown(req.user!.userId, sessionId)
    return ok(res, result)
  } catch (err) { return handleError(res, err, 'circle.countdown') }
}

export async function withdrawPhoto(req: AuthRequest, res: Response) {
  try {
    const { sessionId, captureId } = req.body
    if (!sessionId) return badRequest(res, 'sessionId required')
    if (captureId != null && typeof captureId !== 'string') return badRequest(res, 'captureId must be a string')
    const result = await session.withdrawPhoto(req.user!.userId, sessionId, captureId || undefined)
    cleanupCircleUrls(result.discardedPhotoUrls)
    return ok(res, { ok: true, removedCaptureIds: result.removedCaptureIds })
  } catch (err) { return handleError(res, err, 'circle.withdrawPhoto') }
}

export async function publish(req: AuthRequest, res: Response) {
  try {
    const { sessionId, caption, roundId } = req.body
    if (!sessionId) return badRequest(res, 'sessionId required')
    if (roundId != null && typeof roundId !== 'string') return badRequest(res, 'roundId must be a string')
    const post = await session.publishSession(
      req.user!.userId,
      sessionId,
      caption?.trim() || undefined,
      roundId || undefined,
    )
    return created(res, post)
  } catch (err) { return handleError(res, err, 'circle.publish') }
}
