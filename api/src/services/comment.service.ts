import { prisma } from '../config/database'
import { interact as travelInteract } from './travel.service'

async function extendPostLife(postId: string, minutes: number) {
  const post = await prisma.post.findUnique({ where: { id: postId }, select: { expiresAt: true, isAnnouncement: true } })
  if (!post || post.isAnnouncement) return
  const base = Math.max(post.expiresAt.getTime(), Date.now())
  await prisma.post.update({ where: { id: postId }, data: { expiresAt: new Date(base + minutes * 60_000) } })
}

export async function getComments(postId: string) {
  return prisma.comment.findMany({
    where: { postId, parentId: null },
    include: {
      user: { select: { id: true, name: true, avatar: true } },
      replies: {
        include: { user: { select: { id: true, name: true, avatar: true } } },
        orderBy: { createdAt: 'asc' },
      },
    },
    orderBy: { createdAt: 'desc' },
  })
}

export async function addComment(userId: string, postId: string, content: string, parentId?: string) {
  const comment = await prisma.comment.create({
    data: { userId, postId, content, parentId },
    include: { user: { select: { id: true, name: true, avatar: true } } },
  })
  extendPostLife(postId, 30).catch(() => {})
  travelInteract(postId, userId, 'comment').catch(() => {})  // fire-and-forget
  return comment
}

export async function deleteComment(userId: string, commentId: string) {
  const comment = await prisma.comment.findUnique({ where: { id: commentId } })
  if (!comment || comment.userId !== userId) throw new Error('Comment not found')
  return prisma.comment.delete({ where: { id: commentId } })
}
