import { Response } from 'express'
import * as challengeService from '../services/challenge.service'
import { ok, serverError } from '../utils/response'
import { AuthRequest } from '../types'

export async function getActiveChallenges(_req: AuthRequest, res: Response) {
  try {
    const challenges = await challengeService.getActiveChallenges()
    return ok(res, challenges)
  } catch {
    return serverError(res)
  }
}
