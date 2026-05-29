import cron from 'node-cron'
import fs from 'fs'
import path from 'path'
import { prisma } from '../config/database'
import { POST_EXTENSION_THRESHOLD } from '../types'

function unlinkMedia(mediaUrl: string) {
  const filePath = path.join(process.cwd(), mediaUrl)
  fs.unlink(filePath, () => {}) // ignore errors (file may not exist)
}

async function checkPostExtension(postId: string, userId: string): Promise<boolean> {
  const friendships = await prisma.friendship.findMany({
    where: { OR: [{ userAId: userId }, { userBId: userId }] },
  })
  const friendIds = friendships.map((f) => (f.userAId === userId ? f.userBId : f.userAId))
  if (friendIds.length === 0) return false

  const [likes, comments, shares, views] = await Promise.all([
    prisma.like.count({ where: { postId, userId: { in: friendIds } } }),
    prisma.comment.count({ where: { postId, userId: { in: friendIds } } }),
    prisma.share.count({ where: { postId, userId: { in: friendIds } } }),
    prisma.view.count({ where: { postId, userId: { in: friendIds } } }),
  ])

  const uniqueInteractors = new Set([
    ...(await prisma.like.findMany({ where: { postId, userId: { in: friendIds } }, select: { userId: true } })).map((l) => l.userId),
    ...(await prisma.view.findMany({ where: { postId, userId: { in: friendIds } }, select: { userId: true } })).map((v) => v.userId),
  ])

  return uniqueInteractors.size / friendIds.length >= POST_EXTENSION_THRESHOLD
}

async function processExpiredPosts() {
  const now = new Date()
  const expiring = await prisma.post.findMany({
    where: { deletedAt: null, expiresAt: { lte: now }, extended: false },
  })

  for (const post of expiring) {
    const shouldExtend = await checkPostExtension(post.id, post.userId)
    if (shouldExtend) {
      const newExpiry = new Date(now.getTime() + 24 * 60 * 60 * 1000)
      await prisma.post.update({ where: { id: post.id }, data: { expiresAt: newExpiry, extended: true } })
    } else {
      unlinkMedia(post.mediaUrl)
      await prisma.post.update({ where: { id: post.id }, data: { deletedAt: now } })
    }
  }

  // Hard-delete soft-deleted posts older than 7 days
  const oldPosts = await prisma.post.findMany({
    where: { deletedAt: { lte: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000) } },
    select: { id: true, mediaUrl: true },
  })
  for (const p of oldPosts) unlinkMedia(p.mediaUrl)
  await prisma.post.deleteMany({ where: { id: { in: oldPosts.map((p) => p.id) } } })
}

export function startCleanupJob() {
  cron.schedule('0 * * * *', processExpiredPosts)
  console.log('[Cron] Post cleanup job started')
}
