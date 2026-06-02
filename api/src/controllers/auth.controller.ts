import { Response } from 'express'
import * as authService from '../services/auth.service'
import { ok, created, badRequest, serverError } from '../utils/response'
import { AuthRequest, RegisterBody, LoginBody } from '../types'
import { prisma } from '../config/database'
import { comparePassword as compareHash, hashPassword } from '../utils/hash'
import fs from 'fs'
import path from 'path'

export async function checkPhone(req: AuthRequest, res: Response) {
  try {
    const { phone } = req.body
    if (!phone) return badRequest(res, 'phone required')
    const user = await prisma.user.findUnique({ where: { phone }, select: { id: true } })
    return ok(res, { exists: !!user })
  } catch { return serverError(res) }
}

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
    const profile = await authService.getProfile(req.user!.userId)
    return ok(res, profile)
  } catch {
    return serverError(res)
  }
}

// ── Change password (authenticated) ─────────────────────────────────────────
export async function changePassword(req: AuthRequest, res: Response) {
  try {
    const { currentPassword, newPassword } = req.body
    if (!currentPassword || !newPassword) return badRequest(res, 'currentPassword and newPassword required')
    if (newPassword.length < 6) return badRequest(res, 'Password must be at least 6 characters')

    const user = await prisma.user.findUnique({ where: { id: req.user!.userId } })
    if (!user) return badRequest(res, 'User not found')

    const valid = await compareHash(currentPassword, user.password)
    if (!valid) return badRequest(res, 'Current password is incorrect')

    const hashed = await hashPassword(newPassword)
    await prisma.user.update({ where: { id: user.id }, data: { password: hashed } })
    return ok(res, null, 'Password updated')
  } catch {
    return serverError(res)
  }
}

// ── Request password reset (generates code, no SMS — shown in response) ──────
export async function requestPasswordReset(req: AuthRequest, res: Response) {
  try {
    const { phone, countryCode } = req.body
    if (!phone || !countryCode) return badRequest(res, 'phone and countryCode required')

    const user = await prisma.user.findFirst({ where: { phone, countryCode } })
    // Always respond the same to avoid user enumeration
    if (!user) return ok(res, null, 'If this account exists, a reset code was generated')

    // Invalidate old codes
    await prisma.passwordReset.updateMany({ where: { phone, used: false }, data: { used: true } })

    const code = Math.floor(100000 + Math.random() * 900000).toString()
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000) // 15 min

    await prisma.passwordReset.create({ data: { phone, code, expiresAt } })

    // TODO: When SMS is available, send via provider instead of returning in response
    return ok(res, { code, expiresAt }, 'Reset code generated')
  } catch {
    return serverError(res)
  }
}

// ── Confirm password reset ────────────────────────────────────────────────────
export async function confirmPasswordReset(req: AuthRequest, res: Response) {
  try {
    const { phone, countryCode, code, newPassword } = req.body
    if (!phone || !code || !newPassword) return badRequest(res, 'phone, code and newPassword required')
    if (newPassword.length < 6) return badRequest(res, 'Password must be at least 6 characters')

    const reset = await prisma.passwordReset.findFirst({
      where: { phone, code, used: false, expiresAt: { gt: new Date() } },
    })
    if (!reset) return badRequest(res, 'Invalid or expired code')

    const user = await prisma.user.findFirst({ where: { phone, countryCode } })
    if (!user) return badRequest(res, 'User not found')

    const hashed = await hashPassword(newPassword)
    await Promise.all([
      prisma.user.update({ where: { id: user.id }, data: { password: hashed } }),
      prisma.passwordReset.update({ where: { id: reset.id }, data: { used: true } }),
    ])

    return ok(res, null, 'Password reset successful')
  } catch {
    return serverError(res)
  }
}

// ── Delete account (GDPR) ─────────────────────────────────────────────────────
export async function deleteAccount(req: AuthRequest, res: Response) {
  try {
    const { password } = req.body
    if (!password) return badRequest(res, 'Password confirmation required')

    const user = await prisma.user.findUnique({ where: { id: req.user!.userId } })
    if (!user) return badRequest(res, 'User not found')

    const valid = await compareHash(password, user.password)
    if (!valid) return badRequest(res, 'Incorrect password')

    // Media is on Cloudinary — no local file deletion needed
    if (user.avatar) {
      fs.unlink(path.join(process.cwd(), user.avatar), () => {})
    }

    // Cascade delete (Prisma handles related records via onDelete: Cascade in schema)
    await prisma.user.delete({ where: { id: user.id } })

    return ok(res, null, 'Account deleted')
  } catch {
    return serverError(res)
  }
}
