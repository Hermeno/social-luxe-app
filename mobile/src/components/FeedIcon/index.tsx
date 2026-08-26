import React from 'react'
import Svg, { Circle, Line, Path, Polygon, Polyline, Rect } from 'react-native-svg'
import { feedIcons, type FeedIconName, type FeedIconShape } from './paths'

export type { FeedIconName }
export { feedIcons }

export type FeedIconWeight = 'regular' | 'medium'

const TAGS = {
  path: Path,
  circle: Circle,
  rect: Rect,
  line: Line,
  polyline: Polyline,
  polygon: Polygon,
} as const

export interface FeedIconProps {
  name: FeedIconName
  /** Lado da caixa em px. O viewBox nativo do desenho trata da escala. */
  size?: number
  /** Substitui `currentColor` — no traço e no preenchimento. */
  color?: string
  /** Peso visual opt-in. `medium` preserva a caixa e acrescenta só 1% do viewBox. */
  weight?: FeedIconWeight
  /**
   * Espessura do traço em px do tamanho renderizado, não em unidades do viewBox.
   * É isto que iguala desenhos de famílias diferentes: cada um traz a sua caixa,
   * e um `strokeWidth` de 1 vale coisas diferentes numa caixa de 14 e numa de 256.
   */
  strokePx?: number
  /**
   * Reforço para desenhos sem traço — aqueles em que o contorno já vem cozido no
   * preenchimento. Engrossa a forma em exactamente N px do tamanho renderizado.
   */
  boostPx?: number
  opacity?: number
}

/**
 * Ícones da feed principal.
 *
 * Ao contrário do `<Icon>` da Luxee, este componente mantém por defeito a pintura
 * original de cada desenho. Como alguns contornos são traço e outros são geometria
 * preenchida, o peso `medium` é opt-in: soma um reforço mínimo ao traço existente ou
 * contorna a forma com a própria cor, sem mudar caixa, escala ou alinhamento.
 *
 * Fonte dos desenhos: `src/assets/feed-icons/*.svg` (corre `npm run icons:feed`).
 */
export default function FeedIcon({
  name, size = 24, color = '#FFFFFF', weight = 'regular', strokePx, boostPx, opacity,
}: FeedIconProps) {
  const icon = feedIcons[name]
  if (!icon) {
    if (__DEV__) console.warn(`[FeedIcon] "${name}" não existe em src/assets/feed-icons`)
    return null
  }

  const paint = (value: string | undefined, fallback: string) =>
    value === 'currentColor' ? color : (value ?? fallback)
  const viewBoxSide = Number(icon.viewBox.trim().split(/\s+/)[2]) || 24
  const mediumBoost = viewBoxSide * 0.01
  // px do tamanho renderizado → unidades da caixa deste desenho.
  const toUnits = (px: number) => (px * viewBoxSide) / size

  return (
    <Svg width={size} height={size} viewBox={icon.viewBox} fill="none" opacity={opacity}>
      {(icon.shapes as FeedIconShape[]).map(([tag, attrs], i) => {
        const Shape = TAGS[tag as keyof typeof TAGS]
        if (!Shape) return null
        const own = { ...attrs }
        const fill = paint(own.fill, 'none')
        let stroke = paint(own.stroke, 'none')
        delete own.fill
        delete own.stroke

        const hasStroke = stroke !== 'none' && stroke !== 'transparent'
        const hasFill = fill !== 'none' && fill !== 'transparent'

        if (strokePx != null && hasStroke) {
          // Substitui a espessura de origem: o alvo é ótico, em px.
          own.strokeWidth = String(+toUnits(strokePx).toFixed(4))
        } else if (boostPx != null && hasFill) {
          // O traço centra-se no bordo da forma: metade cresce para fora, metade
          // para dentro do que já está pintado — logo a espessura sobe `boostPx`.
          stroke = fill
          own.strokeWidth = String(+toUnits(boostPx).toFixed(4))
          own.strokeLinejoin ??= 'round'
        } else if (weight === 'medium') {
          if (hasStroke) {
            const nativeStroke = Number(own.strokeWidth ?? 1)
            own.strokeWidth = String(+(nativeStroke + mediumBoost).toFixed(4))
          } else if (hasFill) {
            stroke = fill
            own.strokeWidth = String(+mediumBoost.toFixed(4))
            own.strokeLinejoin ??= 'round'
          }
        }

        return <Shape key={i} {...(own as any)} fill={fill} stroke={stroke} />
      })}
    </Svg>
  )
}
