import { Response } from 'express'
import * as postService from '../services/post.service'
import * as commentService from '../services/comment.service'
import { ok, created, badRequest, serverError } from '../utils/response'
import { AuthRequest } from '../types'
import { MediaType } from '@prisma/client'

export async function createPost(req: AuthRequest, res: Response) {
  try {
    const file = req.file
    if (!file) return badRequest(res, 'Media file required')
    const mediaType = file.mimetype.startsWith('video') ? MediaType.VIDEO : MediaType.IMAGE
    const mediaUrl = `/uploads/${file.filename}`
    const post = await postService.createPost(req.user!.userId, mediaUrl, mediaType, req.body.caption)
    return created(res, post)
  } catch (err: unknown) {
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
