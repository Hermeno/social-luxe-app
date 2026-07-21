// ─── Vida conquistada de um post ──────────────────────────────────────────────
// Todo o post nasce com 24h. As interações (views, likes, objetos, comentários,
// partilhas) empurram-no para escalões maiores — 3d, 10d, 30d, 1 ano, para
// sempre. A API grava isso em `expiresAt = createdAt + vida do escalão`, por
// isso o escalão lê-se aqui sem chamada nenhuma: é a diferença entre as duas
// datas. Espelha LIFE_TIERS em api/src/services/post.service.ts.

const DAY_MS = 24 * 60 * 60 * 1000

export type LifeTier = 'base' | 'd3' | 'd10' | 'd30' | 'y1' | 'forever'

// Ordenado do maior para o menor: o primeiro que couber ganha.
const TIERS: { tier: LifeTier; minDays: number }[] = [
  { tier: 'forever', minDays: 365 * 50 },
  { tier: 'y1',      minDays: 300      },
  { tier: 'd30',     minDays: 25       },
  { tier: 'd10',     minDays: 8        },
  { tier: 'd3',      minDays: 2.5      },
]

export function lifeTier(post: { createdAt?: string | null; expiresAt?: string | null }): LifeTier {
  if (!post.createdAt || !post.expiresAt) return 'base'
  const born = new Date(post.createdAt).getTime()
  const dies = new Date(post.expiresAt).getTime()
  if (!Number.isFinite(born) || !Number.isFinite(dies)) return 'base'

  const days = (dies - born) / DAY_MS
  return TIERS.find((t) => days >= t.minDays)?.tier ?? 'base'
}

// Etiqueta curta para a grelha. `yearLabel` vem do i18n (1a / 1y).
export function lifeLabel(tier: LifeTier, yearLabel: string): string | null {
  switch (tier) {
    case 'forever': return '∞'
    case 'y1':      return yearLabel
    case 'd30':     return '30d'
    case 'd10':     return '10d'
    case 'd3':      return '3d'
    default:        return null
  }
}

// Só os dois escalões de topo ganham a cor da marca — os outros ficam neutros,
// senão a grelha inteira acende e a distinção perde-se.
export function isEliteTier(tier: LifeTier): boolean {
  return tier === 'forever' || tier === 'y1'
}
