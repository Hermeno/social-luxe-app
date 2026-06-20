import { prisma } from '../config/database'
import { MediaType } from '@prisma/client'
import { POST_INITIAL_HOURS, POST_EXTENDED_HOURS } from '../types'
import { sendPush } from './notification.service'
import { withThumbnail, withThumbnails } from '../utils/cloudinary.util'

export async function createPost(
  userId: string,
  mediaUrl: string | null,
  mediaType: MediaType,
  caption?: string,
  bgColor?: string,
  partnerUserId?: string,
  isAnnouncement?: boolean,
  deviceModel?: string,
  stickersEnabled?: boolean,
) {
  const expiresAt = isAnnouncement
    ? new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)
    : new Date(Date.now() + POST_INITIAL_HOURS * 60 * 60 * 1000)
  const post = await prisma.post.create({
    data: { userId, mediaUrl, mediaType, caption, bgColor, expiresAt, partnerUserId: partnerUserId ?? null, isAnnouncement: isAnnouncement ?? false, deviceModel: deviceModel ?? null, stickersEnabled: stickersEnabled ?? false },
    include: {
      user:        { select: { id: true, name: true, avatar: true, viewsPublic: true, showDevice: true, statusLabel: true } },
      partnerUser: { select: { id: true, name: true, avatar: true } },
      _count:      { select: { likes: true, comments: true, shares: true, views: true } },
    },
  })
  return withThumbnail(post)
}

// Haversine distance in km between two lat/lng points
function haversine(lat1: number, lng1: number, lat2: number, lng2: number) {
  const R = 6371
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLng = ((lng2 - lng1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

// ─── Sticker service functions ───────────────────────────────────────────────

const STICKER_REACTION_SELECT = {
  userId: true,
  word:   true,
  user:   { select: { id: true, name: true, avatar: true } },
} as const

type RawStickerRow = {
  id: string; postId: string; userId: string; type: string; emoji: string
  content: string | null; x: number; y: number; createdAt: Date
  user:      { id: string; name: string; avatar: string | null }
  likes:     { userId: string }[]
  reactions: { userId: string; word: string; user: { id: string; name: string; avatar: string | null } }[]
}

function formatSticker(s: RawStickerRow, requesterId?: string) {
  const reactionMap = new Map<string, { count: number; mine: boolean; users: { id: string; name: string; avatar: string | null }[] }>()
  for (const r of s.reactions) {
    const prev = reactionMap.get(r.word) ?? { count: 0, mine: false, users: [] }
    reactionMap.set(r.word, {
      count: prev.count + 1,
      mine:  prev.mine || r.userId === requesterId,
      users: [...prev.users, r.user],
    })
  }
  return {
    id:        s.id,
    postId:    s.postId,
    userId:    s.userId,
    type:      s.type,
    emoji:     s.emoji,
    content:   s.content,
    x:         s.x,
    y:         s.y,
    createdAt: s.createdAt,
    user:      s.user,
    likeCount: s.likes.length,
    myLike:    s.likes.some((l) => l.userId === requesterId),
    reactions: Array.from(reactionMap.entries()).map(([word, { count, mine, users }]) => ({ word, count, mine, users })),
  }
}

export async function getStickers(postId: string, requesterId?: string) {
  const rows = await prisma.postSticker.findMany({
    where:   { postId },
    include: {
      user:      { select: { id: true, name: true, avatar: true } },
      likes:     { select: { userId: true } },
      reactions: { select: STICKER_REACTION_SELECT },
    },
    orderBy: { createdAt: 'asc' },
  })
  return rows.map((s) => formatSticker(s as RawStickerRow, requesterId))
}

export async function likeSticker(userId: string, stickerId: string) {
  const existing = await prisma.stickerLike.findUnique({
    where: { stickerId_userId: { stickerId, userId } },
  })
  if (existing) {
    await prisma.stickerLike.delete({ where: { stickerId_userId: { stickerId, userId } } })
    return { liked: false }
  }
  await prisma.stickerLike.create({ data: { stickerId, userId } })
  return { liked: true }
}

export async function reactSticker(userId: string, stickerId: string, word: string) {
  const existing = await prisma.stickerReaction.findUnique({
    where: { stickerId_userId_word: { stickerId, userId, word } },
  })
  if (existing) {
    await prisma.stickerReaction.delete({ where: { stickerId_userId_word: { stickerId, userId, word } } })
    return { reacted: false }
  }
  await prisma.stickerReaction.create({ data: { stickerId, userId, word } })
  return { reacted: true }
}

const STICKER_LIMIT = 50

export async function addSticker(userId: string, postId: string, emoji: string, x: number, y: number, type = 'emoji', content?: string) {
  const post = await prisma.post.findUnique({ where: { id: postId }, select: { stickersEnabled: true } })
  if (!post?.stickersEnabled) throw new Error('Stickers not enabled for this post')
  const count = await prisma.postSticker.count({ where: { postId } })
  if (count >= STICKER_LIMIT) throw new Error('Sticker limit reached')
  return prisma.postSticker.create({
    data:    { postId, userId, emoji, x, y, type, content: content ?? null },
    include: { user: { select: { id: true, name: true, avatar: true } } },
  })
}

export async function removeSticker(userId: string, stickerId: string) {
  const sticker = await prisma.postSticker.findUnique({
    where:   { id: stickerId },
    include: { post: { select: { userId: true } } },
  })
  if (!sticker) throw new Error('Not found')
  // Only the sticker's creator or the post owner may delete
  if (sticker.userId !== userId && sticker.post.userId !== userId) throw new Error('Not authorized')
  await prisma.postSticker.delete({ where: { id: stickerId } })
}

// ─── Feed meta helpers ────────────────────────────────────────────────────────

// Fetch up to 4 unique non-author commenters, stickers, and the caller's vote
// status for each post — all in O(1) round-trips regardless of post count.
async function attachRecentCommenters(posts: any[], userId?: string): Promise<any[]> {
  const allPostIds      = posts.map((p) => p.id)
  const commentPostIds  = posts.filter((p) => p._count.comments > 0).map((p) => p.id)

  // ── Comments ────────────────────────────────────────────────────────────────
  const byPost = new Map<string, any[]>()
  if (commentPostIds.length > 0) {
    const comments = await prisma.comment.findMany({
      where:   { postId: { in: commentPostIds }, parentId: null },
      select:  { postId: true, userId: true, user: { select: { id: true, name: true, avatar: true } } },
      orderBy: { createdAt: 'desc' },
    })
    for (const c of comments) {
      if (!byPost.has(c.postId)) byPost.set(c.postId, [])
      byPost.get(c.postId)!.push(c)
    }
  }

  // ── Stickers ────────────────────────────────────────────────────────────────
  const stickerEnabledIds = posts.filter((p) => p.stickersEnabled).map((p) => p.id)
  const allStickers = stickerEnabledIds.length > 0
    ? await prisma.postSticker.findMany({
        where:   { postId: { in: stickerEnabledIds } },
        include: {
          user:      { select: { id: true, name: true, avatar: true } },
          likes:     { select: { userId: true } },
          reactions: { select: STICKER_REACTION_SELECT },
        },
        orderBy: { createdAt: 'asc' },
      })
    : []
  const stickersByPost = new Map<string, ReturnType<typeof formatSticker>[]>()
  for (const s of allStickers) {
    if (!stickersByPost.has(s.postId)) stickersByPost.set(s.postId, [])
    stickersByPost.get(s.postId)!.push(formatSticker(s as RawStickerRow, userId))
  }

  // ── Vote extend ─────────────────────────────────────────────────────────────
  const votedPostIds = new Set<string>()
  if (userId && allPostIds.length > 0) {
    const votes = await prisma.postExtendVote.findMany({
      where:  { userId, postId: { in: allPostIds } },
      select: { postId: true },
    })
    votes.forEach((v) => votedPostIds.add(v.postId))
  }

  return posts.map((p) => {
    const seen = new Set<string>([p.userId])
    const recentCommenters: Array<{ id: string; name: string; avatar: string | null }> = []
    for (const c of byPost.get(p.id) ?? []) {
      if (seen.has(c.userId)) continue
      seen.add(c.userId)
      recentCommenters.push(c.user)
      if (recentCommenters.length >= 4) break
    }
    return {
      ...p,
      recentCommenters,
      stickers: stickersByPost.get(p.id) ?? [],
      hasVotedExtend: votedPostIds.has(p.id),
    }
  })
}

export async function getFeed(userId: string, page = 1, limit = 10) {
  // Touch lastSeen so other users can see this user is online (fire-and-forget)
  prisma.user.update({ where: { id: userId }, data: { lastSeen: new Date() } }).catch(() => {})

  const now = new Date()
  const baseWhere = { deletedAt: null, expiresAt: { gt: now } }
  const include = {
    user:        { select: { id: true, name: true, avatar: true, viewsPublic: true, isAdmin: true, showDevice: true, statusLabel: true, lastSeen: true } },
    partnerUser: { select: { id: true, name: true, avatar: true } },
    _count:      { select: { likes: true, comments: true, shares: true, views: true } },
  }

  // Get blocked user IDs (both directions) + connections (both follow directions)
  const [blocksGiven, blocksReceived, currentUser, followRows] = await Promise.all([
    prisma.block.findMany({ where: { blockerId: userId }, select: { blockedId: true } }),
    prisma.block.findMany({ where: { blockedId: userId }, select: { blockerId: true } }),
    prisma.user.findUnique({ where: { id: userId }, select: { lat: true, lng: true } }),
    // Connections = union of following + followers (same base as Messages)
    prisma.follow.findMany({
      where: { OR: [{ followerId: userId }, { followingId: userId }] },
      select: { followerId: true, followingId: true },
    }),
  ])

  const blockedIds = new Set([
    ...blocksGiven.map((b) => b.blockedId),
    ...blocksReceived.map((b) => b.blockerId),
  ])

  // Collect all connected user IDs (both directions, excluding self)
  const connectedSet = new Set<string>()
  for (const f of followRows) {
    if (f.followerId  !== userId) connectedSet.add(f.followerId)
    if (f.followingId !== userId) connectedSet.add(f.followingId)
  }
  const connectionIds = Array.from(connectedSet)
  const hasConnections = connectionIds.length > 0

  if (hasConnections) {
    // Personalised feed: all connections + own posts, excluding blocked
    const allowedIds = [...connectionIds, userId].filter((id) => !blockedIds.has(id))
    const posts = await prisma.post.findMany({
      where: { ...baseWhere, OR: [{ userId: { in: allowedIds } }, { isAnnouncement: true }] },
      include,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    })
    return attachRecentCommenters(withThumbnails(posts), userId)
  }

  // New user: show posts from people within 40 km (or all if no location)
  if (currentUser?.lat != null && currentUser?.lng != null) {
    const { lat, lng } = currentUser
    const RADIUS_KM = 40

    // Rough bounding box first (cheap), then Haversine filter in JS
    const degPerKm = 1 / 111
    const latDelta = RADIUS_KM * degPerKm
    const lngDelta = RADIUS_KM * degPerKm / Math.cos((lat * Math.PI) / 180)

    const nearbyUsers = await prisma.user.findMany({
      where: {
        id: { notIn: [userId, ...blockedIds] },
        lat: { gte: lat - latDelta, lte: lat + latDelta },
        lng: { gte: lng - lngDelta, lte: lng + lngDelta },
      },
      select: { id: true, lat: true, lng: true },
    })

    const nearbyIds = nearbyUsers
      .filter((u) => haversine(lat, lng, u.lat!, u.lng!) <= RADIUS_KM)
      .map((u) => u.id)

    if (nearbyIds.length > 0) {
      const nearbyWithSelf = [...new Set([...nearbyIds, userId])].filter((id) => !blockedIds.has(id))
      const posts = await prisma.post.findMany({
        where: { ...baseWhere, OR: [{ userId: { in: nearbyWithSelf } }, { isAnnouncement: true }] },
        include,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      })
      return attachRecentCommenters(withThumbnails(posts), userId)
    }
  }

  // Fallback: global feed — own posts always included
  const posts = await prisma.post.findMany({
    where: { ...baseWhere, OR: [{ userId: { notIn: [...blockedIds] } }, { isAnnouncement: true }] },
    include,
    orderBy: { createdAt: 'desc' },
    skip: (page - 1) * limit,
    take: limit,
  })
  return attachRecentCommenters(withThumbnails(posts), userId)
}

// Extend a post's expiry by `minutes`. Announcements are never touched.
async function extendLife(postId: string, minutes: number) {
  const post = await prisma.post.findUnique({ where: { id: postId }, select: { expiresAt: true, isAnnouncement: true } })
  if (!post || post.isAnnouncement) return
  const base = Math.max(post.expiresAt.getTime(), Date.now())
  await prisma.post.update({ where: { id: postId }, data: { expiresAt: new Date(base + minutes * 60_000) } })
}

export async function likePost(userId: string, postId: string) {
  const existing = await prisma.like.findUnique({ where: { userId_postId: { userId, postId } } })
  if (existing) {
    await prisma.like.delete({ where: { userId_postId: { userId, postId } } })
    return { liked: false }
  }
  await prisma.like.create({ data: { userId, postId } })
  extendLife(postId, 10).catch(() => {})   // +10 min — fire-and-forget
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

  // Hard delete — remove all relations first, then the post
  await prisma.$transaction([
    prisma.like.deleteMany({ where: { postId } }),
    prisma.comment.deleteMany({ where: { postId } }),
    prisma.view.deleteMany({ where: { postId } }),
    prisma.share.deleteMany({ where: { postId } }),
    prisma.bookmark.deleteMany({ where: { postId } }),
    prisma.reaction.deleteMany({ where: { postId } }),
    prisma.postExtendVote.deleteMany({ where: { postId } }),
    prisma.post.delete({ where: { id: postId } }),
  ])

  return { mediaUrl: post.mediaUrl, mediaType: post.mediaType }
}

export async function updatePostCaption(userId: string, postId: string, caption: string) {
  const post = await prisma.post.findUnique({ where: { id: postId } })
  if (!post || post.userId !== userId) throw new Error('Post not found')
  return prisma.post.update({ where: { id: postId }, data: { caption } })
}

export async function sharePost(userId: string, postId: string) {
  const post = await prisma.post.findUnique({ where: { id: postId } })
  if (!post || post.deletedAt) throw new Error('Post not found')
  const share = await prisma.share.create({ data: { userId, postId } })
  extendLife(postId, 60).catch(() => {})   // +1h — fire-and-forget
  return share
}

export async function voteExtendPost(userId: string, postId: string) {
  const post = await prisma.post.findUnique({ where: { id: postId }, select: { isAnnouncement: true, deletedAt: true } })
  if (!post || post.deletedAt) throw new Error('Post not found')
  if (post.isAnnouncement) throw new Error('Cannot vote on announcements')

  const existing = await prisma.postExtendVote.findUnique({
    where: { postId_userId: { postId, userId } },
  })

  if (existing) {
    // Un-vote: remove vote and subtract 10 minutes
    await prisma.postExtendVote.delete({ where: { postId_userId: { postId, userId } } })
    const current = await prisma.post.findUnique({ where: { id: postId }, select: { expiresAt: true } })
    if (current) {
      await prisma.post.update({
        where: { id: postId },
        data: { expiresAt: new Date(current.expiresAt.getTime() - 10 * 60_000) },
      })
    }
    return { voted: false }
  }

  // Vote: add 10 minutes
  await prisma.postExtendVote.create({ data: { postId, userId } })
  await extendLife(postId, 10)
  return { voted: true }
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

  const post = await prisma.post.findFirst({
    where: {
      userId,
      deletedAt: null,
      createdAt: { gte: rangeStart, lte: rangeEnd },
    },
    include: {
      user: { select: { id: true, name: true, avatar: true, viewsPublic: true, showDevice: true, statusLabel: true } },
      _count: { select: { likes: true, comments: true, shares: true, views: true } },
    },
    orderBy: { createdAt: 'desc' },
  })
  return post ? withThumbnail(post) : null
}
