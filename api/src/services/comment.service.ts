import { prisma } from '../config/database'

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
  return prisma.comment.create({
    data: { userId, postId, content, parentId },
    include: { user: { select: { id: true, name: true, avatar: true } } },
  })
}

export async function deleteComment(userId: string, commentId: string) {
  const comment = await prisma.comment.findUnique({ where: { id: commentId } })
  if (!comment || comment.userId !== userId) throw new Error('Comment not found')
  return prisma.comment.delete({ where: { id: commentId } })
}
