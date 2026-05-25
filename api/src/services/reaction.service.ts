import { prisma } from '../config/database'
import { ReactionType } from '@prisma/client'
import { sendPush } from './notification.service'

export async function reactToPost(
  userId: string,
  postId: string,
  type: ReactionType,
  anonymous: boolean,
) {
  const existing = await prisma.reaction.findUnique({
    where: { userId_postId: { userId, postId } },
  })

  const isNew = !existing

  const reaction = await prisma.reaction.upsert({
    where: { userId_postId: { userId, postId } },
    update: { type, anonymous },
    create: { userId, postId, type, anonymous },
  })

  // Send push notification to post owner if this is a new reaction and not anonymous
  if (isNew && !anonymous) {
    const post = await prisma.post.findUnique({
      where: { id: postId },
      select: { userId: true },
    })
    if (post && post.userId !== userId) {
      const reactor = await prisma.user.findUnique({
        where: { id: userId },
        select: { name: true },
      })
      await sendPush(
        post.userId,
        'New Reaction',
        `${reactor?.name ?? 'Someone'} reacted to your post`,
        { postId, type },
      )
    }
  }

  return reaction
}

export async function removeReaction(userId: string, postId: string) {
  const existing = await prisma.reaction.findUnique({
    where: { userId_postId: { userId, postId } },
  })
  if (!existing) throw new Error('Reaction not found')
  return prisma.reaction.delete({ where: { userId_postId: { userId, postId } } })
}

export async function getReactions(postId: string) {
  const reactions = await prisma.reaction.findMany({
    where: { postId },
    include: {
      user: { select: { id: true, name: true, avatar: true } },
    },
    orderBy: { createdAt: 'desc' },
  })

  // Group by type
  const grouped: Record<string, { type: ReactionType; count: number; users: unknown[] }> = {}

  for (const r of reactions) {
    if (!grouped[r.type]) {
      grouped[r.type] = { type: r.type, count: 0, users: [] }
    }
    grouped[r.type].count++
    if (!r.anonymous) {
      grouped[r.type].users.push(r.user)
    } else {
      grouped[r.type].users.push({ id: null, name: 'Anonymous', avatar: null })
    }
  }

  return {
    total: reactions.length,
    byType: Object.values(grouped),
  }
}
