import { prisma } from '../config/database'
import { MediaType } from '@prisma/client'

interface HighlightPostInput {
  mediaUrl: string
  mediaType: MediaType
  caption?: string
}

export async function createHighlight(
  userId: string,
  title: string,
  posts: HighlightPostInput[],
) {
  return prisma.highlight.create({
    data: {
      userId,
      title,
      coverUrl: posts[0]?.mediaUrl ?? null,
      posts: {
        create: posts.map((p) => ({
          mediaUrl: p.mediaUrl,
          mediaType: p.mediaType,
          caption: p.caption,
        })),
      },
    },
    include: { posts: true },
  })
}

export async function getUserHighlights(userId: string) {
  return prisma.highlight.findMany({
    where: { userId },
    include: { posts: { orderBy: { addedAt: 'asc' } } },
    orderBy: { createdAt: 'desc' },
  })
}

export async function deleteHighlight(userId: string, highlightId: string) {
  const highlight = await prisma.highlight.findUnique({ where: { id: highlightId } })
  if (!highlight || highlight.userId !== userId) throw new Error('Highlight not found')
  return prisma.highlight.delete({ where: { id: highlightId } })
}
