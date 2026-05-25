import { prisma } from '../config/database'

export async function getActiveChallenges() {
  const now = new Date()
  return prisma.challenge.findMany({
    where: {
      startsAt: { lte: now },
      endsAt: { gte: now },
    },
    orderBy: { startsAt: 'asc' },
  })
}
