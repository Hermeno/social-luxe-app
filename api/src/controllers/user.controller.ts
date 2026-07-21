import { Response } from 'express'
import * as userService from '../services/user.service'
import { ok, badRequest, serverError, notFound, forbidden, created, unauthorized } from '../utils/response'
import { handleError, isSelfRecordNotFound } from '../utils/errors'
import { AuthRequest } from '../types'
import { prisma } from '../config/database'
import { Prisma } from '@prisma/client'
import { uploadToCloudinary } from '../utils/cloudinary.util'

export async function getAllUsers(req: AuthRequest, res: Response) {
  try {
    const users = await userService.getAllUsers(req.user!.userId)
    return ok(res, users)
  } catch (err) { return handleError(res, err) }
}

export async function searchUsers(req: AuthRequest, res: Response) {
  try {
    const query = String(req.query.q ?? '')
    if (!query) return badRequest(res, 'Query required')
    const users = await userService.searchUsers(query, req.user!.userId)
    return ok(res, users)
  } catch (err) { return handleError(res, err) }
}

export async function getUserById(req: AuthRequest, res: Response) {
  try {
    const user = await userService.getUserById(req.params.id)
    return ok(res, user)
  } catch (err) { return handleError(res, err) }
}

export async function updateProfile(req: AuthRequest, res: Response) {
  try {
    const {
      name, bio, availability, lat, lng, viewsPublic,
      contact, defaultFollowDuration,
      city, district, autoReply,
      showDevice: rawShowDevice, statusLabel,
    } = req.body
    let avatar: string | undefined
    if (req.file) {
      avatar = await uploadToCloudinary(req.file, 'luxe/avatars')
    }
    const location = lat != null && lng != null ? { lat: parseFloat(lat), lng: parseFloat(lng) } : {}
    const extra = viewsPublic != null ? { viewsPublic: viewsPublic === true || viewsPublic === 'true' } : {}
    const deviceExtra = rawShowDevice != null ? { showDevice: rawShowDevice === true || rawShowDevice === 'true' } : {}
    const user = await userService.updateProfile(req.user!.userId, {
      name, bio, avatar, availability,
      ...location, ...extra, ...deviceExtra,
      contact, defaultFollowDuration,
      city, district, autoReply,
      statusLabel: statusLabel !== undefined ? (statusLabel || null) : undefined,
    })
    return ok(res, user)
  } catch (err) {
    if (isSelfRecordNotFound(err)) return unauthorized(res, 'Sessão inválida. Inicia sessão novamente.')
    return handleError(res, err)
  }
}

export async function updateInterests(req: AuthRequest, res: Response) {
  try {
    const { interests } = req.body
    if (!Array.isArray(interests) || interests.some((i) => typeof i !== 'string')) {
      return badRequest(res, 'interests must be an array of strings')
    }
    const user = await userService.updateProfile(req.user!.userId, { interests })
    return ok(res, user)
  } catch (err) {
    if (isSelfRecordNotFound(err)) return unauthorized(res, 'Sessão inválida. Inicia sessão novamente.')
    return handleError(res, err)
  }
}

export async function getUserPosts(req: AuthRequest, res: Response) {
  try {
    const posts = await userService.getUserPosts(req.params.id)
    return ok(res, posts)
  } catch (err) { return handleError(res, err) }
}

export async function getMutualConnections(req: AuthRequest, res: Response) {
  try {
    const result = await userService.getMutualConnections(req.user!.userId, req.params.id)
    return ok(res, result)
  } catch (err) { return handleError(res, err) }
}

export async function getConnections(req: AuthRequest, res: Response) {
  try {
    const userId = req.user!.userId

    // 1. One query: union of followers + following
    const follows = await prisma.follow.findMany({
      where: { OR: [{ followerId: userId }, { followingId: userId }] },
      select: {
        follower:    { select: { id: true, name: true, avatar: true } },
        following:   { select: { id: true, name: true, avatar: true } },
        followerId:  true,
        followingId: true,
      },
    })

    const userMap = new Map<string, { id: string; name: string; avatar: string | null }>()
    follows.forEach((f) => {
      if (f.followerId  !== userId) userMap.set(f.followerId,  f.follower)
      if (f.followingId !== userId) userMap.set(f.followingId, f.following)
    })

    // 1b. Anyone with message history is a connection too — a conversation must
    // never vanish from the inbox just because there's no follow relationship
    const msgPartners = await prisma.$queryRaw<{ id: string; name: string; avatar: string | null }[]>`
      SELECT DISTINCT u.id, u.name, u.avatar
      FROM "Message" m
      JOIN "User" u
        ON u.id = CASE WHEN m."senderId" = ${userId} THEN m."receiverId" ELSE m."senderId" END
      WHERE m."senderId" = ${userId} OR m."receiverId" = ${userId}
    `
    for (const u of msgPartners) {
      if (u.id !== userId && !userMap.has(u.id)) userMap.set(u.id, u)
    }

    // Blocked users (either direction) never appear in the inbox
    const blocks = await prisma.block.findMany({
      where:  { OR: [{ blockerId: userId }, { blockedId: userId }] },
      select: { blockerId: true, blockedId: true },
    })
    for (const b of blocks) {
      userMap.delete(b.blockerId === userId ? b.blockedId : b.blockerId)
    }

    const connectionIds = Array.from(userMap.keys())
    if (connectionIds.length === 0) return ok(res, [])

    const now = new Date()

    // 2–4. Three aggregated queries (replaces 3N individual queries)
    type RawMsg = {
      id: string; content: string | null; senderId: string; receiverId: string
      readAt: Date | null; createdAt: Date; partner_id: string
    }

    const [rawLastMessages, unreadGroups, activePosts] = await Promise.all([
      // Last message per conversation. NOTE: DISTINCT ON is not usable here —
      // Prisma numbers each ${userId} as a separate parameter ($1, $5, …), so
      // Postgres treats the DISTINCT ON and ORDER BY expressions as different
      // and rejects the query (42P10). ROW_NUMBER has no such restriction.
      prisma.$queryRaw<RawMsg[]>`
        SELECT id, content, "senderId", "receiverId", "readAt", "createdAt", partner_id
        FROM (
          SELECT m.id, m.content, m."senderId", m."receiverId", m."readAt", m."createdAt",
                 CASE WHEN m."senderId" = ${userId} THEN m."receiverId" ELSE m."senderId" END AS partner_id,
                 ROW_NUMBER() OVER (
                   PARTITION BY CASE WHEN m."senderId" = ${userId} THEN m."receiverId" ELSE m."senderId" END
                   ORDER BY m."createdAt" DESC
                 ) AS rn
          FROM "Message" m
          WHERE m."senderId" = ${userId} OR m."receiverId" = ${userId}
        ) t
        WHERE rn = 1
      `,

      // Unread counts — one GROUP BY instead of N COUNT queries
      prisma.message.groupBy({
        by:    ['senderId'],
        where: { senderId: { in: connectionIds }, receiverId: userId, readAt: null },
        _count: { _all: true },
      }),

      // Active posts — one IN query instead of N findMany queries
      prisma.post.findMany({
        where:   { userId: { in: connectionIds }, expiresAt: { gt: now } },
        select:  { id: true, userId: true },
        orderBy: { createdAt: 'desc' },
      }),
    ])

    // Build lookup maps
    const lastMsgByPartner = new Map(rawLastMessages.map((m) => [m.partner_id, m]))
    const unreadByPartner  = new Map(unreadGroups.map((g) => [g.senderId, g._count._all]))
    const postsByUser      = new Map<string, string[]>()
    activePosts.forEach((p) => {
      if (!postsByUser.has(p.userId)) postsByUser.set(p.userId, [])
      postsByUser.get(p.userId)!.push(p.id)
    })

    // Assemble and sort
    const connections = connectionIds.map((otherId) => ({
      user:         userMap.get(otherId)!,
      lastMessage:  lastMsgByPartner.get(otherId) ?? null,
      unreadCount:  unreadByPartner.get(otherId)  ?? 0,
      postIds:      postsByUser.get(otherId)       ?? [],
    }))

    connections.sort((a, b) => {
      if (a.lastMessage && b.lastMessage)
        return new Date(b.lastMessage.createdAt).getTime() - new Date(a.lastMessage.createdAt).getTime()
      if (a.lastMessage) return -1
      if (b.lastMessage) return 1
      return a.user.name.localeCompare(b.user.name)
    })

    return ok(res, connections)
  } catch (err) { return handleError(res, err) }
}

export async function getSuggestedUsers(req: AuthRequest, res: Response) {
  try {
    const userId = req.user!.userId
    const alreadyFollowing = await prisma.follow.findMany({
      where: { followerId: userId },
      select: { followingId: true },
    })
    const excludeIds = [userId, ...alreadyFollowing.map((f) => f.followingId)]

    // Users with most followers that I don't follow yet, limit 20
    const users = await prisma.user.findMany({
      where: { id: { notIn: excludeIds } },
      select: {
        id: true, name: true, avatar: true, bio: true,
        _count: { select: { followers: true, posts: true } },
      },
      orderBy: { followers: { _count: 'desc' } },
      take: 20,
    })
    return ok(res, users)
  } catch (err) { return handleError(res, err) }
}

export async function toggleGhostMode(req: AuthRequest, res: Response) {
  try {
    const { ghostMode } = req.body
    if (typeof ghostMode !== 'boolean') return badRequest(res, 'ghostMode must be a boolean')
    const user = await userService.toggleGhostMode(req.user!.userId, ghostMode)
    return ok(res, user)
  } catch (err) {
    if (isSelfRecordNotFound(err)) return unauthorized(res, 'Sessão inválida. Inicia sessão novamente.')
    return handleError(res, err)
  }
}
