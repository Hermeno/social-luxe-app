import { Response } from 'express'
import * as notificationService from '../services/notification.service'
import { ok, badRequest, serverError, notFound, forbidden, created } from '../utils/response'
import { handleError } from '../utils/errors'
import { AuthRequest } from '../types'

export async function registerToken(req: AuthRequest, res: Response) {
  try {
    const { token, platform } = req.body
    if (!token) return badRequest(res, 'token required')
    if (!platform) return badRequest(res, 'platform required')
    await notificationService.registerToken(req.user!.userId, token, platform)
    return ok(res, null, 'Token registered')
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed'
    return serverError(res, msg)
  }
}
