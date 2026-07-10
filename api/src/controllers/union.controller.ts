import { Response } from 'express'
import * as unionService from '../services/union.service'
import { ok, created, badRequest, serverError, notFound, forbidden } from '../utils/response'
import { handleError } from '../utils/errors'
import { AuthRequest } from '../types'
import { emitToUser } from '../socket'
import { sendPush } from '../services/notification.service'
import { uploadToCloudinary } from '../utils/cloudinary.util'

// ─── Union CRUD ───────────────────────────────────────────────────────────────

export async function createUnion(req: AuthRequest, res: Response) {
  try {
    const userId = req.user!.userId
    const { invitedUserId, name, label, bio } = req.body
    if (!invitedUserId || !name) return badRequest(res, 'invitedUserId e name são obrigatórios')

    const union = await unionService.createUnion(userId, invitedUserId, name, label, bio)
    return created(res, union)
  } catch (err: any) {
    if (err?.message?.includes('já pertence') || err?.message?.includes('já existe')) return badRequest(res, err.message)
    return handleError(res, err)
  }
}

export async function getMyUnions(req: AuthRequest, res: Response) {
  try {
    const unions = await unionService.getMyUnions(req.user!.userId)
    return ok(res, unions)
  } catch (err) { return handleError(res, err) }
}

export async function getUnion(req: AuthRequest, res: Response) {
  try {
    const union = await unionService.getUnion(req.params.id)
    if (!union) return notFound(res, 'União não encontrada')
    return ok(res, union)
  } catch (err) { return handleError(res, err) }
}

export async function updateUnion(req: AuthRequest, res: Response) {
  try {
    const userId = req.user!.userId
    const { name, bio, label } = req.body
    let avatar: string | undefined

    if (req.file) {
      avatar = await uploadToCloudinary(req.file, 'luxe/unions')
    }

    const union = await unionService.updateUnion(req.params.id, userId, { name, bio, label, avatar })
    return ok(res, union)
  } catch (err: any) {
    if (err?.message?.includes('membro')) return forbidden(res, err.message)
    return handleError(res, err)
  }
}

export async function dissolveUnion(req: AuthRequest, res: Response) {
  try {
    await unionService.dissolveUnion(req.params.id, req.user!.userId)
    return ok(res, { dissolved: true })
  } catch (err: any) {
    if (err?.message?.includes('membro')) return forbidden(res, err.message)
    return handleError(res, err)
  }
}

// ─── Invites ──────────────────────────────────────────────────────────────────

export async function sendInvite(req: AuthRequest, res: Response) {
  try {
    const userId = req.user!.userId
    const { toUserId } = req.body
    if (!toUserId) return badRequest(res, 'toUserId é obrigatório')

    const invite = await unionService.sendInvite(req.params.id, toUserId, userId)

    // Notify target user — socket (real-time) + push (background)
    emitToUser(toUserId, 'union:invite', { invite })
    sendPush(
      toUserId,
      '💑 Convite de União',
      `${invite.fromUnion.name} convidou-te para uma união. Aceita ou recusa.`,
      { type: 'union_invite', inviteId: invite.id, unionId: invite.fromUnion.id },
    ).catch(() => {})

    return created(res, invite)
  } catch (err: any) {
    if (err?.message?.includes('membro') || err?.message?.includes('Não és')) return forbidden(res, err.message)
    if (err?.message?.includes('já existe')) return badRequest(res, err.message)
    return handleError(res, err)
  }
}

export async function getPendingInvites(req: AuthRequest, res: Response) {
  try {
    const invites = await unionService.getPendingInvites(req.user!.userId)
    return ok(res, invites)
  } catch (err) { return handleError(res, err) }
}

export async function respondToInvite(req: AuthRequest, res: Response) {
  try {
    const userId = req.user!.userId
    const accept = req.body.accept === true || req.body.accept === 'true'
    const result = await unionService.respondToInvite(req.params.inviteId, userId, accept)
    return ok(res, { accepted: accept, union: result })
  } catch (err: any) {
    if (err?.message?.includes('não é para ti')) return forbidden(res, err.message)
    if (err?.message?.includes('já foi respondido')) return badRequest(res, err.message)
    return handleError(res, err)
  }
}

// ─── Messaging between Unions ─────────────────────────────────────────────────

export async function getUnionConversations(req: AuthRequest, res: Response) {
  try {
    const convs = await unionService.getUnionConversations(req.user!.userId)
    return ok(res, convs)
  } catch (err) { return handleError(res, err) }
}

export async function getUnionMessages(req: AuthRequest, res: Response) {
  try {
    const { fromId, toId } = req.params
    const before = req.query.before as string | undefined
    const msgs = await unionService.getUnionMessages(fromId, toId, before)
    return ok(res, msgs)
  } catch (err) { return handleError(res, err) }
}

export async function sendUnionMessage(req: AuthRequest, res: Response) {
  try {
    const userId = req.user!.userId
    const { toUnionId, content } = req.body
    if (!toUnionId) return badRequest(res, 'toUnionId é obrigatório')

    let mediaUrl: string | undefined
    if (req.file) {
      mediaUrl = await uploadToCloudinary(req.file, 'luxe/union-messages')
    }

    const msg = await unionService.sendUnionMessage(req.params.id, toUnionId, userId, content, mediaUrl)

    // Real-time: notify all members of the target union
    const { toUnionId: tId } = msg as any
    emitToUser(tId, 'union:message:new', { message: msg })

    return created(res, msg)
  } catch (err: any) {
    if (err?.message?.includes('membro')) return forbidden(res, err.message)
    return handleError(res, err)
  }
}

export async function markUnionRead(req: AuthRequest, res: Response) {
  try {
    const { fromId, toId } = req.params
    await unionService.markUnionMessagesRead(fromId, toId)
    return ok(res, { read: true })
  } catch (err) { return handleError(res, err) }
}
