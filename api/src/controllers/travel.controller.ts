import { Response } from 'express'
import { AuthRequest } from '../types'
import * as travelService from '../services/travel.service'
import { ok, created, notFound, forbidden, serverError, badRequest } from '../utils/response'
import { handleError } from '../utils/errors'

export async function getTravelData(req: AuthRequest, res: Response) {
  try {
    const data = await travelService.getTravelData(req.params.postId)
    return ok(res, data)
  } catch (e) {
    return handleError(res, e)
  }
}

export async function addObject(req: AuthRequest, res: Response) {
  try {
    const { type = 'emoji', value } = req.body
    if (!value?.trim()) return badRequest(res, 'value is required')

    const obj = await travelService.addObject(
      req.params.postId,
      req.user!.userId,
      type,
      value.trim(),
    )
    return created(res, obj)
  } catch (e: any) {
    if (e?.message === 'Travel not enabled on this post') return badRequest(res, e.message)
    return handleError(res, e)
  }
}

export async function removeObject(req: AuthRequest, res: Response) {
  try {
    await travelService.removeObject(req.params.objectId, req.user!.userId)
    return ok(res, { removed: true })
  } catch (e: any) {
    if (e?.message === 'Object not found') return notFound(res, e.message)
    if (e?.message === 'Forbidden')        return forbidden(res, e.message)
    return handleError(res, e)
  }
}
