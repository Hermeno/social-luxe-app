import { api } from './api'

export type ReportTarget = 'POST' | 'USER' | 'COMMENT'

export const REPORT_REASONS = [
  'Conteúdo inapropriado',
  'Spam',
  'Assédio',
  'Informação falsa',
  'Outro',
]

export async function createReport(
  targetId: string,
  targetType: ReportTarget,
  reason: string,
): Promise<void> {
  await api.post('/reports', { targetId, targetType, reason })
}
