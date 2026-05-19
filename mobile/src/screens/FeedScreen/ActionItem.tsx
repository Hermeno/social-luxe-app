import React, { useRef } from 'react'
import { Animated, View, Text, TouchableWithoutFeedback, StyleSheet } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { colors } from '../../theme'

type IonName = React.ComponentProps<typeof Ionicons>['name']
interface Props {
  icon: IonName
  size?: number
  count?: string
  onPress?: () => void
  circleStyle?: any
}

export default function ActionItem({ icon, size = 26, count, onPress, circleStyle }: Props) {
  const scale = useRef(new Animated.Value(1)).current

  function onPressIn() {
    Animated.spring(scale, { toValue: 0.82, useNativeDriver: true, speed: 40, bounciness: 6 }).start()
  }
  function onPressOut() {
    Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 20, bounciness: 12 }).start()
    onPress?.()
  }

  return (
    <TouchableWithoutFeedback onPressIn={onPressIn} onPressOut={onPressOut}>
      <Animated.View style={[s.item, { transform: [{ scale }] }]}>
        <View style={[s.circle, circleStyle]}>
          <Ionicons name={icon} size={size} color={colors.white} />
        </View>
        {count !== undefined && <Text style={s.count}>{count}</Text>}
      </Animated.View>
    </TouchableWithoutFeedback>
  )
}

const s = StyleSheet.create({
  item:  { alignItems: 'center', gap: 5 },
  circle:{ width: 52, height: 52, borderRadius: 26, backgroundColor: 'rgba(0,0,0,0.32)', alignItems: 'center', justifyContent: 'center' },
  count: { color: '#fff', fontSize: 13, fontWeight: '700' as const },
})
