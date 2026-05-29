import { Response } from 'express'
import * as messageService from '../services/message.service'
import { ok, created, badRequest, serverError } from '../utils/response'
import { AuthRequest } from '../types'
import { emitToUser } from '../socket'
import { sendPush } from '../services/notification.service'
import { prisma } from '../config/database'
import { uploadToCloudinary } from '../utils/cloudinary.util'

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
    const { receiverId, content, replyToId } = req.body
    if (!receiverId) return badRequest(res, 'receiverId required')

    const block = await prisma.block.findFirst({
      where: {
        OR: [
          { blockerId: req.user!.userId, blockedId: receiverId },
          { blockerId: receiverId, blockedId: req.user!.userId },
        ],
      },
    })
    if (block) return badRequest(res, 'Cannot send message to this user')

    const mediaUrl = req.file
      ? await uploadToCloudinary(req.file.buffer, req.file.mimetype, 'luxe/messages')
      : undefined
    const message = await messageService.sendMessage(
      req.user!.userId, receiverId, content, mediaUrl, replyToId,
    )
    emitToUser(receiverId, 'message:new', message)

    const sender = await prisma.user.findUnique({ where: { id: req.user!.userId }, select: { name: true } })
    const preview = content ? content.slice(0, 60) : '🎤 Mensagem de voz'
    sendPush(receiverId, `💬 ${sender?.name}`, preview, { type: 'message', userId: req.user!.userId }).catch(() => {})

    return created(res, message)
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed'
    return badRequest(res, msg)
  }
}

export async function reactToMessage(req: AuthRequest, res: Response) {
  try {
    const { emoji } = req.body
    if (!emoji) return badRequest(res, 'emoji required')
    const result = await messageService.reactToMessage(req.user!.userId, req.params.id, emoji)
    // Notify the other user in real-time
    const msg = await prisma.message.findUnique({ where: { id: req.params.id }, select: { senderId: true, receiverId: true } })
    if (msg) {
      const targetId = msg.senderId === req.user!.userId ? msg.receiverId : msg.senderId
      emitToUser(targetId, 'message:reaction', { messageId: req.params.id, ...result, userId: req.user!.userId })
    }
    return ok(res, result)
  } catch {
    return serverError(res)
  }
}
