import { Response } from 'express'
import * as momentoService from '../services/momento.service'
import { ok, created, badRequest, serverError, notFound, forbidden } from '../utils/response'
import { handleError } from '../utils/errors'
import { AuthRequest } from '../types'

export async function createMomento(req: AuthRequest, res: Response) {
  try {
    const { latitude, longitude, label } = req.body
    if (latitude === undefined || longitude === undefined) return badRequest(res, 'latitude and longitude required')
    const lat = Number(latitude)
    const lng = Number(longitude)
    if (isNaN(lat) || isNaN(lng)) return badRequest(res, 'latitude and longitude must be numbers')
    const momento = await momentoService.createMomento(req.user!.userId, lat, lng, label)
    return created(res, momento)
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed'
    return serverError(res, msg)
  }
}

export async function getFriendsMomentos(req: AuthRequest, res: Response) {
  try {
    const momentos = await momentoService.getFriendsMomentos(req.user!.userId)
    return ok(res, momentos)
  } catch (err) { return handleError(res, err) }
}

export async function deleteMomento(req: AuthRequest, res: Response) {
  try {
    await momentoService.deleteMomento(req.user!.userId, req.params.id)
    return ok(res, null, 'Deleted')
  } catch (err) { return handleError(res, err) }
}

export async function viewMomento(req: AuthRequest, res: Response) {
  try {
    await momentoService.viewMomento(req.params.id, req.user!.userId)
    return ok(res, null)
  } catch (err) { return handleError(res, err) }
}
