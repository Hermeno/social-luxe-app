import { Request, Response } from 'express'
import { prisma } from '../config/database'

export async function followUser(req: Request, res: Response) {
  const followerId  = req.user!.userId
  const followingId = req.params.id

  if (followerId === followingId) return res.status(400).json({ message: 'Cannot follow yourself' })

  const existing = await prisma.follow.findUnique({
    where: { followerId_followingId: { followerId, followingId } },
  })

  if (existing) {
    await prisma.follow.delete({ where: { id: existing.id } })
    return res.json({ following: false })
  }

  await prisma.follow.create({ data: { followerId, followingId } })
  return res.json({ following: true })
}

export async function getFollowStatus(req: Request, res: Response) {
  const followerId  = req.user!.userId
  const followingId = req.params.id

  const existing = await prisma.follow.findUnique({
    where: { followerId_followingId: { followerId, followingId } },
  })

  return res.json({ following: !!existing })
}

export async function getMyFollowers(req: Request, res: Response) {
  const userId = req.user!.userId
  const rows = await prisma.follow.findMany({
    where: { followingId: userId },
    orderBy: { createdAt: 'desc' },
    select: {
      follower: { select: { id: true, name: true, avatar: true, bio: true } },
      createdAt: true,
    },
  })
  return res.json(rows.map((r) => ({ ...r.follower, followedAt: r.createdAt })))
}

export async function getMyFollowing(req: Request, res: Response) {
  const userId = req.user!.userId
  const rows = await prisma.follow.findMany({
    where: { followerId: userId },
    orderBy: { createdAt: 'desc' },
    select: {
      following: { select: { id: true, name: true, avatar: true, bio: true } },
      createdAt: true,
    },
  })
  return res.json(rows.map((r) => ({ ...r.following, followedAt: r.createdAt })))
}
