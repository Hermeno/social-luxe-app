import cron from 'node-cron'
import { prisma } from '../config/database'
import { POST_EXTENSION_THRESHOLD } from '../types'
import { deleteFromCloudinary } from '../utils/cloudinary.util'
import { deleteFromR2, isR2Url } from '../utils/r2.util'

async function deleteMediaUrl(url: string | null): Promise<void> {
  if (!url) return
  if (isR2Url(url)) {
    await deleteFromR2(url)
  } else if (url.includes('cloudinary.com')) {
    await deleteFromCloudinary(url)
  }
}

async function hardDeletePost(postId: string, mediaUrl: string | null): Promise<void> {
  // Delete media from storage first (non-blocking — failure shouldn't block DB cleanup)
  deleteMediaUrl(mediaUrl).catch(() => {})

  // Hard-delete all related records then the post itself.
  // Order matters: child records before parent to avoid FK violations.
  await prisma.$transaction([
    prisma.postExtendVote.deleteMany({ where: { postId } }),
    prisma.reaction.deleteMany({ where: { postId } }),
    prisma.bookmark.deleteMany({ where: { postId } }),
    prisma.luxeCoin.deleteMany({ where: { postId } }),
    prisma.share.deleteMany({ where: { postId } }),
    prisma.view.deleteMany({ where: { postId } }),
    prisma.like.deleteMany({ where: { postId } }),
    // Delete replies before top-level comments to respect self-referential FK
    prisma.comment.deleteMany({ where: { postId, parentId: { not: null } } }),
    prisma.comment.deleteMany({ where: { postId } }),
    prisma.post.delete({ where: { id: postId } }),
  ])
}

async function checkPostExtension(postId: string, userId: string): Promise<boolean> {
  const friendships = await prisma.friendship.findMany({
    where: { OR: [{ userAId: userId }, { userBId: userId }] },
  })
  const friendIds = friendships.map((f) => (f.userAId === userId ? f.userBId : f.userAId))
  if (friendIds.length === 0) return false

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
      await hardDeletePost(post.id, post.mediaUrl)
    }
  }

  // Clean up any old soft-deleted posts (legacy — migrating from the old soft-delete pattern)
  const legacySoftDeleted = await prisma.post.findMany({
    where: { deletedAt: { not: null } },
    select: { id: true, mediaUrl: true },
  })
  for (const p of legacySoftDeleted) {
    await hardDeletePost(p.id, p.mediaUrl)
  }
}

// Expired stories are already hidden from every query, but their DB rows and
// media files would otherwise accumulate forever.
async function processExpiredStories() {
  const expired = await prisma.story.findMany({
    where:  { expiresAt: { lte: new Date() } },
    select: { id: true, mediaUrl: true },
  })
  for (const story of expired) {
    deleteMediaUrl(story.mediaUrl).catch(() => {})
    // StoryView rows cascade at the DB level
    await prisma.story.delete({ where: { id: story.id } }).catch(() => {})
  }
}

// Momentos have no media — a bulk delete is enough (views cascade)
async function processExpiredMomentos() {
  await prisma.momento.deleteMany({ where: { expiresAt: { lte: new Date() } } })
}

async function runCleanup() {
  await processExpiredPosts().catch((err) => console.error('[Cron] post cleanup failed:', err))
  await processExpiredStories().catch((err) => console.error('[Cron] story cleanup failed:', err))
  await processExpiredMomentos().catch((err) => console.error('[Cron] momento cleanup failed:', err))
}

export function startCleanupJob() {
  cron.schedule('0 * * * *', runCleanup)
  console.log('[Cron] Cleanup job started (posts, stories, momentos)')
}
