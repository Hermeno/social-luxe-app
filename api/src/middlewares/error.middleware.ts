import { Request, Response, NextFunction } from 'express'
import { handleError } from '../utils/errors'

export function errorMiddleware(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
) {
  handleError(res, err)
}
