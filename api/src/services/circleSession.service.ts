import { prisma } from '../config/database'
import { sendPush } from './notification.service'
import { emitToUser } from '../socket'
import { createAlbumPost } from './post.service'

const RADIUS_KM = 3

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number) {
  const R = 6371
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLng = ((lng2 - lng1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

type PublicUser = { id: string; name: string; avatar: string | null }

// Pessoas próximas com quem há seguimento mútuo (eu sigo E sou seguido), sem bloqueios.
// Sem localização → devolve os mútuos sem filtro de distância (mantém o Círculo utilizável cedo).
async function nearbyMutuals(userId: string, lat?: number | null, lng?: number | null): Promise<PublicUser[]> {
  const [iFollow, followMe, blocks] = await Promise.all([
    prisma.follow.findMany({ where: { followerId: userId },  select: { followingId: true } }),
    prisma.follow.findMany({ where: { followingId: userId }, select: { followerId: true } }),
    prisma.block.findMany({ where: { OR: [{ blockerId: userId }, { blockedId: userId }] }, select: { blockerId: true, blockedId: true } }),
  ])
  const iFollowSet = new Set(iFollow.map((f) => f.followingId))
  const blocked    = new Set(blocks.flatMap((b) => [b.blockerId, b.blockedId]))
  const mutualIds  = [...new Set(followMe.map((f) => f.followerId))]
    .filter((id) => iFollowSet.has(id) && !blocked.has(id) && id !== userId)
  if (mutualIds.length === 0) return []

  if (lat == null || lng == null) {
    return prisma.user.findMany({
      where:  { id: { in: mutualIds } },
      select: { id: true, name: true, avatar: true },
      take:   12,
    })
  }

  const degPerKm = 1 / 111
  const latD = RADIUS_KM * degPerKm
  const lngD = RADIUS_KM * degPerKm / Math.cos((lat * Math.PI) / 180)
  const cands = await prisma.user.findMany({
    where: {
      id:  { in: mutualIds },
      lat: { gte: lat - latD, lte: lat + latD },
      lng: { gte: lng - lngD, lte: lng + lngD },
    },
    select: { id: true, name: true, avatar: true, lat: true, lng: true },
  })
  return cands
    .filter((u) => haversineKm(lat, lng, u.lat!, u.lng!) <= RADIUS_KM)
    .slice(0, 12)
    .map(({ id, name, avatar }) => ({ id, name, avatar }))
}

async function membersOf(sessionId: string) {
  const rows = await prisma.circleSessionMember.findMany({
    where:   { sessionId },
    include: { user: { select: { id: true, name: true, avatar: true } } },
    orderBy: { createdAt: 'asc' },
  })
  return rows.map((r) => ({ user: r.user, status: r.status, photoUrl: r.photoUrl }))
}

async function broadcast(sessionId: string) {
  const [rows, members] = await Promise.all([
    prisma.circleSessionMember.findMany({ where: { sessionId }, select: { userId: true } }),
    membersOf(sessionId),
  ])
  rows.forEach((r) => emitToUser(r.userId, 'circle:update', { sessionId, members }))
}

// Abre (ou reutiliza) a minha sessão como anfitrião e devolve estado + vizinhos a chamar
export async function openSession(userId: string, lat?: number, lng?: number) {
  if (lat != null && lng != null) {
    prisma.user.update({ where: { id: userId }, data: { lat, lng } }).catch(() => {})
  }

  let session = await prisma.circleSession.findFirst({ where: { hostId: userId, status: 'OPEN' } })
  if (!session) {
    session = await prisma.circleSession.create({ data: { hostId: userId, lat, lng } })
    await prisma.circleSessionMember.create({ data: { sessionId: session.id, userId, status: 'JOINED' } })
  }

  const [members, nearby] = await Promise.all([
    membersOf(session.id),
    nearbyMutuals(userId, lat, lng),
  ])
  const memberIds = new Set(members.map((m) => m.user.id))
  return { session, members, nearby: nearby.filter((u) => !memberIds.has(u.id)) }
}

export async function getSessionState(sessionId: string) {
  const session = await prisma.circleSession.findUnique({ where: { id: sessionId } })
  if (!session) throw new Error('Sessão não encontrada')
  return { session, members: await membersOf(sessionId) }
}

// Anfitrião chama alguém próximo → convite (push + socket ao vivo)
export async function callUser(hostId: string, sessionId: string, targetId: string) {
  const session = await prisma.circleSession.findUnique({ where: { id: sessionId } })
  if (!session || session.hostId !== hostId) throw new Error('Sessão não encontrada')
  if (session.status !== 'OPEN') throw new Error('Sessão já fechou')

  await prisma.circleSessionMember.upsert({
    where:  { sessionId_userId: { sessionId, userId: targetId } },
    update: {},
    create: { sessionId, userId: targetId, status: 'INVITED' },
  })

  const host  = await prisma.user.findUnique({ where: { id: hostId }, select: { name: true, avatar: true } })
  const first = host?.name.split(' ')[0] ?? 'Alguém'
  sendPush(targetId, '⭕ Chamada para o Círculo', `${first} quer tirar uma foto contigo agora.`, { type: 'circle_call', sessionId }).catch(() => {})
  emitToUser(targetId, 'circle:called', { sessionId, hostName: host?.name ?? '', hostAvatar: host?.avatar ?? null })
  await broadcast(sessionId)
  return { ok: true }
}

// Aceitar / entrar numa sessão
export async function joinSession(userId: string, sessionId: string) {
  const session = await prisma.circleSession.findUnique({ where: { id: sessionId } })
  if (!session) throw new Error('Sessão não encontrada')
  if (session.status !== 'OPEN') throw new Error('Sessão já fechou')

  await prisma.circleSessionMember.upsert({
    where:  { sessionId_userId: { sessionId, userId } },
    update: { status: 'JOINED' },
    create: { sessionId, userId, status: 'JOINED' },
  })
  await broadcast(sessionId)
  return getSessionState(sessionId)
}

type Overlay = { emoji: string; x: number; y: number }

// Membro guarda a sua foto (com emojis) na sessão
export async function addPhoto(userId: string, sessionId: string, photoUrl: string, overlays: Overlay[] = []) {
  const member = await prisma.circleSessionMember.findUnique({ where: { sessionId_userId: { sessionId, userId } } })
  if (!member) throw new Error('Não estás nesta sessão')
  await prisma.circleSessionMember.update({
    where: { sessionId_userId: { sessionId, userId } },
    data:  { photoUrl, overlays: overlays.length > 0 ? overlays : undefined, status: 'JOINED' },
  })
  await broadcast(sessionId)
  return { ok: true }
}

// Qualquer membro publica o álbum no SEU feed (fotos de todos, com os emojis de cada um).
// A sessão fica aberta — cada pessoa pode publicar no seu próprio feed.
export async function publishSession(userId: string, sessionId: string, caption?: string) {
  const me = await prisma.circleSessionMember.findUnique({ where: { sessionId_userId: { sessionId, userId } } })
  if (!me || me.status !== 'JOINED') throw new Error('Não estás nesta sessão')

  const withPhotos = await prisma.circleSessionMember.findMany({
    where:   { sessionId, status: 'JOINED', photoUrl: { not: null } },
    orderBy: { createdAt: 'asc' },
  })
  const urls     = withPhotos.map((m) => m.photoUrl!).filter(Boolean)
  const overlays = withPhotos.map((m) => (Array.isArray(m.overlays) ? (m.overlays as Overlay[]) : []))
  if (urls.length < 1) throw new Error('Ainda não há fotos para publicar')

  const post = await createAlbumPost(userId, urls, caption, undefined, overlays)
  emitToUser(userId, 'circle:published', { sessionId, postId: post.id })
  return post
}

// Uma chamada pendente para mim (para quem abre o Círculo após ser chamado)
export async function incomingCall(userId: string) {
  const m = await prisma.circleSessionMember.findFirst({
    where:   { userId, status: 'INVITED', session: { status: 'OPEN' } },
    orderBy: { createdAt: 'desc' },
    include: { session: { include: { host: { select: { id: true, name: true, avatar: true } } } } },
  })
  if (!m) return { call: null }
  return { call: { sessionId: m.sessionId, host: m.session.host } }
}
