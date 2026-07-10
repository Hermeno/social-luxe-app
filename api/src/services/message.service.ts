import { prisma } from '../config/database'

const MSG_SELECT = {
  sender:    { select: { id: true, name: true, avatar: true } },
  replyTo:   { select: { id: true, content: true, sender: { select: { name: true } } } },
  reactions: { select: { emoji: true, userId: true } },
} as const

export async function getConversations(userId: string) {
  // Latest message per conversation, computed in the DB — Prisma's `distinct`
  // loads every message for the user and dedupes in memory, which degrades
  // as history grows.
  const rows = await prisma.$queryRaw<{ id: string }[]>`
    SELECT id FROM (
      SELECT id, ROW_NUMBER() OVER (
        PARTITION BY LEAST("senderId", "receiverId"), GREATEST("senderId", "receiverId")
        ORDER BY "createdAt" DESC
      ) AS rn
      FROM "Message"
      WHERE "senderId" = ${userId} OR "receiverId" = ${userId}
    ) t
    WHERE rn = 1
  `
  if (rows.length === 0) return []

  return prisma.message.findMany({
    where: { id: { in: rows.map((r) => r.id) } },
    include: {
      sender:   { select: { id: true, name: true, avatar: true } },
      receiver: { select: { id: true, name: true, avatar: true } },
    },
    orderBy: { createdAt: 'desc' },
  })
}

export async function getMessages(
  userId: string,
  otherId: string,
  before?: string,
  limit = 30,
) {
  return prisma.message.findMany({
    where: {
      OR: [
        { senderId: userId, receiverId: otherId },
        { senderId: otherId, receiverId: userId },
      ],
      ...(before ? { createdAt: { lt: new Date(before) } } : {}),
    },
    include: MSG_SELECT,
    orderBy: { createdAt: 'desc' },
    take: limit,
  })
}

export async function sendMessage(
  senderId: string,
  receiverId: string,
  content?: string,
  mediaUrl?: string,
  replyToId?: string,
) {
  if (!content && !mediaUrl) throw new Error('Message must have content or media')
  const receiver = await prisma.user.findUnique({ where: { id: receiverId } })
  if (!receiver) throw new Error('Receiver not found')

  // A block in either direction kills the conversation
  const blocked = await prisma.block.findFirst({
    where: {
      OR: [
        { blockerId: receiverId, blockedId: senderId },
        { blockerId: senderId,   blockedId: receiverId },
      ],
    },
    select: { id: true },
  })
  if (blocked) throw new Error('You cannot message this user')

  return prisma.message.create({
    data: { senderId, receiverId, content, mediaUrl, replyToId },
    include: MSG_SELECT,
  })
}

export async function markRead(userId: string, otherId: string) {
  return prisma.message.updateMany({
    where: { senderId: otherId, receiverId: userId, readAt: null },
    data: { readAt: new Date() },
  })
}

export async function reactToMessage(userId: string, messageId: string, emoji: string) {
  // Toggle: if same emoji exists, delete it; otherwise upsert
  const existing = await prisma.messageReaction.findUnique({
    where: { messageId_userId: { messageId, userId } },
  })

  if (existing?.emoji === emoji) {
    await prisma.messageReaction.delete({ where: { messageId_userId: { messageId, userId } } })
    return { removed: true, emoji }
  }

  await prisma.messageReaction.upsert({
    where:  { messageId_userId: { messageId, userId } },
    update: { emoji },
    create: { messageId, userId, emoji },
  })
  return { removed: false, emoji }
}
