import React from 'react'
import Svg, { Circle } from 'react-native-svg'
import { colors } from '../theme'

interface Props {
  count: number
  size: number
  strokeWidth?: number
}

// UMA cor, sempre: o crimson da marca. Sem variação por visto/não visto — se o
// anel mudasse de cor conforme o estado, a fila deixava de se ler como um só
// conjunto. O que distingue estados é a espessura do traço, não a cor.
export default function SegmentedRing({ count, size, strokeWidth = 3 }: Props) {
  if (count === 0) return null

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
        stroke={colors.primary}
        strokeWidth={strokeWidth}
      />
    </Svg>
  )
}
