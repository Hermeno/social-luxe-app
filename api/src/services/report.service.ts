import { prisma } from '../config/database'
import { ReportTarget } from '@prisma/client'

export async function createReport(
  reporterId: string,
  targetId: string,
  targetType: ReportTarget,
  reason: string,
) {
  return prisma.report.create({
    data: { reporterId, targetId, targetType, reason },
  })
}
