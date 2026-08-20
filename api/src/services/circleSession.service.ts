import { prisma } from '../config/database'
import { Prisma } from '@prisma/client'
import { sendPush } from './notification.service'
import { emitToUser } from '../socket'
import { createAlbumPost, emitPostToVisibleFollowers } from './post.service'
import { createHash } from 'crypto'

const RADIUS_KM = 3
const INVITE_TTL_MS = 2 * 60 * 1000   // convite expira em 2 minutos
const COUNTDOWN_MS = 3 * 1000
// A ronda continua identificável enquanto os dois uploads chegam. Durante esta
// janela outro toque em countdown devolve a mesma ronda em vez de a substituir.
const ROUND_ACTIVE_MS = 60 * 1000
// Janela de publicação contada da captura do próprio publicador.
const PUBLISH_WINDOW_MS = 60 * 1000

// Uma sessão é um momento, não uma sala permanente. Passado isto o anfitrião
// abre uma nova em vez de reutilizar a antiga — senão membros e fotos de há
// semanas continuavam agarrados à mesma sessão.
export const SESSION_MAX_AGE_MS = 2 * 60 * 60 * 1000   // 2 horas

// Quantas chamadas um anfitrião pode fazer numa janela — um convite é um push
// no telemóvel de outra pessoa, por isso tem preço.
const CALL_LIMIT       = 12
const CALL_WINDOW_MS   = 5 * 60 * 1000
const CALL_COOLDOWN_MS = 30 * 1000   // insistir na mesma pessoa não repete o push

async function lockSession(tx: Prisma.TransactionClient, sessionId: string) {
  const rows = await tx.$queryRaw<Array<{ id: string }>>`
    SELECT "id" FROM "CircleSession" WHERE "id" = ${sessionId} FOR UPDATE
  `
  return rows.length > 0
}

// Retakes e desistências só podem remover assets quando nenhum Post, captura
// normalizada ou campo legado ainda os preserva. Falhar esta verificação é
// conservador: mantém o ficheiro em vez de arriscar quebrar um momento.
async function unreferencedCirclePhotos(urls: Array<string | null>): Promise<string[]> {
  const candidates = [...new Set(urls.filter((url): url is string => !!url))]
  if (candidates.length === 0) return []
  try {
    const [posts, captures, legacy] = await Promise.all([
      prisma.post.findMany({
        where: {
          OR: [
            { mediaUrl: { in: candidates } },
            { mediaUrls: { hasSome: candidates } },
          ],
        },
        select: { mediaUrl: true, mediaUrls: true },
      }),
      prisma.circleSessionCapture.findMany({
        where: { mediaUrl: { in: candidates } },
        select: { mediaUrl: true },
      }),
      prisma.circleSessionMember.findMany({
        where: { photoUrl: { in: candidates } },
        select: { photoUrl: true },
      }),
    ])
    const referenced = new Set<string>([
      ...posts.flatMap((post) => [
        ...(post.mediaUrl ? [post.mediaUrl] : []),
        ...post.mediaUrls,
      ]),
      ...captures.map((capture) => capture.mediaUrl),
      ...legacy.flatMap((member) => member.photoUrl ? [member.photoUrl] : []),
    ])
    return candidates.filter((url) => !referenced.has(url))
  } catch {
    return []
  }
}

// Remove convites pendentes (INVITED) com mais de 2 min — evita que alguém
// aceite 1h depois quando quem chamou já desistiu.
// `scope` limita o varrimento: sem ele isto lia a tabela inteira a cada chamada.
async function expireInvites(scope: { sessionId?: string; userId?: string } = {}) {
  const cutoff = new Date(Date.now() - INVITE_TTL_MS)
  const res = await prisma.circleSessionMember.deleteMany({
    where: {
      status: 'INVITED',
      createdAt: { lt: cutoff },
      ...(scope.sessionId ? { sessionId: scope.sessionId } : {}),
      ...(scope.userId    ? { userId:    scope.userId }    : {}),
    },
  }).catch(() => null)
  // Avisa a sessão para os clientes tirarem o convidado da lista de membros —
  // senão ficaria escondido de "chamar mais pessoas" para sempre.
  if (scope.sessionId && res && res.count > 0) await broadcast(scope.sessionId).catch(() => {})
}

// Seguimento mútuo e sem bloqueio em nenhuma direção. É a condição para se
// poder chamar alguém — a mesma que o `nearbyMutuals` usa para montar a lista,
// mas verificada também no servidor. Antes vivia só na UI.
async function canCall(hostId: string, targetId: string): Promise<boolean> {
  if (hostId === targetId) return false
  const [iFollow, followsMe, blocked] = await Promise.all([
    prisma.follow.findFirst({ where: { followerId: hostId,   followingId: targetId }, select: { id: true } }),
    prisma.follow.findFirst({ where: { followerId: targetId, followingId: hostId },   select: { id: true } }),
    prisma.block.findFirst({
      where: {
        OR: [
          { blockerId: hostId,   blockedId: targetId },
          { blockerId: targetId, blockedId: hostId },
        ],
      },
      select: { id: true },
    }),
  ])
  return !!iFollow && !!followsMe && !blocked
}

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
      select: { id: true, name: true, username: true, avatar: true },
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
    select: { id: true, name: true, username: true, avatar: true, lat: true, lng: true },
  })
  return cands
    .filter((u) => haversineKm(lat, lng, u.lat!, u.lng!) <= RADIUS_KM)
    .slice(0, 12)
    .map(({ id, name, avatar }) => ({ id, name, avatar }))
}

type CircleReadClient = Pick<
  Prisma.TransactionClient,
  'circleSessionMember' | 'circleSessionRound' | 'circleSessionCapture'
>

type Overlay = { emoji: string; x: number; y: number }

function roundState(round: {
  id: string
  sessionId: string
  shotAt: Date
  expiresAt: Date
  isSolo: boolean
  ownerUserId: string | null
}) {
  return {
    id: round.id,
    sessionId: round.sessionId,
    shotAt: round.shotAt.toISOString(),
    expiresAt: round.expiresAt.toISOString(),
    isSolo: round.isSolo,
    ownerUserId: round.ownerUserId,
  }
}

function captureState(capture: {
  id: string
  roundId: string
  userId: string
  slot: number
  mediaUrl: string
  photoWidth: number | null
  photoHeight: number | null
  overlays: Prisma.JsonValue | null
  createdAt: Date
}) {
  return {
    id: capture.id,
    roundId: capture.roundId,
    userId: capture.userId,
    slot: capture.slot,
    mediaUrl: capture.mediaUrl,
    photoWidth: capture.photoWidth,
    photoHeight: capture.photoHeight,
    overlays: Array.isArray(capture.overlays) ? capture.overlays : [],
    createdAt: capture.createdAt.toISOString(),
  }
}

async function currentRoundOf(
  sessionId: string,
  requesterId?: string,
  db: CircleReadClient = prisma,
) {
  const now = new Date()
  // Uma ronda sincronizada é comum à sessão e tem prioridade. Uma ronda solo
  // só é current para o próprio dono, para não substituir a vista coletiva dos
  // restantes membros.
  const synchronized = await db.circleSessionRound.findFirst({
    where: { sessionId, isSolo: false, expiresAt: { gt: now } },
    orderBy: { shotAt: 'desc' },
  })
  if (synchronized) return synchronized
  if (!requesterId) return null
  return db.circleSessionRound.findFirst({
    where: { sessionId, isSolo: true, ownerUserId: requesterId, expiresAt: { gt: now } },
    orderBy: { shotAt: 'desc' },
  })
}

async function membersOf(sessionId: string, roundId?: string | null, db: CircleReadClient = prisma) {
  const rows = await db.circleSessionMember.findMany({
    where:   { sessionId },
    include: { user: { select: { id: true, name: true, username: true, avatar: true } } },
    orderBy: { createdAt: 'asc' },
  })
  const captures = roundId
    ? await db.circleSessionCapture.findMany({
        where: { roundId },
        orderBy: [{ userId: 'asc' }, { slot: 'asc' }],
      })
    : []
  const byUser = new Map<string, ReturnType<typeof captureState>[]>()
  for (const capture of captures) {
    const list = byUser.get(capture.userId) ?? []
    list.push(captureState(capture))
    byUser.set(capture.userId, list)
  }
  return rows.map((r) => ({
    user: r.user, status: r.status, photoUrl: r.photoUrl,
    photoAt: r.photoAt ? r.photoAt.toISOString() : null,
    captures: byUser.get(r.userId) ?? [],
  }))
}

async function liveState(sessionId: string, requesterId: string, db: CircleReadClient = prisma) {
  const currentRound = await currentRoundOf(sessionId, requesterId, db)
  return {
    currentRound: currentRound ? roundState(currentRound) : null,
    members: await membersOf(sessionId, currentRound?.id, db),
  }
}

// Só para quem já aceitou. O estado leva os URLs das fotos, e quem foi chamado
// mas ainda não entrou não tem nada que os receber — para esse a chamada chega
// pelo evento `circle:called`.
async function broadcast(sessionId: string) {
  const rows = await prisma.circleSessionMember.findMany({
    where: { sessionId, status: 'JOINED' },
    select: { userId: true },
  })
  await Promise.all(rows.map(async (row) => {
    const state = await liveState(sessionId, row.userId)
    emitToUser(row.userId, 'circle:update', { sessionId, ...state })
  }))
}

// Abre (ou reutiliza) a minha sessão como anfitrião e devolve estado + vizinhos a chamar
export async function openSession(userId: string, lat?: number, lng?: number) {
  if (lat != null && lng != null) {
    prisma.user.update({ where: { id: userId }, data: { lat, lng } }).catch(() => {})
  }

  // Só se reutiliza uma sessão recente. Sem o limite de idade, o anfitrião
  // caía sempre na primeira sessão que abriu na vida — com os membros e as
  // fotos de então ainda lá dentro.
  const fresh = new Date(Date.now() - SESSION_MAX_AGE_MS)
  let session = await prisma.circleSession.findFirst({
    where:   { hostId: userId, status: 'OPEN', createdAt: { gte: fresh } },
    orderBy: { createdAt: 'desc' },
  })
  if (!session) {
    await closeStaleSessionsOf(userId)
    session = await prisma.circleSession.create({ data: { hostId: userId, lat, lng } })
    await prisma.circleSessionMember.create({ data: { sessionId: session.id, userId, status: 'JOINED' } })
  }

  await expireInvites({ sessionId: session.id })

  const [state, nearby] = await Promise.all([
    liveState(session.id, userId),
    nearbyMutuals(userId, lat, lng),
  ])
  const memberIds = new Set(state.members.map((m) => m.user.id))
  return {
    session,
    ...state,
    nearby: nearby.filter((u) => !memberIds.has(u.id)),
    publishWindowMs: PUBLISH_WINDOW_MS,
  }
}

// Fecha as sessões antigas deste anfitrião. As fotos são apagadas do
// armazenamento pelo cron (limparCirculos), não aqui — fechar tem de ser rápido.
async function closeStaleSessionsOf(hostId: string) {
  await prisma.circleSession.updateMany({
    where: {
      hostId,
      status: 'OPEN',
      createdAt: { lt: new Date(Date.now() - SESSION_MAX_AGE_MS) },
      // Abrir um novo Círculo não pode fechar o antigo enquanto alguém ainda
      // está dentro da janela legítima de captura/publicação.
      members: { none: { photoAt: { gte: new Date(Date.now() - PUBLISH_WINDOW_MS) } } },
      rounds: { none: { expiresAt: { gt: new Date() } } },
    },
    data:  { status: 'CLOSED' },
  }).catch(() => {})
}

// Ler uma sessão expõe quem lá está e os URLs das fotos de toda a gente, por
// isso exige ser membro. Sem isto qualquer utilizador autenticado lia qualquer
// sessão só com o ID.
export async function getSessionState(sessionId: string, requesterId: string) {
  const session = await prisma.circleSession.findUnique({ where: { id: sessionId } })
  if (!session) throw new Error('Sessão não encontrada')

  const me = await prisma.circleSessionMember.findUnique({
    where: { sessionId_userId: { sessionId, userId: requesterId } },
  })
  if (!me || me.status !== 'JOINED') throw new Error('Não estás nesta sessão')

  await expireInvites({ sessionId })
  return { session, ...(await liveState(sessionId, requesterId)), publishWindowMs: PUBLISH_WINDOW_MS }
}

// Anfitrião chama alguém próximo → convite (push + socket ao vivo)
export async function callUser(hostId: string, sessionId: string, targetId: string) {
  // Um convite é uma notificação no telemóvel de outra pessoa. Sem esta
  // verificação, quem chamasse a API diretamente mandava pushes a estranhos —
  // e a quem o tivesse bloqueado.
  if (!(await canCall(hostId, targetId))) throw new Error('Só podes chamar pessoas que te seguem e que segues')
  const alreadyCalled = await prisma.$transaction(async (tx) => {
    await lockSession(tx, sessionId)
    const session = await tx.circleSession.findUnique({ where: { id: sessionId } })
    if (!session || session.hostId !== hostId) throw new Error('Sessão não encontrada')
    if (session.status !== 'OPEN') throw new Error('Sessão já fechou')

    const existing = await tx.circleSessionMember.findUnique({
      where:  { sessionId_userId: { sessionId, userId: targetId } },
      select: { status: true, createdAt: true },
    })
    if (existing?.status === 'JOINED') throw new Error('Esta pessoa já está no círculo')

    // Insistir na mesma pessoa não vale um push novo.
    if (existing && Date.now() - existing.createdAt.getTime() < CALL_COOLDOWN_MS) return true

    const recentCalls = await tx.circleSessionMember.count({
      where: {
        session:   { hostId },
        status:    'INVITED',
        createdAt: { gte: new Date(Date.now() - CALL_WINDOW_MS) },
      },
    })
    if (recentCalls >= CALL_LIMIT) throw new Error('Chamaste demasiadas pessoas em pouco tempo. Espera um pouco.')

    await tx.circleSessionMember.upsert({
      where:  { sessionId_userId: { sessionId, userId: targetId } },
      update: { status: 'INVITED', createdAt: new Date() },
      create: { sessionId, userId: targetId, status: 'INVITED' },
    })
    return false
  })
  if (alreadyCalled) return { ok: true, alreadyCalled: true }

  const host  = await prisma.user.findUnique({ where: { id: hostId }, select: { name: true, username: true, avatar: true } })
  const first = host?.name.split(' ')[0] ?? 'Alguém'
  sendPush(targetId, '⭕ Chamada para o Círculo', `${first} quer tirar uma foto contigo agora.`, { type: 'circle_call', sessionId }).catch(() => {})
  emitToUser(targetId, 'circle:called', { sessionId, hostName: host?.name ?? '', hostAvatar: host?.avatar ?? null })
  await broadcast(sessionId)
  return { ok: true }
}

// Aceitar / entrar numa sessão
export async function joinSession(userId: string, sessionId: string) {
  const result = await prisma.$transaction(async (tx) => {
    await lockSession(tx, sessionId)
    const session = await tx.circleSession.findUnique({ where: { id: sessionId } })
    if (!session) throw new Error('Sessão não encontrada')
    if (session.status !== 'OPEN') throw new Error('Sessão já fechou')

    // Entra-se por convite, nunca por conhecer o ID da sessão.
    const existing = await tx.circleSessionMember.findUnique({
      where: { sessionId_userId: { sessionId, userId } },
    })
    if (!existing) throw new Error('Não foste convidado para este círculo')

    if (existing.status === 'INVITED' && Date.now() - existing.createdAt.getTime() > INVITE_TTL_MS) {
      await tx.circleSessionMember.delete({ where: { sessionId_userId: { sessionId, userId } } })
      return 'expired' as const
    }

    await tx.circleSessionMember.update({
      where: { sessionId_userId: { sessionId, userId } },
      data:  { status: 'JOINED' },
    })
    return 'joined' as const
  })
  if (result === 'expired') throw new Error('O convite expirou')
  await broadcast(sessionId)
  return getSessionState(sessionId, userId)
}

// Sair de uma sessão (desfazer o "aceitar"). O anfitrião não sai por aqui.
export async function leaveSession(userId: string, sessionId: string) {
  const removed = await prisma.$transaction(async (tx) => {
    await lockSession(tx, sessionId)
    const session = await tx.circleSession.findUnique({ where: { id: sessionId } })
    if (!session || session.hostId === userId) return { urls: [] as string[], captureIds: [] as string[] }
    const [member, captures] = await Promise.all([
      tx.circleSessionMember.findUnique({ where: { sessionId_userId: { sessionId, userId } } }),
      tx.circleSessionCapture.findMany({
        where: { userId, round: { sessionId } },
        select: { id: true, mediaUrl: true },
      }),
    ])
    await tx.circleSessionCapture.deleteMany({ where: { userId, round: { sessionId } } })
    await tx.circleSessionMember.deleteMany({ where: { sessionId, userId } })
    return {
      urls: [...captures.map((capture) => capture.mediaUrl), ...(member?.photoUrl ? [member.photoUrl] : [])],
      captureIds: captures.map((capture) => capture.id),
    }
  })
  await broadcast(sessionId)
  return {
    ok: true,
    removedCaptureIds: removed.captureIds,
    discardedPhotoUrls: await unreferencedCirclePhotos(removed.urls),
  }
}

// O anfitrião remove um membro (para voltar a ficar sozinho, por ex.)
export async function removeMember(hostId: string, sessionId: string, targetId: string) {
  const removed = await prisma.$transaction(async (tx) => {
    await lockSession(tx, sessionId)
    const session = await tx.circleSession.findUnique({ where: { id: sessionId } })
    if (!session || session.hostId !== hostId) throw new Error('Sessão não encontrada')
    if (session.status !== 'OPEN') throw new Error('Sessão já fechou')
    if (targetId === hostId) return { urls: [] as string[], captureIds: [] as string[] }
    const [member, captures] = await Promise.all([
      tx.circleSessionMember.findUnique({ where: { sessionId_userId: { sessionId, userId: targetId } } }),
      tx.circleSessionCapture.findMany({
        where: { userId: targetId, round: { sessionId } },
        select: { id: true, mediaUrl: true },
      }),
    ])
    await tx.circleSessionCapture.deleteMany({ where: { userId: targetId, round: { sessionId } } })
    await tx.circleSessionMember.deleteMany({ where: { sessionId, userId: targetId } })
    return {
      urls: [...captures.map((capture) => capture.mediaUrl), ...(member?.photoUrl ? [member.photoUrl] : [])],
      captureIds: captures.map((capture) => capture.id),
    }
  })
  emitToUser(targetId, 'circle:removed', { sessionId })   // avisa o removido
  await broadcast(sessionId)
  return {
    ok: true,
    removedCaptureIds: removed.captureIds,
    discardedPhotoUrls: await unreferencedCirclePhotos(removed.urls),
  }
}

// Membro guarda a sua foto (com emojis) na sessão
export async function addPhoto(
  userId: string,
  sessionId: string,
  photoUrl: string,
  overlays: Overlay[] = [],
  photoWidth?: number | null,
  photoHeight?: number | null,
  requestedRoundId?: string | 'solo',
  requestedSlot?: 1 | 2,
  requestedRoundAt?: Date | null,
) {
  const written = await prisma.$transaction(async (tx) => {
    await lockSession(tx, sessionId)
    const member = await tx.circleSessionMember.findUnique({
      where: { sessionId_userId: { sessionId, userId } },
      include: { session: { select: { status: true, shotAt: true, createdAt: true } } },
    })
    // Tem de já ter aceitado: antes, gravar uma foto promovia sozinho um
    // convidado a membro sem ele alguma vez ter carregado em aceitar.
    if (!member || member.status !== 'JOINED') throw new Error('Não estás nesta sessão')
    if (member.session.status !== 'OPEN' || Date.now() - member.session.createdAt.getTime() > SESSION_MAX_AGE_MS) {
      throw new Error('Sessão já fechou')
    }

    const now = new Date()
    let round
    const wantsSolo = requestedRoundId === 'solo' || requestedRoundAt === null

    if (requestedRoundId && requestedRoundId !== 'solo') {
      round = await tx.circleSessionRound.findUnique({ where: { id: requestedRoundId } })
      if (!round || round.sessionId !== sessionId || (round.isSolo && round.ownerUserId !== userId)) {
        throw new Error('Ronda de captura inválida')
      }
    } else if (wantsSolo) {
      round = await tx.circleSessionRound.findFirst({
        where: { sessionId, isSolo: true, ownerUserId: userId, expiresAt: { gt: now } },
        orderBy: { shotAt: 'desc' },
      })
      if (!round) {
        round = await tx.circleSessionRound.create({
          data: {
            sessionId,
            shotAt: now,
            expiresAt: new Date(now.getTime() + ROUND_ACTIVE_MS),
            isSolo: true,
            ownerUserId: userId,
          },
        })
      }
    } else if (requestedRoundAt instanceof Date) {
      // Compatibilidade com a versão que identificava rondas por shotAt.
      round = await tx.circleSessionRound.findFirst({
        where: { sessionId, isSolo: false, shotAt: requestedRoundAt },
        orderBy: { createdAt: 'desc' },
      })
      if (!round && member.session.shotAt?.getTime() === requestedRoundAt.getTime()) {
        round = await tx.circleSessionRound.create({
          data: {
            sessionId,
            shotAt: member.session.shotAt,
            expiresAt: new Date(member.session.shotAt.getTime() + ROUND_ACTIVE_MS),
          },
        })
      }
    } else {
      // Clientes sem roundId entram na ronda sincronizada ativa. Sem uma, o
      // comportamento antigo de captura individual vira uma ronda solo.
      round = await tx.circleSessionRound.findFirst({
        where: { sessionId, isSolo: false, expiresAt: { gt: now } },
        orderBy: { shotAt: 'desc' },
      })
      if (!round) {
        round = await tx.circleSessionRound.findFirst({
          where: { sessionId, isSolo: true, ownerUserId: userId, expiresAt: { gt: now } },
          orderBy: { shotAt: 'desc' },
        }) ?? await tx.circleSessionRound.create({
          data: {
            sessionId,
            shotAt: now,
            expiresAt: new Date(now.getTime() + ROUND_ACTIVE_MS),
            isSolo: true,
            ownerUserId: userId,
          },
        })
      }
    }

    if (!round || round.expiresAt <= now || round.shotAt > now) {
      throw new Error('Ronda de captura inválida')
    }

    const existing = await tx.circleSessionCapture.findMany({
      where: { roundId: round.id, userId },
      orderBy: { slot: 'asc' },
    })
    const occupied = new Set(existing.map((capture) => capture.slot))
    const slot = requestedSlot ?? ([1, 2].find((candidate) => !occupied.has(candidate)) as 1 | 2 | undefined)
    if (!slot) throw new Error('Cada participante pode adicionar no máximo 2 fotos por ronda')

    const previousInSlot = existing.find((capture) => capture.slot === slot)
    const capture = previousInSlot
      ? await tx.circleSessionCapture.update({
          where: { roundId_userId_slot: { roundId: round.id, userId, slot } },
          data: {
            mediaUrl: photoUrl,
            photoWidth: photoWidth ?? null,
            photoHeight: photoHeight ?? null,
            overlays: overlays as unknown as Prisma.InputJsonValue,
            createdAt: now,
          },
        })
      : await tx.circleSessionCapture.create({
          data: {
            roundId: round.id,
            userId,
            slot,
            mediaUrl: photoUrl,
            photoWidth: photoWidth ?? null,
            photoHeight: photoHeight ?? null,
            overlays: overlays as unknown as Prisma.InputJsonValue,
          },
        })

    // Espelho para clientes antigos. A fonte de verdade passa a ser Capture.
    await tx.circleSessionMember.update({
      where: { sessionId_userId: { sessionId, userId } },
      data: {
        photoUrl,
        photoAt: now,
        photoRoundAt: round.shotAt,
        photoWidth: photoWidth ?? null,
        photoHeight: photoHeight ?? null,
        overlays,
      },
    })
    return {
      round,
      capture,
      previousUrls: [
        previousInSlot?.mediaUrl ?? null,
        member.photoUrl && member.photoUrl !== photoUrl ? member.photoUrl : null,
      ],
    }
  })

  await broadcast(sessionId).catch(() => {})
  return {
    ok: true,
    roundId: written.round.id,
    capture: captureState(written.capture),
    discardedPhotoUrls: await unreferencedCirclePhotos(written.previousUrls),
  }
}

// Retirar a minha foto do círculo. Qualquer membro pode publicar o álbum com as
// fotos de todos, por isso tem de haver forma de dizer não sem sair da sessão.
export async function withdrawPhoto(userId: string, sessionId: string, captureId?: string) {
  const removed = await prisma.$transaction(async (tx) => {
    await lockSession(tx, sessionId)
    const member = await tx.circleSessionMember.findUnique({
      where: { sessionId_userId: { sessionId, userId } },
      include: { session: { select: { status: true } } },
    })
    if (!member || member.status !== 'JOINED') throw new Error('Não estás nesta sessão')
    if (member.session.status !== 'OPEN') throw new Error('Sessão já fechou')

    const captures = await tx.circleSessionCapture.findMany({
      where: {
        userId,
        round: { sessionId },
        ...(captureId ? { id: captureId } : {}),
      },
      select: { id: true, mediaUrl: true },
    })
    if (captureId && captures.length === 0) throw new Error('Captura não encontrada')
    await tx.circleSessionCapture.deleteMany({
      where: { id: { in: captures.map((capture) => capture.id) } },
    })

    const latest = await tx.circleSessionCapture.findFirst({
      where: { userId, round: { sessionId, expiresAt: { gt: new Date() } } },
      orderBy: { createdAt: 'desc' },
      include: { round: { select: { shotAt: true } } },
    })
    await tx.circleSessionMember.update({
      where: { sessionId_userId: { sessionId, userId } },
      data: latest ? {
        photoUrl: latest.mediaUrl,
        photoAt: latest.createdAt,
        photoRoundAt: latest.round.shotAt,
        photoWidth: latest.photoWidth,
        photoHeight: latest.photoHeight,
        overlays: latest.overlays ?? [],
      } : {
        photoUrl: null,
        photoAt: null,
        photoRoundAt: null,
        photoWidth: null,
        photoHeight: null,
        overlays: [],
      },
    })
    return {
      captureIds: captures.map((capture) => capture.id),
      urls: [
        ...captures.map((capture) => capture.mediaUrl),
        ...(!captureId && member.photoUrl ? [member.photoUrl] : []),
      ],
    }
  })

  await broadcast(sessionId).catch(() => {})
  return {
    ok: true,
    removedCaptureIds: removed.captureIds,
    discardedPhotoUrls: await unreferencedCirclePhotos(removed.urls),
  }
}

// ─── Disparo sincronizado ─────────────────────────────────────────────────────
// Todos no círculo disparam no mesmo instante. Quem carrega no botão só pede a
// contagem; é o servidor que decide o momento, senão cada telemóvel dispararia
// pelo seu próprio relógio e as fotos nunca coincidiriam.
export async function startCountdown(userId: string, sessionId: string) {
  const countdown = await prisma.$transaction(async (tx) => {
    await lockSession(tx, sessionId)
    const session = await tx.circleSession.findUnique({ where: { id: sessionId } })
    if (!session) throw new Error('Sessão não encontrada')
    if (session.status !== 'OPEN' || Date.now() - session.createdAt.getTime() > SESSION_MAX_AGE_MS) {
      throw new Error('Sessão já fechou')
    }

    const me = await tx.circleSessionMember.findUnique({
      where: { sessionId_userId: { sessionId, userId } },
    })
    if (!me || me.status !== 'JOINED') throw new Error('Não estás nesta sessão')

    const now = new Date()
    // A ronda permanece ativa também durante o upload. Sem isto, um segundo
    // toque logo após o disparo mudava shotAt e invalidava fotos em trânsito.
    let round = await tx.circleSessionRound.findFirst({
      where: { sessionId, isSolo: false, expiresAt: { gt: now } },
      orderBy: { shotAt: 'desc' },
    })
    if (round) {
      return {
        roundId: round.id,
        shotAt: round.shotAt.toISOString(),
        expiresAt: round.expiresAt.toISOString(),
        inMs: Math.max(0, round.shotAt.getTime() - now.getTime()),
        recipients: [] as string[],
      }
    }

    // Compatibilidade com uma contagem criada antes do deploy da tabela Round.
    if (session.shotAt) {
      const legacyExpiry = new Date(session.shotAt.getTime() + ROUND_ACTIVE_MS)
      if (legacyExpiry > now) {
        round = await tx.circleSessionRound.create({
          data: { sessionId, shotAt: session.shotAt, expiresAt: legacyExpiry },
        })
        return {
          roundId: round.id,
          shotAt: round.shotAt.toISOString(),
          expiresAt: round.expiresAt.toISOString(),
          inMs: Math.max(0, round.shotAt.getTime() - now.getTime()),
          recipients: [] as string[],
        }
      }
    }

    const shotAt = new Date(now.getTime() + COUNTDOWN_MS)
    const expiresAt = new Date(shotAt.getTime() + ROUND_ACTIVE_MS)
    round = await tx.circleSessionRound.create({
      data: { sessionId, shotAt, expiresAt },
    })
    await tx.circleSession.update({ where: { id: sessionId }, data: { shotAt } })
    // Evita que clientes antigos mostrem fotos da ronda anterior enquanto a
    // nova ainda está a contar. As capturas normalizadas anteriores continuam
    // disponíveis para publicação por roundId e para cleanup seguro.
    await tx.circleSessionMember.updateMany({
      where: { sessionId },
      data: {
        photoUrl: null,
        photoAt: null,
        photoRoundAt: null,
        photoWidth: null,
        photoHeight: null,
        overlays: [],
      },
    })
    const rows = await tx.circleSessionMember.findMany({
      where:  { sessionId, status: 'JOINED' },
      select: { userId: true },
    })
    return {
      roundId: round.id,
      shotAt: shotAt.toISOString(),
      expiresAt: expiresAt.toISOString(),
      inMs: COUNTDOWN_MS,
      recipients: rows.map((row) => row.userId),
    }
  })

  // Mandamos a duração para a animação (os relógios dos telemóveis não estão
  // sincronizados) e o instante do servidor apenas como identidade da ronda.
  for (const recipientId of countdown.recipients) {
    try {
      emitToUser(recipientId, 'circle:countdown', {
        sessionId,
        roundId: countdown.roundId,
        inMs: countdown.inMs,
        shotAt: countdown.shotAt,
        expiresAt: countdown.expiresAt,
        startedBy: userId,
      })
    } catch {}
  }

  return {
    roundId: countdown.roundId,
    shotAt: countdown.shotAt,
    expiresAt: countdown.expiresAt,
    inMs: countdown.inMs,
  }
}

// Qualquer membro publica no seu feed o snapshot imutável de uma ronda. Uma
// pessoa pode aparecer zero vezes, uma ou duas vezes em captures; participants
// continua a representar presença, não quantidade de fotos.
export async function publishSession(
  userId: string,
  sessionId: string,
  caption?: string,
  requestedRoundId?: string,
) {
  // Publicação e limpeza disputam a mesma linha de sessão. O lock garante que
  // ou o Post existe antes do cron decidir apagar media, ou a sessão fecha e a
  // publicação falha sem criar uma referência tardia para um asset apagado.
  const published = await prisma.$transaction(async (tx) => {
    await lockSession(tx, sessionId)
    const me = await tx.circleSessionMember.findUnique({
      where: { sessionId_userId: { sessionId, userId } },
      include: { session: { select: { hostId: true, status: true } } },
    })
    if (!me || me.status !== 'JOINED') throw new Error('Não estás nesta sessão')
    if (me.session.status !== 'OPEN') throw new Error('Sessão já fechou')

    // Lemos todos os JOINED, não só quem fotografou. Participar e capturar são
    // factos diferentes e ambos precisam sobreviver no post publicado.
    const joined = await tx.circleSessionMember.findMany({
      where:   { sessionId, status: 'JOINED' },
      include: { user: { select: { id: true, name: true, username: true, avatar: true } } },
      orderBy: { createdAt: 'asc' },
    })
    const joinedIds = joined.map((member) => member.userId)

    let round = requestedRoundId
      ? await tx.circleSessionRound.findUnique({ where: { id: requestedRoundId } })
      : await tx.circleSessionRound.findFirst({
          where: { sessionId, captures: { some: { userId } } },
          orderBy: { createdAt: 'desc' },
        })
    if (round && round.sessionId !== sessionId) throw new Error('Ronda de captura inválida')

    // Compatibilidade de deploy: uma sessão que já tinha photoUrl nos Members
    // antes da migração é promovida uma única vez para Round/Capture.
    if (!round) {
      if (!me.photoAt || Date.now() - me.photoAt.getTime() > PUBLISH_WINDOW_MS) {
        throw new Error('A janela para publicar esta foto já passou')
      }
      const roundAt = me.photoRoundAt ?? me.photoAt
      const legacyMembers = joined.filter((member) =>
        !!member.photoUrl && !!member.photoAt &&
        Date.now() - member.photoAt.getTime() <= PUBLISH_WINDOW_MS &&
        (me.photoRoundAt
          ? member.photoRoundAt?.getTime() === me.photoRoundAt.getTime()
          : member.photoRoundAt == null),
      )
      if (legacyMembers.length === 0) throw new Error('Ainda não há fotos para publicar')
      round = await tx.circleSessionRound.create({
        data: {
          sessionId,
          shotAt: roundAt,
          expiresAt: new Date(Math.max(roundAt.getTime() + ROUND_ACTIVE_MS, Date.now() + 1000)),
          isSolo: legacyMembers.length === 1,
          ownerUserId: legacyMembers.length === 1 ? legacyMembers[0].userId : null,
        },
      })
      for (const member of legacyMembers) {
        await tx.circleSessionCapture.create({
          data: {
            roundId: round.id,
            userId: member.userId,
            slot: 1,
            mediaUrl: member.photoUrl!,
            photoWidth: member.photoWidth,
            photoHeight: member.photoHeight,
            overlays: (member.overlays ?? []) as Prisma.InputJsonValue,
            createdAt: member.photoAt!,
          },
        })
      }
    }

    const captures = await tx.circleSessionCapture.findMany({
      where: { roundId: round.id, userId: { in: joinedIds } },
    })
    const myCaptures = captures.filter((capture) => capture.userId === userId)
    const latestMine = myCaptures.reduce<Date | null>(
      (latest, capture) => !latest || capture.createdAt > latest ? capture.createdAt : latest,
      null,
    )
    if (!latestMine || Date.now() - latestMine.getTime() > PUBLISH_WINDOW_MS) {
      throw new Error('A janela para publicar esta foto já passou')
    }

    const memberOrder = new Map(joinedIds.map((id, index) => [id, index]))
    captures.sort((a, b) =>
      (memberOrder.get(a.userId) ?? Number.MAX_SAFE_INTEGER) -
        (memberOrder.get(b.userId) ?? Number.MAX_SAFE_INTEGER) ||
      a.slot - b.slot,
    )
    if (captures.length === 0) throw new Error('Ainda não há fotos para publicar')

    const urls = captures.map((capture) => capture.mediaUrl)
    const overlays = captures.map((capture) =>
      Array.isArray(capture.overlays) ? capture.overlays as Overlay[] : [],
    )
    const sizes = captures.map((capture) => ({
      w: capture.photoWidth,
      h: capture.photoHeight,
    }))

    const snapshotParticipants = joined.map((member) => member.user)
    const snapshotCaptures = captures.map((capture, index) => ({
      id: capture.id,
      userId: capture.userId,
      slot: capture.slot,
      mediaIndex: index,
      mediaUrl: capture.mediaUrl,
      overlays: overlays[index],
      createdAt: capture.createdAt.toISOString(),
    }))
    const revision = createHash('sha256')
      .update(JSON.stringify({ participants: snapshotParticipants, captures: snapshotCaptures }))
      .digest('hex')
      .slice(0, 24)
    const collectiveMoment = {
      version: 1 as const,
      id: round.id,
      sessionId,
      roundId: round.id,
      revision,
      creatorId: me.session.hostId,
      createdAt: round.shotAt.toISOString(),
      participants: snapshotParticipants,
      captures: snapshotCaptures,
    }

    const circlePublicationKey = `${userId}:${round.id}`
    const existing = await tx.post.findUnique({
      where: { circlePublicationKey },
      select: { id: true, caption: true, mediaUrls: true, collectiveMoment: true },
    })
    const existingMoment = existing?.collectiveMoment
    const existingRevision = existingMoment && typeof existingMoment === 'object' && !Array.isArray(existingMoment)
      ? (existingMoment as { revision?: unknown }).revision
      : null
    const requestedCaption = caption ?? null
    const changed = !existing ||
      existingRevision !== revision ||
      existing.caption !== requestedCaption ||
      existing.mediaUrls.length !== urls.length ||
      existing.mediaUrls.some((url, index) => url !== urls[index])
    const post = await createAlbumPost(
      userId,
      urls,
      caption,
      undefined,
      overlays,
      sizes,
      collectiveMoment,
      tx,
    )
    return {
      post,
      created: !existing,
      changed,
      roundId: round.id,
      status: !existing ? 'created' as const : changed ? 'updated' as const : 'unchanged' as const,
    }
  }, { maxWait: 5_000, timeout: 10_000 })

  if (published.changed) {
    try {
      emitToUser(userId, 'circle:published', {
        sessionId,
        roundId: published.roundId,
        postId: published.post.id,
        status: published.status,
      })
    } catch {}
    emitPostToVisibleFollowers(
      userId,
      published.post,
      published.created ? 'post:new' : 'post:updated',
    ).catch(() => {})
  }
  return { ...published.post, circlePublicationStatus: published.status }
}

// Chamado pelo cron. Fecha as sessões que passaram da idade e devolve os URLs
// das fotos que ficaram por publicar, para quem chama as apagar do
// armazenamento. Sem isto, cada círculo deixava fotos no Cloudinary para sempre.
export async function closeStaleSessions(): Promise<string[]> {
  const cutoff = new Date(Date.now() - SESSION_MAX_AGE_MS)
  const publishSafeBefore = new Date(Date.now() - PUBLISH_WINDOW_MS)
  const deletableUrls: string[] = []

  // Lotes curtos evitam que uma sessão ocupada faça o cron inteiro exceder o
  // timeout da interactive transaction.
  while (true) {
    const now = new Date()
    const stale = await prisma.circleSession.findMany({
      where: {
        createdAt: { lt: cutoff },
        OR: [
          {
            status: 'OPEN',
            members: { none: { photoAt: { gte: publishSafeBefore } } },
            rounds: { none: { expiresAt: { gt: now } } },
          },
          {
            status: 'CLOSED',
            OR: [
              { members: { some: { photoUrl: { not: null } } } },
              { rounds: { some: {} } },
            ],
          },
        ],
      },
      select: { id: true },
      orderBy: { id: 'asc' },
      take: 100,
    })
    if (stale.length === 0) break

    const ids = stale.map((session) => session.id).sort()
    const photoUrls = await prisma.$transaction(async (tx) => {
      await tx.$queryRaw<Array<{ id: string }>>(
        Prisma.sql`
          SELECT "id" FROM "CircleSession"
          WHERE "id" IN (${Prisma.join(ids)})
          ORDER BY "id"
          FOR UPDATE
        `,
      )

      // Repetir a condição depois do lock cobre uma captura/round que tenha
      // chegado entre o primeiro select e o fechamento.
      const checkedAt = new Date()
      const closable = await tx.circleSession.findMany({
        where: {
          id: { in: ids },
          createdAt: { lt: cutoff },
          OR: [
            {
              status: 'OPEN',
              members: { none: { photoAt: { gte: publishSafeBefore } } },
              rounds: { none: { expiresAt: { gt: checkedAt } } },
            },
            {
              status: 'CLOSED',
              OR: [
                { members: { some: { photoUrl: { not: null } } } },
                { rounds: { some: {} } },
              ],
            },
          ],
        },
        select: { id: true },
      })
      const closableIds = closable.map((session) => session.id)
      if (closableIds.length === 0) return []

      const [legacyPhotos, captures] = await Promise.all([
        tx.circleSessionMember.findMany({
          where:  { sessionId: { in: closableIds }, photoUrl: { not: null } },
          select: { photoUrl: true },
        }),
        tx.circleSessionCapture.findMany({
          where: { round: { sessionId: { in: closableIds } } },
          select: { mediaUrl: true },
        }),
      ])

      await tx.circleSession.updateMany({
        where: { id: { in: closableIds }, status: 'OPEN' },
        data: { status: 'CLOSED' },
      })
      await tx.circleSessionMember.updateMany({
        where: { sessionId: { in: closableIds } },
        data: {
          photoUrl: null,
          photoAt: null,
          photoRoundAt: null,
          photoWidth: null,
          photoHeight: null,
          overlays: [],
        },
      })
      // O snapshot do Post já é autónomo; rounds/captures ao vivo podem sair.
      await tx.circleSessionRound.deleteMany({ where: { sessionId: { in: closableIds } } })
      return [...new Set([
        ...legacyPhotos.flatMap((photo) => photo.photoUrl ? [photo.photoUrl] : []),
        ...captures.map((capture) => capture.mediaUrl),
      ])]
    }, { maxWait: 5_000, timeout: 15_000 })

    // Nenhuma publicação desta sessão nasce depois de CLOSED; a consulta após
    // commit decide com segurança quais ficheiros não passaram para um Post.
    const published = photoUrls.length > 0
      ? await prisma.post.findMany({
          where: {
            OR: [
              { mediaUrl: { in: photoUrls } },
              { mediaUrls: { hasSome: photoUrls } },
            ],
          },
          select: { mediaUrl: true, mediaUrls: true },
        })
      : []
    const publishedUrls = new Set(published.flatMap((post) => [
      ...(post.mediaUrl ? [post.mediaUrl] : []),
      ...post.mediaUrls,
    ]))
    deletableUrls.push(...photoUrls.filter((url) => !publishedUrls.has(url)))
  }

  return [...new Set(deletableUrls)]
}

// Uma chamada pendente para mim (para quem abre o Círculo após ser chamado)
export async function incomingCall(userId: string) {
  await expireInvites({ userId })
  const cutoff = new Date(Date.now() - INVITE_TTL_MS)
  const m = await prisma.circleSessionMember.findFirst({
    where:   { userId, status: 'INVITED', createdAt: { gte: cutoff }, session: { status: 'OPEN' } },
    orderBy: { createdAt: 'desc' },
    include: { session: { include: { host: { select: { id: true, name: true, username: true, avatar: true } } } } },
  })
  if (!m) return { call: null }
  return { call: { sessionId: m.sessionId, host: m.session.host } }
}
