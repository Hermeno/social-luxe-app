import { prisma } from '../config/database'
import { FriendshipDuration } from '@prisma/client'
import { FRIENDSHIP_DURATION_DAYS } from '../types'

function calcExpiry(duration: FriendshipDuration): Date | null {
  const days = FRIENDSHIP_DURATION_DAYS[duration]
  if (days === null) return null
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000)
}

export async function sendRequest(userAId: string, userBId: string, duration: FriendshipDuration) {
  if (userAId === userBId) throw new Error('Cannot add yourself')
  const target = await prisma.user.findUnique({ where: { id: userBId } })
  if (!target) throw new Error('User not found')

  const existing = await prisma.friendship.findFirst({
    where: { OR: [{ userAId, userBId }, { userAId: userBId, userBId: userAId }] },
  })
  if (existing) throw new Error('Friendship already exists')

  const expiresAt = calcExpiry(duration)
  return prisma.friendship.create({ data: { userAId, userBId, duration, expiresAt } })
}

export async function renewFriendship(userId: string, friendshipId: string) {
  const friendship = await prisma.friendship.findUnique({ where: { id: friendshipId } })
  if (!friendship) throw new Error('Friendship not found')
  if (friendship.userAId !== userId && friendship.userBId !== userId) throw new Error('Forbidden')

  const expiresAt = calcExpiry(friendship.duration)
  return prisma.friendship.update({
    where: { id: friendshipId },
    data: { expiresAt, renewedAt: new Date() },
  })
}

export async function removeFriendship(userId: string, friendshipId: string) {
  const f = await prisma.friendship.findUnique({ where: { id: friendshipId } })
  if (!f || (f.userAId !== userId && f.userBId !== userId)) throw new Error('Friendship not found')

  await prisma.friendshipHistory.create({
    data: { userAId: f.userAId, userBId: f.userBId, duration: f.duration, startedAt: f.createdAt, endedAt: new Date() },
  })
  return prisma.friendship.delete({ where: { id: friendshipId } })
}

export async function getFriends(userId: string) {
  const friendships = await prisma.friendship.findMany({
    where: { OR: [{ userAId: userId }, { userBId: userId }] },
    include: {
      userA: { select: { id: true, name: true, avatar: true } },
      userB: { select: { id: true, name: true, avatar: true } },
    },
  })
  return friendships.map((f) => ({
    friendshipId: f.id,
    duration: f.duration,
    expiresAt: f.expiresAt,
    renewedAt: f.renewedAt,
    friend: f.userAId === userId ? f.userB : f.userA,
  }))
}
