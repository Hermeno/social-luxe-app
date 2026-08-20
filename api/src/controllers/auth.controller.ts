import { Response } from 'express'
import * as authService from '../services/auth.service'
import { ok, created, badRequest, tooManyRequests, serviceUnavailable } from '../utils/response'
import { handleError } from '../utils/errors'
import { AuthRequest, RegisterBody, LoginBody } from '../types'
import { prisma } from '../config/database'
import { env } from '../config/env'
import { comparePassword as compareHash, hashPassword } from '../utils/hash'
import { deleteFromCloudinary } from '../utils/cloudinary.util'
import { deleteFromR2, isR2Url } from '../utils/r2.util'
import { usernameOptions as genUsernameOptions } from '../utils/username'
import { Prisma } from '@prisma/client'

export async function checkPhone(req: AuthRequest, res: Response) {
  try {
    const { phone } = req.body
    if (!phone) return badRequest(res, 'phone required')
    const user = await prisma.user.findUnique({ where: { phone }, select: { id: true } })
    return ok(res, { exists: !!user })
  } catch (err) { return handleError(res, err) }
}

// Opções de @handle (base do nome + número) para escolher no registo. Público.
export async function usernameOptions(req: AuthRequest, res: Response) {
  try {
    const name = String(req.query.name ?? '').trim()
    if (!name) return badRequest(res, 'name required')
    const result = await genUsernameOptions(name, 6)
    return ok(res, result)
  } catch (err) { return handleError(res, err) }
}

export async function register(req: AuthRequest, res: Response) {
  try {
    const body = req.body as RegisterBody
    if (!body.name || !body.phone || !body.countryCode || !body.password || !body.confirmPassword) {
      return badRequest(res, 'All fields are required')
    }
    const result = await authService.register(body)
    return created(res, result, 'Account created')
  } catch (err) { return handleError(res, err) }
}

export async function login(req: AuthRequest, res: Response) {
  try {
    const body = req.body as LoginBody
    if (!body.phone || !body.password) return badRequest(res, 'Phone and password required')
    const result = await authService.login(body)
    return ok(res, result, 'Login successful')
  } catch (err) { return handleError(res, err) }
}

export async function me(req: AuthRequest, res: Response) {
  try {
    const profile = await authService.getProfile(req.user!.userId)
    return ok(res, profile)
  } catch (err) { return handleError(res, err) }
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
  } catch (err) { return handleError(res, err) }
}

// ── Request password reset (generates code; delivery via SMS is not wired up yet) ──
export async function requestPasswordReset(req: AuthRequest, res: Response) {
  try {
    if (!env.passwordResetEnabled) {
      return serviceUnavailable(res, 'Password reset by SMS is not configured yet')
    }

    const { phone, countryCode } = req.body
    if (!phone || !countryCode) return badRequest(res, 'phone and countryCode required')

    const genericMessage = 'If this account exists, a reset code was generated'
    const user = await prisma.user.findFirst({ where: { phone, countryCode } })
    // Always respond the same to avoid user enumeration
    if (!user) return ok(res, null, genericMessage)

    const recentCount = await prisma.passwordReset.count({
      where: { phone, createdAt: { gt: new Date(Date.now() - 60 * 60 * 1000) } },
    })
    if (recentCount >= 3) return tooManyRequests(res, 'Too many reset requests — try again later')

    // Invalidate old codes
    await prisma.passwordReset.updateMany({ where: { phone, used: false }, data: { used: true } })

    const code = Math.floor(100000 + Math.random() * 900000).toString()
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000) // 15 min

    await prisma.passwordReset.create({ data: { phone, code, expiresAt } })

    // TODO: integrate an SMS provider and send `code` there. Never return the code in the API response.
    return ok(res, { expiresAt }, genericMessage)
  } catch (err) { return handleError(res, err) }
}

// ── Confirm password reset ────────────────────────────────────────────────────
export async function confirmPasswordReset(req: AuthRequest, res: Response) {
  try {
    const { phone, countryCode, code, newPassword } = req.body
    if (!phone || !code || !newPassword) return badRequest(res, 'phone, code and newPassword required')
    if (newPassword.length < 6) return badRequest(res, 'Password must be at least 6 characters')

    const reset = await prisma.passwordReset.findFirst({
      where: { phone, used: false, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: 'desc' },
    })
    if (!reset) return badRequest(res, 'Invalid or expired code')
    if (reset.attempts >= 5) return tooManyRequests(res, 'Too many attempts — request a new code')

    if (reset.code !== code) {
      await prisma.passwordReset.update({ where: { id: reset.id }, data: { attempts: { increment: 1 } } })
      return badRequest(res, 'Invalid or expired code')
    }

    const user = await prisma.user.findFirst({ where: { phone, countryCode } })
    if (!user) return badRequest(res, 'User not found')

    const hashed = await hashPassword(newPassword)
    await Promise.all([
      prisma.user.update({ where: { id: user.id }, data: { password: hashed } }),
      prisma.passwordReset.update({ where: { id: reset.id }, data: { used: true } }),
    ])

    return ok(res, null, 'Password reset successful')
  } catch (err) { return handleError(res, err) }
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

    // Collect media URLs before the rows disappear (DB cascades remove the rows,
    // but storage on Cloudinary/R2 must be cleaned up explicitly)
    const [posts, stories, messages] = await Promise.all([
      prisma.post.findMany({
        where: { userId: user.id },
        select: {
          id: true,
          mediaUrl: true,
          mediaUrls: true,
          repostEntry: { select: { id: true } },
          reposts: { select: { repostedPostId: true } },
        },
      }),
      prisma.story.findMany({ where: { userId: user.id }, select: { mediaUrl: true } }),
      prisma.message.findMany({ where: { senderId: user.id, mediaUrl: { not: null } }, select: { mediaUrl: true } }),
    ])

    const repostCopiesOfMyOriginals = posts.flatMap((p) => p.reposts.map((r) => r.repostedPostId))
    const circleUrls = await prisma.$transaction(async (tx) => {
      // Publicar/retirar/limpar uma captura usa exatamente o mesmo lock. Assim a
      // conta ou vê o Post já commitado, ou remove a sessão/captura antes de um
      // publish tardio poder construir um snapshot com media prestes a apagar.
      const affected = await tx.circleSession.findMany({
        where: {
          OR: [
            { hostId: user.id },
            { members: { some: { userId: user.id } } },
          ],
        },
        select: { id: true },
      })
      const sessionIds = affected.map((session) => session.id).sort()
      if (sessionIds.length > 0) {
        await tx.$queryRaw<Array<{ id: string }>>(
          Prisma.sql`
            SELECT "id" FROM "CircleSession"
            WHERE "id" IN (${Prisma.join(sessionIds)})
            ORDER BY "id"
            FOR UPDATE
          `,
        )
      }

      const [legacyCaptures, normalizedCaptures] = await Promise.all([
        tx.circleSessionMember.findMany({
          where: {
            photoUrl: { not: null },
            OR: [
              { userId: user.id },
              { session: { hostId: user.id } },
            ],
          },
          select: { photoUrl: true },
        }),
        tx.circleSessionCapture.findMany({
          where: {
            OR: [
              { userId: user.id },
              { round: { session: { hostId: user.id } } },
            ],
          },
          select: { mediaUrl: true },
        }),
      ])

      // As cópias pertencem a quem repostou, por isso não cairiam no cascade do
      // utilizador que criou o original. Sem esta remoção ficariam com media órfã.
      if (repostCopiesOfMyOriginals.length > 0) {
        await tx.post.deleteMany({ where: { id: { in: repostCopiesOfMyOriginals } } })
      }
      await tx.user.delete({ where: { id: user.id } })
      return [...new Set([
        ...legacyCaptures.flatMap((capture) => capture.photoUrl ? [capture.photoUrl] : []),
        ...normalizedCaptures.map((capture) => capture.mediaUrl),
      ])]
    }, { maxWait: 5_000, timeout: 15_000 })

    // Best-effort storage cleanup — a failure here must not undo the deletion
    const ownedPostUrls = [...new Set(posts
      .filter((post) => !post.repostEntry)
      .flatMap((post) => post.mediaUrls.length > 0
        ? post.mediaUrls
        : post.mediaUrl ? [post.mediaUrl] : []))]
    const cleanupCandidates = [...new Set([...ownedPostUrls, ...circleUrls])]
    const [remainingPosts, liveCirclePhotos, liveCircleCaptures] = cleanupCandidates.length > 0
      ? await Promise.all([
          prisma.post.findMany({
            where: {
              OR: [
                { mediaUrl: { in: cleanupCandidates } },
                { mediaUrls: { hasSome: cleanupCandidates } },
              ],
            },
            select: { mediaUrl: true, mediaUrls: true },
          }),
          prisma.circleSessionMember.findMany({
            where: { photoUrl: { in: cleanupCandidates } },
            select: { photoUrl: true },
          }),
          prisma.circleSessionCapture.findMany({
            where: { mediaUrl: { in: cleanupCandidates } },
            select: { mediaUrl: true },
          }),
        ])
      : [[], [], []]
    const stillReferenced = new Set<string>([
      ...remainingPosts.flatMap((post) => [
      ...(post.mediaUrl ? [post.mediaUrl] : []),
      ...post.mediaUrls,
      ]),
      ...liveCirclePhotos.flatMap((capture) => capture.photoUrl ? [capture.photoUrl] : []),
      ...liveCircleCaptures.map((capture) => capture.mediaUrl),
    ])

    const mediaUrls = [
      user.avatar,
      // Uma cópia de repost e um Post coletivo de outra pessoa podem apontar
      // para o mesmo ficheiro; só URLs sem qualquer referência saem do storage.
      ...cleanupCandidates.filter((url) => !stillReferenced.has(url)),
      ...stories.map((s) => s.mediaUrl),
      ...messages.map((m) => m.mediaUrl),
    ]
    for (const url of mediaUrls) {
      if (!url) continue
      if (isR2Url(url)) deleteFromR2(url).catch(() => {})
      else deleteFromCloudinary(url).catch(() => {})
    }

    return ok(res, null, 'Account deleted')
  } catch (err) { return handleError(res, err) }
}
