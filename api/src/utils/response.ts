import { Response } from 'express'

export function ok(res: Response, data: unknown, message = 'Success') {
  return res.status(200).json({ success: true, message, data })
}

export function created(res: Response, data: unknown, message = 'Created') {
  return res.status(201).json({ success: true, message, data })
}

export function badRequest(res: Response, message: string) {
  return res.status(400).json({ success: false, message })
}

export function unauthorized(res: Response, message = 'Unauthorized') {
  return res.status(401).json({ success: false, message })
}

export function forbidden(res: Response, message = 'Forbidden') {
  return res.status(403).json({ success: false, message })
}

export function notFound(res: Response, message = 'Not found') {
  return res.status(404).json({ success: false, message })
}

export function serverError(res: Response, message = 'Internal server error') {
  return res.status(500).json({ success: false, message })
}

export function tooManyRequests(res: Response, message = 'Too many requests') {
  return res.status(429).json({ success: false, message })
}
