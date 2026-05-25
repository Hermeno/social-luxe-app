import { Response } from 'express'
import * as groupService from '../services/group.service'
import { ok, created, badRequest, serverError } from '../utils/response'
import { AuthRequest } from '../types'

export async function createGroup(req: AuthRequest, res: Response) {
  try {
    const { name, memberIds } = req.body
    if (!name) return badRequest(res, 'Group name required')
    if (!Array.isArray(memberIds)) return badRequest(res, 'memberIds must be an array')
    const group = await groupService.createGroup(req.user!.userId, name, memberIds)
    return created(res, group)
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed'
    return serverError(res, msg)
  }
}

export async function getMyGroups(req: AuthRequest, res: Response) {
  try {
    const groups = await groupService.getMyGroups(req.user!.userId)
    return ok(res, groups)
  } catch {
    return serverError(res)
  }
}

export async function getGroupMessages(req: AuthRequest, res: Response) {
  try {
    const page = Number(req.query.page ?? 1)
    const messages = await groupService.getGroupMessages(req.params.id, req.user!.userId, page)
    return ok(res, messages)
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed'
    return badRequest(res, msg)
  }
}

export async function sendGroupMessage(req: AuthRequest, res: Response) {
  try {
    const { content, mediaUrl } = req.body
    const message = await groupService.sendGroupMessage(req.params.id, req.user!.userId, content, mediaUrl)
    return created(res, message)
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed'
    return badRequest(res, msg)
  }
}

export async function addMember(req: AuthRequest, res: Response) {
  try {
    const { userId } = req.body
    if (!userId) return badRequest(res, 'userId required')
    const member = await groupService.addMember(req.params.id, req.user!.userId, userId)
    return created(res, member)
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed'
    return badRequest(res, msg)
  }
}

export async function removeMember(req: AuthRequest, res: Response) {
  try {
    await groupService.removeMember(req.params.id, req.user!.userId, req.params.userId)
    return ok(res, null, 'Member removed')
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed'
    return badRequest(res, msg)
  }
}
