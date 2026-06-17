import React, { useEffect, useRef } from 'react'
import { View, Text, StyleSheet, Animated } from 'react-native'
import { fonts } from '../theme'

interface Props {
  count: number
  color?: string
}

const RED = '#FF3040'

export default function SpeechBadge({ count, color = RED }: Props) {
  const scale = useRef(new Animated.Value(0)).current
  const prevCount = useRef(count)

  useEffect(() => {
    Animated.spring(scale, {
      toValue: 1,
      useNativeDriver: true,
      speed: 14,
      bounciness: 18,
    }).start()
  }, [])

  useEffect(() => {
    if (count !== prevCount.current) {
      prevCount.current = count
      Animated.sequence([
        Animated.timing(scale, { toValue: 1.25, duration: 90, useNativeDriver: true }),
        Animated.spring(scale, { toValue: 1, speed: 18, bounciness: 10, useNativeDriver: true }),
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
      {/* Tail at bottom-left — matches Instagram notification badge */}
      <View style={s.tailRow}>
        <View style={[s.tail, { borderTopColor: color }]} />
      </View>
    </Animated.View>
  )
}

const s = StyleSheet.create({
  wrap: {
    alignItems: 'flex-start',
  },
  bubble: {
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 6,
    minWidth: 34,
    alignItems: 'center',
    justifyContent: 'center',
  },
  txt: {
    fontSize: 12,
    fontFamily: fonts.extraBold,
    color: '#fff',
    lineHeight: 16,
    includeFontPadding: false,
  },
  tailRow: {
    paddingLeft: 10,
  },
  tail: {
    width: 0,
    height: 0,
    borderLeftWidth: 0,
    borderRightWidth: 10,
    borderTopWidth: 9,
    borderStyle: 'solid',
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
  },
})
