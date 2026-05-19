import { prisma } from '../config/database'

export async function getConversations(userId: string) {
  const messages = await prisma.message.findMany({
    where: { OR: [{ senderId: userId }, { receiverId: userId }] },
    include: {
      sender: { select: { id: true, name: true, avatar: true } },
      receiver: { select: { id: true, name: true, avatar: true } },
    },
    orderBy: { createdAt: 'desc' },
    distinct: ['senderId', 'receiverId'],
  })
  return messages
}

export async function getMessages(userId: string, otherId: string, page = 1, limit = 30) {
  return prisma.message.findMany({
    where: {
      OR: [
        { senderId: userId, receiverId: otherId },
        { senderId: otherId, receiverId: userId },
      ],
    },
    include: {
      sender: { select: { id: true, name: true, avatar: true } },
    },
    orderBy: { createdAt: 'desc' },
    skip: (page - 1) * limit,
    take: limit,
  })
}

export async function sendMessage(senderId: string, receiverId: string, content?: string, mediaUrl?: string) {
  if (!content && !mediaUrl) throw new Error('Message must have content or media')
  const receiver = await prisma.user.findUnique({ where: { id: receiverId } })
  if (!receiver) throw new Error('Receiver not found')

  return prisma.message.create({
    data: { senderId, receiverId, content, mediaUrl },
    include: { sender: { select: { id: true, name: true, avatar: true } } },
  })
}

export async function markRead(userId: string, otherId: string) {
  return prisma.message.updateMany({
    where: { senderId: otherId, receiverId: userId, readAt: null },
    data: { readAt: new Date() },
  })
}
