import { prisma } from '../config/database'

export async function blockUser(blockerId: string, blockedId: string) {
  if (blockerId === blockedId) throw new Error('Cannot block yourself')
  const target = await prisma.user.findUnique({ where: { id: blockedId }, select: { id: true } })
  if (!target) throw new Error('User not found')

  // Blocking is a state, not a one-shot event. Upsert keeps retries (for
  // example after a slow mobile connection) from failing with P2002.
  return prisma.block.upsert({
    where: { blockerId_blockedId: { blockerId, blockedId } },
    create: { blockerId, blockedId },
    update: {},
  })
}

export async function unblockUser(blockerId: string, blockedId: string) {
  // Idempotent so a repeated tap/retry cannot turn a successful unblock into
  // an error, and deleteMany also avoids the find-then-delete race.
  return prisma.block.deleteMany({ where: { blockerId, blockedId } })
}

export async function getBlockedUsers(userId: string) {
  const blocks = await prisma.block.findMany({
    where: { blockerId: userId },
    include: {
      blocked: { select: { id: true, name: true, username: true, avatar: true } },
    },
    orderBy: { createdAt: 'desc' },
  })
  // Keep the target user at the top level. The mobile client addresses the
  // unblock route by user id; the previous nested shape made it call
  // DELETE /blocks/undefined and also made profiles appear never blocked.
  return blocks.map((b) => ({
    ...b.blocked,
    blockId: b.id,
    blockedAt: b.createdAt,
  }))
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
