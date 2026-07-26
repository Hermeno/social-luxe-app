import React from 'react'
import Svg, { Circle } from 'react-native-svg'
import { colors } from '../theme'

interface Props {
  count: number
  size: number
  strokeWidth?: number
  /** Por defeito o preto suave do tema. Anéis de avatar nunca são carmim — o
   *  carmim é para acções. Passa-se cor só para casos deliberados. */
  color?: string
}

// Anel MESMO segmentado: parte-se em arcos = nº de posts da pessoa. O anel diz
// quantos momentos há, não é enfeite. Uma pessoa com 1 post → anel inteiro;
// com 3 → três arcos com folga entre eles. Acima de MAX o ganho de informação
// deixa de compensar o ruído visual, por isso satura.
const MAX_SEGMENTS = 8

export default function SegmentedRing({ count, size, strokeWidth = 3, color = colors.ring }: Props) {
  if (count === 0) return null

  const r  = (size - strokeWidth) / 2
  const cx = size / 2
  const cy = size / 2

  const segments = Math.min(count, MAX_SEGMENTS)
  const circumference = 2 * Math.PI * r
  // Folga entre arcos proporcional ao tamanho; sem folga quando é um só.
  const gap = segments > 1 ? Math.max(3, circumference * 0.03) : 0
  const seg = circumference / segments
  const dash = Math.max(0.1, seg - gap)

  return (
    <Svg width={size} height={size} style={{ position: 'absolute' }}>
      <Circle
        cx={cx}
        cy={cy}
        r={r}
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeDasharray={`${dash} ${gap}`}
        // Começa no topo (12h), não à direita — fica alinhado e simétrico.
        transform={`rotate(-90 ${cx} ${cy})`}
      />
    </Svg>
  )
}
