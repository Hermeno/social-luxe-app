import { prisma } from '../config/database'
import { sendPush } from './notification.service'
import { emitToUser } from '../socket'
import { createAlbumPost } from './post.service'

const RADIUS_KM = 3
const INVITE_TTL_MS = 2 * 60 * 1000   // convite expira em 2 minutos

// Uma sessão é um momento, não uma sala permanente. Passado isto o anfitrião
// abre uma nova em vez de reutilizar a antiga — senão membros e fotos de há
// semanas continuavam agarrados à mesma sessão.
export const SESSION_MAX_AGE_MS = 2 * 60 * 60 * 1000   // 2 horas

// Quantas chamadas um anfitrião pode fazer numa janela — um convite é um push
// no telemóvel de outra pessoa, por isso tem preço.
const CALL_LIMIT       = 12
const CALL_WINDOW_MS   = 5 * 60 * 1000
const CALL_COOLDOWN_MS = 30 * 1000   // insistir na mesma pessoa não repete o push

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
  return rows.map((r) => ({
    user: r.user, status: r.status, photoUrl: r.photoUrl,
    photoAt: r.photoAt ? r.photoAt.toISOString() : null,
  }))
}

// Só para quem já aceitou. O estado leva os URLs das fotos, e quem foi chamado
// mas ainda não entrou não tem nada que os receber — para esse a chamada chega
// pelo evento `circle:called`.
async function broadcast(sessionId: string) {
  const [rows, members] = await Promise.all([
    prisma.circleSessionMember.findMany({ where: { sessionId, status: 'JOINED' }, select: { userId: true } }),
    membersOf(sessionId),
  ])
  rows.forEach((r) => emitToUser(r.userId, 'circle:update', { sessionId, members }))
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

  const [members, nearby] = await Promise.all([
    membersOf(session.id),
    nearbyMutuals(userId, lat, lng),
  ])
  const memberIds = new Set(members.map((m) => m.user.id))
  return {
    session,
    members,
    nearby: nearby.filter((u) => !memberIds.has(u.id)),
    publishWindowMs: PUBLISH_WINDOW_MS,
  }
}

// Fecha as sessões antigas deste anfitrião. As fotos são apagadas do
// armazenamento pelo cron (limparCirculos), não aqui — fechar tem de ser rápido.
async function closeStaleSessionsOf(hostId: string) {
  await prisma.circleSession.updateMany({
    where: { hostId, status: 'OPEN', createdAt: { lt: new Date(Date.now() - SESSION_MAX_AGE_MS) } },
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
  if (!me) throw new Error('Não estás nesta sessão')

  await expireInvites({ sessionId })
  return { session, members: await membersOf(sessionId), publishWindowMs: PUBLISH_WINDOW_MS }
}

// Anfitrião chama alguém próximo → convite (push + socket ao vivo)
export async function callUser(hostId: string, sessionId: string, targetId: string) {
  const session = await prisma.circleSession.findUnique({ where: { id: sessionId } })
  if (!session || session.hostId !== hostId) throw new Error('Sessão não encontrada')
  if (session.status !== 'OPEN') throw new Error('Sessão já fechou')

  // Um convite é uma notificação no telemóvel de outra pessoa. Sem esta
  // verificação, quem chamasse a API diretamente mandava pushes a estranhos —
  // e a quem o tivesse bloqueado.
  if (!(await canCall(hostId, targetId))) throw new Error('Só podes chamar pessoas que te seguem e que segues')

  const existing = await prisma.circleSessionMember.findUnique({
    where:  { sessionId_userId: { sessionId, userId: targetId } },
    select: { status: true, createdAt: true },
  })
  if (existing?.status === 'JOINED') throw new Error('Esta pessoa já está no círculo')

  // Insistir na mesma pessoa não vale um push novo. Sem isto, carregar em
  // "chamar" em ciclo mandava-lhe notificações sem fim — o limite abaixo não
  // apanhava, porque reconvidar reaproveita a mesma linha.
  if (existing && Date.now() - existing.createdAt.getTime() < CALL_COOLDOWN_MS) {
    return { ok: true, alreadyCalled: true }
  }

  // Quantas pessoas *diferentes* chamei na janela. Conta linhas, e reconvidar
  // reaproveita a linha, por isso o que isto limita é o alcance: espalhar
  // convites por muita gente de uma vez.
  const recentCalls = await prisma.circleSessionMember.count({
    where: {
      session:   { hostId },
      status:    'INVITED',
      createdAt: { gte: new Date(Date.now() - CALL_WINDOW_MS) },
    },
  })
  if (recentCalls >= CALL_LIMIT) throw new Error('Chamaste demasiadas pessoas em pouco tempo. Espera um pouco.')

  // (re)convite renova a janela de 2 min a partir de agora
  await prisma.circleSessionMember.upsert({
    where:  { sessionId_userId: { sessionId, userId: targetId } },
    update: { status: 'INVITED', createdAt: new Date() },
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

  // Entra-se por convite, nunca por conhecer o ID da sessão. Antes o upsert
  // criava a linha de raiz, o que deixava qualquer pessoa entrar num círculo
  // alheio e passar a receber as fotos de todos por socket.
  const existing = await prisma.circleSessionMember.findUnique({ where: { sessionId_userId: { sessionId, userId } } })
  if (!existing) throw new Error('Não foste convidado para este círculo')

  // Convite só é válido durante 2 min — depois disso expira
  if (existing.status === 'INVITED' && Date.now() - existing.createdAt.getTime() > INVITE_TTL_MS) {
    await prisma.circleSessionMember.delete({ where: { sessionId_userId: { sessionId, userId } } }).catch(() => {})
    throw new Error('O convite expirou')
  }

  await prisma.circleSessionMember.update({
    where: { sessionId_userId: { sessionId, userId } },
    data:  { status: 'JOINED' },
  })
  await broadcast(sessionId)
  return getSessionState(sessionId, userId)
}

// Sair de uma sessão (desfazer o "aceitar"). O anfitrião não sai por aqui.
export async function leaveSession(userId: string, sessionId: string) {
  const session = await prisma.circleSession.findUnique({ where: { id: sessionId } })
  if (session && session.hostId === userId) return { ok: true }   // anfitrião não sai da própria
  await prisma.circleSessionMember.delete({
    where: { sessionId_userId: { sessionId, userId } },
  }).catch(() => {})
  await broadcast(sessionId)
  return { ok: true }
}

// O anfitrião remove um membro (para voltar a ficar sozinho, por ex.)
export async function removeMember(hostId: string, sessionId: string, targetId: string) {
  const session = await prisma.circleSession.findUnique({ where: { id: sessionId } })
  if (!session || session.hostId !== hostId) throw new Error('Sessão não encontrada')
  if (targetId === hostId) return { ok: true }   // não se remove a si próprio
  await prisma.circleSessionMember.delete({
    where: { sessionId_userId: { sessionId, userId: targetId } },
  }).catch(() => {})
  emitToUser(targetId, 'circle:removed', { sessionId })   // avisa o removido
  await broadcast(sessionId)
  return { ok: true }
}

type Overlay = { emoji: string; x: number; y: number }

// Membro guarda a sua foto (com emojis) na sessão
export async function addPhoto(userId: string, sessionId: string, photoUrl: string, overlays: Overlay[] = []) {
  const member = await prisma.circleSessionMember.findUnique({ where: { sessionId_userId: { sessionId, userId } } })
  // Tem de já ter aceitado: antes, gravar uma foto promovia sozinho um
  // convidado a membro sem ele alguma vez ter carregado em aceitar.
  if (!member || member.status !== 'JOINED') throw new Error('Não estás nesta sessão')
  await prisma.circleSessionMember.update({
    where: { sessionId_userId: { sessionId, userId } },
    data:  { photoUrl, photoAt: new Date(), overlays: overlays.length > 0 ? overlays : undefined },
  })
  await broadcast(sessionId)
  return { ok: true }
}

// Retirar a minha foto do círculo. Qualquer membro pode publicar o álbum com as
// fotos de todos, por isso tem de haver forma de dizer não sem sair da sessão.
export async function withdrawPhoto(userId: string, sessionId: string) {
  const member = await prisma.circleSessionMember.findUnique({ where: { sessionId_userId: { sessionId, userId } } })
  if (!member) throw new Error('Não estás nesta sessão')
  await prisma.circleSessionMember.update({
    where: { sessionId_userId: { sessionId, userId } },
    data:  { photoUrl: null, photoAt: null, overlays: undefined },
  })
  await broadcast(sessionId)
  return { ok: true }
}

// Qualquer membro publica o álbum no SEU feed (fotos de todos, com os emojis de cada um).
// A sessão fica aberta — cada pessoa pode publicar no seu próprio feed.
// ─── Disparo sincronizado ─────────────────────────────────────────────────────
// Todos no círculo disparam no mesmo instante. Quem carrega no botão só pede a
// contagem; é o servidor que decide o momento, senão cada telemóvel dispararia
// pelo seu próprio relógio e as fotos nunca coincidiriam.
const COUNTDOWN_MS = 3000

export async function startCountdown(userId: string, sessionId: string) {
  const session = await prisma.circleSession.findUnique({ where: { id: sessionId } })
  if (!session) throw new Error('Sessão não encontrada')
  if (session.status !== 'OPEN') throw new Error('Sessão já fechou')

  const me = await prisma.circleSessionMember.findUnique({
    where: { sessionId_userId: { sessionId, userId } },
  })
  if (!me || me.status !== 'JOINED') throw new Error('Não estás nesta sessão')

  const now = Date.now()
  // Já há uma contagem a decorrer: devolvemos a mesma em vez de abrir outra,
  // senão dois dedos rápidos dessincronizavam o círculo todo.
  if (session.shotAt && session.shotAt.getTime() > now) {
    return { shotAt: session.shotAt.toISOString(), inMs: session.shotAt.getTime() - now }
  }

  const shotAt = new Date(now + COUNTDOWN_MS)
  await prisma.circleSession.update({ where: { id: sessionId }, data: { shotAt } })

  const rows = await prisma.circleSessionMember.findMany({
    where:  { sessionId, status: 'JOINED' },
    select: { userId: true },
  })
  // Mandamos a duração, não só o instante: os relógios dos telemóveis estão
  // dessincronizados entre si e com o servidor, mas a duração é sempre fiável.
  rows.forEach((r) => emitToUser(r.userId, 'circle:countdown', {
    sessionId, inMs: COUNTDOWN_MS, startedBy: userId,
  }))

  return { shotAt: shotAt.toISOString(), inMs: COUNTDOWN_MS }
}

// Janela para publicar depois de tirar a foto. Passado isto o momento passou —
// o botão desaparece no cliente e a ação deixa de ser aceite aqui.
// Mantém em sincronia com PUBLISH_WINDOW_MS em mobile/src/screens/CircleScreen.
const PUBLISH_WINDOW_MS = 60 * 1000

export async function publishSession(userId: string, sessionId: string, caption?: string) {
  const me = await prisma.circleSessionMember.findUnique({ where: { sessionId_userId: { sessionId, userId } } })
  if (!me || me.status !== 'JOINED') throw new Error('Não estás nesta sessão')
  if (!me.photoAt || Date.now() - me.photoAt.getTime() > PUBLISH_WINDOW_MS) {
    throw new Error('A janela para publicar esta foto já passou')
  }

  // Só entram as fotos da ronda atual. A janela aplicava-se só à minha foto, o
  // que deixava sair no álbum uma foto que outra pessoa tirou semanas antes —
  // e que ela já não esperava ver publicada.
  const roundStart = new Date(Date.now() - PUBLISH_WINDOW_MS)
  const withPhotos = await prisma.circleSessionMember.findMany({
    where:   { sessionId, status: 'JOINED', photoUrl: { not: null }, photoAt: { gte: roundStart } },
    orderBy: { createdAt: 'asc' },
  })
  const urls     = withPhotos.map((m) => m.photoUrl!).filter(Boolean)
  const overlays = withPhotos.map((m) => (Array.isArray(m.overlays) ? (m.overlays as Overlay[]) : []))
  if (urls.length < 1) throw new Error('Ainda não há fotos para publicar')

  const post = await createAlbumPost(userId, urls, caption, undefined, overlays)
  emitToUser(userId, 'circle:published', { sessionId, postId: post.id })
  return post
}

// Chamado pelo cron. Fecha as sessões que passaram da idade e devolve os URLs
// das fotos que ficaram por publicar, para quem chama as apagar do
// armazenamento. Sem isto, cada círculo deixava fotos no Cloudinary para sempre.
export async function closeStaleSessions(): Promise<string[]> {
  const cutoff = new Date(Date.now() - SESSION_MAX_AGE_MS)
  const stale = await prisma.circleSession.findMany({
    where:  { status: 'OPEN', createdAt: { lt: cutoff } },
    select: { id: true },
  })
  if (stale.length === 0) return []

  const ids = stale.map((s) => s.id)
  const photos = await prisma.circleSessionMember.findMany({
    where:  { sessionId: { in: ids }, photoUrl: { not: null } },
    select: { photoUrl: true },
  })

  await prisma.$transaction([
    prisma.circleSessionMember.updateMany({
      where: { sessionId: { in: ids } },
      data:  { photoUrl: null, photoAt: null },
    }),
    prisma.circleSession.updateMany({
      where: { id: { in: ids } },
      data:  { status: 'CLOSED' },
    }),
  ])

  return photos.map((p) => p.photoUrl!).filter(Boolean)
}

// Uma chamada pendente para mim (para quem abre o Círculo após ser chamado)
export async function incomingCall(userId: string) {
  await expireInvites({ userId })
  const cutoff = new Date(Date.now() - INVITE_TTL_MS)
  const m = await prisma.circleSessionMember.findFirst({
    where:   { userId, status: 'INVITED', createdAt: { gte: cutoff }, session: { status: 'OPEN' } },
    orderBy: { createdAt: 'desc' },
    include: { session: { include: { host: { select: { id: true, name: true, avatar: true } } } } },
  })
  if (!m) return { call: null }
  return { call: { sessionId: m.sessionId, host: m.session.host } }
}
