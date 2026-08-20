import { Request, Response } from 'express'
import multer from 'multer'
import * as postService from '../services/post.service'
import * as commentService from '../services/comment.service'
import { ok, created, badRequest, serverError, notFound, forbidden } from '../utils/response'
import { handleError } from '../utils/errors'
import { AuthRequest } from '../types'
import { MediaType } from '@prisma/client'
import { sendPush } from '../services/notification.service'
import { prisma } from '../config/database'
import { deleteFromCloudinary, uploadToCloudinaryWithMeta, withThumbnails } from '../utils/cloudinary.util'
import { deleteFromR2, isR2Url } from '../utils/r2.util'
import { parsePostFontKey } from '../utils/postFont.util'

export async function createPost(req: AuthRequest, res: Response) {
  try {
    const { caption, bgColor } = req.body
    // Só a whitelist entra; um valor inventado cai na fonte padrão.
    const fontKey = parsePostFontKey(req.body.fontKey)
    const file = req.file

    let mediaUrl: string | null = null
    let mediaWidth: number | null = null
    let mediaHeight: number | null = null
    let mediaType: MediaType

    if (!file) {
      // Text post — no media file required
      if (!caption?.trim() && !bgColor) return badRequest(res, 'Content required')
      mediaType = MediaType.TEXT
    } else {
      mediaType = file.mimetype.startsWith('video') ? MediaType.VIDEO : MediaType.IMAGE
      const uploaded = await uploadToCloudinaryWithMeta(file, 'luxe/posts')
      mediaUrl    = uploaded.url
      mediaWidth  = uploaded.width
      mediaHeight = uploaded.height
    }

    // Include partner if user has an accepted partner and opted in
    const { partnerUserId: requestedPartner, isAnnouncement: rawAnnouncement, deviceModel } = req.body
    let partnerUserId: string | null = null
    if (requestedPartner) {
      const myUnion = await prisma.union.findFirst({
        where: {
          OR: [
            { memberAId: req.user!.userId, memberBId: requestedPartner },
            { memberBId: req.user!.userId, memberAId: requestedPartner },
          ],
        },
        select: { id: true },
      })
      if (myUnion) partnerUserId = requestedPartner
    }

    let isAnnouncement = false
    if (rawAnnouncement === true || rawAnnouncement === 'true') {
      const me = await prisma.user.findUnique({ where: { id: req.user!.userId }, select: { isAdmin: true } })
      if (!me?.isAdmin) return forbidden(res, 'Apenas administradores podem publicar anúncios')
      isAnnouncement = true
    }

    const post = await postService.createPost(req.user!.userId, mediaUrl, mediaType, caption, bgColor, partnerUserId ?? undefined, isAnnouncement, deviceModel ?? undefined, mediaWidth, mediaHeight, mediaType === MediaType.TEXT ? fontKey : null)

    // Notify partner of post invitation
    if (partnerUserId) {
      sendPush(partnerUserId, '💑 Foste incluído/a num post', 'O teu parceiro publicou algo contigo. Aceita ou rejeita.', { type: 'post_partner_invite', postId: post.id }).catch(() => {})
    }

    // ── Real-time push to followers who may still see this author ─────────────
    postService.emitPostToVisibleFollowers(req.user!.userId, post).catch(() => {})

    return created(res, post)
  } catch (err: unknown) {
    if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({ success: false, message: 'Ficheiro demasiado grande. Máximo 100 MB.' })
    }
    const cloudinaryTooBig = typeof (err as any)?.message === 'string' && (err as any).message.includes('File size too large')
    if (cloudinaryTooBig) {
      return res.status(413).json({ success: false, message: 'Ficheiro demasiado grande. Máximo 100 MB.' })
    }
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
        user: { select: { id: true, name: true, username: true, avatar: true, viewsPublic: true } },
        _count: { select: { likes: true, comments: true, shares: true, reposts: true, views: true } },
      },
      orderBy: { createdAt: 'desc' },
    })
    return ok(res, await postService.attachPostMeta(withThumbnails(posts), req.user!.userId))
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

// ── Álbum: várias fotos numa publicação → grelha na feed ─────────────────────
export async function createAlbum(req: AuthRequest, res: Response) {
  try {
    const files = (req.files as Express.Multer.File[] | undefined) ?? []
    if (files.length < 2) return badRequest(res, 'Um álbum precisa de pelo menos 2 fotos')
    if (files.length > 10) return badRequest(res, 'Máximo de 10 fotos por álbum')

    const { caption, deviceModel } = req.body
    const uploaded = await Promise.all(files.map((f) => uploadToCloudinaryWithMeta(f, 'luxe/posts')))
    const urls  = uploaded.map((u) => u.url)
    const sizes = uploaded.map((u) => ({ w: u.width, h: u.height }))
    const post = await postService.createAlbumPost(req.user!.userId, urls, caption?.trim() || undefined, deviceModel, undefined, sizes)

    postService.emitPostToVisibleFollowers(req.user!.userId, post).catch(() => {})

    return created(res, post)
  } catch (err: unknown) {
    if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({ success: false, message: 'Ficheiro demasiado grande. Máximo 100 MB.' })
    }
    console.error('[createAlbum]', err)
    return serverError(res)
  }
}

export async function getFeed(req: AuthRequest, res: Response) {
  try {
    const page = Number(req.query.page ?? 1)
    const posts = await postService.getFeed(req.user!.userId, page)
    return ok(res, posts)
  } catch (err) { return handleError(res, err) }
}

// Sem sessão: não recebe `req.user` e nunca regista vista nem toca no ciclo de
// vida do post. Quem não tem conta observa; não conta como presença.
export async function getPublicFeed(req: Request, res: Response) {
  try {
    const page = Math.max(1, Number(req.query.page ?? 1) || 1)
    const posts = await postService.getPublicFeed(page)
    return ok(res, posts)
  } catch (err) { return handleError(res, err) }
}

export async function searchPosts(req: AuthRequest, res: Response) {
  try {
    const query = String(req.query.q ?? '').trim()
    if (!query) return badRequest(res, 'Query required')
    const posts = await postService.searchPosts(query, req.user!.userId)
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
    const comments = await commentService.getComments(req.params.id, req.user!.userId)
    return ok(res, comments)
  } catch (err) { return handleError(res, err) }
}

export async function editComment(req: AuthRequest, res: Response) {
  try {
    const { content } = req.body
    if (!content || !String(content).trim()) return badRequest(res, 'Content required')
    const comment = await commentService.editComment(req.user!.userId, req.params.commentId, String(content).trim())
    return ok(res, comment)
  } catch (err) { return handleError(res, err) }
}

export async function deleteComment(req: AuthRequest, res: Response) {
  try {
    const result = await commentService.deleteComment(req.user!.userId, req.params.commentId)
    return ok(res, result)
  } catch (err) { return handleError(res, err) }
}

export async function toggleCommentLike(req: AuthRequest, res: Response) {
  try {
    const result = await commentService.toggleCommentLike(req.user!.userId, req.params.commentId)
    return ok(res, result)
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

    // Delete media from storage (fire-and-forget)
    if (result.deleteMedia && result.mediaUrls.length > 0) {
      ;(async () => {
        for (const mediaUrl of result.mediaUrls) {
          try {
            if (isR2Url(mediaUrl)) await deleteFromR2(mediaUrl)
            else await deleteFromCloudinary(mediaUrl)
          } catch {}
        }
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

export async function repostPost(req: AuthRequest, res: Response) {
  try {
    const result = await postService.repostPost(req.user!.userId, req.params.id)
    return created(res, result)
  } catch (err) { return handleError(res, err) }
}

export async function removeRepost(req: AuthRequest, res: Response) {
  try {
    const result = await postService.removeRepost(req.user!.userId, req.params.id)
    return ok(res, result)
  } catch (err) { return handleError(res, err) }
}

// POST /posts/:id/taste  { signal: 'MORE' | 'LESS', dwellMs?: number }
export async function recordTasteFeedback(req: AuthRequest, res: Response) {
  try {
    const signal = req.body?.signal
    if (signal !== 'MORE' && signal !== 'LESS') {
      return res.status(400).json({ success: false, message: 'signal must be MORE or LESS' })
    }
    // O cliente mede o tempo com o relógio dele; aceita-se como pista, nunca
    // como verdade. Fora de um intervalo plausível, vale mais não guardar nada
    // do que guardar um número que envenena o treino.
    const raw = Number(req.body?.dwellMs)
    const dwellMs = Number.isFinite(raw) && raw >= 0 && raw <= 3_600_000
      ? Math.round(raw)
      : null

    const result = await postService.recordTasteFeedback(
      req.user!.userId, req.params.id, signal, dwellMs,
    )
    return ok(res, result)
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
