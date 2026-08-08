import React from 'react'
import Svg, { Circle, Line, Path, Polygon, Polyline, Rect } from 'react-native-svg'
import { iconPaths, type IconName, type IconShape } from './paths'

export type { IconName }
export { iconPaths }

const TAGS = {
  path: Path,
  circle: Circle,
  rect: Rect,
  line: Line,
  polyline: Polyline,
  polygon: Polygon,
} as const

export interface IconProps {
  name: IconName
  /** Lado da caixa em px. Os ícones são desenhados numa grelha 24×24. */
  size?: number
  /** Cor do traço (e do preenchimento onde o SVG usa `currentColor`). */
  color?: string
  /** Espessura do traço no espaço 24×24. 1.75 normal · 2.25 ativo. */
  strokeWidth?: number
  /** Preenche as formas fechadas — usado no estado ativo da TabBar. */
  fill?: string
  /** Mantém a espessura ótica constante quando `size` foge dos 24. */
  absoluteStrokeWidth?: boolean
  opacity?: number
}

/**
 * Ícone do design system da Luxee.
 * Grelha 24×24 · área viva 2..22 · traço 1.75 · pontas e junções redondas.
 * Fonte dos desenhos: `src/assets/icons/*.svg` (corre `npm run icons` após editar).
 */
export default function Icon({
  name,
  size = 24,
  color = '#000000',
  strokeWidth = 1.75,
  fill = 'none',
  absoluteStrokeWidth = false,
  opacity,
}: IconProps) {
  const shapes = iconPaths[name] as IconShape[] | undefined
  if (!shapes) {
    if (__DEV__) console.warn(`[Icon] "${name}" não existe em src/assets/icons`)
    return null
  }

  const sw = absoluteStrokeWidth ? (strokeWidth * 24) / size : strokeWidth

  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" opacity={opacity}>
      {shapes.map(([tag, attrs], i) => {
        const Shape = TAGS[tag as keyof typeof TAGS]
        if (!Shape) return null
        // `currentColor` no SVG resolve para a prop `color`; o resto herda os defaults.
        const own = { ...attrs }
        const shapeFill = own.fill ? (own.fill === 'currentColor' ? color : own.fill) : fill
        const shapeStroke = own.stroke
          ? own.stroke === 'currentColor'
            ? color
            : own.stroke
          : color
        delete own.fill
        delete own.stroke
        return (
          <Shape
            key={i}
            {...(own as any)}
            fill={shapeFill}
            stroke={shapeStroke}
            strokeWidth={shapeStroke === 'none' ? undefined : sw}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )
      })}
    </Svg>
  )
}
