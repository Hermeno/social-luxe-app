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
  /** Geometria e traço escalam juntos a partir de 24×24. */
  size?: number
  color?: string
  opacity?: number
}

/** Grelha 24×24, margem mínima 2, traço 1.75 e junções redondas. */
export default function FeedIcon({ name, size = 24, color = '#FFFFFF', opacity }: FeedIconProps) {
  const icon = feedIcons[name]
  if (!icon) {
    if (__DEV__) console.warn(`[FeedIcon] "${name}" não existe em src/assets/feed-icons`)
    return null
  }

  const paint = (value: string | undefined) => value === 'currentColor' ? color : (value ?? 'none')

  return (
    <Svg width={size} height={size} viewBox={icon.viewBox} fill="none" opacity={opacity}>
      {(icon.shapes as FeedIconShape[]).map(([tag, attrs], i) => {
        const Shape = TAGS[tag as keyof typeof TAGS]
        if (!Shape) return null
        return <Shape key={i} {...(attrs as any)} fill={paint(attrs.fill)} stroke={paint(attrs.stroke)} />
      })}
    </Svg>
  )
}
