import { prisma } from '../config/database'
import { sendPush } from './notification.service'
import { emitToUser } from '../socket'

// Alvos diários — objetos universais que obrigam a sair e olhar para o mundo
const TARGETS: { title: string; emoji: string }[] = [
  { title: 'Algo vermelho',                  emoji: '🔴' },
  { title: 'Um círculo perfeito',            emoji: '⭕' },
  { title: 'Um portão ou porta azul',        emoji: '🚪' },
  { title: 'Uma sombra com forma bonita',    emoji: '🌗' },
  { title: 'Algo amarelo',                   emoji: '🟡' },
  { title: 'Uma planta a nascer no cimento', emoji: '🌱' },
  { title: 'Um número pintado na parede',    emoji: '🔢' },
  { title: 'Duas coisas iguais lado a lado', emoji: '👯' },
  { title: 'O céu de onde estás',            emoji: '☁️' },
  { title: 'Algo mais velho do que tu',      emoji: '🕰️' },
  { title: 'Uma linha que não acaba',        emoji: '➿' },
  { title: 'Algo verde que não é planta',    emoji: '🟢' },
  { title: 'Um reflexo numa superfície',     emoji: '🪞' },
  { title: 'Uma cadeira sozinha',            emoji: '🪑' },
]

const APPROVE_THRESHOLD = 3   // confirmações da comunidade para entrar no círculo
const REJECT_THRESHOLD  = 3
const COLD_START_LIVE   = 5   // primeiras capturas entram direto — ainda não há quem verifique
const TARGET_HOURS      = 24

export async function ensureActiveTarget() {
  const now = new Date()
  const active = await prisma.circleTarget.findFirst({
    where:   { endsAt: { gt: now } },
    orderBy: { endsAt: 'desc' },
  })
  if (active) return active

  // Rotação determinística: o alvo seguinte da lista, criado sob demanda
  const count = await prisma.circleTarget.count()
  const next  = TARGETS[count % TARGETS.length]
  return prisma.circleTarget.create({
    data: { title: next.title, emoji: next.emoji, endsAt: new Date(now.getTime() + TARGET_HOURS * 3_600_000) },
  })
}

export async function getCurrent(userId: string) {
  const target = await ensureActiveTarget()

  const [captures, myCapture, toVerify, liveCount] = await Promise.all([
    prisma.circleCapture.findMany({
      where:   { targetId: target.id, status: 'LIVE' },
      include: { user: { select: { id: true, name: true, avatar: true } } },
      orderBy: { createdAt: 'desc' },
      take:    60,
    }),
    prisma.circleCapture.findFirst({
      where:  { targetId: target.id, userId },
      select: { id: true, mediaUrl: true, status: true, approvals: true, rejections: true },
    }),
    // Verificação estilo captcha: capturas pendentes de outros, ainda não votadas por mim
    prisma.circleCapture.findMany({
      where: {
        targetId: target.id,
        status:   'PENDING',
        userId:   { not: userId },
        votes:    { none: { voterId: userId } },
      },
      select:  { id: true, mediaUrl: true },
      orderBy: { createdAt: 'asc' },
      take:    3,
    }),
    prisma.circleCapture.count({ where: { targetId: target.id, status: 'LIVE' } }),
  ])

  return { target, captures, myCapture, toVerify, liveCount }
}

export async function submitCapture(userId: string, targetId: string, mediaUrl: string) {
  const target = await prisma.circleTarget.findUnique({ where: { id: targetId } })
  if (!target || target.endsAt <= new Date()) throw new Error('Este círculo já fechou')

  const existing = await prisma.circleCapture.findUnique({
    where: { targetId_userId: { targetId, userId } },
  })
  if (existing) throw new Error('Já entraste neste círculo')

  const total  = await prisma.circleCapture.count({ where: { targetId } })
  const status = total < COLD_START_LIVE ? 'LIVE' as const : 'PENDING' as const

  return prisma.circleCapture.create({
    data:    { targetId, userId, mediaUrl, status },
    include: { user: { select: { id: true, name: true, avatar: true } } },
  })
}

// ─── Spark — abrir a câmera avisa conexões próximas ──────────────────────────
// Privacidade: comparação de posição só aqui no servidor; quem recebe só sabe
// "perto de ti" — nunca distância, nunca coordenadas. Só conexões (follow em
// qualquer direção) recebem nome; bloqueados nunca são avisados.

const lastSpark = new Map<string, number>()   // userId → ts (por instância; suficiente p/ 1 dyno)
const SPARK_COOLDOWN_MS = 60 * 60 * 1000      // 1 spark/hora por pessoa — anti-spam
const SPARK_RADIUS_KM   = 2

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number) {
  const R = 6371
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLng = ((lng2 - lng1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

export async function spark(userId: string, lat?: number, lng?: number) {
  const now = Date.now()
  if (now - (lastSpark.get(userId) ?? 0) < SPARK_COOLDOWN_MS) return { notified: 0 }

  const me = await prisma.user.findUnique({
    where:  { id: userId },
    select: { id: true, name: true, lat: true, lng: true },
  })
  if (!me) return { notified: 0 }

  // Posição fresca do momento em que a câmera abriu (fallback: última conhecida)
  const myLat = lat ?? me.lat
  const myLng = lng ?? me.lng
  if (myLat == null || myLng == null) return { notified: 0 }
  if (lat != null && lng != null) {
    prisma.user.update({ where: { id: userId }, data: { lat, lng } }).catch(() => {})
  }

  lastSpark.set(userId, now)

  const [target, follows, blocks] = await Promise.all([
    ensureActiveTarget(),
    prisma.follow.findMany({
      where:  { OR: [{ followerId: userId }, { followingId: userId }] },
      select: { followerId: true, followingId: true },
    }),
    prisma.block.findMany({
      where:  { OR: [{ blockerId: userId }, { blockedId: userId }] },
      select: { blockerId: true, blockedId: true },
    }),
  ])

  const blockedIds = new Set(blocks.flatMap((b) => [b.blockerId, b.blockedId]))
  const connectionIds = [...new Set(
    follows.flatMap((f) => [f.followerId, f.followingId]).filter((id) => id !== userId && !blockedIds.has(id)),
  )]
  if (connectionIds.length === 0) return { notified: 0 }

  // Bounding box barato primeiro, haversine exato depois
  const degPerKm = 1 / 111
  const latDelta = SPARK_RADIUS_KM * degPerKm
  const lngDelta = SPARK_RADIUS_KM * degPerKm / Math.cos((myLat * Math.PI) / 180)

  const candidates = await prisma.user.findMany({
    where: {
      id:  { in: connectionIds },
      lat: { gte: myLat - latDelta, lte: myLat + latDelta },
      lng: { gte: myLng - lngDelta, lte: myLng + lngDelta },
    },
    select: { id: true, lat: true, lng: true },
  })
  const nearby = candidates.filter((u) => haversineKm(myLat, myLng, u.lat!, u.lng!) <= SPARK_RADIUS_KM)

  const first   = me.name.split(' ')[0]
  const message = `${first} abriu a câmera perto de ti à procura de "${target.title}". Entra no círculo.`
  for (const u of nearby) {
    sendPush(u.id, `⭕ ${first} está no Círculo`, message, { type: 'circle' }).catch(() => {})
    try {
      emitToUser(u.id, 'notification:new', {
        id: `circle_${userId}_${now}`,
        type: 'circle',
        message,
        read: false,
        createdAt: new Date().toISOString(),
      })
    } catch { /* socket ainda não inicializado (ex.: testes) */ }
  }

  return { notified: nearby.length }
}

export async function vote(voterId: string, captureId: string, match: boolean) {
  const capture = await prisma.circleCapture.findUnique({ where: { id: captureId } })
  if (!capture) throw new Error('Captura não encontrada')
  if (capture.userId === voterId) throw new Error('Não podes verificar a tua própria captura')

  await prisma.$transaction([
    prisma.circleVote.create({ data: { captureId, voterId, match } }),
    prisma.circleCapture.update({
      where: { id: captureId },
      data:  match ? { approvals: { increment: 1 } } : { rejections: { increment: 1 } },
    }),
  ])

  const updated = await prisma.circleCapture.findUnique({ where: { id: captureId } })
  if (!updated || updated.status !== 'PENDING') return { status: updated?.status ?? 'PENDING' }

  if (updated.approvals >= APPROVE_THRESHOLD) {
    await prisma.circleCapture.update({ where: { id: captureId }, data: { status: 'LIVE' } })
    sendPush(updated.userId, '⭕ Estás no círculo', 'A comunidade confirmou o teu achado.', { type: 'circle' }).catch(() => {})
    return { status: 'LIVE' }
  }
  if (updated.rejections >= REJECT_THRESHOLD) {
    await prisma.circleCapture.update({ where: { id: captureId }, data: { status: 'REJECTED' } })
    return { status: 'REJECTED' }
  }
  return { status: 'PENDING' }
}
