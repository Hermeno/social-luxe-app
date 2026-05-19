import React, { useEffect, useRef } from 'react'
import { Animated, StyleProp, ViewStyle } from 'react-native'

interface Props { children: React.ReactNode; style?: StyleProp<ViewStyle>; delay?: number }

export default function ScreenEntry({ children, style, delay = 0 }: Props) {
  const opacity    = useRef(new Animated.Value(0)).current
  const translateY = useRef(new Animated.Value(28)).current

  useEffect(() => {
    const anim = Animated.parallel([
      Animated.timing(opacity,    { toValue: 1, duration: 420, delay, useNativeDriver: true }),
      Animated.timing(translateY, { toValue: 0, duration: 420, delay, useNativeDriver: true }),
    ])
    anim.start()
    return () => anim.stop()
  }, [])

  return (
    <Animated.View style={[style, { opacity, transform: [{ translateY }] }]}>
      {children}
    </Animated.View>
  )
}
