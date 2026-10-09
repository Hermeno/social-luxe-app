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

/**
 * A publicação ainda está dentro do primeiro dia?
 *
 * É a pergunta que decide se um Círculo ainda acende. Os anéis cromáticos à
 * volta das fotografias dizem "isto é agora"; passadas 24 horas deixa de ser
 * verdade — o momento fechou — e a cor de marca a toda a volta passaria a ser
 * decoração. A partir daí as fotografias ficam sem anel.
 *
 * 24h e não outro número: é a vida com que todo o post nasce (ver o topo deste
 * ficheiro). O Círculo apaga-se exactamente quando a publicação deixa de ser
 * nova, e não numa contagem própria inventada ao lado.
 *
 * Sem data assume-se que sim: um post acabado de criar no telemóvel ainda não
 * tem `createdAt` do servidor, e esse é novo por definição.
 */
export function withinFirstDay(post: { createdAt?: string | null }, now = Date.now()): boolean {
  if (!post.createdAt) return true
  const born = new Date(post.createdAt).getTime()
  if (!Number.isFinite(born)) return true
  return now - born < DAY_MS
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
