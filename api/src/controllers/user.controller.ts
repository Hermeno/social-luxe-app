import { Response } from 'express'
import * as userService from '../services/user.service'
import { ok, badRequest, serverError, notFound, forbidden, created } from '../utils/response'
import { handleError } from '../utils/errors'
import { AuthRequest } from '../types'
import { prisma } from '../config/database'
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
      contact, defaultFollowDuration, relationshipStatus,
      partnerName, partnerId, city, district, autoReply,
    } = req.body
    let avatar: string | undefined
    if (req.file) {
      avatar = await uploadToCloudinary(req.file.buffer, req.file.mimetype, 'luxe/avatars')
    }
    const location = lat != null && lng != null ? { lat: parseFloat(lat), lng: parseFloat(lng) } : {}
    const extra = viewsPublic != null ? { viewsPublic: viewsPublic === true || viewsPublic === 'true' } : {}
    const user = await userService.updateProfile(req.user!.userId, {
      name, bio, avatar, availability,
      ...location, ...extra,
      contact, defaultFollowDuration, relationshipStatus,
      partnerName, partnerId, city, district, autoReply,
    })
    return ok(res, user)
  } catch (err) { return handleError(res, err) }
}

export async function getUserPosts(req: AuthRequest, res: Response) {
  try {
    const posts = await userService.getUserPosts(req.params.id)
    return ok(res, posts)
  } catch (err) { return handleError(res, err) }
}

export async function getConnections(req: AuthRequest, res: Response) {
  try {
    const userId = req.user!.userId

    // Union of people I follow + people who follow me
    const follows = await prisma.follow.findMany({
      where: { OR: [{ followerId: userId }, { followingId: userId }] },
      select: {
        follower:   { select: { id: true, name: true, avatar: true } },
        following:  { select: { id: true, name: true, avatar: true } },
        followerId:  true,
        followingId: true,
      },
    })

    const map = new Map<string, { id: string; name: string; avatar: string | null }>()
    follows.forEach((f) => {
      if (f.followerId  !== userId) map.set(f.followerId,  f.follower)
      if (f.followingId !== userId) map.set(f.followingId, f.following)
    })

    const now = new Date()

    // Fetch per-connection data in parallel
    const connections = await Promise.all(
      Array.from(map.values()).map(async (other) => {
        const [lastMessage, unreadCount, activePosts] = await Promise.all([
          prisma.message.findFirst({
            where: {
              OR: [
                { senderId: userId, receiverId: other.id },
                { senderId: other.id, receiverId: userId },
              ],
            },
            orderBy: { createdAt: 'desc' },
            select: { id: true, content: true, senderId: true, readAt: true, createdAt: true },
          }),
          prisma.message.count({
            where: { senderId: other.id, receiverId: userId, readAt: null },
          }),
          prisma.post.findMany({
            where: { userId: other.id, expiresAt: { gt: now } },
            select: { id: true },
            orderBy: { createdAt: 'desc' },
          }),
        ])
        return {
          user: other,
          lastMessage: lastMessage ?? null,
          unreadCount,
          postIds: activePosts.map((p) => p.id),
        }
      })
    )

    // Sort: recent messages first, then alphabetically
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
  } catch (err) { return handleError(res, err) }
}
