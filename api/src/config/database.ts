import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient }

// Neon serverless uses a pooler — keep connection_limit low to avoid pool exhaustion
const dbUrl = process.env.DATABASE_URL ?? ''
const url = dbUrl.includes('?')
  ? dbUrl.replace(/connection_limit=\d+/, '') + '&connection_limit=3&pool_timeout=20'
  : dbUrl + '?connection_limit=3&pool_timeout=20'

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: [],
    datasources: { db: { url } },
  })

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma
}
