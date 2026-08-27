import { brandPalette, colors } from './colors'

/**
 * Fundos disponíveis para novas publicações de texto.
 *
 * Conteúdo pode usar preto/cinza ou um dos cinco pontos oficiais da imagem de
 * referência. O texto fica branco porque todos os pontos escolhidos mantêm
 * contraste suficiente para texto grande, que é o único uso deste fundo.
 */
export const postBackgroundOptions = [
  { key: 'graphite', bg: '#333333', fg: colors.white },
  { key: 'black',    bg: colors.black, fg: colors.white },
  { key: 'blue',     bg: brandPalette.blue, fg: colors.white },
  { key: 'indigo',   bg: brandPalette.indigo, fg: colors.white },
  { key: 'violet',   bg: brandPalette.violet, fg: colors.white },
  { key: 'purple',   bg: brandPalette.purple, fg: colors.white },
  { key: 'magenta',  bg: brandPalette.magenta, fg: colors.black },
] as const

export type PostBackgroundKey = typeof postBackgroundOptions[number]['key']

const optionByKey = Object.fromEntries(
  postBackgroundOptions.map((option) => [option.key, option]),
) as Record<PostBackgroundKey, typeof postBackgroundOptions[number]>

/** Valores persistidos por versões anteriores. Nunca voltam à UI diretamente. */
const legacyPostColors: Record<string, string> = {
  '#FF7A1C': brandPalette.blue,
  '#FF6766': brandPalette.indigo,
  '#FFB173': brandPalette.violet,
  '#7A1F3D': brandPalette.purple,
  '#1E3A5F': brandPalette.blue,
  '#245C4C': brandPalette.indigo,
  '#4C3A82': brandPalette.violet,
  '#A34210': brandPalette.magenta,
}

const officialChromatic = new Set<string>(Object.values(brandPalette))

function expandHex(value: string): string | null {
  const match = value.trim().match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i)
  if (!match) return null
  const raw = match[1]
  return `#${raw.length === 3 ? raw.split('').map((digit) => digit + digit).join('') : raw}`.toUpperCase()
}

function channels(hex: string): [number, number, number] {
  return [
    Number.parseInt(hex.slice(1, 3), 16),
    Number.parseInt(hex.slice(3, 5), 16),
    Number.parseInt(hex.slice(5, 7), 16),
  ]
}

function nearestBrandColor(hex: string): string {
  const [r, g, b] = channels(hex)
  let best = brandPalette.violet as string
  let bestDistance = Number.POSITIVE_INFINITY
  for (const candidate of Object.values(brandPalette)) {
    const [cr, cg, cb] = channels(candidate)
    const distance = ((r - cr) ** 2) + ((g - cg) ** 2) + ((b - cb) ** 2)
    if (distance < bestDistance) {
      best = candidate
      bestDistance = distance
    }
  }
  return best
}

/**
 * Impede que cores cromáticas antigas recebidas do cache/API reapareçam.
 * Neutros autorais continuam neutros; qualquer outro matiz é projetado para o
 * ponto mais próximo da paleta oficial.
 */
export function normalizePostColor(value: string | null | undefined, fallback = '#333333'): string {
  const hex = value ? expandHex(value) : null
  if (!hex) return fallback
  if (officialChromatic.has(hex)) return hex
  if (legacyPostColors[hex]) return legacyPostColors[hex]

  const [r, g, b] = channels(hex)
  if (Math.max(r, g, b) - Math.min(r, g, b) <= 8) return hex
  return nearestBrandColor(hex)
}

export function postGradientColors(
  serialized: string | null | undefined,
  fallback: readonly [string, string] = [brandPalette.purple, brandPalette.indigo],
): [string, string] {
  const parts = serialized?.split('|').filter(Boolean) ?? []
  if (parts.length === 0) return [fallback[0], fallback[1]]
  const first = normalizePostColor(parts[0], fallback[0])
  const second = normalizePostColor(parts[1] ?? parts[0], fallback[1])
  return [first, second]
}

export function postBackgroundFor(key: PostBackgroundKey) {
  return optionByKey[key]
}
