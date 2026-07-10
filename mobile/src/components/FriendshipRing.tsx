import React from 'react'
import Svg, { Circle } from 'react-native-svg'
import { colors } from '../theme'

interface Props {
  level: number   // 0–100
  tier: number    // 1–5
  size: number    // outer diameter
  strokeWidth?: number
}

export default function FriendshipRing({ level, size, strokeWidth = 3 }: Props) {
  const r = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * r
  const filled = (level / 100) * circumference
  const dashoffset = circumference - filled
  // Uma única cor de anel em toda a app; o tier é comunicado pelo preenchimento
  const color = colors.primary
  const cx = size / 2
  const cy = size / 2

  return (
    <Svg
      width={size}
      height={size}
      style={{ position: 'absolute', top: 0, left: 0 }}
    >
      {/* Track (fundo do anel) */}
      <Circle
        cx={cx} cy={cy} r={r}
        stroke="rgba(255,255,255,0.12)"
        strokeWidth={strokeWidth}
        fill="none"
        strokeDasharray={`${circumference}`}
        strokeDashoffset={0}
        rotation="-90"
        origin={`${cx}, ${cy}`}
      />
      {/* Progresso colorido */}
      <Circle
        cx={cx} cy={cy} r={r}
        stroke={color}
        strokeWidth={strokeWidth}
        fill="none"
        strokeDasharray={`${circumference}`}
        strokeDashoffset={dashoffset}
        strokeLinecap="round"
        rotation="-90"
        origin={`${cx}, ${cy}`}
      />
    </Svg>
  )
}
