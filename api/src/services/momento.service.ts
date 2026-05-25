import { prisma } from '../config/database'

const MOMENTO_EXPIRY_HOURS = 1

export async function createMomento(userId: string, lat: number, lng: number, label?: string) {
  const expiresAt = new Date(Date.now() + MOMENTO_EXPIRY_HOURS * 60 * 60 * 1000)
  return prisma.momento.create({
    data: { userId, latitude: lat, longitude: lng, label, expiresAt },
    include: { user: { select: { id: true, name: true, avatar: true } } },
  })
}

export async function getFriendsMomentos(userId: string) {
  const friendships = await prisma.friendship.findMany({
    where: {
      OR: [{ userAId: userId }, { userBId: userId }],
    },
    select: { userAId: true, userBId: true },
  })

  const friendIds = friendships.map((f) => (f.userAId === userId ? f.userBId : f.userAId))

  return prisma.momento.findMany({
    where: {
      userId: { in: friendIds },
      expiresAt: { gt: new Date() },
    },
    include: {
      user: { select: { id: true, name: true, avatar: true } },
      _count: { select: { viewers: true } },
    },
    orderBy: { createdAt: 'desc' },
  })
}

export async function deleteMomento(userId: string, momentoId: string) {
  const momento = await prisma.momento.findUnique({ where: { id: momentoId } })
  if (!momento || momento.userId !== userId) throw new Error('Momento not found')
  return prisma.momento.delete({ where: { id: momentoId } })
}

export async function viewMomento(momentoId: string, viewerId: string) {
  return prisma.momentoView.upsert({
    where: { momentoId_viewerId: { momentoId, viewerId } },
    update: {},
    create: { momentoId, viewerId },
  })
}
