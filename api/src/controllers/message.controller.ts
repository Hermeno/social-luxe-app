import { Response } from 'express'
import * as messageService from '../services/message.service'
import { ok, created, badRequest, serverError } from '../utils/response'
import { AuthRequest } from '../types'

export async function getConversations(req: AuthRequest, res: Response) {
  try {
    const conversations = await messageService.getConversations(req.user!.userId)
    return ok(res, conversations)
  } catch {
    return serverError(res)
  }
}

export async function getMessages(req: AuthRequest, res: Response) {
  try {
    const page = Number(req.query.page ?? 1)
    const messages = await messageService.getMessages(req.user!.userId, req.params.userId, page)
    await messageService.markRead(req.user!.userId, req.params.userId)
    return ok(res, messages)
  } catch {
    return serverError(res)
  }
}

export async function sendMessage(req: AuthRequest, res: Response) {
  try {
    const { receiverId, content } = req.body
    if (!receiverId) return badRequest(res, 'receiverId required')
    const mediaUrl = req.file ? `/uploads/${req.file.filename}` : undefined
    const message = await messageService.sendMessage(req.user!.userId, receiverId, content, mediaUrl)
    return created(res, message)
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed'
    return badRequest(res, msg)
  }
}
