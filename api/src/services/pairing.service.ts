import { prisma } from '../config/database'

const PAIRING_SELECT = {
  id:          true,
  type:        true,
  customLabel: true,
  status:      true,
  requestedBy: true,
  createdAt:   true,
  respondedAt: true,
  endedAt:     true,
  userA: { select: { id: true, name: true, avatar: true } },
  userB: { select: { id: true, name: true, avatar: true } },
} as const

function canonicalPair(userId: string, targetId: string): [string, string] {
  return userId < targetId ? [userId, targetId] : [targetId, userId]
}

export function isParticipant(pairing: { userAId: string; userBId: string }, userId: string) {
  return pairing.userAId === userId || pairing.userBId === userId
}

// Active or still-pending pairing involving this user — at most one at a time.
export async function getActiveOrPendingFor(userId: string) {
  return prisma.pairing.findFirst({
    where: {
      status: { in: ['ACTIVE', 'PENDING'] },
      OR: [{ userAId: userId }, { userBId: userId }],
    },
    select: PAIRING_SELECT,
  })
}

export async function getMyPairing(userId: string) {
  return getActiveOrPendingFor(userId)
}

// Public — used for profile badges / feed tags. Pending invites stay private.
export async function getActivePairingForProfile(userId: string) {
  return prisma.pairing.findFirst({
    where: { status: 'ACTIVE', OR: [{ userAId: userId }, { userBId: userId }] },
    select: PAIRING_SELECT,
  })
}

export async function invitePairing(
  userId: string,
  targetUserId: string,
  type: string,
  customLabel?: string,
) {
  if (userId === targetUserId) throw new Error('Não podes formar par contigo mesmo')

  const [mineExisting, theirsExisting] = await Promise.all([
    getActiveOrPendingFor(userId),
    getActiveOrPendingFor(targetUserId),
  ])
  if (mineExisting) throw new Error('Já tens um par ativo ou pendente')
  if (theirsExisting) throw new Error('Este utilizador já tem um par ativo ou pendente')

  const [userAId, userBId] = canonicalPair(userId, targetUserId)

  // Upsert: a pair that broke up before leaves an ENDED row behind (unique on
  // userAId+userBId) — reinviting the same person resets that row instead of
  // colliding with the constraint.
  return prisma.pairing.upsert({
    where: { userAId_userBId: { userAId, userBId } },
    create: {
      userAId, userBId,
      type: type as any, customLabel,
      requestedBy: userId,
      status: 'PENDING',
    },
    update: {
      type: type as any, customLabel,
      requestedBy: userId,
      status: 'PENDING',
      createdAt: new Date(),
      respondedAt: null,
      endedAt: null,
    },
    select: PAIRING_SELECT,
  })
}

export async function respondPairing(pairingId: string, userId: string, accept: boolean) {
  const pairing = await prisma.pairing.findUnique({ where: { id: pairingId } })
  if (!pairing) throw new Error('Convite não encontrado')
  if (!isParticipant(pairing, userId)) throw new Error('Não és participante deste convite')
  if (pairing.requestedBy === userId) throw new Error('Não podes responder ao teu próprio convite')
  if (pairing.status !== 'PENDING') throw new Error('Convite já foi respondido')

  return prisma.pairing.update({
    where: { id: pairingId },
    data: accept
      ? { status: 'ACTIVE', respondedAt: new Date() }
      : { status: 'ENDED', respondedAt: new Date(), endedAt: new Date() },
    select: PAIRING_SELECT,
  })
}

export async function endPairing(pairingId: string, userId: string) {
  const pairing = await prisma.pairing.findUnique({ where: { id: pairingId } })
  if (!pairing) throw new Error('Par não encontrado')
  if (!isParticipant(pairing, userId)) throw new Error('Não és participante deste par')
  if (pairing.status === 'ENDED') throw new Error('Este par já terminou')

  return prisma.pairing.update({
    where: { id: pairingId },
    data: { status: 'ENDED', endedAt: new Date() },
    select: PAIRING_SELECT,
  })
}
