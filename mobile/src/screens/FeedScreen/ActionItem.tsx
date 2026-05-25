import React, { useRef, useEffect, useState } from 'react'
import { Animated, View, Text, TouchableWithoutFeedback, StyleSheet, Easing } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { colors, fonts } from '../../theme'

type IonName = React.ComponentProps<typeof Ionicons>['name']
interface Props {
  icon: IonName
  size?: number
  count?: string
  onPress?: () => void
  onLongPress?: () => void
  circleStyle?: any
  spinOnPress?: boolean
  continuousSpin?: boolean
}

export default function ActionItem({
  icon, size = 28, count, onPress, onLongPress, circleStyle, spinOnPress, continuousSpin,
}: Props) {
  const containerScale = useRef(new Animated.Value(1)).current
  const iconRotation   = useRef(new Animated.Value(0)).current
  const spinLoop       = useRef(new Animated.Value(0)).current
  const circleOpacity  = useRef(new Animated.Value(0)).current
  const [pressed, setPressed] = useState(false)

  useEffect(() => {
    if (!continuousSpin) return
    const loop = Animated.loop(
      Animated.timing(spinLoop, {
        toValue: 1,
        duration: 5000,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    )
    loop.start()
    return () => loop.stop()
  }, [continuousSpin])

  function onPressIn() {
    setPressed(true)
    Animated.parallel([
      Animated.spring(containerScale, {
        toValue: 0.80, useNativeDriver: true, speed: 40, bounciness: 6,
      }),
      Animated.timing(circleOpacity, {
        toValue: 1, duration: 80, useNativeDriver: true,
      }),
    ]).start()
  }

  function onPressOut() {
    setPressed(false)
    Animated.parallel([
      Animated.spring(containerScale, {
        toValue: 1, useNativeDriver: true, speed: 20, bounciness: 14,
      }),
      Animated.timing(circleOpacity, {
        toValue: 0, duration: 200, useNativeDriver: true,
      }),
    ]).start()

    if (spinOnPress) {
      iconRotation.setValue(0)
      Animated.timing(iconRotation, {
        toValue: 1,
        duration: 420,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start()
    }

    onPress?.()
  }

  const iconSpin = spinOnPress
    ? iconRotation.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] })
    : continuousSpin
    ? spinLoop.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] })
    : '0deg'

  return (
    <TouchableWithoutFeedback onPressIn={onPressIn} onPressOut={onPressOut} onLongPress={onLongPress}>
      <Animated.View style={[s.item, { transform: [{ scale: containerScale }] }]}>
        <View style={[s.circle, circleStyle]}>
          {/* pressed highlight overlay */}
          <Animated.View style={[s.pressOverlay, { opacity: circleOpacity }]} />
          <Animated.View style={{ transform: [{ rotate: iconSpin }] }}>
            <Ionicons name={icon} size={size} color={colors.white} />
          </Animated.View>
        </View>
        {count !== undefined && <Text style={s.count}>{count}</Text>}
      </Animated.View>
    </TouchableWithoutFeedback>
  )
}

const s = StyleSheet.create({
  item:         { alignItems: 'center', gap: 2 },
  circle:       {
    width: 44, height: 44, borderRadius: 22,
    alignItems: 'center', justifyContent: 'center',
    overflow: 'hidden',
  },
  pressOverlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(255,255,255,0.14)',
    borderRadius: 25,
  },
  count:        {
    color: colors.white,
    fontFamily: fonts.bold,
    fontSize: 13,
    letterSpacing: -0.2,
  },
})
