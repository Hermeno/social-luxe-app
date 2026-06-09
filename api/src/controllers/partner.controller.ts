import { Response } from 'express'
import { prisma } from '../config/database'
import { AuthRequest as Request } from '../types'
import { ok, badRequest } from '../utils/response'
import { handleError } from '../utils/errors'
import { sendPush } from '../services/notification.service'

// POST /users/partner-request — send a partner request
export async function sendPartnerRequest(req: Request, res: Response) {
  try {
    const senderId   = req.user!.userId
    const receiverId = req.body.receiverId as string
    if (!receiverId)             return badRequest(res, 'receiverId required')
    if (receiverId === senderId) return badRequest(res, 'Cannot partner with yourself')

    // Both sides must be unattached
    const [sender, receiver] = await Promise.all([
      prisma.user.findUnique({ where: { id: senderId },   select: { partnerId: true, name: true } }),
      prisma.user.findUnique({ where: { id: receiverId }, select: { partnerId: true, name: true } }),
    ])
    if (sender?.partnerId)   return badRequest(res, 'Já tens uma conta associada. Remove a associação atual primeiro.')
    if (receiver?.partnerId) return badRequest(res, 'Esse utilizador já tem uma conta associada.')

    const req2 = await prisma.partnerRequest.upsert({
      where:  { senderId_receiverId: { senderId, receiverId } },
      create: { senderId, receiverId },
      update: { status: 'pending', updatedAt: new Date() },
    })

    sendPush(receiverId, '💑 Pedido de parceiro', `${sender?.name} quer associar-se a ti`, { type: 'partner_request', requestId: req2.id }).catch(() => {})

    return ok(res, req2)
  } catch (err) { return handleError(res, err, 'sendPartnerRequest') }
}

// GET /users/partner-requests — get pending incoming requests for me
export async function getPartnerRequests(req: Request, res: Response) {
  try {
    const requests = await prisma.partnerRequest.findMany({
      where:   { receiverId: req.user!.userId, status: 'pending' },
      include: { sender: { select: { id: true, name: true, avatar: true, bio: true } } },
      orderBy: { createdAt: 'desc' },
    })
    return ok(res, requests)
  } catch (err) { return handleError(res, err, 'getPartnerRequests') }
}

// PUT /users/partner-requests/:id/accept
export async function acceptPartnerRequest(req: Request, res: Response) {
  try {
    const myId = req.user!.userId
    const request = await prisma.partnerRequest.findUnique({ where: { id: req.params.id } })
    if (!request || request.receiverId !== myId) return badRequest(res, 'Request not found')
    if (request.status !== 'pending') return badRequest(res, 'Request already handled')

    // Re-check both sides are still unattached (race condition guard)
    const [senderUser, receiverUser] = await Promise.all([
      prisma.user.findUnique({ where: { id: request.senderId }, select: { name: true, avatar: true, partnerId: true } }),
      prisma.user.findUnique({ where: { id: myId },             select: { name: true, avatar: true, partnerId: true } }),
    ])
    if (senderUser?.partnerId)   return badRequest(res, 'O remetente já tem uma conta associada.')
    if (receiverUser?.partnerId) return badRequest(res, 'Já tens uma conta associada. Remove a associação atual primeiro.')

    // Link both users + reject all other pending requests for both
    await prisma.$transaction([
      prisma.partnerRequest.update({ where: { id: request.id }, data: { status: 'accepted', updatedAt: new Date() } }),
      prisma.user.update({ where: { id: request.senderId }, data: { partnerId: myId,             partnerName: receiverUser?.name } }),
      prisma.user.update({ where: { id: myId },             data: { partnerId: request.senderId, partnerName: senderUser?.name  } }),
      // Cancel all other pending requests for both parties
      prisma.partnerRequest.updateMany({
        where: { id: { not: request.id }, status: 'pending', OR: [{ senderId: request.senderId }, { receiverId: request.senderId }, { senderId: myId }, { receiverId: myId }] },
        data: { status: 'rejected', updatedAt: new Date() },
      }),
    ])

    sendPush(request.senderId, '💑 Pedido aceite!', `${receiverUser?.name} aceitou a tua associação`, { type: 'partner_accepted' }).catch(() => {})

    return ok(res, { accepted: true })
  } catch (err) { return handleError(res, err, 'acceptPartnerRequest') }
}

// PUT /users/partner-requests/:id/reject
export async function rejectPartnerRequest(req: Request, res: Response) {
  try {
    const myId = req.user!.userId
    const request = await prisma.partnerRequest.findUnique({ where: { id: req.params.id } })
    if (!request || request.receiverId !== myId) return badRequest(res, 'Request not found')

    await prisma.partnerRequest.update({ where: { id: request.id }, data: { status: 'rejected', updatedAt: new Date() } })

    return ok(res, { rejected: true })
  } catch (err) { return handleError(res, err, 'rejectPartnerRequest') }
}

// DELETE /users/partner — unlink partnership
export async function removePartner(req: Request, res: Response) {
  try {
    const myId = req.user!.userId
    const me = await prisma.user.findUnique({ where: { id: myId }, select: { partnerId: true } })
    if (!me?.partnerId) return badRequest(res, 'No partner linked')

    await prisma.$transaction([
      prisma.user.update({ where: { id: myId },          data: { partnerId: null, partnerName: null } }),
      prisma.user.update({ where: { id: me.partnerId },  data: { partnerId: null, partnerName: null } }),
    ])

    return ok(res, { removed: true })
  } catch (err) { return handleError(res, err, 'removePartner') }
}
