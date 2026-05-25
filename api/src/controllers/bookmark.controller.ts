import { Response } from 'express'
import * as bookmarkService from '../services/bookmark.service'
import { ok, badRequest, serverError } from '../utils/response'
import { AuthRequest } from '../types'

export async function toggleBookmark(req: AuthRequest, res: Response) {
  try {
    const { postId } = req.body
    if (!postId) return badRequest(res, 'postId required')
    const result = await bookmarkService.toggleBookmark(req.user!.userId, postId)
    return ok(res, result)
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed'
    return serverError(res, msg)
  }
}

export async function getBookmarks(req: AuthRequest, res: Response) {
  try {
    const bookmarks = await bookmarkService.getBookmarks(req.user!.userId)
    return ok(res, bookmarks)
  } catch {
    return serverError(res)
  }
}
