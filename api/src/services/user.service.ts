import { prisma } from '../config/database'
import { withThumbnails } from '../utils/cloudinary.util'

const USER_SELECT = {
  id: true, name: true, avatar: true, bio: true, availability: true,
  _count: { select: { followers: true, posts: true } },
} as const

export async function getAllUsers(currentUserId: string) {
  return prisma.user.findMany({
    where: { id: { not: currentUserId } },
    select: USER_SELECT,
    orderBy: { name: 'asc' },
    take: 100,
  })
}

export async function searchUsers(query: string, currentUserId: string) {
  return prisma.user.findMany({
    where: {
      AND: [
        { id: { not: currentUserId } },
        { OR: [{ name: { contains: query, mode: 'insensitive' } }, { phone: { contains: query } }] },
      ],
    },
    select: USER_SELECT,
    take: 20,
  })
}

// Tudo o que a página de perfil precisa. Usado na escrita e na leitura para as
// duas nunca divergirem — era por divergirem que city/district/statusLabel não
// chegavam ao perfil de outra pessoa.
const PROFILE_SELECT = {
  id: true, name: true, phone: true, countryCode: true,
  avatar: true, bio: true, availability: true, viewsPublic: true,
  contact: true, defaultFollowDuration: true, city: true, district: true,
  autoReply: true, showDevice: true, statusLabel: true, interests: true,
  isAdmin: true, createdAt: true,
  accountType: true, businessCategory: true, businessAddress: true,
  businessHours: true, whatsapp: true, profileActions: true,
  socialLinks: true,
} as const

export async function updateProfile(userId: string, data: {
  name?: string
  bio?: string
  avatar?: string
  availability?: string
  lat?: number
  lng?: number
  viewsPublic?: boolean
  contact?: string
  defaultFollowDuration?: string
  city?: string
  district?: string
  autoReply?: string
  showDevice?: boolean
  statusLabel?: string | null
  interests?: string[]
  accountType?: string
  businessCategory?: string | null
  businessAddress?: string | null
  businessHours?: unknown
  whatsapp?: string | null
  profileActions?: string[]
  socialLinks?: unknown
}) {
  return prisma.user.update({
    where: { id: userId },
    data: data as any,
    select: PROFILE_SELECT,
  })
}

export async function getUserById(userId: string, viewerId?: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      ...PROFILE_SELECT,
      _count: { select: { friendshipsA: true, friendshipsB: true, posts: true } },
    },
  })
  if (!user) throw new Error('User not found')
  if (viewerId === userId) return user

  // Um número de telefone não é público só porque o perfil é. Só sai daqui se o
  // dono o publicou de propósito: conta profissional com essa ação ligada.
  const isPro   = user.accountType === 'PROFESSIONAL'
  const actions = user.profileActions ?? []
  return {
    ...user,
    phone:       isPro && actions.includes('call')     ? user.phone     : null,
    countryCode: isPro && actions.includes('call')     ? user.countryCode : null,
    whatsapp:    isPro && actions.includes('whatsapp') ? user.whatsapp  : null,
    contact:     isPro ? user.contact : null,
    autoReply:   null,   // rascunho privado do dono, nunca de quem visita
  }
}

export async function getUserPosts(userId: string) {
  const posts = await prisma.post.findMany({
    where: { userId, deletedAt: null, expiresAt: { gt: new Date() } },
    include: {
      user: { select: { id: true, name: true, avatar: true, viewsPublic: true, isAdmin: true, showDevice: true, statusLabel: true } },
      _count: { select: { likes: true, comments: true, views: true, shares: true } },
    },
    orderBy: { createdAt: 'desc' },
  })
  return withThumbnails(posts)
}

// ─── Conexões em comum ────────────────────────────────────────────────────────
// "5 pessoas que conheces também o conhecem." Num perfil de desconhecido este é
// o único sinal de confiança que a página dá — sem ele a decisão de seguir é às
// cegas. Conexão = qualquer direção do follow, a mesma definição que o feed e a
// caixa de mensagens já usam, para o vocabulário da app não se contradizer.
export async function getMutualConnections(viewerId: string, targetId: string, limit = 3) {
  if (viewerId === targetId) return { total: 0, users: [] }

  const [mine, theirs, blocksGiven, blocksReceived] = await Promise.all([
    prisma.follow.findMany({
      where:  { OR: [{ followerId: viewerId }, { followingId: viewerId }] },
      select: { followerId: true, followingId: true },
    }),
    prisma.follow.findMany({
      where:  { OR: [{ followerId: targetId }, { followingId: targetId }] },
      select: { followerId: true, followingId: true },
    }),
    prisma.block.findMany({ where: { blockerId: viewerId }, select: { blockedId: true } }),
    prisma.block.findMany({ where: { blockedId: viewerId }, select: { blockerId: true } }),
  ])

  const peersOf = (rows: { followerId: string; followingId: string }[], self: string) => {
    const set = new Set<string>()
    for (const r of rows) {
      if (r.followerId  !== self) set.add(r.followerId)
      if (r.followingId !== self) set.add(r.followingId)
    }
    return set
  }

  const blocked = new Set([
    ...blocksGiven.map((b) => b.blockedId),
    ...blocksReceived.map((b) => b.blockerId),
  ])

  const a = peersOf(mine, viewerId)
  const b = peersOf(theirs, targetId)

  const ids = [...a].filter(
    (id) => b.has(id) && id !== viewerId && id !== targetId && !blocked.has(id),
  )
  if (ids.length === 0) return { total: 0, users: [] }

  // Só os primeiros são precisos para os avatares; `total` carrega a contagem.
  const users = await prisma.user.findMany({
    where:  { id: { in: ids.slice(0, limit) } },
    select: { id: true, name: true, avatar: true },
  })

  return { total: ids.length, users }
}

export async function toggleGhostMode(userId: string, ghostMode: boolean) {
  return prisma.user.update({
    where: { id: userId },
    data: { ghostMode },
    select: { id: true, ghostMode: true },
  })
}
