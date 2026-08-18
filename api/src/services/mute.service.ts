import { prisma } from '../config/database'

export type MuteDuration = 'ONE_MONTH' | 'FOREVER'

const MUTED_USER_SELECT = {
  id: true,
  name: true,
  username: true,
  avatar: true,
} as const

function oneCalendarMonthFrom(now: Date): Date {
  const result = new Date(now)
  const originalDay = result.getDate()

  // Moving from (for example) 31 January directly with setMonth would skip
  // February. Move via day one, then clamp to the last day of next month.
  result.setDate(1)
  result.setMonth(result.getMonth() + 1)
  const lastDay = new Date(
    result.getFullYear(),
    result.getMonth() + 1,
    0,
  ).getDate()
  result.setDate(Math.min(originalDay, lastDay))
  return result
}

function formatMute(mute: {
  id: string
  createdAt: Date
  expiresAt: Date | null
  muted: { id: string; name: string; username: string | null; avatar: string | null }
}) {
  return {
    ...mute.muted,
    muteId: mute.id,
    mutedAt: mute.createdAt,
    expiresAt: mute.expiresAt,
  }
}

export async function muteUser(
  muterId: string,
  mutedId: string,
  duration: MuteDuration,
) {
  if (muterId === mutedId) throw new Error('Cannot mute yourself')

  const target = await prisma.user.findUnique({
    where: { id: mutedId },
    select: { id: true },
  })
  if (!target) throw new Error('User not found')

  const now = new Date()
  const expiresAt = duration === 'ONE_MONTH' ? oneCalendarMonthFrom(now) : null
  const mute = await prisma.userMute.upsert({
    where: { muterId_mutedId: { muterId, mutedId } },
    create: { muterId, mutedId, expiresAt, createdAt: now },
    // Reapplying a mute starts its selected period again.
    update: { expiresAt, createdAt: now },
    include: { muted: { select: MUTED_USER_SELECT } },
  })

  return formatMute(mute)
}

export async function unmuteUser(muterId: string, mutedId: string) {
  // Idempotent for retries and fast repeated taps.
  return prisma.userMute.deleteMany({ where: { muterId, mutedId } })
}

export async function getMutedUsers(muterId: string) {
  const now = new Date()
  const mutes = await prisma.userMute.findMany({
    where: {
      muterId,
      OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
    },
    include: { muted: { select: MUTED_USER_SELECT } },
    orderBy: { createdAt: 'desc' },
  })

  return mutes.map(formatMute)
}

