import { Response } from 'express'
import * as reportService from '../services/report.service'
import { created, badRequest, serverError } from '../utils/response'
import { AuthRequest } from '../types'
import { ReportTarget } from '@prisma/client'

export async function createReport(req: AuthRequest, res: Response) {
  try {
    const { targetId, targetType, reason } = req.body
    if (!targetId || !targetType || !reason) return badRequest(res, 'targetId, targetType, and reason required')
    if (!Object.values(ReportTarget).includes(targetType)) return badRequest(res, 'Invalid targetType')
    const report = await reportService.createReport(
      req.user!.userId,
      targetId,
      targetType as ReportTarget,
      reason,
    )
    return created(res, report, 'Report submitted')
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed'
    return serverError(res, msg)
  }
}
