import React from 'react'
import Svg, { Circle, Defs, LinearGradient, Stop } from 'react-native-svg'

interface Props {
  count: number
  viewedCount?: number
  size: number
  strokeWidth?: number
  inactiveColor?: string
}

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
      {!allViewed && (
        <Defs>
          <LinearGradient id="ring-grad" x1="0%" y1="0%" x2="100%" y2="100%">
            <Stop offset="0%"   stopColor="#CA2851" stopOpacity={1} />
            <Stop offset="50%"  stopColor="#FF6766" stopOpacity={1} />
            <Stop offset="100%" stopColor="#FFB173" stopOpacity={1} />
          </LinearGradient>
        </Defs>
      )}
      <Circle
        cx={cx}
        cy={cy}
        r={r}
        fill="none"
        stroke={allViewed ? inactiveColor : 'url(#ring-grad)'}
        strokeWidth={strokeWidth}
      />
    </Svg>
  )
}
