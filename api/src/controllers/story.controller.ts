import { Response } from 'express'
import * as storyService from '../services/story.service'
import { ok, created, badRequest, serverError } from '../utils/response'
import { AuthRequest } from '../types'
import { MediaType } from '@prisma/client'
import { uploadToCloudinary } from '../utils/cloudinary.util'

export async function createStory(req: AuthRequest, res: Response) {
  try {
    const file = req.file
    if (!file) return badRequest(res, 'Media file required')
    const mediaType = file.mimetype.startsWith('video') ? MediaType.VIDEO : MediaType.IMAGE
    const mediaUrl = await uploadToCloudinary(file.buffer, file.mimetype, 'luxe/stories')
    const story = await storyService.createStory(req.user!.userId, mediaUrl, mediaType)
    return created(res, story)
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed'
    return serverError(res, msg)
  }
}

export async function getFriendsStories(req: AuthRequest, res: Response) {
  try {
    const stories = await storyService.getFriendsStories(req.user!.userId)
    return ok(res, stories)
  } catch {
    return serverError(res)
  }
}

export async function deleteStory(req: AuthRequest, res: Response) {
  try {
    await storyService.deleteStory(req.user!.userId, req.params.id)
    return ok(res, null, 'Deleted')
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed'
    return badRequest(res, msg)
  }
}

export async function viewStory(req: AuthRequest, res: Response) {
  try {
    await storyService.viewStory(req.params.id, req.user!.userId)
    return ok(res, null)
  } catch {
    return serverError(res)
  }
}
