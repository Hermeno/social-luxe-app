import { prisma } from '../config/database'
import { HalfStatus, MediaType } from '@prisma/client'
import { POST_INITIAL_HOURS } from '../types'
import { sendPush } from './notification.service'
import { withThumbnail } from '../utils/cloudinary.util'

// Uma metade fica à espera 24h. Se ninguém a completar, expira — e nunca
// existiu publicação nenhuma. É a fricção que dá peso ao gesto.
const HALF_TTL_HOURS = 24

const creatorSelect = { select: { id: true, name: true, avatar: true } }

const halfInclude = {
  creator:     creatorSelect,
  targetUser:  creatorSelect,
  completedBy: creatorSelect,
}

// Ligações = união de quem sigo com quem me segue (mesma base do feed e das
// mensagens). Uma metade aberta só é visível para estas pessoas.
async function connectionIds(userId: string): Promise<string[]> {
  const rows = await prisma.follow.findMany({
    where:  { OR: [{ followerId: userId }, { followingId: userId }] },
    select: { followerId: true, followingId: true },
  })
  const ids = new Set<string>()
  for (const r of rows) {
    if (r.followerId  !== userId) ids.add(r.followerId)
    if (r.followingId !== userId) ids.add(r.followingId)
  }
  return Array.from(ids)
}

export async function createHalf(
  creatorId: string,
  mediaUrl: string,
  mediaType: MediaType,
  caption?: string,
  targetUserId?: string,
) {
  if (targetUserId === creatorId) throw new Error('Não podes enviar uma metade a ti próprio')

  if (targetUserId) {
    const target = await prisma.user.findUnique({ where: { id: targetUserId }, select: { id: true } })
    if (!target) throw new Error('Pessoa não encontrada')

    // Bloqueios em qualquer direção impedem o convite
    const blocked = await prisma.block.findFirst({
      where: {
        OR: [
          { blockerId: creatorId,    blockedId: targetUserId },
          { blockerId: targetUserId, blockedId: creatorId },
        ],
      },
      select: { id: true },
    })
    if (blocked) throw new Error('Não é possível enviar uma metade a esta pessoa')
  }

  const half = await prisma.half.create({
    data: {
      creatorId,
      mediaUrl,
      mediaType,
      caption:      caption ?? null,
      targetUserId: targetUserId ?? null,
      expiresAt:    new Date(Date.now() + HALF_TTL_HOURS * 60 * 60 * 1000),
    },
    include: halfInclude,
  })

  if (targetUserId) {
    const name = half.creator.name
    sendPush(
      targetUserId,
      'Falta a tua metade',
      `${name} começou uma publicação contigo. Sem ti, não vai para o feed.`,
      { type: 'half_invite', halfId: half.id },
    ).catch(() => {})
  }

  return half
}

// As minhas metades à espera — o que criei e ainda ninguém completou.
export async function getMyHalves(userId: string) {
  return prisma.half.findMany({
    where:   { creatorId: userId, status: HalfStatus.WAITING, expiresAt: { gt: new Date() } },
    include: halfInclude,
    orderBy: { createdAt: 'desc' },
  })
}

// Metades que eu posso completar: as dirigidas a mim + as abertas das minhas
// ligações. Bloqueios excluídos nos dois sentidos.
export async function getIncomingHalves(userId: string) {
  const [connections, blocksGiven, blocksReceived] = await Promise.all([
    connectionIds(userId),
    prisma.block.findMany({ where: { blockerId: userId }, select: { blockedId: true } }),
    prisma.block.findMany({ where: { blockedId: userId }, select: { blockerId: true } }),
  ])

  const blockedIds = new Set([
    ...blocksGiven.map((b) => b.blockedId),
    ...blocksReceived.map((b) => b.blockerId),
  ])
  const openFrom = connections.filter((id) => !blockedIds.has(id))

  return prisma.half.findMany({
    where: {
      status:    HalfStatus.WAITING,
      expiresAt: { gt: new Date() },
      creatorId: { not: userId },
      OR: [
        { targetUserId: userId },
        { targetUserId: null, creatorId: { in: openFrom } },
      ],
    },
    include: halfInclude,
    orderBy: { createdAt: 'asc' },   // as que estão mais perto de morrer primeiro
  })
}

export async function getHalf(userId: string, halfId: string) {
  const half = await prisma.half.findUnique({ where: { id: halfId }, include: halfInclude })
  if (!half) throw new Error('Metade não encontrada')

  // Só o criador, o destinatário, ou — se for aberta — uma ligação pode vê-la
  if (half.creatorId !== userId && half.targetUserId !== userId) {
    if (half.targetUserId !== null) throw new Error('Não autorizado')
    const connections = await connectionIds(userId)
    if (!connections.includes(half.creatorId)) throw new Error('Não autorizado')
  }
  return half
}

// O momento em que a regra se cumpre: duas metades viram um Post com dois
// autores. O Post nasce já com partnerAccepted — quem completa consentiu ao
// completar, não há convite pendente.
export async function completeHalf(userId: string, halfId: string, mediaUrl: string) {
  const half = await getHalf(userId, halfId)

  if (half.creatorId === userId)              throw new Error('Não podes completar a tua própria metade')
  if (half.status !== HalfStatus.WAITING)     throw new Error('Esta metade já não está à espera')
  if (half.expiresAt <= new Date())           throw new Error('Esta metade expirou')

  const expiresAt = new Date(Date.now() + POST_INITIAL_HOURS * 60 * 60 * 1000)

  const post = await prisma.$transaction(async (tx) => {
    // Reivindica a metade antes de criar o post. Se outra pessoa completou
    // entretanto, o count vem a 0 e abortamos — evita dois posts da mesma metade.
    const claimed = await tx.half.updateMany({
      where: { id: half.id, status: HalfStatus.WAITING },
      data:  { status: HalfStatus.COMPLETED, completedById: userId, completedUrl: mediaUrl, completedAt: new Date() },
    })
    if (claimed.count === 0) throw new Error('Esta metade já foi completada')

    const created = await tx.post.create({
      data: {
        userId:          half.creatorId,
        partnerUserId:   userId,
        partnerAccepted: true,
        mediaUrl:        half.mediaUrl,
        mediaUrls:       [half.mediaUrl, mediaUrl],
        mediaType:       half.mediaType,
        caption:         half.caption,
        expiresAt,
      },
      include: {
        user:        { select: { id: true, name: true, avatar: true, viewsPublic: true, showDevice: true, statusLabel: true } },
        partnerUser: { select: { id: true, name: true, avatar: true } },
        _count:      { select: { likes: true, comments: true, shares: true, views: true } },
      },
    })

    await tx.half.update({ where: { id: half.id }, data: { postId: created.id } })
    return created
  })

  sendPush(
    half.creatorId,
    'A tua metade ficou inteira',
    `${post.partnerUser?.name ?? 'Alguém'} completou-a. Já está no feed.`,
    { type: 'half_completed', postId: post.id },
  ).catch(() => {})

  return withThumbnail(post)
}

export async function deleteHalf(userId: string, halfId: string) {
  const half = await prisma.half.findUnique({ where: { id: halfId }, select: { creatorId: true, status: true } })
  if (!half)                              throw new Error('Metade não encontrada')
  if (half.creatorId !== userId)          throw new Error('Não autorizado')
  if (half.status !== HalfStatus.WAITING) throw new Error('Esta metade já foi completada')
  await prisma.half.delete({ where: { id: halfId } })
}

// Chamado pelo cron. Uma metade não completada não deixa rasto no feed —
// marcamos como expirada para o criador poder ver o que não vingou.
export async function expireStaleHalves() {
  const res = await prisma.half.updateMany({
    where: { status: HalfStatus.WAITING, expiresAt: { lte: new Date() } },
    data:  { status: HalfStatus.EXPIRED },
  })
  return res.count
}
