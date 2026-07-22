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
) {
  const expiresAt = isAnnouncement
    ? new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)
    : new Date(Date.now() + POST_INITIAL_HOURS * 60 * 60 * 1000)
  const post = await prisma.post.create({
    data: { userId, mediaUrl, mediaType, caption, bgColor, expiresAt, partnerUserId: partnerUserId ?? null, isAnnouncement: isAnnouncement ?? false, deviceModel: deviceModel ?? null },
    include: {
      user:        { select: { id: true, name: true, avatar: true, viewsPublic: true, showDevice: true, statusLabel: true } },
      partnerUser: { select: { id: true, name: true, avatar: true } },
      _count:      { select: { likes: true, comments: true, shares: true, views: true } },
    },
  })

  return withThumbnail(post)
}

// Álbum: várias fotos numa só publicação, mostradas em grelha na feed.
// mediaUrl = 1ª foto (thumbnail/compat); mediaUrls = todas.
type Overlay = { emoji: string; x: number; y: number }

export async function createAlbumPost(
  userId: string,
  mediaUrls: string[],
  caption?: string,
  deviceModel?: string,
  albumOverlays?: Overlay[][],   // paralelo a mediaUrls; emojis de cada foto
) {
  const hasOverlays = albumOverlays?.some((a) => a.length > 0)
  const expiresAt = new Date(Date.now() + POST_INITIAL_HOURS * 60 * 60 * 1000)
  const post = await prisma.post.create({
    data: {
      userId,
      mediaUrl:  mediaUrls[0] ?? null,
      mediaUrls,
      albumOverlays: hasOverlays ? albumOverlays : undefined,
      mediaType: MediaType.IMAGE,
      caption:   caption ?? null,
      bgColor:   null,
      expiresAt,
      deviceModel: deviceModel ?? null,
    },
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

// ─── Feed meta helpers ────────────────────────────────────────────────────────

// Fetch up to 4 unique non-author commenters and the caller's vote
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

  // ── Vote extend + User likes ─────────────────────────────────────────────────
  const votedPostIds  = new Set<string>()
  const likedPostIds  = new Set<string>()
  if (userId && allPostIds.length > 0) {
    const [votes, likes] = await Promise.all([
      prisma.postExtendVote.findMany({
        where:  { userId, postId: { in: allPostIds } },
        select: { postId: true },
      }),
      prisma.like.findMany({
        where:  { userId, postId: { in: allPostIds } },
        select: { postId: true },
      }),
    ])
    votes.forEach((v) => votedPostIds.add(v.postId))
    likes.forEach((l) => likedPostIds.add(l.postId))
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
      hasVotedExtend: votedPostIds.has(p.id),
      userLiked:      likedPostIds.has(p.id),
    }
  })
}

export async function getFeed(userId: string, page = 1, limit = 10) {
  // Touch lastSeen so other users can see this user is online (fire-and-forget)
  prisma.user.update({ where: { id: userId }, data: { lastSeen: new Date() } }).catch(() => {})

  const now = new Date()
  // Janela de frescura do feed: o post circula no feed só nas primeiras 48h.
  // A vida estendida por interações (3/10/30 dias, 1 ano, para sempre) mantém o
  // post VIVO — visível no perfil do autor, por link, com objetos e comentários —
  // mas não volta a encher o feed dos seguidores. Anúncios ficam isentos.
  const FEED_WINDOW_MS = 48 * 60 * 60 * 1000
  const freshSince = new Date(now.getTime() - FEED_WINDOW_MS)
  const baseWhere = {
    deletedAt: null,
    expiresAt: { gt: now },
    AND: [{ OR: [{ createdAt: { gte: freshSince } }, { isAnnouncement: true }] }],
  }
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

// Search posts by caption (case-insensitive), excluding blocked users, deleted
// and expired posts. Same shape as the feed so the client can reuse Post cards.
export async function searchPosts(query: string, userId: string) {
  const now = new Date()
  const [blocksGiven, blocksReceived] = await Promise.all([
    prisma.block.findMany({ where: { blockerId: userId }, select: { blockedId: true } }),
    prisma.block.findMany({ where: { blockedId: userId }, select: { blockerId: true } }),
  ])
  const blockedIds = [
    ...blocksGiven.map((b) => b.blockedId),
    ...blocksReceived.map((b) => b.blockerId),
  ]

  const posts = await prisma.post.findMany({
    where: {
      deletedAt: null,
      expiresAt: { gt: now },
      userId: { notIn: blockedIds },
      caption: { contains: query, mode: 'insensitive' },
    },
    include: {
      user:        { select: { id: true, name: true, avatar: true, viewsPublic: true, isAdmin: true, showDevice: true, statusLabel: true, lastSeen: true } },
      partnerUser: { select: { id: true, name: true, avatar: true } },
      _count:      { select: { likes: true, comments: true, shares: true, views: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: 30,
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

// ── Vida por interação ─────────────────────────────────────────────────────────
// Todo post nasce com 24h. Interações somam pontos; ao atingir um nível, a vida
// (contada a partir do createdAt) sobe: 3 dias → 10 → 30 → 1 ano → para sempre.
// A expiração nunca encolhe — só cresce.
const ENGAGE_WEIGHTS = { view: 1, like: 3, reaction: 3, comment: 5, share: 8 }
const DAY_MS = 24 * 60 * 60 * 1000
const LIFE_TIERS: { minScore: number; lifeMs: number }[] = [
  { minScore: 2000, lifeMs: 100 * 365 * DAY_MS },  // para sempre (100 anos)
  { minScore: 600,  lifeMs: 365 * DAY_MS },        // 1 ano
  { minScore: 150,  lifeMs: 30 * DAY_MS },         // 30 dias
  { minScore: 50,   lifeMs: 10 * DAY_MS },         // 10 dias
  { minScore: 15,   lifeMs: 3 * DAY_MS },          // 3 dias
]

export async function recalcPostLife(postId: string) {
  const post = await prisma.post.findUnique({
    where:  { id: postId },
    select: {
      createdAt: true, expiresAt: true, isAnnouncement: true, deletedAt: true,
      _count: { select: { likes: true, comments: true, shares: true, views: true } },
    },
  })
  if (!post || post.isAnnouncement || post.deletedAt) return

  const reactions = await prisma.reaction.count({ where: { postId } }).catch(() => 0)
  const c = post._count
  const score =
    c.views    * ENGAGE_WEIGHTS.view +
    c.likes    * ENGAGE_WEIGHTS.like +
    reactions  * ENGAGE_WEIGHTS.reaction +
    c.comments * ENGAGE_WEIGHTS.comment +
    c.shares   * ENGAGE_WEIGHTS.share

  const tier = LIFE_TIERS.find((t) => score >= t.minScore)
  if (!tier) return

  const tierExpiry = new Date(post.createdAt.getTime() + tier.lifeMs)
  if (tierExpiry.getTime() > post.expiresAt.getTime()) {
    await prisma.post.update({ where: { id: postId }, data: { expiresAt: tierExpiry } })
  }
}

export async function likePost(userId: string, postId: string) {
  const existing = await prisma.like.findUnique({ where: { userId_postId: { userId, postId } } })
  if (existing) {
    await prisma.like.delete({ where: { userId_postId: { userId, postId } } })
    return { liked: false }
  }
  await prisma.like.create({ data: { userId, postId } })
  extendLife(postId, 10).catch(() => {})
  recalcPostLife(postId).catch(() => {})
  return { liked: true }
}

export async function addView(userId: string, postId: string) {
  await prisma.view.upsert({
    where: { userId_postId: { userId, postId } },
    update: {},
    create: { userId, postId },
  })
  recalcPostLife(postId).catch(() => {})
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
  recalcPostLife(postId).catch(() => {})
  return share
}

// Repost — republica o conteúdo do post original como uma nova publicação do
// utilizador (aparece na feed dele). Credita também uma partilha ao original.
export async function repostPost(userId: string, postId: string) {
  const original = await prisma.post.findUnique({ where: { id: postId } })
  if (!original || original.deletedAt) throw new Error('Post not found')

  const expiresAt = new Date(Date.now() + POST_INITIAL_HOURS * 60 * 60 * 1000)
  const post = await prisma.post.create({
    data: {
      userId,
      mediaUrl:        original.mediaUrl,
      mediaUrls:       original.mediaUrls ?? [],
      albumOverlays:   (original.albumOverlays ?? undefined) as any,
      mediaType:       original.mediaType,
      caption:         original.caption,
      bgColor:         original.bgColor,
      expiresAt,
    },
    include: {
      user:        { select: { id: true, name: true, avatar: true, viewsPublic: true, showDevice: true, statusLabel: true } },
      partnerUser: { select: { id: true, name: true, avatar: true } },
      _count:      { select: { likes: true, comments: true, shares: true, views: true } },
    },
  })
  // credita partilha ao original e recalcula a vida dele
  prisma.share.create({ data: { userId, postId } })
    .then(() => recalcPostLife(postId))
    .catch(() => {})
  return withThumbnail(post)
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
