import { prisma } from '../config/database'
import { MediaType } from '@prisma/client'
import { POST_INITIAL_HOURS } from '../types'

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
