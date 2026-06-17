import { prisma } from '../config/database'
import { withThumbnails } from '../utils/cloudinary.util'

const USER_SELECT = {
  id: true, name: true, avatar: true, bio: true, availability: true,
  _count: { select: { followers: true, posts: true } },
} as const

export async function getAllUsers(currentUserId: string) {
  return prisma.user.findMany({
    where: { id: { not: currentUserId } },
    select: USER_SELECT,
    orderBy: { name: 'asc' },
    take: 100,
  })
}

export async function searchUsers(query: string, currentUserId: string) {
  return prisma.user.findMany({
    where: {
      AND: [
        { id: { not: currentUserId } },
        { OR: [{ name: { contains: query, mode: 'insensitive' } }, { phone: { contains: query } }] },
      ],
    },
    select: USER_SELECT,
    take: 20,
  })
}

export async function updateProfile(userId: string, data: {
  name?: string
  bio?: string
  avatar?: string
  availability?: string
  lat?: number
  lng?: number
  viewsPublic?: boolean
  contact?: string
  defaultFollowDuration?: string
  relationshipStatus?: string
  partnerName?: string
  partnerId?: string
  city?: string
  district?: string
  autoReply?: string
  showDevice?: boolean
  statusLabel?: string | null
}) {
  return prisma.user.update({
    where: { id: userId },
    data,
    select: {
      id: true, name: true, phone: true, countryCode: true,
      avatar: true, bio: true, availability: true, viewsPublic: true,
      contact: true, defaultFollowDuration: true, relationshipStatus: true,
      partnerName: true, partnerId: true, city: true, district: true,
      autoReply: true, showDevice: true, statusLabel: true, createdAt: true,
    },
  })
}

export async function getUserById(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true, name: true, avatar: true, bio: true, availability: true, createdAt: true,
      _count: { select: { friendshipsA: true, friendshipsB: true, posts: true } },
    },
  })
  if (!user) throw new Error('User not found')
  return user
}

export async function getUserPosts(userId: string) {
  const posts = await prisma.post.findMany({
    where: { userId, deletedAt: null, expiresAt: { gt: new Date() } },
    include: {
      user: { select: { id: true, name: true, avatar: true, viewsPublic: true, isAdmin: true, showDevice: true, statusLabel: true } },
      _count: { select: { likes: true, comments: true, views: true, shares: true } },
    },
    orderBy: { createdAt: 'desc' },
  })
  return withThumbnails(posts)
}

export async function toggleGhostMode(userId: string, ghostMode: boolean) {
  return prisma.user.update({
    where: { id: userId },
    data: { ghostMode },
    select: { id: true, ghostMode: true },
  })
}
