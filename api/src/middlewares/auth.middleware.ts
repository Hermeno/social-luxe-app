import { Response, NextFunction } from 'express'
import { verifyToken } from '../utils/jwt'
import { unauthorized } from '../utils/response'
import { AuthRequest } from '../types'

export function authMiddleware(req: AuthRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization

  if (!authHeader?.startsWith('Bearer ')) {
    return unauthorized(res)
  }

  const token = authHeader.split(' ')[1]

  try {
    req.user = verifyToken(token)
    next()
  } catch {
    return unauthorized(res, 'Invalid or expired token')
  }
}
