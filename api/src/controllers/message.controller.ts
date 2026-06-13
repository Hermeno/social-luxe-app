import { Response } from 'express'
import * as messageService from '../services/message.service'
import { ok, created, badRequest, serverError, notFound, forbidden } from '../utils/response'
import { handleError } from '../utils/errors'
import { AuthRequest } from '../types'
import { emitToUser } from '../socket'
import { sendPush } from '../services/notification.service'
import { prisma } from '../config/database'
import { uploadToCloudinary } from '../utils/cloudinary.util'

export async function getConversations(req: AuthRequest, res: Response) {
  try {
    const conversations = await messageService.getConversations(req.user!.userId)
    return ok(res, conversations)
  } catch (err) { return handleError(res, err) }
}

export async function getMessages(req: AuthRequest, res: Response) {
  try {
    const page = Number(req.query.page ?? 1)
    const messages = await messageService.getMessages(req.user!.userId, req.params.userId, page)
    await messageService.markRead(req.user!.userId, req.params.userId)
    return ok(res, messages)
  } catch (err) { return handleError(res, err) }
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
  } catch (err) { return handleError(res, err) }
}

export async function editMessage(req: AuthRequest, res: Response) {
  try {
    const { content } = req.body
    if (!content?.trim()) return badRequest(res, 'content required')
    const msg = await prisma.message.findUnique({ where: { id: req.params.id } })
    if (!msg) return notFound(res, 'Message not found')
    if (msg.senderId !== req.user!.userId) return forbidden(res, 'Not your message')
    const updated = await prisma.message.update({
      where: { id: req.params.id },
      data: { content: content.trim() },
      include: { sender: { select: { id: true, name: true, avatar: true } }, replyTo: { select: { id: true, content: true, sender: { select: { name: true } } } }, reactions: { select: { emoji: true, userId: true } } },
    })
    emitToUser(msg.receiverId, 'message:edited', updated)
    return ok(res, updated)
  } catch (err) { return handleError(res, err) }
}

export async function deleteMessage(req: AuthRequest, res: Response) {
  try {
    const msg = await prisma.message.findUnique({ where: { id: req.params.id } })
    if (!msg) return notFound(res, 'Message not found')
    if (msg.senderId !== req.user!.userId) return forbidden(res, 'Not your message')
    // Null out any reply references first to avoid FK constraint errors
    await prisma.message.updateMany({ where: { replyToId: req.params.id }, data: { replyToId: null } })
    await prisma.messageReaction.deleteMany({ where: { messageId: req.params.id } })
    await prisma.message.delete({ where: { id: req.params.id } })
    emitToUser(msg.receiverId, 'message:deleted', { messageId: req.params.id })
    return ok(res, { deleted: true })
  } catch (err) { return handleError(res, err) }
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
  } catch (err) { return handleError(res, err) }
}
