import { Request, Response, NextFunction } from 'express'

export function errorMiddleware(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
) {
  console.error('[Error]', err.message)

  if (err.message === 'File type not allowed') {
    return res.status(400).json({ success: false, message: err.message })
  }

  return res.status(500).json({ success: false, message: 'Internal server error' })
}
