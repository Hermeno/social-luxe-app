import { Response } from 'express'
import * as session from '../services/circleSession.service'
import { ok, created, badRequest } from '../utils/response'
import { handleError } from '../utils/errors'
import { AuthRequest } from '../types'
import { uploadToCloudinary } from '../utils/cloudinary.util'

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
    return ok(res, await session.getSessionState(req.params.id))
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
    return ok(res, await session.leaveSession(req.user!.userId, sessionId))
  } catch (err) { return handleError(res, err, 'circle.leave') }
}

export async function remove(req: AuthRequest, res: Response) {
  try {
    const { sessionId, userId } = req.body
    if (!sessionId || !userId) return badRequest(res, 'sessionId and userId required')
    return ok(res, await session.removeMember(req.user!.userId, sessionId, userId))
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
  try {
    const { sessionId } = req.body
    if (!sessionId) return badRequest(res, 'sessionId required')
    if (!req.file)  return badRequest(res, 'Photo required')
    const overlays = parseOverlays(req.body.overlays)
    const url = await uploadToCloudinary(req.file, 'luxe/circle')
    return ok(res, await session.addPhoto(req.user!.userId, sessionId, url, overlays))
  } catch (err) { return handleError(res, err, 'circle.photo') }
}

export async function countdown(req: AuthRequest, res: Response) {
  try {
    const { sessionId } = req.body
    if (!sessionId) return badRequest(res, 'sessionId required')
    const result = await session.startCountdown(req.user!.userId, sessionId)
    return ok(res, result)
  } catch (err) { return handleError(res, err, 'circle.countdown') }
}

export async function publish(req: AuthRequest, res: Response) {
  try {
    const { sessionId, caption } = req.body
    if (!sessionId) return badRequest(res, 'sessionId required')
    const post = await session.publishSession(req.user!.userId, sessionId, caption?.trim() || undefined)
    return created(res, post)
  } catch (err) { return handleError(res, err, 'circle.publish') }
}
