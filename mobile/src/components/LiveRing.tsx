import React, { useEffect, useRef } from 'react'
import { Animated, Easing } from 'react-native'
import Svg, { Circle, Defs, LinearGradient as SvgGradient, Stop } from 'react-native-svg'

interface Props {
  size: number
  strokeWidth?: number
  color?: string
  durationMs?: number
}

// Anel vivo — um traço em gradiente (do carmim cheio ao quase-transparente) que
// roda devagar. O brilho parece viajar à volta do avatar: marca quem está no
// ecrã com vida, sem piscar nem gritar. Rotação por native driver (barata).
export default function LiveRing({ size, strokeWidth = 3, color = '#CA2851', durationMs = 3800 }: Props) {
  const spin = useRef(new Animated.Value(0)).current

  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(spin, {
        toValue: 1,
        duration: durationMs,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    )
    loop.start()
    return () => loop.stop()
  }, [durationMs, spin])

  const rotate = spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] })
  const r = (size - strokeWidth) / 2

  return (
    <Animated.View
      style={{ position: 'absolute', width: size, height: size, transform: [{ rotate }] }}
      pointerEvents="none"
    >
      <Svg width={size} height={size}>
        <Defs>
          <SvgGradient id="liveRing" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0"    stopColor={color} stopOpacity="1" />
            <Stop offset="0.55" stopColor={color} stopOpacity="0.12" />
            <Stop offset="1"    stopColor={color} stopOpacity="0.95" />
          </SvgGradient>
        </Defs>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="url(#liveRing)"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
        />
      </Svg>
    </Animated.View>
  )
}
