import React from 'react'
import Svg, { Circle } from 'react-native-svg'
import { colors } from '../theme'

interface Props {
  count: number
  viewedCount?: number
  size: number
  strokeWidth?: number
  inactiveColor?: string
}

// Todos os anéis da app usam uma única cor: o crimson da marca.
export default function SegmentedRing({
  count,
  viewedCount = 0,
  size,
  strokeWidth = 3,
  inactiveColor = 'rgba(0,0,0,0.12)',
}: Props) {
  if (count === 0) return null

  const allViewed = viewedCount >= count
  const r  = (size - strokeWidth) / 2
  const cx = size / 2
  const cy = size / 2

  return (
    <Svg width={size} height={size} style={{ position: 'absolute' }}>
      <Circle
        cx={cx}
        cy={cy}
        r={r}
        fill="none"
        stroke={allViewed ? inactiveColor : colors.primary}
        strokeWidth={strokeWidth}
      />
    </Svg>
  )
}
