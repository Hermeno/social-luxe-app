import cron from 'node-cron'
import { prisma } from '../config/database'
import { expireDonations } from '../services/donation.service'

async function expireFollows() {
  const result = await prisma.follow.deleteMany({
    where: { expiresAt: { not: null, lte: new Date() } },
  })
  if (result.count > 0) {
    console.log(`[Cron] Expired ${result.count} follow(s)`)
  }
}

async function runExpiry() {
  await expireFollows()
  const n = await expireDonations()
  if (n > 0) console.log(`[Cron] Expired ${n} donation(s)`)
}

export function startFollowExpiryJob() {
  cron.schedule('*/5 * * * *', runExpiry)
  console.log('[Cron] Follow + donation expiry job started')
}
