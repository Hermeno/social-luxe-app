import { Response } from 'express'
import * as session from '../services/circleSession.service'
import * as moment from '../services/circleMoment.service'
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
    let requestedSlot: number | undefined
    if (req.body.slot != null && req.body.slot !== '') {
      const parsedSlot = Number(req.body.slot)
      if (!Number.isInteger(parsedSlot) || parsedSlot < 1 || parsedSlot > session.MAX_CAPTURE_SLOT) {
        fs.unlink(req.file.path, () => {})
        return badRequest(res, `slot must be an integer from 1 to ${session.MAX_CAPTURE_SLOT}`)
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
    return ok(res, { ok: true, roundId: result.roundId, round: result.round, capture: result.capture })
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

// ─── Círculo publicado: entrar depois e retirar fotografias ───────────────────

export async function requestJoin(req: AuthRequest, res: Response) {
  let uploadedUrl: string | null = null
  try {
    const momentId = req.params.momentId
    if (!req.file) return badRequest(res, 'Photo required')
    if (!req.file.mimetype.startsWith('image/')) {
      fs.unlink(req.file.path, () => {})
      return badRequest(res, 'Photo must be an image')
    }
    // Quem não pode pedir fica à porta antes de pagar o upload. O serviço volta
    // a verificar tudo depois, dentro da transacção.
    await moment.assertCanRequestJoin(req.user!.userId, momentId)
    const uploaded = await uploadToCloudinaryWithMeta(req.file, 'luxe/circle')
    uploadedUrl = uploaded.url
    const request = await moment.requestToJoin(req.user!.userId, momentId, {
      url: uploaded.url,
      width: uploaded.width ?? null,
      height: uploaded.height ?? null,
    })
    uploadedUrl = null
    return created(res, request)
  } catch (err) {
    if (!uploadedUrl && req.file) fs.unlink(req.file.path, () => {})
    if (uploadedUrl) deleteFromCloudinary(uploadedUrl).catch(() => {})
    return handleError(res, err, 'circle.requestJoin')
  }
}

export async function cancelJoin(req: AuthRequest, res: Response) {
  try {
    const result = await moment.cancelJoinRequest(req.user!.userId, req.params.requestId)
    cleanupCircleUrls([result.discardedPhotoUrl])
    return ok(res, { ok: true })
  } catch (err) { return handleError(res, err, 'circle.cancelJoin') }
}

export async function incomingJoins(req: AuthRequest, res: Response) {
  try {
    return ok(res, await moment.incomingJoinRequests(req.user!.userId))
  } catch (err) { return handleError(res, err, 'circle.incomingJoins') }
}

export async function myJoins(req: AuthRequest, res: Response) {
  try {
    return ok(res, await moment.myPendingJoinRequests(req.user!.userId))
  } catch (err) { return handleError(res, err, 'circle.myJoins') }
}

export async function decideJoin(req: AuthRequest, res: Response) {
  try {
    const { accept } = req.body ?? {}
    if (typeof accept !== 'boolean') return badRequest(res, 'accept must be a boolean')
    const result = await moment.decideJoinRequest(req.user!.userId, req.params.requestId, accept)
    if (result.discardedPhotoUrl) cleanupCircleUrls([result.discardedPhotoUrl])
    return ok(res, { accepted: result.accepted })
  } catch (err) { return handleError(res, err, 'circle.decideJoin') }
}

export async function removeMomentPhotos(req: AuthRequest, res: Response) {
  try {
    const { captureId } = req.body ?? {}
    if (captureId != null && typeof captureId !== 'string') return badRequest(res, 'captureId must be a string')
    const result = await moment.removeMomentPhotos(req.user!.userId, req.params.momentId, captureId || undefined)
    // Só sai do armazenamento o que nenhum post, captura ou pedido ainda usa.
    cleanupCircleUrls(await session.unreferencedCirclePhotos(result.removedUrls))
    return ok(res, { removedCaptureIds: result.removedCaptureIds, removedPostIds: result.removedPostIds })
  } catch (err) { return handleError(res, err, 'circle.removeMomentPhotos') }
}
