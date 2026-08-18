import { Response } from 'express'
import { AuthRequest } from '../types'
import { badRequest, ok } from '../utils/response'
import { handleError } from '../utils/errors'
import * as muteService from '../services/mute.service'

const VALID_DURATIONS = new Set<muteService.MuteDuration>(['ONE_MONTH', 'FOREVER'])

export async function getMutedUsers(req: AuthRequest, res: Response) {
  try {
    const users = await muteService.getMutedUsers(req.user!.userId)
    return ok(res, users)
  } catch (err) {
    return handleError(res, err, 'getMutedUsers')
  }
}

export async function muteUser(req: AuthRequest, res: Response) {
  try {
    const userId = req.params.userId
    const duration = req.body?.duration as muteService.MuteDuration | undefined
    if (!duration || !VALID_DURATIONS.has(duration)) {
      return badRequest(res, 'duration must be ONE_MONTH or FOREVER')
    }
    if (userId === req.user!.userId) return badRequest(res, 'Cannot mute yourself')

    const mute = await muteService.muteUser(req.user!.userId, userId, duration)
    return ok(res, mute, 'User publications muted')
  } catch (err) {
    return handleError(res, err, 'muteUser')
  }
}

export async function unmuteUser(req: AuthRequest, res: Response) {
  try {
    await muteService.unmuteUser(req.user!.userId, req.params.userId)
    return ok(res, null, 'User publications unmuted')
  } catch (err) {
    return handleError(res, err, 'unmuteUser')
  }
}

