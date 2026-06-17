import React from 'react'
import Svg, { Circle } from 'react-native-svg'

// Tier colors: 1=subtle → 5=pink (primary)
const TIER_COLORS = [
  'rgba(255,255,255,0.45)', // tier 1 — branco suave
  '#4A9EFF',               // tier 2 — azul
  '#A855F7',               // tier 3 — roxo
  '#F59E0B',               // tier 4 — ouro
  '#CA2851',               // tier 5 — rosa (primary)
]

interface Props {
  level: number   // 0–100
  tier: number    // 1–5
  size: number    // outer diameter
  strokeWidth?: number
}

export default function FriendshipRing({ level, tier, size, strokeWidth = 3 }: Props) {
  const r = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * r
  const filled = (level / 100) * circumference
  const dashoffset = circumference - filled
  const color = TIER_COLORS[Math.max(0, Math.min(4, tier - 1))]
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
