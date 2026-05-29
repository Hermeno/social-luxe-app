import { Response } from 'express'
import * as postService from '../services/post.service'
import * as commentService from '../services/comment.service'
import { ok, created, badRequest, serverError } from '../utils/response'
import { AuthRequest } from '../types'
import { MediaType } from '@prisma/client'
import { sendPush } from '../services/notification.service'
import { prisma } from '../config/database'
import { uploadToCloudinary } from '../utils/cloudinary.util'
import { emitToUser } from '../socket'

export async function createPost(req: AuthRequest, res: Response) {
  try {
    const file = req.file
    if (!file) return badRequest(res, 'Media file required')
    const mediaType = file.mimetype.startsWith('video') ? MediaType.VIDEO : MediaType.IMAGE
    const mediaUrl  = await uploadToCloudinary(file.buffer, file.mimetype, 'luxe/posts')
    const post      = await postService.createPost(req.user!.userId, mediaUrl, mediaType, req.body.caption)

    // ── Real-time push to all followers via WebSocket ─────────────────────────
    // Fire-and-forget: don't block the HTTP response
    ;(async () => {
      try {
        const followers = await prisma.follow.findMany({
          where:  { followingId: req.user!.userId },
          select: { followerId: true },
        })
        followers.forEach(({ followerId }) => {
          emitToUser(followerId, 'post:new', post)
        })
      } catch {}
    })()

    return created(res, post)
  } catch (err: unknown) {
    console.error('[createPost]', err)
    return serverError(res)
  }
}

export async function getFeed(req: AuthRequest, res: Response) {
  try {
    const page = Number(req.query.page ?? 1)
    const posts = await postService.getFeed(req.user!.userId, page)
    return ok(res, posts)
  } catch {
    return serverError(res)
  }
}

export async function likePost(req: AuthRequest, res: Response) {
  try {
    const result = await postService.likePost(req.user!.userId, req.params.id)

    // Notify post author on new like (not on unlike, not self)
    if (result.liked) {
      const post = await prisma.post.findUnique({
        where: { id: req.params.id },
        select: { userId: true, user: { select: { name: true } } },
      })
      if (post && post.userId !== req.user!.userId) {
        const liker = await prisma.user.findUnique({ where: { id: req.user!.userId }, select: { name: true } })
        sendPush(post.userId, '❤️ Novo like', `${liker?.name} curtiu o teu post`, { type: 'like', postId: req.params.id }).catch(() => {})
      }
    }

    return ok(res, result)
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed'
    return badRequest(res, msg)
  }
}

export async function addView(req: AuthRequest, res: Response) {
  try {
    await postService.addView(req.user!.userId, req.params.id)
    return ok(res, null)
  } catch {
    return serverError(res)
  }
}

export async function getComments(req: AuthRequest, res: Response) {
  try {
    const comments = await commentService.getComments(req.params.id)
    return ok(res, comments)
  } catch {
    return serverError(res)
  }
}

export async function addComment(req: AuthRequest, res: Response) {
  try {
    const { content, parentId } = req.body
    if (!content) return badRequest(res, 'Content required')
    const comment = await commentService.addComment(req.user!.userId, req.params.id, content, parentId)

    // Notify post author
    const post = await prisma.post.findUnique({
      where: { id: req.params.id },
      select: { userId: true },
    })
    if (post && post.userId !== req.user!.userId) {
      const commenter = await prisma.user.findUnique({ where: { id: req.user!.userId }, select: { name: true } })
      sendPush(post.userId, '💬 Novo comentário', `${commenter?.name}: ${content.slice(0, 60)}`, { type: 'comment', postId: req.params.id }).catch(() => {})
    }

    return created(res, comment)
  } catch {
    return serverError(res)
  }
}

export async function deletePost(req: AuthRequest, res: Response) {
  try {
    await postService.deletePost(req.user!.userId, req.params.id)
    return ok(res, null, 'Deleted')
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed'
    return badRequest(res, msg)
  }
}

export async function sharePost(req: AuthRequest, res: Response) {
  try {
    const share = await postService.sharePost(req.user!.userId, req.params.id)
    return created(res, share)
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed'
    return badRequest(res, msg)
  }
}

export async function voteExtendPost(req: AuthRequest, res: Response) {
  try {
    const result = await postService.voteExtendPost(req.user!.userId, req.params.id)
    return ok(res, result)
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed'
    return badRequest(res, msg)
  }
}

export async function getExtendVotes(req: AuthRequest, res: Response) {
  try {
    const result = await postService.getExtendVotes(req.params.id)
    return ok(res, result)
  } catch {
    return serverError(res)
  }
}

export async function getFlashback(req: AuthRequest, res: Response) {
  try {
    const post = await postService.getFlashback(req.user!.userId)
    return ok(res, post)
  } catch {
    return serverError(res)
  }
}
