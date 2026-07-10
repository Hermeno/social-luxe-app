import { Response } from 'express'
import * as circleService from '../services/circle.service'
import { ok, created, badRequest } from '../utils/response'
import { handleError } from '../utils/errors'
import { AuthRequest } from '../types'
import { uploadToCloudinary } from '../utils/cloudinary.util'

export async function getCurrent(req: AuthRequest, res: Response) {
  try {
    const state = await circleService.getCurrent(req.user!.userId)
    return ok(res, state)
  } catch (err) { return handleError(res, err, 'circle.getCurrent') }
}

export async function submitCapture(req: AuthRequest, res: Response) {
  try {
    const { targetId } = req.body
    if (!targetId) return badRequest(res, 'targetId required')
    if (!req.file)  return badRequest(res, 'Photo required')

    const mediaUrl = await uploadToCloudinary(req.file, 'luxe/circle')
    const capture  = await circleService.submitCapture(req.user!.userId, targetId, mediaUrl)
    return created(res, capture)
  } catch (err) { return handleError(res, err, 'circle.submitCapture') }
}

export async function vote(req: AuthRequest, res: Response) {
  try {
    const raw = req.body?.match
    if (raw !== true && raw !== false && raw !== 'true' && raw !== 'false') {
      return badRequest(res, 'match (true/false) required')
    }
    const result = await circleService.vote(req.user!.userId, req.params.id, raw === true || raw === 'true')
    return ok(res, result)
  } catch (err) { return handleError(res, err, 'circle.vote') }
}
