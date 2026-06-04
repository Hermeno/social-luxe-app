import { Response } from 'express'
import * as coinService from '../services/coin.service'
import { ok, created, badRequest, serverError, notFound, forbidden } from '../utils/response'
import { handleError } from '../utils/errors'
import { AuthRequest } from '../types'

export async function getBalance(req: AuthRequest, res: Response) {
  try {
    const data = await coinService.getBalance(req.user!.userId)
    return ok(res, data)
  } catch (err) { return handleError(res, err) }
}

export async function getHistory(req: AuthRequest, res: Response) {
  try {
    const history = await coinService.getHistory(req.user!.userId)
    return ok(res, history)
  } catch (err) { return handleError(res, err) }
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
  } catch (err) { return handleError(res, err) }
}
