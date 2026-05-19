import { Response } from 'express'
import * as userService from '../services/user.service'
import { ok, badRequest, serverError } from '../utils/response'
import { AuthRequest } from '../types'

export async function getAllUsers(req: AuthRequest, res: Response) {
  try {
    const users = await userService.getAllUsers(req.user!.userId)
    return ok(res, users)
  } catch { return serverError(res) }
}

export async function searchUsers(req: AuthRequest, res: Response) {
  try {
    const query = String(req.query.q ?? '')
    if (!query) return badRequest(res, 'Query required')
    const users = await userService.searchUsers(query, req.user!.userId)
    return ok(res, users)
  } catch {
    return serverError(res)
  }
}

export async function getUserById(req: AuthRequest, res: Response) {
  try {
    const user = await userService.getUserById(req.params.id)
    return ok(res, user)
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed'
    return badRequest(res, msg)
  }
}

export async function updateProfile(req: AuthRequest, res: Response) {
  try {
    const { name, bio, availability } = req.body
    const avatar = req.file ? `/uploads/${req.file.filename}` : undefined
    const user = await userService.updateProfile(req.user!.userId, { name, bio, avatar, availability })
    return ok(res, user)
  } catch {
    return serverError(res)
  }
}

export async function getUserPosts(req: AuthRequest, res: Response) {
  try {
    const posts = await userService.getUserPosts(req.params.id)
    return ok(res, posts)
  } catch {
    return serverError(res)
  }
}
