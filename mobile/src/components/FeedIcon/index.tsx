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
  name, size = 24, color = '#FFFFFF', weight = 'regular', opacity,
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

        if (weight === 'medium') {
          if (stroke !== 'none' && stroke !== 'transparent') {
            const nativeStroke = Number(own.strokeWidth ?? 1)
            own.strokeWidth = String(+(nativeStroke + mediumBoost).toFixed(4))
          } else if (fill !== 'none' && fill !== 'transparent') {
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
