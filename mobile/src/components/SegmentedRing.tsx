import React from 'react'
import Svg, { Circle } from 'react-native-svg'
import { colors } from '../theme'

interface Props {
  count: number
  size: number
  strokeWidth?: number
  /** Por defeito o preto suave do tema. Passa-se cor para casos deliberados. */
  color?: string
}

// Anel SEMPRE inteiro — um círculo fechado, mesmo com vários posts. (Já foi
// segmentado por nº de posts; o utilizador preferiu o anel cheio.)
export default function SegmentedRing({ count, size, strokeWidth = 3, color = colors.ring }: Props) {
  if (count === 0) return null

  const r  = (size - strokeWidth) / 2
  const cx = size / 2
  const cy = size / 2

  return (
    <Svg width={size} height={size} style={{ position: 'absolute' }}>
      <Circle cx={cx} cy={cy} r={r} fill="none" stroke={color} strokeWidth={strokeWidth} />
    </Svg>
  )
}
