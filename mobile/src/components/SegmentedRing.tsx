import React from 'react'
import Svg, { Circle } from 'react-native-svg'

interface Props {
  count: number
  viewedCount?: number
  size: number
  strokeWidth?: number
  activeColor?: string
  inactiveColor?: string
}

/**
 * Anel segmentado onde cada segmento = 1 post.
 * count=1 → anel sólido, count=2 → 2 metades, count=N → N fatias iguais.
 * Segmentos visualizados ficam cinza, os não-vistos ficam azuis.
 */
export default function SegmentedRing({
  count,
  viewedCount = 0,
  size,
  strokeWidth = 2.5,
  activeColor  = '#4C8CE4',
  inactiveColor = '#E5E5EA',
}: Props) {
  if (count === 0) return null

  const r   = (size - strokeWidth) / 2
  const cx  = size / 2
  const cy  = size / 2
  const circumference = 2 * Math.PI * r

  // Sem gaps para 1 post (anel sólido); 4° de gap entre segmentos para 2+
  const GAP_DEG  = count === 1 ? 0 : 4
  const segDeg   = 360 / count - GAP_DEG
  const segArc   = (circumference / 360) * segDeg

  return (
    <Svg width={size} height={size} style={{ position: 'absolute' }}>
      {Array.from({ length: count }, (_, i) => {
        const isViewed  = i < viewedCount
        const color     = isViewed ? inactiveColor : activeColor
        // Cada segmento começa na posição angular correcta (topo = -90°)
        const startDeg  = -90 + i * (360 / count)

        return (
          <Circle
            key={i}
            cx={cx}
            cy={cy}
            r={r}
            fill="none"
            stroke={color}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={`${segArc} ${circumference}`}
            transform={`rotate(${startDeg} ${cx} ${cy})`}
          />
        )
      })}
    </Svg>
  )
}
