import cron from 'node-cron'
import { prisma } from '../config/database'
import { POST_EXTENSION_THRESHOLD } from '../types'
import { deleteFromCloudinary } from '../utils/cloudinary.util'
import { deleteFromR2, isR2Url } from '../utils/r2.util'
import { expireStaleHalves } from '../services/half.service'
import { closeStaleSessions } from '../services/circleSession.service'

async function deleteMediaUrl(url: string | null): Promise<void> {
  if (!url) return
  if (isR2Url(url)) {
    await deleteFromR2(url)
  } else if (url.includes('cloudinary.com')) {
    await deleteFromCloudinary(url)
  }
}

async function hardDeletePost(postId: string, mediaUrl: string | null): Promise<void> {
  const current = await prisma.post.findUnique({
    where:  { id: postId },
    select: {
      repostEntry: { select: { postId: true } },
      reposts:     { select: { repostedPostId: true } },
    },
  })
  // O original pode ter sido processado primeiro e levado esta cópia consigo.
  if (!current) return
  const repostEntry = current.repostEntry
  const copies = current.reposts

  // Uma cópia de repost usa o URL do original. Só o original é dono do ficheiro
  // físico; apagar uma cópia nunca pode partir a media que ele referencia.
  if (!repostEntry) deleteMediaUrl(mediaUrl).catch(() => {})

  // Hard-delete all related records then the post itself.
  // Order matters: child records before parent to avoid FK violations.
  await prisma.$transaction(async (tx) => {
    await tx.repost.deleteMany({ where: { OR: [{ postId }, { repostedPostId: postId }] } })
    if (copies.length > 0) {
      await tx.post.deleteMany({ where: { id: { in: copies.map((r) => r.repostedPostId) } } })
    }
    await tx.postExtendVote.deleteMany({ where: { postId } })
    await tx.reaction.deleteMany({ where: { postId } })
    await tx.share.deleteMany({ where: { postId } })
    await tx.view.deleteMany({ where: { postId } })
    await tx.like.deleteMany({ where: { postId } })
    // Delete replies before top-level comments to respect self-referential FK
    await tx.comment.deleteMany({ where: { postId, parentId: { not: null } } })
    await tx.comment.deleteMany({ where: { postId } })
    await tx.post.delete({ where: { id: postId } })
  })
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

// Sessões de Círculo que passaram da idade: fecham e as fotos que ninguém
// publicou saem do armazenamento.
async function processStaleCircles() {
  const urls = await closeStaleSessions()
  for (const url of urls) {
    await deleteMediaUrl(url).catch(() => {})
  }
}

async function runCleanup() {
  await processExpiredPosts().catch((err) => console.error('[Cron] post cleanup failed:', err))
  await processExpiredStories().catch((err) => console.error('[Cron] story cleanup failed:', err))
  await expireStaleHalves().catch((err) => console.error('[Cron] half cleanup failed:', err))
  await processStaleCircles().catch((err) => console.error('[Cron] circle cleanup failed:', err))
}

export function startCleanupJob() {
  cron.schedule('0 * * * *', runCleanup)
  console.log('[Cron] Cleanup job started (posts, stories, halves, circles)')
}
