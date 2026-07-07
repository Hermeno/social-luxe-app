import { Response } from 'express'
import { prisma } from '../config/database'
import { AuthRequest as Request } from '../types'
import { sendPush } from '../services/notification.service'
import { ok, badRequest } from '../utils/response'
import { handleError } from '../utils/errors'
import { emitToUser } from '../socket'

function calcExpiresAt(duration?: string): Date | null {
  const now = new Date()
  if (duration === '1d') { now.setDate(now.getDate() + 1); return now }
  if (duration === '1m') { now.setMonth(now.getMonth() + 1); return now }
  if (duration === '1y') { now.setFullYear(now.getFullYear() + 1); return now }
  return null
}

export async function followUser(req: Request, res: Response) {
  try {
    const followerId  = req.user!.userId
    const followingId = req.params.id

    if (followerId === followingId) return badRequest(res, 'Cannot follow yourself')

    const existing = await prisma.follow.findUnique({
      where: { followerId_followingId: { followerId, followingId } },
    })

    if (existing) {
      await prisma.follow.delete({ where: { id: existing.id } })
      return ok(res, { following: false })
    }

    const expiresAt = calcExpiresAt(req.body?.duration)
    await prisma.follow.create({ data: { followerId, followingId, expiresAt } })

    const follower = await prisma.user.findUnique({
      where: { id: followerId }, select: { id: true, name: true, avatar: true },
    })
    const message = `${follower?.name} começou a seguir-te. Segue de volta?`
    sendPush(followingId, '👤 Novo seguidor', message, { type: 'follow', userId: followerId }).catch(() => {})
    emitToUser(followingId, 'notification:new', {
      id: `follow_${followerId}_${Date.now()}`,
      type: 'follow',
      message,
      read: false,
      createdAt: new Date().toISOString(),
      fromUser: follower,
    })

    return ok(res, { following: true })
  } catch (err) {
    return handleError(res, err, 'followUser')
  }
}

export async function getFollowStatus(req: Request, res: Response) {
  try {
    const viewerId  = req.user!.userId
    const profileId = req.params.id
    const now = new Date()
    const [iFollow, theyFollow] = await Promise.all([
      prisma.follow.findUnique({ where: { followerId_followingId: { followerId: viewerId,  followingId: profileId } } }),
      prisma.follow.findUnique({ where: { followerId_followingId: { followerId: profileId, followingId: viewerId  } } }),
    ])
    const following = !!iFollow   && (iFollow.expiresAt   === null || iFollow.expiresAt   > now)
    const followsMe = !!theyFollow && (theyFollow.expiresAt === null || theyFollow.expiresAt > now)
    return ok(res, { following, followsMe })
  } catch (err) {
    return handleError(res, err, 'getFollowStatus')
  }
}

const activeFollow = { OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] }

export async function getMyFollowers(req: Request, res: Response) {
  try {
    const rows = await prisma.follow.findMany({
      where:   { followingId: req.user!.userId, ...activeFollow },
      orderBy: { createdAt: 'desc' },
      select:  { follower: { select: { id: true, name: true, avatar: true, bio: true } }, createdAt: true, expiresAt: true },
    })
    return ok(res, rows.map((r) => ({ ...r.follower, followedAt: r.createdAt, expiresAt: r.expiresAt })))
  } catch (err) {
    return handleError(res, err, 'getMyFollowers')
  }
}

export async function getMyFollowing(req: Request, res: Response) {
  try {
    const rows = await prisma.follow.findMany({
      where:   { followerId: req.user!.userId, ...activeFollow },
      orderBy: { createdAt: 'desc' },
      select:  { following: { select: { id: true, name: true, avatar: true, bio: true } }, createdAt: true, expiresAt: true },
    })
    return ok(res, rows.map((r) => ({ ...r.following, followedAt: r.createdAt, expiresAt: r.expiresAt })))
  } catch (err) {
    return handleError(res, err, 'getMyFollowing')
  }
}

export async function getUserFollowers(req: Request, res: Response) {
  try {
    const rows = await prisma.follow.findMany({
      where:   { followingId: req.params.id, ...activeFollow },
      orderBy: { createdAt: 'desc' },
      select:  { follower: { select: { id: true, name: true, avatar: true, bio: true } }, createdAt: true, expiresAt: true },
    })
    return ok(res, rows.map((r) => ({ ...r.follower, followedAt: r.createdAt, expiresAt: r.expiresAt })))
  } catch (err) {
    return handleError(res, err, 'getUserFollowers')
  }
}

export async function getUserFollowing(req: Request, res: Response) {
  try {
    const rows = await prisma.follow.findMany({
      where:   { followerId: req.params.id, ...activeFollow },
      orderBy: { createdAt: 'desc' },
      select:  { following: { select: { id: true, name: true, avatar: true, bio: true } }, createdAt: true, expiresAt: true },
    })
    return ok(res, rows.map((r) => ({ ...r.following, followedAt: r.createdAt, expiresAt: r.expiresAt })))
  } catch (err) {
    return handleError(res, err, 'getUserFollowing')
  }
}
