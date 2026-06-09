import { Response } from 'express'
import * as postService from '../services/post.service'
import * as commentService from '../services/comment.service'
import { ok, created, badRequest, serverError, notFound, forbidden } from '../utils/response'
import { handleError } from '../utils/errors'
import { AuthRequest } from '../types'
import { MediaType } from '@prisma/client'
import { sendPush } from '../services/notification.service'
import { prisma } from '../config/database'
import { uploadToCloudinary } from '../utils/cloudinary.util'
import { emitToUser } from '../socket'

export async function createPost(req: AuthRequest, res: Response) {
  try {
    const { caption, bgColor } = req.body
    const file = req.file

    let mediaUrl: string | null = null
    let mediaType: MediaType

    if (!file) {
      // Text post — no media file required
      if (!caption?.trim() && !bgColor) return badRequest(res, 'Content required')
      mediaType = MediaType.TEXT
    } else {
      mediaType = file.mimetype.startsWith('video') ? MediaType.VIDEO : MediaType.IMAGE
      mediaUrl  = await uploadToCloudinary(file.buffer, file.mimetype, 'luxe/posts')
    }

    // Include partner if user has an accepted partner and opted in
    const { partnerUserId: requestedPartner, isAnnouncement: rawAnnouncement } = req.body
    let partnerUserId: string | null = null
    if (requestedPartner) {
      const me = await prisma.user.findUnique({ where: { id: req.user!.userId }, select: { partnerId: true } })
      if (me?.partnerId === requestedPartner) partnerUserId = requestedPartner
    }

    let isAnnouncement = false
    if (rawAnnouncement === true || rawAnnouncement === 'true') {
      const me = await prisma.user.findUnique({ where: { id: req.user!.userId }, select: { isAdmin: true } })
      if (!me?.isAdmin) return forbidden(res, 'Apenas administradores podem publicar anúncios')
      isAnnouncement = true
    }

    const post = await postService.createPost(req.user!.userId, mediaUrl, mediaType, caption, bgColor, partnerUserId ?? undefined, isAnnouncement)

    // Notify partner of post invitation
    if (partnerUserId) {
      sendPush(partnerUserId, '💑 Foste incluído/a num post', 'O teu parceiro publicou algo contigo. Aceita ou rejeita.', { type: 'post_partner_invite', postId: post.id }).catch(() => {})
    }

    // ── Real-time push to all followers via WebSocket ─────────────────────────
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

// GET /posts/partner-pending — posts where I'm invited as partner but haven't responded
export async function getPartnerPostInvites(req: AuthRequest, res: Response) {
  try {
    const posts = await prisma.post.findMany({
      where: { partnerUserId: req.user!.userId, partnerAccepted: false, deletedAt: null },
      include: {
        user: { select: { id: true, name: true, avatar: true, viewsPublic: true } },
        _count: { select: { likes: true, comments: true, shares: true, views: true } },
      },
      orderBy: { createdAt: 'desc' },
    })
    return ok(res, posts)
  } catch (err) { return handleError(res, err, 'getPartnerPostInvites') }
}

// PUT /posts/:id/partner-accept
export async function acceptPostPartner(req: AuthRequest, res: Response) {
  try {
    const myId = req.user!.userId
    const post = await prisma.post.findUnique({ where: { id: req.params.id } })
    if (!post || post.partnerUserId !== myId) return badRequest(res, 'Convite não encontrado')
    await prisma.post.update({ where: { id: req.params.id }, data: { partnerAccepted: true } })
    return ok(res, { accepted: true })
  } catch (err) { return handleError(res, err, 'acceptPostPartner') }
}

// PUT /posts/:id/partner-reject
export async function rejectPostPartner(req: AuthRequest, res: Response) {
  try {
    const myId = req.user!.userId
    const post = await prisma.post.findUnique({ where: { id: req.params.id } })
    if (!post || post.partnerUserId !== myId) return badRequest(res, 'Convite não encontrado')
    await prisma.post.update({ where: { id: req.params.id }, data: { partnerUserId: null } })
    return ok(res, { rejected: true })
  } catch (err) { return handleError(res, err, 'rejectPostPartner') }
}

export async function getFeed(req: AuthRequest, res: Response) {
  try {
    const page = Number(req.query.page ?? 1)
    const posts = await postService.getFeed(req.user!.userId, page)
    return ok(res, posts)
  } catch (err) { return handleError(res, err) }
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
  } catch (err) { return handleError(res, err) }
}

export async function addView(req: AuthRequest, res: Response) {
  try {
    await postService.addView(req.user!.userId, req.params.id)
    return ok(res, null)
  } catch (err) { return handleError(res, err) }
}

export async function getComments(req: AuthRequest, res: Response) {
  try {
    const comments = await commentService.getComments(req.params.id)
    return ok(res, comments)
  } catch (err) { return handleError(res, err) }
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
  } catch (err) { return handleError(res, err) }
}

export async function deletePost(req: AuthRequest, res: Response) {
  try {
    const result = await postService.deletePost(req.user!.userId, req.params.id)

    // Delete from Cloudinary (fire-and-forget — don't block the response)
    if (result.mediaUrl && result.mediaUrl.includes('cloudinary.com')) {
      ;(async () => {
        try {
          // Extract public_id: everything after /upload/vXXXXX/ up to the extension
          const match = result.mediaUrl!.match(/\/upload\/(?:v\d+\/)?(.+)\.[^.]+$/)
          if (match) {
            const publicId    = match[1]
            const resourceType = result.mediaType === 'VIDEO' ? 'video' : 'image'
            const { cloudinary } = await import('../config/cloudinary')
            await cloudinary.uploader.destroy(publicId, { resource_type: resourceType })
          }
        } catch {}
      })()
    }

    return ok(res, null, 'Deleted')
  } catch (err) { return handleError(res, err) }
}

export async function updatePost(req: AuthRequest, res: Response) {
  try {
    const { caption } = req.body
    if (caption === undefined) return badRequest(res, 'caption required')
    const post = await postService.updatePostCaption(req.user!.userId, req.params.id, caption)
    return ok(res, post)
  } catch (err) { return handleError(res, err) }
}

export async function sharePost(req: AuthRequest, res: Response) {
  try {
    const share = await postService.sharePost(req.user!.userId, req.params.id)
    return created(res, share)
  } catch (err) { return handleError(res, err) }
}

export async function voteExtendPost(req: AuthRequest, res: Response) {
  try {
    const result = await postService.voteExtendPost(req.user!.userId, req.params.id)
    return ok(res, result)
  } catch (err) { return handleError(res, err) }
}

export async function getExtendVotes(req: AuthRequest, res: Response) {
  try {
    const result = await postService.getExtendVotes(req.params.id)
    return ok(res, result)
  } catch (err) { return handleError(res, err) }
}

export async function getFlashback(req: AuthRequest, res: Response) {
  try {
    const post = await postService.getFlashback(req.user!.userId)
    return ok(res, post)
  } catch (err) { return handleError(res, err) }
}
