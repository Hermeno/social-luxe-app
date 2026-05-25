import { prisma } from '../config/database'
import { MediaType } from '@prisma/client'
import { POST_INITIAL_HOURS, POST_EXTENDED_HOURS } from '../types'
import { sendPush } from './notification.service'

export async function createPost(userId: string, mediaUrl: string, mediaType: MediaType, caption?: string) {
  const expiresAt = new Date(Date.now() + POST_INITIAL_HOURS * 60 * 60 * 1000)
  return prisma.post.create({
    data: { userId, mediaUrl, mediaType, caption, expiresAt },
    include: { user: { select: { id: true, name: true, avatar: true } } },
  })
}

export async function getFeed(_userId: string, page = 1, limit = 10) {
  return prisma.post.findMany({
    where: { deletedAt: null, expiresAt: { gt: new Date() } },
    include: {
      user: { select: { id: true, name: true, avatar: true } },
      _count: { select: { likes: true, comments: true, shares: true, views: true } },
    },
    orderBy: { createdAt: 'desc' },
    skip: (page - 1) * limit,
    take: limit,
  })
}

export async function likePost(userId: string, postId: string) {
  const existing = await prisma.like.findUnique({ where: { userId_postId: { userId, postId } } })
  if (existing) {
    await prisma.like.delete({ where: { userId_postId: { userId, postId } } })
    return { liked: false }
  }
  await prisma.like.create({ data: { userId, postId } })
  return { liked: true }
}

export async function addView(userId: string, postId: string) {
  // Skip view if user has ghost mode enabled
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { ghostMode: true } })
  if (user?.ghostMode) return

  await prisma.view.upsert({
    where: { userId_postId: { userId, postId } },
    update: {},
    create: { userId, postId },
  })
}

export async function deletePost(userId: string, postId: string) {
  const post = await prisma.post.findUnique({ where: { id: postId } })
  if (!post || post.userId !== userId) throw new Error('Post not found')
  return prisma.post.update({ where: { id: postId }, data: { deletedAt: new Date() } })
}

export async function sharePost(userId: string, postId: string) {
  const post = await prisma.post.findUnique({ where: { id: postId } })
  if (!post || post.deletedAt) throw new Error('Post not found')
  return prisma.share.create({ data: { userId, postId } })
}

export async function voteExtendPost(userId: string, postId: string) {
  const post = await prisma.post.findUnique({ where: { id: postId } })
  if (!post || post.deletedAt) throw new Error('Post not found')

  // Create vote (unique constraint will throw if already voted)
  await prisma.postExtendVote.create({ data: { postId, userId } })

  const voteCount = await prisma.postExtendVote.count({ where: { postId } })

  // If 3 or more votes and post not yet extended, extend it
  if (voteCount >= 3 && !post.extended) {
    const newExpiresAt = new Date(Date.now() + POST_EXTENDED_HOURS * 60 * 60 * 1000)
    await prisma.post.update({
      where: { id: postId },
      data: { extended: true, expiresAt: newExpiresAt },
    })

    // Notify post owner
    await sendPush(
      post.userId,
      'Your post was extended!',
      'The community voted to keep your post alive for 48 more hours.',
      { postId },
    )
  }

  return { voteCount }
}

export async function getExtendVotes(postId: string) {
  const count = await prisma.postExtendVote.count({ where: { postId } })
  return { postId, voteCount: count }
}

export async function getFlashback(userId: string) {
  const now = new Date()
  const oneYearAgo = new Date(now)
  oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1)

  const rangeStart = new Date(oneYearAgo)
  rangeStart.setDate(rangeStart.getDate() - 3)

  const rangeEnd = new Date(oneYearAgo)
  rangeEnd.setDate(rangeEnd.getDate() + 3)

  return prisma.post.findFirst({
    where: {
      userId,
      deletedAt: null,
      createdAt: { gte: rangeStart, lte: rangeEnd },
    },
    include: {
      user: { select: { id: true, name: true, avatar: true } },
      _count: { select: { likes: true, comments: true, shares: true, views: true } },
    },
    orderBy: { createdAt: 'desc' },
  })
}
