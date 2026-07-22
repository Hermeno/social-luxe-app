import React from 'react'
import Svg, { Circle } from 'react-native-svg'
import { colors } from '../theme'

interface Props {
  count: number
  size: number
  strokeWidth?: number
  /** Por defeito o crimson da marca (feed). A área de conversas passa preto —
   *  lá o desenho é a preto e branco e nenhum anel é colorido. */
  color?: string
}

// Uma cor por zona da app, nunca variação por visto/não visto: se o anel mudasse
// de cor conforme o estado, a fila deixava de se ler como um só conjunto.
export default function SegmentedRing({ count, size, strokeWidth = 3, color = colors.primary }: Props) {
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
        stroke={color}
        strokeWidth={strokeWidth}
      />
    </Svg>
  )
}
