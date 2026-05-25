import { Response } from 'express'
import * as reactionService from '../services/reaction.service'
import { ok, badRequest, serverError } from '../utils/response'
import { AuthRequest } from '../types'
import { ReactionType } from '@prisma/client'

export async function react(req: AuthRequest, res: Response) {
  try {
    const { type, anonymous = false } = req.body
    if (!type) return badRequest(res, 'Reaction type required')
    if (!Object.values(ReactionType).includes(type)) return badRequest(res, 'Invalid reaction type')
    const reaction = await reactionService.reactToPost(
      req.user!.userId,
      req.params.id,
      type as ReactionType,
      Boolean(anonymous),
    )
    return ok(res, reaction)
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed'
    return serverError(res, msg)
  }
}

export async function removeReaction(req: AuthRequest, res: Response) {
  try {
    await reactionService.removeReaction(req.user!.userId, req.params.id)
    return ok(res, null, 'Reaction removed')
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed'
    return badRequest(res, msg)
  }
}

export async function getReactions(req: AuthRequest, res: Response) {
  try {
    const data = await reactionService.getReactions(req.params.id)
    return ok(res, data)
  } catch {
    return serverError(res)
  }
}
