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

export async function getFriendshipLevel(currentUserId: string, targetUserId: string) {
  const friendship = await prisma.friendship.findFirst({
    where: {
      OR: [
        { userAId: currentUserId, userBId: targetUserId },
        { userAId: targetUserId, userBId: currentUserId },
      ],
    },
  })

  if (!friendship) return { isFriend: false, level: 0, tier: 0 }

  const [messages, myComments, theirComments, myLikes, theirLikes] = await Promise.all([
    prisma.message.count({
      where: {
        OR: [
          { senderId: currentUserId, receiverId: targetUserId },
          { senderId: targetUserId, receiverId: currentUserId },
        ],
      },
    }),
    prisma.comment.count({ where: { userId: currentUserId, post: { userId: targetUserId } } }),
    prisma.comment.count({ where: { userId: targetUserId, post: { userId: currentUserId } } }),
    prisma.like.count({ where: { userId: currentUserId, post: { userId: targetUserId } } }),
    prisma.like.count({ where: { userId: targetUserId, post: { userId: currentUserId } } }),
  ])

  // Messages: max 60 pts | Comments: max 30 pts | Likes: max 10 pts = 100 total
  const score =
    Math.min(messages, 30) * 2 +
    Math.min(myComments + theirComments, 15) * 2 +
    Math.min(myLikes + theirLikes, 10)

  const level = Math.min(100, score)
  const tier  = level === 0 ? 1 : Math.min(5, Math.ceil(level / 20))

  return { isFriend: true, level, tier, friendshipId: friendship.id }
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

export async function getFriendshipStreak(userId: string, friendId: string): Promise<{ streakDays: number }> {
  const now = new Date()
  const thirtyDaysAgo = new Date(now)
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

  // Build an array of the last 30 days and check if both users had at least 1 interaction on each day
  const [messages, comments] = await Promise.all([
    prisma.message.findMany({
      where: {
        createdAt: { gte: thirtyDaysAgo },
        OR: [
          { senderId: userId, receiverId: friendId },
          { senderId: friendId, receiverId: userId },
        ],
      },
      select: { createdAt: true },
    }),
    prisma.comment.findMany({
      where: {
        createdAt: { gte: thirtyDaysAgo },
        OR: [
          { userId, post: { userId: friendId } },
          { userId: friendId, post: { userId } },
        ],
      },
      select: { createdAt: true },
    }),
  ])

  // Collect all interaction dates as day strings (YYYY-MM-DD)
  const interactionDays = new Set<string>()
  const toDay = (d: Date) => d.toISOString().slice(0, 10)

  messages.forEach((m) => interactionDays.add(toDay(m.createdAt)))
  comments.forEach((c) => interactionDays.add(toDay(c.createdAt)))

  return { streakDays: interactionDays.size }
}
