import { Response } from 'express'
import * as groupService from '../services/group.service'
import { ok, created, badRequest, serverError } from '../utils/response'
import { handleError } from '../utils/errors'
import { AuthRequest } from '../types'
import { uploadToCloudinary } from '../utils/cloudinary.util'

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
  } catch (err) { return handleError(res, err) }
}

export async function getGroupMessages(req: AuthRequest, res: Response) {
  try {
    const page = Number(req.query.page ?? 1)
    const messages = await groupService.getGroupMessages(req.params.id, req.user!.userId, page)
    return ok(res, messages)
  } catch (err) { return handleError(res, err) }
}

export async function sendGroupMessage(req: AuthRequest, res: Response) {
  try {
    const { content, replyToId } = req.body
    const message = await groupService.sendGroupMessage(req.params.id, req.user!.userId, content, replyToId)
    return created(res, message)
  } catch (err) { return handleError(res, err) }
}

export async function addMember(req: AuthRequest, res: Response) {
  try {
    const { userId } = req.body
    if (!userId) return badRequest(res, 'userId required')
    const member = await groupService.addMember(req.params.id, req.user!.userId, userId)
    return created(res, member)
  } catch (err) { return handleError(res, err) }
}

export async function removeMember(req: AuthRequest, res: Response) {
  try {
    await groupService.removeMember(req.params.id, req.user!.userId, req.params.userId)
    return ok(res, null, 'Member removed')
  } catch (err) { return handleError(res, err) }
}

export async function getGroupInfo(req: AuthRequest, res: Response) {
  try {
    const info = await groupService.getGroupInfo(req.params.id, req.user!.userId)
    return ok(res, info)
  } catch (err) { return handleError(res, err) }
}

export async function updateGroup(req: AuthRequest, res: Response) {
  try {
    const { name, description } = req.body
    let avatar: string | undefined
    if (req.file) {
      avatar = await uploadToCloudinary(req.file.buffer, req.file.mimetype, 'luxe/groups')
    }
    if (!name && !description && !avatar) return badRequest(res, 'Nothing to update')
    const group = await groupService.updateGroup(req.params.id, req.user!.userId, { name, description, avatar })
    return ok(res, group)
  } catch (err) { return handleError(res, err) }
}

export async function deleteGroup(req: AuthRequest, res: Response) {
  try {
    await groupService.deleteGroup(req.params.id, req.user!.userId)
    return ok(res, null, 'Group deleted')
  } catch (err) { return handleError(res, err) }
}

export async function promoteToAdmin(req: AuthRequest, res: Response) {
  try {
    const { userId } = req.body
    if (!userId) return badRequest(res, 'userId required')
    await groupService.promoteToAdmin(req.params.id, req.user!.userId, userId)
    return ok(res, null, 'Promoted to admin')
  } catch (err) { return handleError(res, err) }
}

export async function leaveGroup(req: AuthRequest, res: Response) {
  try {
    await groupService.leaveGroup(req.params.id, req.user!.userId)
    return ok(res, null, 'Left group')
  } catch (err) { return handleError(res, err) }
}
