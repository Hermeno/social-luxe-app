import { prisma } from '../config/database'
import { UnionType } from '@prisma/client'

const UNION_SELECT = {
  id:        true,
  name:      true,
  avatar:    true,
  type:      true,
  bio:       true,
  createdAt: true,
  memberA: { select: { id: true, name: true, avatar: true } },
  memberB: { select: { id: true, name: true, avatar: true } },
} as const

const MSG_SELECT = {
  fromUnion: { select: { id: true, name: true, avatar: true, memberA: { select: { id: true, name: true, avatar: true } }, memberB: { select: { id: true, name: true, avatar: true } } } },
} as const

// ─── Helpers ──────────────────────────────────────────────────────────────────

export function isMember(union: { memberAId: string; memberBId: string }, userId: string) {
  return union.memberAId === userId || union.memberBId === userId
}

// ─── Union CRUD ───────────────────────────────────────────────────────────────

export async function createUnion(
  memberAId: string,
  memberBId: string,
  name: string,
  type: UnionType,
  bio?: string,
) {
  // Ensure canonical order so the unique constraint always matches
  const [a, b] = memberAId < memberBId ? [memberAId, memberBId] : [memberBId, memberAId]

  const existing = await prisma.union.findUnique({ where: { memberAId_memberBId: { memberAId: a, memberBId: b } } })
  if (existing) throw new Error('União já existe entre estes utilizadores')

  return prisma.union.create({
    data: { memberAId: a, memberBId: b, name, type, bio },
    select: UNION_SELECT,
  })
}

export async function getUnion(id: string) {
  return prisma.union.findUnique({ where: { id }, select: UNION_SELECT })
}

export async function getMyUnions(userId: string) {
  return prisma.union.findMany({
    where: { OR: [{ memberAId: userId }, { memberBId: userId }] },
    select: UNION_SELECT,
    orderBy: { createdAt: 'desc' },
  })
}

export async function updateUnion(
  id: string,
  userId: string,
  data: { name?: string; avatar?: string; bio?: string },
) {
  const union = await prisma.union.findUnique({ where: { id } })
  if (!union) throw new Error('União não encontrada')
  if (!isMember(union, userId)) throw new Error('Não és membro desta união')

  return prisma.union.update({ where: { id }, data, select: UNION_SELECT })
}

export async function dissolveUnion(id: string, userId: string) {
  const union = await prisma.union.findUnique({ where: { id } })
  if (!union) throw new Error('União não encontrada')
  if (!isMember(union, userId)) throw new Error('Não és membro desta união')

  await prisma.union.delete({ where: { id } })
}

// ─── Invites ──────────────────────────────────────────────────────────────────

export async function sendInvite(fromUnionId: string, toUserId: string, requesterId: string) {
  const union = await prisma.union.findUnique({ where: { id: fromUnionId } })
  if (!union) throw new Error('União não encontrada')
  if (!isMember(union, requesterId)) throw new Error('Não és membro desta união')

  // Check target user isn't already in a union with the requester
  const [a, b] = requesterId < toUserId ? [requesterId, toUserId] : [toUserId, requesterId]
  const already = await prisma.union.findUnique({ where: { memberAId_memberBId: { memberAId: a, memberBId: b } } })
  if (already) throw new Error('Já existe uma união com este utilizador')

  return prisma.unionInvite.upsert({
    where: { fromUnionId_toUserId: { fromUnionId, toUserId } },
    create: { fromUnionId, toUserId },
    update: { status: 'PENDING', updatedAt: new Date() },
    include: { fromUnion: { select: UNION_SELECT } },
  })
}

export async function getPendingInvites(userId: string) {
  return prisma.unionInvite.findMany({
    where: { toUserId: userId, status: 'PENDING' },
    include: { fromUnion: { select: UNION_SELECT } },
    orderBy: { createdAt: 'desc' },
  })
}

export async function respondToInvite(
  inviteId: string,
  userId: string,
  accept: boolean,
) {
  const invite = await prisma.unionInvite.findUnique({
    where: { id: inviteId },
    include: { fromUnion: true },
  })
  if (!invite) throw new Error('Convite não encontrado')
  if (invite.toUserId !== userId) throw new Error('Este convite não é para ti')
  if (invite.status !== 'PENDING') throw new Error('Convite já foi respondido')

  if (!accept) {
    await prisma.unionInvite.update({ where: { id: inviteId }, data: { status: 'REJECTED' } })
    return null
  }

  // Accept: mark invite + create a new union between the two unions' members
  await prisma.unionInvite.update({ where: { id: inviteId }, data: { status: 'ACCEPTED' } })

  // The invite is from fromUnion → the accepting user creates a new union pairing them
  const fromUnion = invite.fromUnion
  // toUserId is accepting — we need them to pick their own union or we create one ad-hoc
  // For now: the acceptor's userId IS one member; return the fromUnion so the chat can start
  return prisma.union.findUnique({ where: { id: fromUnion.id }, select: UNION_SELECT })
}

// ─── Messages between Unions ──────────────────────────────────────────────────

export async function getUnionConversations(userId: string) {
  const myUnions = await prisma.union.findMany({
    where: { OR: [{ memberAId: userId }, { memberBId: userId }] },
    select: { id: true },
  })
  const myUnionIds = myUnions.map((u) => u.id)

  const messages = await prisma.unionMessage.findMany({
    where: {
      OR: [
        { fromUnionId: { in: myUnionIds } },
        { toUnionId:   { in: myUnionIds } },
      ],
    },
    include: MSG_SELECT,
    orderBy: { createdAt: 'desc' },
  })

  // Deduplicate into conversation pairs
  const seen = new Set<string>()
  const conversations: typeof messages = []
  for (const msg of messages) {
    const key = [msg.fromUnionId, msg.toUnionId].sort().join('|')
    if (!seen.has(key)) {
      seen.add(key)
      conversations.push(msg)
    }
  }
  return conversations
}

export async function getUnionMessages(
  fromUnionId: string,
  toUnionId: string,
  before?: string,
  limit = 30,
) {
  return prisma.unionMessage.findMany({
    where: {
      OR: [
        { fromUnionId, toUnionId },
        { fromUnionId: toUnionId, toUnionId: fromUnionId },
      ],
      ...(before ? { createdAt: { lt: new Date(before) } } : {}),
    },
    include: MSG_SELECT,
    orderBy: { createdAt: 'desc' },
    take: limit,
  })
}

export async function sendUnionMessage(
  fromUnionId: string,
  toUnionId:   string,
  userId:      string,
  content?:    string,
  mediaUrl?:   string,
) {
  if (!content && !mediaUrl) throw new Error('Mensagem deve ter conteúdo')

  const fromUnion = await prisma.union.findUnique({ where: { id: fromUnionId } })
  if (!fromUnion) throw new Error('União de origem não encontrada')
  if (!isMember(fromUnion, userId)) throw new Error('Não és membro desta união')

  const toUnion = await prisma.union.findUnique({ where: { id: toUnionId } })
  if (!toUnion) throw new Error('União de destino não encontrada')

  return prisma.unionMessage.create({
    data: { fromUnionId, toUnionId, content, mediaUrl },
    include: MSG_SELECT,
  })
}

export async function markUnionMessagesRead(fromUnionId: string, toUnionId: string) {
  return prisma.unionMessage.updateMany({
    where: { fromUnionId, toUnionId, readAt: null },
    data:  { readAt: new Date() },
  })
}
