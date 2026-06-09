import React, { useEffect, useRef } from 'react'
import { View, Text, StyleSheet, Animated } from 'react-native'
import { fonts } from '../theme'

interface Props {
  count: number
  color?: string
}

const RED = '#FF3B30'

export default function SpeechBadge({ count, color = RED }: Props) {
  const scale = useRef(new Animated.Value(0)).current
  const prevCount = useRef(count)

  // Entrance bounce when badge mounts
  useEffect(() => {
    Animated.spring(scale, {
      toValue: 1,
      useNativeDriver: true,
      speed: 14,
      bounciness: 18,
    }).start()
  }, [])

  // Bounce when count changes while visible
  useEffect(() => {
    if (count !== prevCount.current) {
      prevCount.current = count
      Animated.sequence([
        Animated.timing(scale, { toValue: 1.3, duration: 100, useNativeDriver: true }),
        Animated.spring(scale, { toValue: 1, speed: 16, bounciness: 10, useNativeDriver: true }),
      ]).start()
    }
  }, [count])

  if (count <= 0) return null
  const label = count > 99 ? '99+' : String(count)

  return (
    <Animated.View pointerEvents="none" style={[s.wrap, { transform: [{ scale }] }]}>
      <View style={[s.bubble, { backgroundColor: color }]}>
        <Text style={s.txt}>{label}</Text>
      </View>
      <View style={[s.tail, { borderTopColor: color }]} />
    </Animated.View>
  )
}

const s = StyleSheet.create({
  wrap: {
    alignItems: 'center',
  },
  bubble: {
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 4,
    minWidth: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  txt: {
    fontSize: 11,
    fontFamily: fonts.extraBold,
    color: '#fff',
    lineHeight: 15,
  },
  tail: {
    width: 0,
    height: 0,
    borderLeftWidth: 6,
    borderRightWidth: 6,
    borderTopWidth: 7,
    borderStyle: 'solid',
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
  },
})
