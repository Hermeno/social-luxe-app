import { Prisma } from '@prisma/client'
import { prisma } from '../config/database'
import { emitToUser } from '../socket'
import { sendPush } from './notification.service'
import {
  ALBUM_POST_INCLUDE,
  emitPostRemoved,
  emitPostToVisibleFollowers,
  type CollectiveMomentPerson,
  type CollectiveMomentSnapshot,
} from './post.service'
import { momentRevision } from './circleSession.service'
import { withThumbnail } from '../utils/cloudinary.util'

/**
 * Um Círculo depois de publicado.
 *
 * Cada participante publica a sua cópia do Círculo (`collectiveMoment` no seu
 * Post). As cópias partilham o `circleMomentId`, e é por ele que este serviço as
 * encontra e as muda todas juntas quando:
 *
 *   · alguém que não esteve no disparo pede para entrar e o anfitrião aceita —
 *     a fotografia dele entra em todas as cópias, marcada como tardia;
 *   · alguém retira a própria fotografia — sai de todas as cópias. O anfitrião
 *     pode também retirar a de quem entrou depois, porque foi ele que a aceitou.
 *
 * As sessões ao vivo desaparecem duas horas depois; os posts não. Por isso a
 * verdade de um Círculo publicado está nas cópias, e não em tabelas da sessão.
 */

/** Quantas fotografias tardias cada pessoa pode ter no mesmo Círculo. */
export const MAX_LATE_PHOTOS_PER_PERSON = 3
/** Pedidos por pessoa numa hora, somando todos os Círculos. */
const REQUESTS_PER_HOUR = 10
/** Um pedido que o anfitrião não viu em dois dias caduca. */
export const JOIN_REQUEST_TTL_MS = 48 * 60 * 60 * 1000

type Snapshot = CollectiveMomentSnapshot
type SnapshotCapture = Snapshot['captures'][number]
type Overlay = { emoji: string; x: number; y: number }
type Size = { w: number | null; h: number | null }

const PERSON_SELECT = { id: true, name: true, username: true, avatar: true } as const

function readMoment(value: Prisma.JsonValue | null | undefined): Snapshot | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const moment = value as unknown as Snapshot
  if (typeof moment.id !== 'string' || !Array.isArray(moment.captures) || !Array.isArray(moment.participants)) {
    return null
  }
  return moment
}

/**
 * Todas as mudanças a um Círculo passam por aqui, uma de cada vez. Duas
 * aceitações ao mesmo tempo liam a mesma cópia e a segunda apagava a primeira;
 * o lock por momento põe-nas em fila dentro da base de dados.
 */
async function lockMoment(tx: Prisma.TransactionClient, momentId: string) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`circle-moment:${momentId}`}))`
}

/**
 * O que se sabe de um Círculo a partir das cópias vivas: quem é o anfitrião,
 * quem esteve no disparo e quem já tem fotografias nele.
 */
async function momentFacts(momentId: string, db: Prisma.TransactionClient | typeof prisma = prisma) {
  const posts = await db.post.findMany({
    where: { circleMomentId: momentId, expiresAt: { gt: new Date() } },
    select: { collectiveMoment: true },
  })
  const moments = posts.map((post) => readMoment(post.collectiveMoment)).filter((m): m is Snapshot => !!m)
  if (moments.length === 0) return null
  const participantIds = new Set<string>()
  const lateByUser = new Map<string, number>()
  for (const moment of moments) {
    for (const person of moment.participants) participantIds.add(person.id)
    const lateHere = new Map<string, number>()
    for (const capture of moment.captures) {
      if (capture.late) lateHere.set(capture.userId, (lateHere.get(capture.userId) ?? 0) + 1)
    }
    // Uma cópia pode estar atrás de outra; conta a mais completa.
    for (const [userId, count] of lateHere) {
      lateByUser.set(userId, Math.max(lateByUser.get(userId) ?? 0, count))
    }
  }
  return { hostId: moments[0].creatorId, participantIds, lateByUser }
}

// ─── Pedir para entrar ────────────────────────────────────────────────────────

/**
 * Pode esta pessoa pedir para entrar? Corre antes do upload, para ninguém pagar
 * o envio de uma fotografia que ia ser recusada à porta — e outra vez depois,
 * dentro da transacção, porque o mundo pode ter mudado entretanto.
 */
export async function assertCanRequestJoin(userId: string, momentId: string) {
  const facts = await momentFacts(momentId)
  if (!facts) throw new Error('Este círculo já não aceita pedidos')
  if (facts.hostId === userId || facts.participantIds.has(userId)) {
    throw new Error('Já fazes parte deste círculo')
  }

  const now = new Date()
  const [follows, blocked, pending, recent] = await Promise.all([
    // Só quem segue alguém do Círculo — quem o vê na feed por seguir quem lá esteve.
    prisma.follow.count({
      where: {
        followerId: userId,
        followingId: { in: [...facts.participantIds] },
        OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
      },
    }),
    prisma.block.count({
      where: {
        OR: [
          { blockerId: facts.hostId, blockedId: userId },
          { blockerId: userId, blockedId: facts.hostId },
        ],
      },
    }),
    prisma.circleJoinRequest.count({ where: { momentId, requesterId: userId, status: 'PENDING' } }),
    prisma.circleJoinRequest.count({
      where: { requesterId: userId, createdAt: { gt: new Date(now.getTime() - 60 * 60 * 1000) } },
    }),
  ])
  if (follows === 0) throw new Error('Só quem segue alguém deste círculo pode pedir para entrar')
  if (blocked > 0) throw new Error('Não podes pedir para entrar neste círculo')
  if (pending > 0) throw new Error('Já tens um pedido à espera neste círculo')
  if ((facts.lateByUser.get(userId) ?? 0) >= MAX_LATE_PHOTOS_PER_PERSON) {
    throw new Error('Já tens fotos suficientes neste círculo')
  }
  if (recent >= REQUESTS_PER_HOUR) throw new Error('Fizeste muitos pedidos. Espera um pouco.')
  return facts
}

export async function requestToJoin(
  userId: string,
  momentId: string,
  photo: { url: string; width: number | null; height: number | null },
) {
  const facts = await assertCanRequestJoin(userId, momentId)
  const request = await prisma.$transaction(async (tx) => {
    // Dois toques seguidos em "enviar" não podem deixar dois pedidos pendentes.
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`circle-join:${momentId}:${userId}`}))`
    const pending = await tx.circleJoinRequest.count({
      where: { momentId, requesterId: userId, status: 'PENDING' },
    })
    if (pending > 0) throw new Error('Já tens um pedido à espera neste círculo')
    return tx.circleJoinRequest.create({
      data: {
        momentId,
        hostId: facts.hostId,
        requesterId: userId,
        mediaUrl: photo.url,
        photoWidth: photo.width,
        photoHeight: photo.height,
      },
      include: { requester: { select: PERSON_SELECT } },
    })
  })

  const name = request.requester.name.split(' ')[0] || request.requester.name
  try {
    emitToUser(facts.hostId, 'circle:join-request', { requestId: request.id, momentId })
  } catch {}
  sendPush(
    facts.hostId,
    'Círculo',
    `${name} quer juntar-se ao teu círculo`,
    { type: 'circle_join_request', momentId, requestId: request.id },
  ).catch(() => {})

  return { id: request.id, momentId, status: request.status, createdAt: request.createdAt.toISOString() }
}

/** Desistir de um pedido que ainda está à espera. Devolve a fotografia a apagar. */
export async function cancelJoinRequest(userId: string, requestId: string) {
  const request = await prisma.circleJoinRequest.findUnique({ where: { id: requestId } })
  if (!request || request.requesterId !== userId) throw new Error('Pedido não encontrado')
  if (request.status !== 'PENDING') throw new Error('Este pedido já foi decidido')
  const removed = await prisma.circleJoinRequest.deleteMany({ where: { id: requestId, status: 'PENDING' } })
  if (removed.count === 0) throw new Error('Este pedido já foi decidido')
  try {
    emitToUser(request.hostId, 'circle:join-request', { requestId, momentId: request.momentId })
  } catch {}
  return { discardedPhotoUrl: request.mediaUrl }
}

// ─── Listas ───────────────────────────────────────────────────────────────────

/** Os pedidos à espera do anfitrião, com a fotografia e quem a mandou. */
export async function incomingJoinRequests(hostId: string) {
  const since = new Date(Date.now() - JOIN_REQUEST_TTL_MS)
  const requests = await prisma.circleJoinRequest.findMany({
    where: { hostId, status: 'PENDING', createdAt: { gt: since } },
    include: { requester: { select: PERSON_SELECT } },
    orderBy: { createdAt: 'asc' },
    take: 100,
  })
  if (requests.length === 0) return []

  // Quem o anfitrião bloqueou depois do pedido deixa de aparecer, e um Círculo
  // cujos posts já expiraram não tem onde receber ninguém.
  const [blocks, aliveMoments] = await Promise.all([
    prisma.block.findMany({
      where: {
        OR: [
          { blockerId: hostId, blockedId: { in: requests.map((r) => r.requesterId) } },
          { blockedId: hostId, blockerId: { in: requests.map((r) => r.requesterId) } },
        ],
      },
      select: { blockerId: true, blockedId: true },
    }),
    prisma.post.findMany({
      where: {
        circleMomentId: { in: [...new Set(requests.map((r) => r.momentId))] },
        expiresAt: { gt: new Date() },
      },
      select: { circleMomentId: true },
      distinct: ['circleMomentId'],
    }),
  ])
  const blockedIds = new Set(blocks.flatMap((b) => [b.blockerId, b.blockedId]))
  const alive = new Set(aliveMoments.map((p) => p.circleMomentId))

  return requests
    .filter((r) => !blockedIds.has(r.requesterId) && alive.has(r.momentId))
    .map((r) => ({
      id: r.id,
      momentId: r.momentId,
      mediaUrl: r.mediaUrl,
      photoWidth: r.photoWidth,
      photoHeight: r.photoHeight,
      createdAt: r.createdAt.toISOString(),
      requester: r.requester,
    }))
}

/** Os meus pedidos ainda à espera — é o que faz o botão dizer "pedido enviado". */
export async function myPendingJoinRequests(userId: string) {
  const since = new Date(Date.now() - JOIN_REQUEST_TTL_MS)
  const requests = await prisma.circleJoinRequest.findMany({
    where: { requesterId: userId, status: 'PENDING', createdAt: { gt: since } },
    select: { id: true, momentId: true, createdAt: true },
    orderBy: { createdAt: 'desc' },
    take: 100,
  })
  return requests.map((r) => ({ id: r.id, momentId: r.momentId, createdAt: r.createdAt.toISOString() }))
}

// ─── Reescrever as cópias ─────────────────────────────────────────────────────

export type MomentPost = {
  id: string
  userId: string
  mediaUrls: string[]
  mediaSizes: Prisma.JsonValue | null
  albumOverlays: Prisma.JsonValue | null
  collectiveMoment: Prisma.JsonValue | null
}

const MOMENT_POST_SELECT = {
  id: true,
  userId: true,
  mediaUrls: true,
  mediaSizes: true,
  albumOverlays: true,
  collectiveMoment: true,
} as const

/**
 * Os arrays paralelos de um post (URLs, dimensões, emojis) reconstruídos a
 * partir da lista final de capturas. Cada captura aponta para a sua posição
 * antiga por `mediaIndex`; a nova posição é a ordem da lista.
 */
export function rebuildPost(post: MomentPost, moment: Snapshot, captures: Array<SnapshotCapture & { size?: Size }>) {
  const oldSizes = Array.isArray(post.mediaSizes) ? post.mediaSizes as unknown as Size[] : null
  const oldOverlays = Array.isArray(post.albumOverlays) ? post.albumOverlays as unknown as Overlay[][] : null

  const mediaUrls: string[] = []
  const mediaSizes: Size[] = []
  const albumOverlays: Overlay[][] = []
  const nextCaptures: SnapshotCapture[] = captures.map((capture, index) => {
    const { size, ...rest } = capture
    const from = capture.mediaIndex
    mediaUrls.push(post.mediaUrls[from] ?? capture.mediaUrl)
    mediaSizes.push(size ?? oldSizes?.[from] ?? { w: null, h: null })
    albumOverlays.push(oldOverlays?.[from] ?? (Array.isArray(capture.overlays) ? capture.overlays : []))
    return { ...rest, mediaIndex: index }
  })

  // Quem entrou depois só continua na lista enquanto tiver fotografias lá.
  const lateIds = new Set(nextCaptures.filter((c) => c.late).map((c) => c.userId))
  const latecomers = (moment.latecomers ?? []).filter((person) => lateIds.has(person.id))
  const nextMoment: Snapshot = {
    ...moment,
    captures: nextCaptures,
    revision: momentRevision(moment.participants, latecomers, nextCaptures),
  }
  if (latecomers.length > 0) nextMoment.latecomers = latecomers
  else delete nextMoment.latecomers

  const hasSizes = mediaSizes.some((size) => size.w != null && size.h != null)
  const hasOverlays = albumOverlays.some((list) => list.length > 0)
  return {
    mediaUrl: mediaUrls[0] ?? null,
    mediaUrls,
    mediaSizes: hasSizes ? mediaSizes as unknown as Prisma.InputJsonValue : Prisma.DbNull,
    mediaWidth: hasSizes ? mediaSizes[0]?.w ?? null : null,
    mediaHeight: hasSizes ? mediaSizes[0]?.h ?? null : null,
    albumOverlays: hasOverlays ? albumOverlays as unknown as Prisma.InputJsonValue : Prisma.DbNull,
    collectiveMoment: nextMoment as unknown as Prisma.InputJsonValue,
  }
}

async function broadcastUpdated(postIds: string[]) {
  if (postIds.length === 0) return
  const posts = await prisma.post.findMany({ where: { id: { in: postIds } }, include: ALBUM_POST_INCLUDE })
  for (const post of posts) {
    const payload = withThumbnail(post)
    emitPostToVisibleFollowers(post.userId, payload, 'post:updated').catch(() => {})
    try { emitToUser(post.userId, 'post:updated', payload) } catch {}
  }
}

// ─── Decidir ──────────────────────────────────────────────────────────────────

/**
 * O anfitrião aceita ou recusa. Aceite, a fotografia entra em todas as cópias
 * vivas do Círculo como tardia — e na ronda ao vivo, se ainda existir, para um
 * participante que publique depois não a deixar de fora.
 *
 * Devolve a fotografia a apagar quando o pedido é recusado.
 */
export async function decideJoinRequest(hostId: string, requestId: string, accept: boolean) {
  const found = await prisma.circleJoinRequest.findUnique({ where: { id: requestId } })
  if (!found || found.hostId !== hostId) throw new Error('Pedido não encontrado')

  const result = await prisma.$transaction(async (tx) => {
    await lockMoment(tx, found.momentId)
    const request = await tx.circleJoinRequest.findUnique({ where: { id: requestId } })
    if (!request || request.status !== 'PENDING') throw new Error('Este pedido já foi decidido')

    if (!accept) {
      await tx.circleJoinRequest.update({
        where: { id: requestId },
        data: { status: 'DECLINED', decidedAt: new Date() },
      })
      return { accepted: false as const, updatedPostIds: [] as string[], request }
    }

    const now = new Date()
    const posts = await tx.post.findMany({
      where: { circleMomentId: request.momentId },
      select: { ...MOMENT_POST_SELECT, expiresAt: true },
    })
    if (!posts.some((post) => post.expiresAt > now)) throw new Error('Este círculo já não aceita pedidos')
    const requester = await tx.user.findUnique({ where: { id: request.requesterId }, select: PERSON_SELECT })
    if (!requester) throw new Error('Pedido não encontrado')
    const person: CollectiveMomentPerson = requester

    const updatedPostIds: string[] = []
    for (const post of posts) {
      const moment = readMoment(post.collectiveMoment)
      if (!moment) continue
      // Repetir a aceitação não duplica: a captura tardia tem o id do pedido.
      if (moment.captures.some((capture) => capture.id === request.id)) continue
      const slot = moment.captures
        .filter((capture) => capture.userId === requester.id)
        .reduce((last, capture) => Math.max(last, capture.slot ?? 0), 0) + 1
      const late: SnapshotCapture & { size: Size } = {
        id: request.id,
        userId: requester.id,
        slot,
        mediaIndex: -1,
        mediaUrl: request.mediaUrl,
        overlays: [],
        createdAt: now.toISOString(),
        late: true,
        size: { w: request.photoWidth, h: request.photoHeight },
      }
      const latecomers = (moment.latecomers ?? []).some((p) => p.id === person.id)
        ? moment.latecomers!
        : [...(moment.latecomers ?? []), person]
      await tx.post.update({
        where: { id: post.id },
        data: rebuildPost(post, { ...moment, latecomers }, [...moment.captures, late]),
      })
      updatedPostIds.push(post.id)
    }

    // A ronda ao vivo ainda existe nas duas primeiras horas: quem publicar a
    // partir dela tem de trazer também quem entrou depois.
    const round = await tx.circleSessionRound.findUnique({ where: { id: request.momentId }, select: { id: true } })
    if (round) {
      const existing = await tx.circleSessionCapture.findMany({
        where: { roundId: round.id, userId: requester.id },
        select: { slot: true },
      })
      await tx.circleSessionCapture.upsert({
        where: { id: request.id },
        update: {},
        create: {
          id: request.id,
          roundId: round.id,
          userId: requester.id,
          slot: existing.reduce((last, capture) => Math.max(last, capture.slot), 0) + 1,
          mediaUrl: request.mediaUrl,
          photoWidth: request.photoWidth,
          photoHeight: request.photoHeight,
          overlays: [],
          late: true,
        },
      })
    }

    await tx.circleJoinRequest.update({
      where: { id: requestId },
      data: { status: 'ACCEPTED', decidedAt: now },
    })
    return { accepted: true as const, updatedPostIds, request }
  }, { maxWait: 5_000, timeout: 15_000 })

  await broadcastUpdated(result.updatedPostIds).catch(() => {})
  try {
    emitToUser(result.request.requesterId, 'circle:join-decided', {
      requestId,
      momentId: result.request.momentId,
      accepted: result.accepted,
    })
  } catch {}
  sendPush(
    result.request.requesterId,
    'Círculo',
    result.accepted ? 'A tua foto entrou no círculo' : 'O anfitrião não aceitou a tua foto desta vez',
    { type: 'circle_join_decided', momentId: result.request.momentId, accepted: result.accepted },
  ).catch(() => {})

  return {
    accepted: result.accepted,
    discardedPhotoUrl: result.accepted ? null : result.request.mediaUrl,
  }
}

// ─── Retirar fotografias ─────────────────────────────────────────────────────

/**
 * Retirar fotografias de um Círculo publicado, de todas as cópias.
 *
 * Sem `captureId`, saem todas as minhas. Com ele, sai essa — se for minha, ou
 * se for tardia e eu for o anfitrião. Estar lá não se desfaz: quem retira as
 * fotografias continua em `participants`. Uma cópia que fique sem nenhuma
 * fotografia deixa de ter o que mostrar e é apagada.
 */
export async function removeMomentPhotos(userId: string, momentId: string, captureId?: string) {
  const result = await prisma.$transaction(async (tx) => {
    await lockMoment(tx, momentId)
    const posts = await tx.post.findMany({
      where: { circleMomentId: momentId },
      select: MOMENT_POST_SELECT,
    })
    const moments = posts.map((post) => ({ post, moment: readMoment(post.collectiveMoment) }))
      .filter((entry): entry is { post: MomentPost; moment: Snapshot } => !!entry.moment)
    if (moments.length === 0) throw new Error('Círculo não encontrado')
    const hostId = moments[0].moment.creatorId

    const every = moments.flatMap(({ moment }) => moment.captures)
    const targets = new Map<string, SnapshotCapture>()
    for (const capture of every) {
      if (captureId ? capture.id === captureId : capture.userId === userId) targets.set(capture.id, capture)
    }
    if (targets.size === 0) {
      throw new Error(captureId ? 'Captura não encontrada' : 'Não tens fotografias neste círculo')
    }
    for (const capture of targets.values()) {
      const mine = capture.userId === userId
      const hostOnLate = capture.late === true && hostId === userId
      if (!mine && !hostOnLate) throw new Error('Não podes retirar esta fotografia')
    }

    const updatedPostIds: string[] = []
    const emptied: Array<{ id: string; userId: string }> = []
    const removedUrls = new Set<string>()
    for (const { post, moment } of moments) {
      const keep = moment.captures.filter((capture) => !targets.has(capture.id))
      if (keep.length === moment.captures.length) continue
      for (const capture of moment.captures) {
        if (targets.has(capture.id)) removedUrls.add(post.mediaUrls[capture.mediaIndex] ?? capture.mediaUrl)
      }
      if (keep.length === 0) {
        emptied.push({ id: post.id, userId: post.userId })
        continue
      }
      await tx.post.update({ where: { id: post.id }, data: rebuildPost(post, moment, keep) })
      updatedPostIds.push(post.id)
    }

    if (emptied.length > 0) {
      const ids = emptied.map((post) => post.id)
      await tx.repost.deleteMany({ where: { OR: [{ postId: { in: ids } }, { repostedPostId: { in: ids } }] } })
      await tx.post.deleteMany({ where: { id: { in: ids } } })
    }
    // Da ronda ao vivo também, para um republicar não as trazer de volta.
    await tx.circleSessionCapture.deleteMany({ where: { id: { in: [...targets.keys()] } } })

    return { updatedPostIds, emptied, removedUrls: [...removedUrls], removedCaptureIds: [...targets.keys()] }
  }, { maxWait: 5_000, timeout: 15_000 })

  await broadcastUpdated(result.updatedPostIds).catch(() => {})
  for (const post of result.emptied) emitPostRemoved(post.userId, post.id).catch(() => {})
  return {
    removedCaptureIds: result.removedCaptureIds,
    removedPostIds: result.emptied.map((post) => post.id),
    removedUrls: result.removedUrls,
  }
}

// ─── Limpeza ─────────────────────────────────────────────────────────────────

/**
 * Chamado pelo cron. Pedidos que ninguém decidiu em dois dias caducam e a
 * fotografia sai do armazenamento; decisões com mais de uma semana já não
 * servem para nada (nem para o limite por hora) e saem da tabela.
 */
export async function sweepJoinRequests(): Promise<string[]> {
  const now = Date.now()
  const stale = await prisma.circleJoinRequest.findMany({
    where: { status: 'PENDING', createdAt: { lt: new Date(now - JOIN_REQUEST_TTL_MS) } },
    select: { id: true, mediaUrl: true },
    take: 500,
  })
  if (stale.length > 0) {
    await prisma.circleJoinRequest.deleteMany({
      where: { id: { in: stale.map((r) => r.id) }, status: 'PENDING' },
    })
  }
  await prisma.circleJoinRequest.deleteMany({
    where: { status: { not: 'PENDING' }, decidedAt: { lt: new Date(now - 7 * 24 * 60 * 60 * 1000) } },
  })
  return stale.map((r) => r.mediaUrl)
}
