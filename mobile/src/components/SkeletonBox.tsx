import React, { useEffect, useRef } from 'react'
import { Animated, ViewStyle } from 'react-native'

interface Props {
  width?: number | `${number}%`
  height?: number
  borderRadius?: number
  style?: ViewStyle
}

export default function SkeletonBox({ width = '100%', height = 16, borderRadius = 8, style }: Props) {
  const opacity = useRef(new Animated.Value(0.35)).current

  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0.9, duration: 650, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.35, duration: 650, useNativeDriver: true }),
      ]),
    )
    anim.start()
    return () => anim.stop()
  }, [])

  return (
    <Animated.View
      style={[{ width, height, borderRadius, backgroundColor: '#E5E7EB', opacity } as any, style]}
    />
  )
}
