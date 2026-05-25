import { prisma } from '../config/database'

export async function blockUser(blockerId: string, blockedId: string) {
  if (blockerId === blockedId) throw new Error('Cannot block yourself')
  const target = await prisma.user.findUnique({ where: { id: blockedId } })
  if (!target) throw new Error('User not found')

  return prisma.block.create({ data: { blockerId, blockedId } })
}

export async function unblockUser(blockerId: string, blockedId: string) {
  const existing = await prisma.block.findUnique({
    where: { blockerId_blockedId: { blockerId, blockedId } },
  })
  if (!existing) throw new Error('Block not found')
  return prisma.block.delete({ where: { blockerId_blockedId: { blockerId, blockedId } } })
}

export async function getBlockedUsers(userId: string) {
  const blocks = await prisma.block.findMany({
    where: { blockerId: userId },
    include: {
      blocked: { select: { id: true, name: true, avatar: true } },
    },
    orderBy: { createdAt: 'desc' },
  })
  return blocks.map((b) => ({ blockId: b.id, blockedAt: b.createdAt, user: b.blocked }))
}

export async function isBlocked(userAId: string, userBId: string): Promise<boolean> {
  const block = await prisma.block.findFirst({
    where: {
      OR: [
        { blockerId: userAId, blockedId: userBId },
        { blockerId: userBId, blockedId: userAId },
      ],
    },
  })
  return block !== null
}
