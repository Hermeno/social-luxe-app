import { Response } from 'express'
import * as halfService from '../services/half.service'
import { ok, created, badRequest } from '../utils/response'
import { handleError } from '../utils/errors'
import { AuthRequest } from '../types'
import { MediaType } from '@prisma/client'
import { uploadToCloudinary } from '../utils/cloudinary.util'

export async function create(req: AuthRequest, res: Response) {
  try {
    const file = req.file
    if (!file) return badRequest(res, 'Uma metade precisa de uma foto ou vídeo')

    const { caption, targetUserId } = req.body
    const mediaType = file.mimetype.startsWith('video') ? MediaType.VIDEO : MediaType.IMAGE
    const mediaUrl  = await uploadToCloudinary(file, 'luxe/halves')

    const half = await halfService.createHalf(
      req.user!.userId,
      mediaUrl,
      mediaType,
      caption?.trim() || undefined,
      targetUserId || undefined,
    )
    return created(res, half)
  } catch (err) { return handleError(res, err) }
}

export async function mine(req: AuthRequest, res: Response) {
  try {
    return ok(res, await halfService.getMyHalves(req.user!.userId))
  } catch (err) { return handleError(res, err) }
}

export async function incoming(req: AuthRequest, res: Response) {
  try {
    return ok(res, await halfService.getIncomingHalves(req.user!.userId))
  } catch (err) { return handleError(res, err) }
}

export async function detail(req: AuthRequest, res: Response) {
  try {
    return ok(res, await halfService.getHalf(req.user!.userId, req.params.id))
  } catch (err) { return handleError(res, err) }
}

export async function complete(req: AuthRequest, res: Response) {
  try {
    const file = req.file
    if (!file) return badRequest(res, 'Completar uma metade exige a tua própria foto')

    const mediaUrl = await uploadToCloudinary(file, 'luxe/halves')
    const post = await halfService.completeHalf(req.user!.userId, req.params.id, mediaUrl)
    return created(res, post)
  } catch (err) { return handleError(res, err) }
}

export async function remove(req: AuthRequest, res: Response) {
  try {
    await halfService.deleteHalf(req.user!.userId, req.params.id)
    return ok(res, { ok: true })
  } catch (err) { return handleError(res, err) }
}
