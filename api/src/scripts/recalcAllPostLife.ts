/**
 * Reaplica os escalões de vida a todos os posts vivos.
 *
 * `recalcPostLife` só corre quando alguém interage com um post, por isso mexer
 * em LIFE_TIERS não muda nada no que já existe — um post fica com a vida que
 * ganhou sob os limiares antigos até à próxima interação. Este script fecha
 * essa lacuna depois de uma recalibração.
 *
 * Seguro de repetir: a expiração nunca encolhe, só cresce.
 *
 *   npm run backfill:post-life
 */
import { prisma } from '../config/database'
import { recalcPostLife } from '../services/post.service'

async function main() {
  const posts = await prisma.post.findMany({
    where:  { deletedAt: null, expiresAt: { gt: new Date() }, isAnnouncement: false },
    select: { id: true, createdAt: true, expiresAt: true },
  })
  console.log(`${posts.length} posts vivos a reavaliar…`)

  let promoted = 0
  for (const p of posts) {
    const before = p.expiresAt.getTime()
    await recalcPostLife(p.id)
    const after = await prisma.post.findUnique({ where: { id: p.id }, select: { expiresAt: true } })
    if (after && after.expiresAt.getTime() > before) {
      const days = (after.expiresAt.getTime() - p.createdAt.getTime()) / 86_400_000
      console.log(`  ${p.id} → ${days.toFixed(1)}d`)
      promoted++
    }
  }

  console.log(`${promoted} posts subiram de escalão.`)
}

main()
  .catch((e) => { console.error(e); process.exitCode = 1 })
  .finally(() => prisma.$disconnect())
