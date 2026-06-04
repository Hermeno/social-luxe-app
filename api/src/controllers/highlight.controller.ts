import { Response } from 'express'
import * as highlightService from '../services/highlight.service'
import { ok, created, badRequest, serverError, notFound, forbidden } from '../utils/response'
import { handleError } from '../utils/errors'
import { AuthRequest } from '../types'

export async function createHighlight(req: AuthRequest, res: Response) {
  try {
    const { title, posts } = req.body
    if (!title) return badRequest(res, 'Title required')
    if (!Array.isArray(posts) || posts.length === 0) return badRequest(res, 'At least one post required')
    const highlight = await highlightService.createHighlight(req.user!.userId, title, posts)
    return created(res, highlight)
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed'
    return serverError(res, msg)
  }
}

export async function getUserHighlights(req: AuthRequest, res: Response) {
  try {
    const highlights = await highlightService.getUserHighlights(req.params.userId)
    return ok(res, highlights)
  } catch (err) { return handleError(res, err) }
}

export async function deleteHighlight(req: AuthRequest, res: Response) {
  try {
    await highlightService.deleteHighlight(req.user!.userId, req.params.id)
    return ok(res, null, 'Deleted')
  } catch (err) { return handleError(res, err) }
}
