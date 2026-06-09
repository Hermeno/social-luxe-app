import cron from 'node-cron'
import { prisma } from '../config/database'

async function expireFollows() {
  const result = await prisma.follow.deleteMany({
    where: { expiresAt: { not: null, lte: new Date() } },
  })
  if (result.count > 0) {
    console.log(`[Cron] Expired ${result.count} follow(s)`)
  }
}

export function startFollowExpiryJob() {
  cron.schedule('*/30 * * * *', expireFollows)
  console.log('[Cron] Follow expiry job started')
}
