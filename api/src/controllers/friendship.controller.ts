import { Response } from 'express'
import * as friendshipService from '../services/friendship.service'
import { ok, created, badRequest, serverError } from '../utils/response'
import { AuthRequest } from '../types'
import { FriendshipDuration } from '@prisma/client'

export async function getFriendshipLevel(req: AuthRequest, res: Response) {
  try {
    const result = await friendshipService.getFriendshipLevel(req.user!.userId, req.params.userId)
    return ok(res, result)
  } catch {
    return serverError(res)
  }
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
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed'
    return badRequest(res, msg)
  }
}

export async function getFriends(req: AuthRequest, res: Response) {
  try {
    const friends = await friendshipService.getFriends(req.user!.userId)
    return ok(res, friends)
  } catch {
    return serverError(res)
  }
}

export async function renewFriendship(req: AuthRequest, res: Response) {
  try {
    const result = await friendshipService.renewFriendship(req.user!.userId, req.params.id)
    return ok(res, result, 'Friendship renewed')
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed'
    return badRequest(res, msg)
  }
}

export async function removeFriendship(req: AuthRequest, res: Response) {
  try {
    await friendshipService.removeFriendship(req.user!.userId, req.params.id)
    return ok(res, null, 'Friendship removed')
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed'
    return badRequest(res, msg)
  }
}

export async function getFriendshipStreak(req: AuthRequest, res: Response) {
  try {
    const result = await friendshipService.getFriendshipStreak(req.user!.userId, req.params.userId)
    return ok(res, result)
  } catch {
    return serverError(res)
  }
}
