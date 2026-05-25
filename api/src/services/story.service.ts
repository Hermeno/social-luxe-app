import { prisma } from '../config/database'
import { MediaType } from '@prisma/client'

const STORY_EXPIRY_HOURS = 12

export async function createStory(userId: string, mediaUrl: string, mediaType: MediaType) {
  const expiresAt = new Date(Date.now() + STORY_EXPIRY_HOURS * 60 * 60 * 1000)
  return prisma.story.create({
    data: { userId, mediaUrl, mediaType, expiresAt },
    include: { user: { select: { id: true, name: true, avatar: true } } },
  })
}

export async function getFriendsStories(userId: string) {
  // Get all friend IDs
  const friendships = await prisma.friendship.findMany({
    where: {
      OR: [{ userAId: userId }, { userBId: userId }],
    },
    select: { userAId: true, userBId: true },
  })

  const friendIds = friendships.map((f) => (f.userAId === userId ? f.userBId : f.userAId))

  // Get active stories from friends
  const stories = await prisma.story.findMany({
    where: {
      userId: { in: friendIds },
      expiresAt: { gt: new Date() },
    },
    include: {
      user: { select: { id: true, name: true, avatar: true } },
      views: { select: { viewerId: true } },
      _count: { select: { views: true } },
    },
    orderBy: { createdAt: 'asc' },
  })

  // Group by user
  const grouped: Record<
    string,
    {
      user: { id: string; name: string; avatar: string | null }
      stories: typeof stories
    }
  > = {}

  for (const story of stories) {
    if (!grouped[story.userId]) {
      grouped[story.userId] = { user: story.user, stories: [] }
    }
    grouped[story.userId].stories.push(story)
  }

  return Object.values(grouped).map((group) => ({
    user: group.user,
    stories: group.stories.map((s) => ({
      id: s.id,
      mediaUrl: s.mediaUrl,
      mediaType: s.mediaType,
      expiresAt: s.expiresAt,
      createdAt: s.createdAt,
      viewCount: s._count.views,
      viewedByMe: s.views.some((v) => v.viewerId === userId),
    })),
  }))
}

export async function deleteStory(userId: string, storyId: string) {
  const story = await prisma.story.findUnique({ where: { id: storyId } })
  if (!story || story.userId !== userId) throw new Error('Story not found')
  return prisma.story.delete({ where: { id: storyId } })
}

export async function viewStory(storyId: string, viewerId: string) {
  return prisma.storyView.upsert({
    where: { storyId_viewerId: { storyId, viewerId } },
    update: {},
    create: { storyId, viewerId },
  })
}
