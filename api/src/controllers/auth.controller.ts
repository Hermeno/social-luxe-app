import { Response } from 'express'
import * as authService from '../services/auth.service'
import { ok, created, badRequest, serverError } from '../utils/response'
import { AuthRequest, RegisterBody, LoginBody } from '../types'

export async function register(req: AuthRequest, res: Response) {
  try {
    const body = req.body as RegisterBody
    if (!body.name || !body.phone || !body.countryCode || !body.password || !body.confirmPassword) {
      return badRequest(res, 'All fields are required')
    }
    const result = await authService.register(body)
    return created(res, result, 'Account created')
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Register failed'
    return badRequest(res, msg)
  }
}

export async function login(req: AuthRequest, res: Response) {
  try {
    const body = req.body as LoginBody
    if (!body.phone || !body.password) return badRequest(res, 'Phone and password required')
    const result = await authService.login(body)
    return ok(res, result, 'Login successful')
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Login failed'
    return badRequest(res, msg)
  }
}

export async function me(req: AuthRequest, res: Response) {
  try {
    const userId = req.user!.userId
    const profile = await authService.getProfile(userId)
    return ok(res, profile)
  } catch (err: unknown) {
    return serverError(res)
  }
}
