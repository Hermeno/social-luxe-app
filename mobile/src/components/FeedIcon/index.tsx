import React from 'react'
import Svg, { Circle, Line, Path, Polygon, Polyline, Rect } from 'react-native-svg'
import { feedIcons, type FeedIconName, type FeedIconShape } from './paths'

export type { FeedIconName }
export { feedIcons }

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
  opacity?: number
}

/**
 * Ícones da feed principal.
 *
 * Ao contrário do `<Icon>` da Luxee, este componente não impõe grelha nem espessura:
 * cada desenho mantém a caixa e a pintura com que foi entregue. Muitos destes ícones
 * têm o contorno cozido numa forma preenchida em vez de um traço, por isso não há
 * `strokeWidth` para dar — a espessura é geometria, não propriedade.
 *
 * Fonte dos desenhos: `src/assets/feed-icons/*.svg` (corre `npm run icons:feed`).
 */
export default function FeedIcon({ name, size = 24, color = '#FFFFFF', opacity }: FeedIconProps) {
  const icon = feedIcons[name]
  if (!icon) {
    if (__DEV__) console.warn(`[FeedIcon] "${name}" não existe em src/assets/feed-icons`)
    return null
  }

  const paint = (value: string | undefined, fallback: string) =>
    value === 'currentColor' ? color : (value ?? fallback)

  return (
    <Svg width={size} height={size} viewBox={icon.viewBox} fill="none" opacity={opacity}>
      {(icon.shapes as FeedIconShape[]).map(([tag, attrs], i) => {
        const Shape = TAGS[tag as keyof typeof TAGS]
        if (!Shape) return null
        const own = { ...attrs }
        const fill = paint(own.fill, 'none')
        const stroke = paint(own.stroke, 'none')
        delete own.fill
        delete own.stroke
        return <Shape key={i} {...(own as any)} fill={fill} stroke={stroke} />
      })}
    </Svg>
  )
}
