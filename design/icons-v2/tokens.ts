/**
 * Luxee · paleta v2 — derivada do kit de referência (2026-08-10).
 * Ainda NÃO está ligada à app. `mobile/src/theme/colors.ts` continua a mandar
 * até o Herminio aprovar o pacote.
 */

export const palette = {
  // ── Superfícies escuras ──────────────────────────────────────────────────
  ground: '#0A0A0F', // fundo base
  panel: '#131420', // cartão / folha
  raised: '#1C1D28', // superfície elevada, chip, pílula
  hairline: '#262838', // fio de 1px — neutro enviesado para o violeta

  // ── Tinta ────────────────────────────────────────────────────────────────
  ink: '#F0F1F6', // texto e ícone em repouso sobre escuro
  muted: '#767E92', // rótulo secundário, ícone inativo
  slate: '#3A4250', // desativado

  // ── Acentos ──────────────────────────────────────────────────────────────
  rose: '#F5274F', // like / gosto, ao vivo, destrutivo
  magenta: '#C238E8',
  violet: '#8B5CF6', // acento primário
  azure: '#2A9BE8',
  teal: '#2FD4B6', // sucesso / confirmado

  white: '#FFFFFF',
} as const

export const gradients = {
  /** Estado ativo da tab bar e botões primários. */
  brand: ['#8B5CF6', '#2A9BE8'] as const,
  /** Só o botão Criar — o anel de néon do kit. */
  create: ['#00E5FF', '#FF2D6F'] as const,
  /** Emissão ao vivo. */
  live: ['#FF2D6F', '#F5274F'] as const,
} as const

/**
 * Cor do ícone por estado. O interior do ícone é SEMPRE vazado —
 * o estado resolve-se com cor e espessura, nunca com preenchimento.
 */
export const iconState = {
  idle: { color: palette.muted, strokeWidth: 1.75 },
  hover: { color: palette.ink, strokeWidth: 1.75 },
  active: { color: palette.violet, strokeWidth: 2.25 },
  liked: { color: palette.rose, strokeWidth: 2.25 },
  disabled: { color: palette.slate, strokeWidth: 1.75 },
} as const
