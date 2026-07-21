import { prisma } from '../config/database'
import { recalcPostLife } from './post.service'

async function extendPostLife(postId: string, minutes: number) {
  const post = await prisma.post.findUnique({ where: { id: postId }, select: { expiresAt: true, isAnnouncement: true } })
  if (!post || post.isAnnouncement) return
  const base = Math.max(post.expiresAt.getTime(), Date.now())
  await prisma.post.update({ where: { id: postId }, data: { expiresAt: new Date(base + minutes * 60_000) } })
}

const USER_SEL = { select: { id: true, name: true, avatar: true } }

// Aplana o comentário para o cliente: conta de gostos + se o próprio já gostou.
// O cliente nunca recebe a lista de likes — só o que precisa de desenhar.
function shape(c: any, viewerId: string): any {
  const likes: { userId: string }[] = c.likes ?? []
  return {
    ...c,
    likes: undefined,
    likeCount: likes.length,
    likedByMe: likes.some((l) => l.userId === viewerId),
    replies: Array.isArray(c.replies) ? c.replies.map((r: any) => shape(r, viewerId)) : undefined,
  }
}

export async function getComments(postId: string, viewerId: string) {
  const rows = await prisma.comment.findMany({
    where: { postId, parentId: null, deletedAt: null },
    include: {
      user:    USER_SEL,
      likes:   { select: { userId: true } },
      replies: {
        where:   { deletedAt: null },
        include: { user: USER_SEL, likes: { select: { userId: true } } },
        orderBy: { createdAt: 'asc' },
      },
    },
    orderBy: { createdAt: 'desc' },
  })
  return rows.map((c) => shape(c, viewerId))
}

export async function editComment(userId: string, commentId: string, content: string) {
  const comment = await prisma.comment.findUnique({ where: { id: commentId }, select: { userId: true, deletedAt: true } })
  if (!comment || comment.deletedAt) throw new Error('Comment not found')
  if (comment.userId !== userId) throw new Error('Not authorized')
  const updated = await prisma.comment.update({
    where: { id: commentId },
    data:  { content, editedAt: new Date() },
    include: { user: USER_SEL, likes: { select: { userId: true } } },
  })
  return shape(updated, userId)
}

// Alternar gosto. O @@unique([userId, commentId]) impede duplicados mesmo que
// dois toques rápidos cheguem ao mesmo tempo.
export async function toggleCommentLike(userId: string, commentId: string) {
  const comment = await prisma.comment.findUnique({ where: { id: commentId }, select: { id: true, postId: true, deletedAt: true } })
  if (!comment || comment.deletedAt) throw new Error('Comment not found')

  const existing = await prisma.commentLike.findUnique({
    where: { userId_commentId: { userId, commentId } },
  })
  if (existing) {
    await prisma.commentLike.delete({ where: { id: existing.id } })
  } else {
    await prisma.commentLike.create({ data: { userId, commentId } }).catch(() => {})
    recalcPostLife(comment.postId).catch(() => {})
  }
  const likeCount = await prisma.commentLike.count({ where: { commentId } })
  return { liked: !existing, likeCount }
}

export async function addComment(userId: string, postId: string, content: string, parentId?: string) {
  const comment = await prisma.comment.create({
    data: { userId, postId, content, parentId },
    include: { user: { select: { id: true, name: true, avatar: true } } },
  })
  extendPostLife(postId, 30).catch(() => {})
  recalcPostLife(postId).catch(() => {})
  return comment
}

// Apagar é leve: um comentário com respostas não pode levar a conversa atrás de
// si (o onDelete: Cascade das Replies apagaria os filhos). Fica invisível nas
// listagens por causa do filtro deletedAt.
export async function deleteComment(userId: string, commentId: string) {
  const comment = await prisma.comment.findUnique({
    where:  { id: commentId },
    select: { userId: true, postId: true, deletedAt: true, post: { select: { userId: true } } },
  })
  if (!comment || comment.deletedAt) throw new Error('Comment not found')
  // O autor do comentário ou o dono do post podem apagar
  if (comment.userId !== userId && comment.post.userId !== userId) throw new Error('Not authorized')
  await prisma.comment.update({ where: { id: commentId }, data: { deletedAt: new Date() } })
  return { ok: true }
}
