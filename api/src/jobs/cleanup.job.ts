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

async function hardDeletePost(postId: string, mediaUrl: string | null, mediaUrls: string[] = []): Promise<void> {
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

  // Uma cópia de repost usa os URLs do original. Só um post de origem pode ser
  // dono físico; em Círculos, a referência pode ainda ser partilhada por outro
  // publicador e será verificada depois da transação.
  const ownedUrls = repostEntry
    ? []
    : [...new Set(mediaUrls.length > 0 ? mediaUrls : mediaUrl ? [mediaUrl] : [])]

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

  if (ownedUrls.length > 0) {
    const [remaining, liveCirclePhotos, liveCircleCaptures] = await Promise.all([
      prisma.post.findMany({
        where: {
          OR: [
            { mediaUrl: { in: ownedUrls } },
            { mediaUrls: { hasSome: ownedUrls } },
          ],
        },
        select: { mediaUrl: true, mediaUrls: true },
      }),
      prisma.circleSessionMember.findMany({
        where: { photoUrl: { in: ownedUrls } },
        select: { photoUrl: true },
      }),
      prisma.circleSessionCapture.findMany({
        where: { mediaUrl: { in: ownedUrls } },
        select: { mediaUrl: true },
      }),
    ])
    const referenced = new Set<string>([
      ...remaining.flatMap((post) => [
      ...(post.mediaUrl ? [post.mediaUrl] : []),
      ...post.mediaUrls,
      ]),
      ...liveCirclePhotos.flatMap((capture) => capture.photoUrl ? [capture.photoUrl] : []),
      ...liveCircleCaptures.map((capture) => capture.mediaUrl),
    ])
    ownedUrls
      .filter((url) => !referenced.has(url))
      .forEach((url) => deleteMediaUrl(url).catch(() => {}))
  }
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
      await hardDeletePost(post.id, post.mediaUrl, post.mediaUrls)
    }
  }

  // Clean up any old soft-deleted posts (legacy — migrating from the old soft-delete pattern)
  const legacySoftDeleted = await prisma.post.findMany({
    where: { deletedAt: { not: null } },
    select: { id: true, mediaUrl: true, mediaUrls: true },
  })
  for (const p of legacySoftDeleted) {
    await hardDeletePost(p.id, p.mediaUrl, p.mediaUrls)
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
