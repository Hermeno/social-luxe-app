import { Response } from 'express'
import * as userService from '../services/user.service'
import { ok, badRequest, serverError } from '../utils/response'
import { AuthRequest } from '../types'
import { prisma } from '../config/database'

export async function getAllUsers(req: AuthRequest, res: Response) {
  try {
    const users = await userService.getAllUsers(req.user!.userId)
    return ok(res, users)
  } catch { return serverError(res) }
}

export async function searchUsers(req: AuthRequest, res: Response) {
  try {
    const query = String(req.query.q ?? '')
    if (!query) return badRequest(res, 'Query required')
    const users = await userService.searchUsers(query, req.user!.userId)
    return ok(res, users)
  } catch {
    return serverError(res)
  }
}

export async function getUserById(req: AuthRequest, res: Response) {
  try {
    const user = await userService.getUserById(req.params.id)
    return ok(res, user)
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed'
    return badRequest(res, msg)
  }
}

export async function updateProfile(req: AuthRequest, res: Response) {
  try {
    const { name, bio, availability } = req.body
    const avatar = req.file ? `/uploads/${req.file.filename}` : undefined
    const user = await userService.updateProfile(req.user!.userId, { name, bio, avatar, availability })
    return ok(res, user)
  } catch {
    return serverError(res)
  }
}

export async function getUserPosts(req: AuthRequest, res: Response) {
  try {
    const posts = await userService.getUserPosts(req.params.id)
    return ok(res, posts)
  } catch {
    return serverError(res)
  }
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
  } catch { return serverError(res) }
}

export async function toggleGhostMode(req: AuthRequest, res: Response) {
  try {
    const { ghostMode } = req.body
    if (typeof ghostMode !== 'boolean') return badRequest(res, 'ghostMode must be a boolean')
    const user = await userService.toggleGhostMode(req.user!.userId, ghostMode)
    return ok(res, user)
  } catch {
    return serverError(res)
  }
}
