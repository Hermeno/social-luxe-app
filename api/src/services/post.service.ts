import { prisma } from '../config/database'
import { MediaType, Prisma } from '@prisma/client'
import { POST_INITIAL_HOURS, POST_EXTENDED_HOURS } from '../types'
import { sendPush } from './notification.service'
import { withThumbnail, withThumbnails } from '../utils/cloudinary.util'
import { emitToUser } from '../socket'

export async function createPost(
  userId: string,
  mediaUrl: string | null,
  mediaType: MediaType,
  caption?: string,
  bgColor?: string,
  partnerUserId?: string,
  isAnnouncement?: boolean,
  deviceModel?: string,
  mediaWidth?: number | null,
  mediaHeight?: number | null,
  fontKey?: string | null,
) {
  const expiresAt = isAnnouncement
    ? new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)
    : new Date(Date.now() + POST_INITIAL_HOURS * 60 * 60 * 1000)
  const post = await prisma.post.create({
    data: { userId, mediaUrl, mediaType, caption, bgColor, fontKey: fontKey ?? null, expiresAt, partnerUserId: partnerUserId ?? null, isAnnouncement: isAnnouncement ?? false, deviceModel: deviceModel ?? null, mediaWidth: mediaWidth ?? null, mediaHeight: mediaHeight ?? null },
    include: {
      user:        { select: { id: true, name: true, username: true, avatar: true, viewsPublic: true, showDevice: true, statusLabel: true } },
      partnerUser: { select: { id: true, name: true, username: true, avatar: true } },
      _count:      { select: { likes: true, comments: true, shares: true, reposts: true, views: true } },
    },
  })

  return withThumbnail(post)
}

// Álbum: várias fotos numa só publicação, mostradas em grelha na feed.
// mediaUrl = 1ª foto (thumbnail/compat); mediaUrls = todas.
type Overlay = { emoji: string; x: number; y: number }

export interface CollectiveMomentSnapshot {
  version: 1
  id: string
  sessionId: string
  roundId?: string
  revision?: string
  creatorId: string
  createdAt: string
  participants: Array<{
    id: string
    name: string
    username: string | null
    avatar: string | null
  }>
  captures: Array<{
    id: string
    userId: string
    slot?: number
    mediaIndex: number
    mediaUrl: string
    overlays: Overlay[]
    createdAt: string
  }>
}

type PostWriteClient = Pick<Prisma.TransactionClient, 'post'>

export async function createAlbumPost(
  userId: string,
  mediaUrls: string[],
  caption?: string,
  deviceModel?: string,
  albumOverlays?: Overlay[][],   // paralelo a mediaUrls; emojis de cada foto
  mediaSizes?: { w: number | null; h: number | null }[],   // paralelo a mediaUrls
  collectiveMoment?: CollectiveMomentSnapshot,
  db: PostWriteClient = prisma,
) {
  const hasOverlays = albumOverlays?.some((a) => a.length > 0)
  const expiresAt = new Date(Date.now() + POST_INITIAL_HOURS * 60 * 60 * 1000)
  const circlePublicationKey = collectiveMoment ? `${userId}:${collectiveMoment.id}` : null
  const data: Prisma.PostUncheckedCreateInput = {
    userId,
    mediaUrl: mediaUrls[0] ?? null,
    mediaUrls,
    mediaSizes: mediaSizes ?? undefined,
    mediaWidth: mediaSizes?.[0]?.w ?? null,
    mediaHeight: mediaSizes?.[0]?.h ?? null,
    albumOverlays: hasOverlays ? albumOverlays : undefined,
    collectiveMoment: collectiveMoment
      ? collectiveMoment as unknown as Prisma.InputJsonValue
      : undefined,
    circlePublicationKey,
    mediaType: MediaType.IMAGE,
    caption: caption ?? null,
    bgColor: null,
    expiresAt,
    deviceModel: deviceModel ?? null,
  }
  const include = {
    user:        { select: { id: true, name: true, username: true, avatar: true, viewsPublic: true, showDevice: true, statusLabel: true } },
    partnerUser: { select: { id: true, name: true, username: true, avatar: true } },
    _count:      { select: { likes: true, comments: true, shares: true, reposts: true, views: true } },
  } as const

  // Retries de rede/toques duplos devolvem o mesmo Post da mesma pessoa e
  // ronda. Álbuns comuns continuam a seguir o caminho de criação normal.
  const post = circlePublicationKey
    ? await db.post.upsert({
        where: { circlePublicationKey },
        // A mesma pessoa continua com um único Post por ronda, mas a segunda
        // captura (ou uma substituição de slot) atualiza esse Post em vez de
        // devolver para sempre o snapshot da primeira publicação.
        update: {
          mediaUrl: mediaUrls[0] ?? null,
          mediaUrls,
          mediaSizes: mediaSizes
            ? mediaSizes as unknown as Prisma.InputJsonValue
            : Prisma.DbNull,
          mediaWidth: mediaSizes?.[0]?.w ?? null,
          mediaHeight: mediaSizes?.[0]?.h ?? null,
          albumOverlays: hasOverlays
            ? albumOverlays as unknown as Prisma.InputJsonValue
            : Prisma.DbNull,
          collectiveMoment: collectiveMoment as unknown as Prisma.InputJsonValue,
          caption: caption ?? null,
          deviceModel: deviceModel ?? null,
        },
        create: data,
        include,
      })
    : await db.post.create({ data, include })
  return withThumbnail(post)
}

function collectiveCaptureUserIds(post: unknown): string[] {
  if (!post || typeof post !== 'object') return []
  const moment = (post as { collectiveMoment?: unknown }).collectiveMoment
  if (!moment || typeof moment !== 'object' || Array.isArray(moment)) return []
  const captures = (moment as { captures?: unknown }).captures
  if (!Array.isArray(captures)) return []
  return captures.flatMap((capture) => {
    if (!capture || typeof capture !== 'object') return []
    const userId = (capture as { userId?: unknown }).userId
    return typeof userId === 'string' ? [userId] : []
  })
}

// Entrega em tempo real segue a mesma fronteira de visibilidade do feed. Num
// Momento Coletivo, autoria visual inclui também quem tirou cada fotografia:
// bloquear/silenciar uma dessas pessoas não pode ser contornado pelo socket.
export async function emitPostToVisibleFollowers(
  authorId: string,
  post: unknown,
  event: 'post:new' | 'post:updated' = 'post:new',
) {
  const followers = await prisma.follow.findMany({
    where: { followingId: authorId },
    select: { followerId: true },
  })
  if (followers.length === 0) return

  const followerIds = followers.map((follow) => follow.followerId)
  const followerSet = new Set(followerIds)
  const contentUserIds = [...new Set([authorId, ...collectiveCaptureUserIds(post)])]
  const now = new Date()
  const [blocks, mutes] = await Promise.all([
    prisma.block.findMany({
      where: {
        OR: [
          { blockerId: { in: contentUserIds }, blockedId: { in: followerIds } },
          { blockerId: { in: followerIds }, blockedId: { in: contentUserIds } },
        ],
      },
      select: { blockerId: true, blockedId: true },
    }),
    prisma.userMute.findMany({
      where: {
        mutedId: { in: contentUserIds },
        muterId: { in: followerIds },
        OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
      },
      select: { muterId: true },
    }),
  ])

  const hiddenRecipients = new Set(mutes.map((mute) => mute.muterId))
  for (const block of blocks) {
    if (followerSet.has(block.blockerId)) hiddenRecipients.add(block.blockerId)
    if (followerSet.has(block.blockedId)) hiddenRecipients.add(block.blockedId)
  }

  for (const followerId of followerIds) {
    if (!hiddenRecipients.has(followerId)) emitToUser(followerId, event, post)
  }
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

export function withoutHiddenCollectiveCaptures<T extends { collectiveMoment?: unknown }>(
  posts: T[],
  hiddenUserIds: ReadonlySet<string>,
): T[] {
  if (hiddenUserIds.size === 0) return posts
  return posts.filter((post) => {
    const moment = post.collectiveMoment
    if (!moment || typeof moment !== 'object' || Array.isArray(moment)) return true
    const captures = (moment as { captures?: unknown }).captures
    if (!Array.isArray(captures)) return true
    // Sanitizar apenas um card quebraria os índices paralelos de URLs,
    // overlays e dimensões. O limite de moderação mais seguro é ocultar o
    // momento inteiro quando ele reintroduzir uma captura bloqueada/silenciada.
    return !captures.some((capture) => {
      if (!capture || typeof capture !== 'object') return false
      const userId = (capture as { userId?: unknown }).userId
      return typeof userId === 'string' && hiddenUserIds.has(userId)
    })
  })
}

// `collectiveMoment` é JSONB e a regra de moderação olha para autores dentro do
// snapshot. Filtrar só depois de skip/take encurtava a página e fazia o mobile
// concluir incorretamente que não existiam mais posts. Este helper pagina o
// conjunto já filtrado; quando não há bloqueios/mutes mantém o caminho barato.
async function findVisibleFeedPage(
  where: Prisma.PostWhereInput,
  include: Record<string, unknown>,
  hiddenUserIds: ReadonlySet<string>,
  page: number,
  limit: number,
): Promise<any[]> {
  const visibleOffset = Math.max(0, page - 1) * limit
  if (hiddenUserIds.size === 0) {
    return prisma.post.findMany({
      where,
      include,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      skip: visibleOffset,
      take: limit,
    })
  }

  const result: any[] = []
  const batchSize = Math.max(30, limit * 3)
  let rawOffset = 0
  let visibleSeen = 0
  while (result.length < limit) {
    const raw = await prisma.post.findMany({
      where,
      include,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      skip: rawOffset,
      take: batchSize,
    })
    if (raw.length === 0) break
    rawOffset += raw.length
    for (const post of withoutHiddenCollectiveCaptures(raw, hiddenUserIds)) {
      if (visibleSeen++ < visibleOffset) continue
      result.push(post)
      if (result.length === limit) break
    }
    if (raw.length < batchSize) break
  }
  return result
}

// ─── Feed meta helpers ────────────────────────────────────────────────────────

// Fetch up to 5 unique non-author commenters and the caller's interaction
// status for each post — all in O(1) round-trips regardless of post count.
// Reposts shown in the feed are copies; their count/state always comes from the
// canonical original, otherwise a "repost do repost" would fragment the total.
export async function attachPostMeta(posts: any[], userId?: string): Promise<any[]> {
  if (posts.length === 0) return []
  const allPostIds      = posts.map((p) => p.id)
  const commentPostIds  = posts.filter((p) => p._count.comments > 0).map((p) => p.id)

  const displayedReposts = await prisma.repost.findMany({
    where:  { repostedPostId: { in: allPostIds } },
    select: {
      postId: true,
      repostedPostId: true,
      post: { select: { userId: true } },
    },
  })
  const originalByDisplayed = new Map(displayedReposts.map((r) => [r.repostedPostId, r.postId]))
  const originalAuthorByDisplayed = new Map(
    displayedReposts.map((r) => [r.repostedPostId, r.post.userId]),
  )
  const originalPostIds = [...new Set(allPostIds.map((id) => originalByDisplayed.get(id) ?? id))]

  // ── Comments ────────────────────────────────────────────────────────────────
  const byPost = new Map<string, any[]>()
  if (commentPostIds.length > 0) {
    const comments = await prisma.comment.findMany({
      where:   { postId: { in: commentPostIds }, parentId: null },
      select:  { postId: true, userId: true, user: { select: { id: true, name: true, username: true, avatar: true } } },
      orderBy: { createdAt: 'desc' },
    })
    for (const c of comments) {
      if (!byPost.has(c.postId)) byPost.set(c.postId, [])
      byPost.get(c.postId)!.push(c)
    }
  }

  // ── Vote extend + likes + reposts ────────────────────────────────────────────
  const votedPostIds  = new Set<string>()
  const likedPostIds  = new Set<string>()
  const repostedOriginalIds = new Set<string>()
  const myRepostByOriginal = new Map<string, string>()

  const myViaPostIds = new Set<string>()

  const [repostCounts, myReposts] = await Promise.all([
    // O contador é da PUBLICAÇÃO onde se tocou, não do original. Uma cópia
    // nasce a zero e só sobe quando alguém repostar a partir dela.
    prisma.repost.groupBy({
      by: ['viaPostId'],
      where: { viaPostId: { in: allPostIds } },
      _count: { _all: true },
    }),
    userId
      ? prisma.repost.findMany({
          where:  { userId, postId: { in: originalPostIds } },
          select: { postId: true, repostedPostId: true, viaPostId: true },
        })
      : Promise.resolve([]),
  ])
  const repostCountByPost = new Map(
    repostCounts
      .filter((r): r is typeof r & { viaPostId: string } => r.viaPostId !== null)
      .map((r) => [r.viaPostId, r._count._all]),
  )
  myReposts.forEach((r) => {
    repostedOriginalIds.add(r.postId)
    myRepostByOriginal.set(r.postId, r.repostedPostId)
    if (r.viaPostId) myViaPostIds.add(r.viaPostId)
  })

  if (userId) {
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
    const originalPostId = originalByDisplayed.get(p.id) ?? p.id
    const isCopy = originalPostId !== p.id
    // Quantos reposts saíram DESTA publicação. Uma cópia nasce a zero e sobe
    // por mérito próprio. `userReposted` continua a olhar para o original — é
    // lá que vive o vínculo que impede repostar duas vezes o mesmo conteúdo.
    const repostCount = repostCountByPost.get(p.id) ?? 0
    const seen = new Set<string>([p.userId])
    const recentCommenters: Array<{ id: string; name: string; avatar: string | null }> = []
    for (const c of byPost.get(p.id) ?? []) {
      if (seen.has(c.userId)) continue
      seen.add(c.userId)
      recentCommenters.push(c.user)
      if (recentCommenters.length >= 5) break
    }
    return {
      ...p,
      recentCommenters,
      hasVotedExtend: votedPostIds.has(p.id),
      userLiked:      likedPostIds.has(p.id),
      repostOfId:     isCopy ? originalPostId : null,
      userReposted:   repostedOriginalIds.has(originalPostId),
      // Foi ESTA publicação que recebeu o meu +1. Só aqui o botão mostra o "1"
      // sobre o glifo; nas outras células do mesmo conteúdo fica só activo.
      userRepostedVia: myViaPostIds.has(p.id),
      userRepostId:   myRepostByOriginal.get(originalPostId) ?? null,
      repostOriginalAuthorId: originalAuthorByDisplayed.get(p.id) ?? null,
      _count:         { ...p._count, reposts: repostCount },
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
    user:        { select: { id: true, name: true, username: true, avatar: true, viewsPublic: true, isAdmin: true, showDevice: true, statusLabel: true, lastSeen: true } },
    partnerUser: { select: { id: true, name: true, username: true, avatar: true } },
    _count:      { select: { likes: true, comments: true, shares: true, reposts: true, views: true } },
  }

  // A block works in both directions. A mute is private/directional and only
  // hides publications while active; it deliberately does not affect profile,
  // follows or messages.
  const [blocksGiven, blocksReceived, activeMutes, currentUser, followRows] = await Promise.all([
    prisma.block.findMany({ where: { blockerId: userId }, select: { blockedId: true } }),
    prisma.block.findMany({ where: { blockedId: userId }, select: { blockerId: true } }),
    prisma.userMute.findMany({
      where: {
        muterId: userId,
        OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
      },
      select: { mutedId: true },
    }),
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
  const mutedIds = new Set(activeMutes.map((mute) => mute.mutedId))
  const hiddenContentIds = new Set([...blockedIds, ...mutedIds])
  // Uma cópia pertence ao reposter, mas o conteúdo continua a vir do autor
  // original. Bloquear ou silenciar esse autor também impede que o conteúdo
  // reapareça por meio de um repost de outra ligação.
  const visibleBaseWhere = hiddenContentIds.size === 0 ? baseWhere : {
    ...baseWhere,
    AND: [
      ...baseWhere.AND,
      // Keep this outside each feed branch so an announcement cannot bypass a
      // viewer's explicit block/mute choice.
      { userId: { notIn: [...hiddenContentIds] } },
      {
        OR: [
          { repostEntry: { is: null } },
          { repostEntry: { is: { post: { is: { userId: { notIn: [...hiddenContentIds] } } } } } },
        ],
      },
    ],
  }

  // Collect all connected user IDs (both directions, excluding self)
  const connectedSet = new Set<string>()
  for (const f of followRows) {
    if (f.followerId  !== userId) connectedSet.add(f.followerId)
    if (f.followingId !== userId) connectedSet.add(f.followingId)
  }
  const connectionIds = Array.from(connectedSet)
  const hasConnections = connectionIds.length > 0

  if (hasConnections) {
    // Personalised feed: all connections + own posts, excluding blocked/muted
    // publication authors.
    const allowedIds = [...connectionIds, userId].filter((id) => !hiddenContentIds.has(id))
    const posts = await findVisibleFeedPage(
      { ...visibleBaseWhere, OR: [{ userId: { in: allowedIds } }, { isAnnouncement: true }] },
      include,
      hiddenContentIds,
      page,
      limit,
    )
    return attachPostMeta(withThumbnails(posts), userId)
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
        id: { notIn: [userId, ...hiddenContentIds] },
        lat: { gte: lat - latDelta, lte: lat + latDelta },
        lng: { gte: lng - lngDelta, lte: lng + lngDelta },
      },
      select: { id: true, lat: true, lng: true },
    })

    const nearbyIds = nearbyUsers
      .filter((u) => haversine(lat, lng, u.lat!, u.lng!) <= RADIUS_KM)
      .map((u) => u.id)

    if (nearbyIds.length > 0) {
      const nearbyWithSelf = [...new Set([...nearbyIds, userId])]
        .filter((id) => !hiddenContentIds.has(id))
      const posts = await findVisibleFeedPage(
        { ...visibleBaseWhere, OR: [{ userId: { in: nearbyWithSelf } }, { isAnnouncement: true }] },
        include,
        hiddenContentIds,
        page,
        limit,
      )
      return attachPostMeta(withThumbnails(posts), userId)
    }
  }

  // Fallback: global feed — own posts always included
  const posts = await findVisibleFeedPage(
    { ...visibleBaseWhere, OR: [{ userId: { notIn: [...hiddenContentIds] } }, { isAnnouncement: true }] },
    include,
    hiddenContentIds,
    page,
    limit,
  )
  return attachPostMeta(withThumbnails(posts), userId)
}

// Search posts by caption or author identity (case-insensitive), excluding
// blocked/muted users, deleted and expired posts. Same shape as the feed so
// the client can reuse Post cards.
export async function searchPosts(query: string, userId: string) {
  const now = new Date()
  const [blocksGiven, blocksReceived, activeMutes] = await Promise.all([
    prisma.block.findMany({ where: { blockerId: userId }, select: { blockedId: true } }),
    prisma.block.findMany({ where: { blockedId: userId }, select: { blockerId: true } }),
    prisma.userMute.findMany({
      where: {
        muterId: userId,
        OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
      },
      select: { mutedId: true },
    }),
  ])
  const hiddenContentIds = [...new Set([
    ...blocksGiven.map((b) => b.blockedId),
    ...blocksReceived.map((b) => b.blockerId),
    ...activeMutes.map((mute) => mute.mutedId),
  ])]

  const posts = await prisma.post.findMany({
    where: {
      deletedAt: null,
      expiresAt: { gt: now },
      userId: { notIn: hiddenContentIds },
      AND: [
        {
          OR: [
            { caption: { contains: query, mode: 'insensitive' } },
            { user: { is: { name: { contains: query, mode: 'insensitive' } } } },
            { user: { is: { username: { contains: query, mode: 'insensitive' } } } },
          ],
        },
        {
          OR: [
            { repostEntry: { is: null } },
            { repostEntry: { is: { post: { is: { userId: { notIn: hiddenContentIds } } } } } },
          ],
        },
      ],
    },
    include: {
      user:        { select: { id: true, name: true, username: true, avatar: true, viewsPublic: true, isAdmin: true, showDevice: true, statusLabel: true, lastSeen: true } },
      partnerUser: { select: { id: true, name: true, username: true, avatar: true } },
      _count:      { select: { likes: true, comments: true, shares: true, reposts: true, views: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: 30,
  })
  return attachPostMeta(withThumbnails(withoutHiddenCollectiveCaptures(posts, new Set(hiddenContentIds))), userId)
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
const ENGAGE_WEIGHTS = { view: 1, like: 3, reaction: 3, comment: 5, share: 8, repost: 8 }
const DAY_MS = 24 * 60 * 60 * 1000
// Os limiares são um botão de afinação, não uma constante: têm de bater certo
// com o tamanho da rede. Calibrados para a base actual — um post que corra bem
// (≈20 vistas + 8 likes + 5 comentários = 69) chega aos 30 dias, que é o
// escalão que abre a feed pública. Sobe-os à medida que a rede cresce.
const LIFE_TIERS: { minScore: number; lifeMs: number }[] = [
  { minScore: 800, lifeMs: 100 * 365 * DAY_MS },  // para sempre (100 anos)
  { minScore: 250, lifeMs: 365 * DAY_MS },        // 1 ano
  { minScore: 70,  lifeMs: 30 * DAY_MS },         // 30 dias
  { minScore: 25,  lifeMs: 10 * DAY_MS },         // 10 dias
  { minScore: 8,   lifeMs: 3 * DAY_MS },          // 3 dias
]

// ─── Feed pública (sem sessão) ────────────────────────────────────────────────
// Não é a feed toda: só os posts que a comunidade manteve vivos até ao escalão
// de 30 dias. Quem chega sem conta vê a vitrina do que foi merecido, não o
// quotidiano de toda a gente. Os 25 dias de folga espelham `postLife.ts`.
//
// Estes posts já saíram da janela de 48h da feed dos membros — a vida ganha
// mantinha-os vivos mas sem circulação. É exactamente esse acervo que aqui
// ganha um segundo uso, sem mexer no que os membros vêem.
const PUBLIC_MIN_LIFE_DAYS = 25

// Devolve apenas o que é preciso para desenhar o post. `select` explícito e não
// `include`: nesta rota não há sessão, por isso o que sai daqui é o que o mundo
// vê — nada de lastSeen, isAdmin, estado de presença ou contagem de quem viu.
const PUBLIC_SELECT = {
  id: true,
  mediaUrl: true,
  mediaUrls: true,
  mediaType: true,
  caption: true,
  bgColor: true,
  createdAt: true,
  user:   { select: { id: true, name: true, username: true, avatar: true } },
  _count: { select: { likes: true, comments: true, views: true } },
} as const

export async function getPublicFeed(page = 1, limit = 10) {
  const skip = (page - 1) * limit

  // O escalão lê-se da diferença entre duas colunas e o Prisma não compara
  // colunas num `where` — daí o SQL cru só para apurar os ids.
  const rows = await prisma.$queryRaw<Array<{ id: string }>>`
    SELECT id
    FROM "Post"
    WHERE "deletedAt" IS NULL
      AND "expiresAt" > NOW()
      AND "isAnnouncement" = false
      AND "expiresAt" - "createdAt" >= ${PUBLIC_MIN_LIFE_DAYS}::float * INTERVAL '1 day'
    ORDER BY ("expiresAt" - "createdAt") DESC, "createdAt" DESC
    LIMIT ${limit} OFFSET ${skip}
  `
  if (rows.length === 0) return []

  const ids = rows.map((r) => r.id)
  const posts = await prisma.post.findMany({ where: { id: { in: ids } }, select: PUBLIC_SELECT })

  // `findMany` não garante a ordem do `in` — repõe-se a do SQL.
  const rank = new Map(ids.map((id, i) => [id, i]))
  return withThumbnails(posts).sort((a, b) => rank.get(a.id)! - rank.get(b.id)!)
}

export async function recalcPostLife(postId: string) {
  const post = await prisma.post.findUnique({
    where:  { id: postId },
    select: {
      createdAt: true, expiresAt: true, isAnnouncement: true, deletedAt: true,
      _count: { select: { likes: true, comments: true, shares: true, reposts: true, views: true } },
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
    c.shares   * ENGAGE_WEIGHTS.share +
    c.reposts  * ENGAGE_WEIGHTS.repost

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
  const post = await prisma.post.findUnique({
    where: { id: postId },
    include: { repostEntry: { select: { postId: true } } },
  })
  if (!post || post.userId !== userId) throw new Error('Post not found')
  const ownedMediaUrls = post.repostEntry
    ? []
    : [...new Set(post.mediaUrls.length > 0
        ? post.mediaUrls
        : post.mediaUrl ? [post.mediaUrl] : [])]

  await prisma.$transaction(async (tx) => {
    // Ao apagar o original, as cópias deixam de ter uma fonte legítima e saem
    // juntas. Ao apagar só uma cópia, remove-se apenas o seu vínculo de repost.
    const copies = await tx.repost.findMany({
      where:  { postId },
      select: { repostedPostId: true },
    })
    await tx.repost.deleteMany({
      where: { OR: [{ postId }, { repostedPostId: postId }] },
    })
    if (copies.length > 0) {
      await tx.post.deleteMany({ where: { id: { in: copies.map((r) => r.repostedPostId) } } })
    }

    // Hard delete — as relações restantes têm ON DELETE CASCADE.
    await tx.post.delete({ where: { id: postId } })
  })

  if (post.repostEntry) recalcPostLife(post.repostEntry.postId).catch(() => {})

  // Fotografias de um Círculo podem ser publicadas por mais de um membro. Só
  // o último Post que referencia uma URL recebe autorização para removê-la do
  // storage; apagar um dos outros não pode partir o momento de outra pessoa.
  const [stillReferenced, liveCirclePhotos, liveCircleCaptures] = ownedMediaUrls.length > 0
    ? await Promise.all([
        prisma.post.findMany({
          where: {
            OR: [
              { mediaUrl: { in: ownedMediaUrls } },
              { mediaUrls: { hasSome: ownedMediaUrls } },
            ],
          },
          select: { mediaUrl: true, mediaUrls: true },
        }),
        // Enquanto a sessão ainda conserva a captura, outro participante pode
        // publicá-la. A sessão é, portanto, uma referência tão válida quanto
        // outro Post para decidir a eliminação física.
        prisma.circleSessionMember.findMany({
          where: { photoUrl: { in: ownedMediaUrls } },
          select: { photoUrl: true },
        }),
        prisma.circleSessionCapture.findMany({
          where: { mediaUrl: { in: ownedMediaUrls } },
          select: { mediaUrl: true },
        }),
      ])
    : [[], [], []]
  const referencedUrls = new Set<string>([
    ...stillReferenced.flatMap((candidate) => [
    ...(candidate.mediaUrl ? [candidate.mediaUrl] : []),
    ...candidate.mediaUrls,
    ]),
    ...liveCirclePhotos.flatMap((capture) => capture.photoUrl ? [capture.photoUrl] : []),
    ...liveCircleCaptures.map((capture) => capture.mediaUrl),
  ])

  return {
    mediaUrl: post.mediaUrl,
    mediaUrls: ownedMediaUrls.filter((url) => !referencedUrls.has(url)),
    mediaType: post.mediaType,
    // A cópia usa o mesmo URL do original: apagá-lo do storage aqui partiria
    // o post original. Só o dono do original remove o ficheiro físico.
    deleteMedia: !post.repostEntry,
  }
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

async function resolveRepostOriginal(postId: string) {
  const source = await prisma.repost.findUnique({
    where:  { repostedPostId: postId },
    select: { postId: true },
  })
  const original = await prisma.post.findUnique({ where: { id: source?.postId ?? postId } })
  if (!original || original.deletedAt) throw new Error('Post not found')
  return original
}

const REPOSTED_POST_INCLUDE = {
  user:        { select: { id: true, name: true, username: true, avatar: true, viewsPublic: true, showDevice: true, statusLabel: true } },
  partnerUser: { select: { id: true, name: true, username: true, avatar: true } },
  _count:      { select: { likes: true, comments: true, shares: true, reposts: true, views: true } },
} as const

async function repostResult(
  userId: string,
  originalPostId: string,
  viaPostId: string,
  repostedPost: any,
) {
  // O +1 é da publicação onde se tocou, não do original.
  const viaCount = await prisma.repost.count({ where: { viaPostId } })
  const shaped = repostedPost
    ? (await attachPostMeta([withThumbnail(repostedPost)], userId))[0]
    : null
  return {
    postId: originalPostId,
    viaPostId,
    viaCount,
    reposted: true,
    repostedPost: shaped,
  }
}

// Repost idempotente: uma pessoa tem no máximo uma cópia de cada original.
// Se o alvo já for uma cópia, o vínculo continua a apontar para o original.
export async function repostPost(userId: string, postId: string) {
  const original = await resolveRepostOriginal(postId)
  // A publicação tocada: o original, ou a cópia de onde a pessoa repostou.
  const viaPostId = postId

  const existing = await prisma.repost.findUnique({
    where:   { userId_postId: { userId, postId: original.id } },
    include: { repostedPost: { include: REPOSTED_POST_INCLUDE } },
  })
  // Repetir o pedido não muda a origem: o +1 fica onde caiu da primeira vez.
  if (existing) {
    return repostResult(userId, original.id, existing.viaPostId ?? original.id, existing.repostedPost)
  }

  const expiresAt = new Date(Date.now() + POST_INITIAL_HOURS * 60 * 60 * 1000)
  let repostedPost: any
  // Se outro dispositivo ganhou a corrida, a origem é a que ele registou.
  let wonViaPostId: string | null = null
  try {
    repostedPost = await prisma.$transaction(async (tx) => {
      const copy = await tx.post.create({
        data: {
          userId,
          mediaUrl:      original.mediaUrl,
          mediaUrls:     original.mediaUrls ?? [],
          albumOverlays: (original.albumOverlays ?? undefined) as any,
          mediaWidth:    original.mediaWidth,
          mediaHeight:   original.mediaHeight,
          mediaSizes:    (original.mediaSizes ?? undefined) as any,
          collectiveMoment: (original.collectiveMoment ?? undefined) as any,
          mediaType:     original.mediaType,
          caption:       original.caption,
          bgColor:       original.bgColor,
          fontKey:       original.fontKey,
          deviceModel:   original.deviceModel,
          expiresAt,
        },
        include: REPOSTED_POST_INCLUDE,
      })
      await tx.repost.create({
        data: { userId, postId: original.id, repostedPostId: copy.id, viaPostId },
      })
      return copy
    })
  } catch (error: any) {
    // Dois dispositivos podem enviar o mesmo PUT ao mesmo tempo. A constraint
    // ganha a corrida; o perdedor lê a cópia vencedora e devolve o mesmo estado.
    if (error?.code !== 'P2002') throw error
    const won = await prisma.repost.findUnique({
      where:   { userId_postId: { userId, postId: original.id } },
      include: { repostedPost: { include: REPOSTED_POST_INCLUDE } },
    })
    if (!won) throw error
    repostedPost = won.repostedPost
    wonViaPostId = won.viaPostId ?? original.id
  }

  extendLife(original.id, 60).catch(() => {})
  recalcPostLife(original.id).catch(() => {})
  return repostResult(userId, original.id, wonViaPostId ?? viaPostId, repostedPost)
}

// Desfazer também é idempotente: repetir DELETE mantém o estado desligado.
export async function removeRepost(userId: string, postId: string) {
  const original = await resolveRepostOriginal(postId)
  const existing = await prisma.repost.findUnique({
    where: { userId_postId: { userId, postId: original.id } },
  })

  if (existing) {
    await prisma.$transaction(async (tx) => {
      // `deleteMany` torna dois DELETE simultâneos seguros: só o pedido que
      // removeu o vínculo apaga a cópia; o outro já encontra o estado final.
      const removed = await tx.repost.deleteMany({ where: { id: existing.id } })
      if (removed.count > 0) {
        await tx.post.deleteMany({ where: { id: existing.repostedPostId } })
      }
    })
    recalcPostLife(original.id).catch(() => {})
  }

  // O -1 sai de onde entrou o +1, não do original.
  const viaPostId = existing?.viaPostId ?? original.id
  const viaCount = await prisma.repost.count({ where: { viaPostId } })
  return {
    postId: original.id,
    viaPostId,
    viaCount,
    reposted: false,
    removedPostId: existing?.repostedPostId ?? null,
    repostedPost: null,
  }
}

// ─── Sinal de gosto ────────────────────────────────────────────────────────
// O gosto é do CONTEÚDO, não da publicação onde se tocou: responder numa cópia
// de repost regista o original e o autor dele. Sem isto o mesmo momento contava
// duas vezes e o algoritmo aprendia com um eco.
//
// Idempotente e reversível: mudar de ideias substitui a resposta anterior em vez
// de acumular linhas contraditórias.
export async function recordTasteFeedback(
  userId: string,
  postId: string,
  signal: 'MORE' | 'LESS',
  dwellMs: number | null,
) {
  const original = await resolveRepostOriginal(postId)
  const shape = {
    authorId:  original.userId,
    mediaType: original.mediaType,
    signal,
    dwellMs,
  }

  await prisma.tasteFeedback.upsert({
    where:  { userId_postId: { userId, postId: original.id } },
    create: { userId, postId: original.id, ...shape },
    // `createdAt` acompanha a resposta que vale: o perfil de gosto lê-se do
    // mais recente para trás e uma correção de hoje não pode ficar arquivada
    // com a data da opinião que substituiu.
    update: { ...shape, createdAt: new Date() },
  })

  return { postId: original.id, signal }
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
      user: { select: { id: true, name: true, username: true, avatar: true, viewsPublic: true, showDevice: true, statusLabel: true } },
      _count: { select: { likes: true, comments: true, shares: true, reposts: true, views: true } },
    },
    orderBy: { createdAt: 'desc' },
  })
  return post ? (await attachPostMeta([withThumbnail(post)], userId))[0] : null
}
