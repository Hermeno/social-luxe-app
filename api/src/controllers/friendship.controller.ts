import { Response } from 'express'
import * as friendshipService from '../services/friendship.service'
import { ok, created, badRequest, serverError, notFound, forbidden } from '../utils/response'
import { handleError } from '../utils/errors'
import { AuthRequest } from '../types'
import { FriendshipDuration } from '@prisma/client'

export async function getFriendshipLevel(req: AuthRequest, res: Response) {
  try {
    const result = await friendshipService.getFriendshipLevel(req.user!.userId, req.params.userId)
    return ok(res, result)
  } catch (err) { return handleError(res, err) }
}

export async function sendRequest(req: AuthRequest, res: Response) {
  try {
    const { targetUserId, duration } = req.body
    if (!targetUserId || !duration) return badRequest(res, 'targetUserId and duration required')
    if (!Object.values(FriendshipDuration).includes(duration)) {
      return badRequest(res, 'Invalid duration')
    }
    const friendship = await friendshipService.sendRequest(req.user!.userId, targetUserId, duration)
    return created(res, friendship)
  } catch (err) { return handleError(res, err) }
}

export async function getFriends(req: AuthRequest, res: Response) {
  try {
    const friends = await friendshipService.getFriends(req.user!.userId)
    return ok(res, friends)
  } catch (err) { return handleError(res, err) }
}

export async function renewFriendship(req: AuthRequest, res: Response) {
  try {
    const result = await friendshipService.renewFriendship(req.user!.userId, req.params.id)
    return ok(res, result, 'Friendship renewed')
  } catch (err) { return handleError(res, err) }
}

export async function removeFriendship(req: AuthRequest, res: Response) {
  try {
    await friendshipService.removeFriendship(req.user!.userId, req.params.id)
    return ok(res, null, 'Friendship removed')
  } catch (err) { return handleError(res, err) }
}

export async function getFriendshipStreak(req: AuthRequest, res: Response) {
  try {
    const result = await friendshipService.getFriendshipStreak(req.user!.userId, req.params.userId)
    return ok(res, result)
  } catch (err) { return handleError(res, err) }
}
