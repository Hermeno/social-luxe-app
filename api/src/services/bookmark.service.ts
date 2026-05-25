import { prisma } from '../config/database'

export async function toggleBookmark(userId: string, postId: string): Promise<{ bookmarked: boolean }> {
  const existing = await prisma.bookmark.findUnique({
    where: { userId_postId: { userId, postId } },
  })

  if (existing) {
    await prisma.bookmark.delete({ where: { userId_postId: { userId, postId } } })
    return { bookmarked: false }
  }

  await prisma.bookmark.create({ data: { userId, postId } })
  return { bookmarked: true }
}

export async function getBookmarks(userId: string) {
  const bookmarks = await prisma.bookmark.findMany({
    where: { userId },
    include: {
      post: {
        include: {
          user: { select: { id: true, name: true, avatar: true } },
          _count: { select: { likes: true, comments: true, shares: true, views: true, reactions: true } },
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  })

  return bookmarks.map((b) => ({
    bookmarkId: b.id,
    bookmarkedAt: b.createdAt,
    post: b.post,
  }))
}
