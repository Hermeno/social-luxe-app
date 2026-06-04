import { Response } from 'express'
import * as blockService from '../services/block.service'
import { ok, badRequest, serverError, notFound, forbidden, created } from '../utils/response'
import { handleError } from '../utils/errors'
import { AuthRequest } from '../types'

export async function blockUser(req: AuthRequest, res: Response) {
  try {
    const { targetUserId } = req.body
    if (!targetUserId) return badRequest(res, 'targetUserId required')
    const block = await blockService.blockUser(req.user!.userId, targetUserId)
    return ok(res, block, 'User blocked')
  } catch (err) { return handleError(res, err) }
}

export async function unblockUser(req: AuthRequest, res: Response) {
  try {
    await blockService.unblockUser(req.user!.userId, req.params.userId)
    return ok(res, null, 'User unblocked')
  } catch (err) { return handleError(res, err) }
}

export async function getBlockedUsers(req: AuthRequest, res: Response) {
  try {
    const users = await blockService.getBlockedUsers(req.user!.userId)
    return ok(res, users)
  } catch (err) { return handleError(res, err) }
}
