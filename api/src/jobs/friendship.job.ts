import cron from 'node-cron'
import { prisma } from '../config/database'

async function expireFriendships() {
  const now = new Date()

  const expired = await prisma.friendship.findMany({
    where: { expiresAt: { lte: now } },
  })

  for (const f of expired) {
    await prisma.friendshipHistory.create({
      data: {
        userAId: f.userAId,
        userBId: f.userBId,
        duration: f.duration,
        startedAt: f.createdAt,
        endedAt: now,
      },
    })
    await prisma.friendship.delete({ where: { id: f.id } })
  }

  if (expired.length > 0) {
    console.log(`[Cron] Expired ${expired.length} friendships`)
  }
}

export function startFriendshipJob() {
  cron.schedule('*/30 * * * *', expireFriendships)
  console.log('[Cron] Friendship expiry job started')
}
