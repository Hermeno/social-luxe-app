import { Prisma } from '@prisma/client'
import { Response } from 'express'
import { badRequest, notFound, serverError } from './response'

// Known business errors thrown by services — safe to show to the client
const SAFE_MESSAGES = new Set([
  'Invalid credentials',
  'User not found',
  'Post not found',
  'Phone already registered',
  'Password must be at least 6 characters',
  'Passwords do not match',
  'Not authorised',
  'Already following',
  'Not following',
  'Already friends',
  'Friend request already sent',
  'Insufficient coins',
  'Invalid or expired code',
  'Current password is incorrect',
  'Incorrect password',
  'Password confirmation required',
  'File type not allowed',
])

function isSafeMessage(msg: string): boolean {
  return SAFE_MESSAGES.has(msg)
}

// A P2025 (record not found) on an update/delete keyed by the AUTHENTICATED user's own
// id means their account no longer exists — a stale JWT for a deleted user, not a normal
// 404. Controllers that write to req.user!.userId should check this before handleError()
// and return unauthorized() instead, so the client's existing 401 handler logs them out
// instead of surfacing a confusing "record not found" forever.
export function isSelfRecordNotFound(err: unknown): boolean {
  return err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2025'
}

// Map Prisma error codes to clean client-facing messages
function handlePrismaError(err: Prisma.PrismaClientKnownRequestError): { status: number; message: string } {
  switch (err.code) {
    case 'P2002': return { status: 400, message: 'This value is already taken.' }
    case 'P2025': return { status: 404, message: 'Record not found.' }
    case 'P2003': return { status: 400, message: 'Related record not found.' }
    case 'P2014': return { status: 400, message: 'Invalid relation.' }
    default:      return { status: 500, message: 'Database error. Please try again.' }
  }
}

// Central error handler — call from every controller catch block
export function handleError(res: Response, err: unknown, context?: string): Response {
  // Don't log expected business errors — only real unexpected ones
  const isKnownBusiness = err instanceof Error && isSafeMessage(err.message)
  if (!isKnownBusiness) {
    console.error(`[${context ?? 'Error'}]`, err instanceof Error ? err.message : err)
  }

  // DB unreachable / connection failed / pool timeout
  if (
    err instanceof Prisma.PrismaClientInitializationError ||
    (err instanceof Error && (
      err.message.includes("Can't reach database") ||
      err.message.includes('connection pool') ||
      err.message.includes('Timed out') ||
      err.message.includes('connect ECONNREFUSED') ||
      err.message.includes('ENOTFOUND')
    ))
  ) {
    return serverError(res, 'Service temporarily unavailable. Please try again.')
  }

  // Prisma known request error (constraint, not found, etc.)
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    const { status, message } = handlePrismaError(err)
    return res.status(status).json({ success: false, message })
  }

  // Prisma validation error (wrong type, missing field, bad schema)
  if (err instanceof Prisma.PrismaClientValidationError) {
    return res.status(400).json({ success: false, message: 'Invalid request data.' })
  }

  // Prisma engine crash
  if (err instanceof Prisma.PrismaClientRustPanicError) {
    return serverError(res, 'Service temporarily unavailable. Please try again.')
  }

  // Business logic errors from services — safe to forward
  if (err instanceof Error && isSafeMessage(err.message)) {
    return badRequest(res, err.message)
  }

  // Unknown error — never leak internals
  return serverError(res, 'Something went wrong. Please try again.')
}
