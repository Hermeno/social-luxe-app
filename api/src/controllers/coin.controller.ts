import { Response } from 'express'
import * as coinService from '../services/coin.service'
import { ok, created, badRequest, serverError } from '../utils/response'
import { AuthRequest } from '../types'

export async function getBalance(req: AuthRequest, res: Response) {
  try {
    const data = await coinService.getBalance(req.user!.userId)
    return ok(res, data)
  } catch {
    return serverError(res)
  }
}

export async function getHistory(req: AuthRequest, res: Response) {
  try {
    const history = await coinService.getHistory(req.user!.userId)
    return ok(res, history)
  } catch {
    return serverError(res)
  }
}

export async function sendCoins(req: AuthRequest, res: Response) {
  try {
    const { receiverId, amount, postId, message } = req.body
    if (!receiverId) return badRequest(res, 'receiverId required')
    if (!amount || typeof amount !== 'number') return badRequest(res, 'amount must be a number')
    const coin = await coinService.sendCoins(
      req.user!.userId,
      receiverId,
      amount,
      postId,
      message,
    )
    return created(res, coin)
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed'
    return badRequest(res, msg)
  }
}
