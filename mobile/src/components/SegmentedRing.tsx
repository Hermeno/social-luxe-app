import React from 'react'
import Svg, { Path, Circle, Defs, LinearGradient, Stop } from 'react-native-svg'
import { colors } from '../theme'

// Instagram-inspired, lighter version
const INSTA_GRADIENT = ['#FCAF45', '#E1306C', '#833AB4']

interface Props {
  count: number
  viewedCount?: number
  size: number
  strokeWidth?: number
  inactiveColor?: string
  useGradient?: boolean
}

export default function SegmentedRing({
  count,
  viewedCount = 0,
  size,
  strokeWidth = 3,
  inactiveColor = colors.gray200,
  useGradient = true,
}: Props) {
  const r     = (size - strokeWidth) / 2
  const cx    = size / 2
  const cy    = size / 2
  const gap   = count > 1 ? 8 : 0
  const segDeg = (360 - count * gap) / count
  const gradId = 'instaGrad'

  function toXY(deg: number) {
    const rad = ((deg - 90) * Math.PI) / 180
    return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) }
  }

  function arc(startDeg: number, endDeg: number) {
    const s = toXY(startDeg)
    const e = toXY(endDeg)
    const large = endDeg - startDeg > 180 ? 1 : 0
    return `M${s.x} ${s.y} A${r} ${r} 0 ${large} 1 ${e.x} ${e.y}`
  }

  function activeStroke(i: number) {
    return useGradient ? `url(#${gradId})` : colors.primary
  }

  return (
    <Svg width={size} height={size} style={{ position: 'absolute' }}>
      <Defs>
        <LinearGradient id={gradId} x1="0" y1="1" x2="1" y2="0">
          {INSTA_GRADIENT.map((color, i) => (
            <Stop
              key={i}
              offset={`${i / (INSTA_GRADIENT.length - 1)}`}
              stopColor={color}
            />
          ))}
        </LinearGradient>
      </Defs>

      {count === 1 ? (
        <Circle
          cx={cx} cy={cy} r={r}
          stroke={viewedCount >= 1 ? inactiveColor : activeStroke(0)}
          strokeWidth={strokeWidth}
          fill="none"
        />
      ) : (
        Array.from({ length: count }, (_, i) => {
          const start = i * (segDeg + gap)
          const end   = start + segDeg
          return (
            <Path
              key={i}
              d={arc(start, end)}
              stroke={i < viewedCount ? inactiveColor : activeStroke(i)}
              strokeWidth={strokeWidth}
              fill="none"
              strokeLinecap="round"
            />
          )
        })
      )}
    </Svg>
  )
}
