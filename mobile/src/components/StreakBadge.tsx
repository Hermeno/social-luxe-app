import React from 'react'
import { View, Text, StyleSheet, ViewStyle } from 'react-native'
import { fonts, radius } from '../theme'

interface Props {
  streakDays: number
  style?: ViewStyle
}

export default function StreakBadge({ streakDays, style }: Props) {
  if (streakDays <= 0) return null

  return (
    <View style={[s.badge, style]}>
      <Text style={s.fire}>🔥</Text>
      <Text style={s.count}>{streakDays}</Text>
    </View>
  )
}

const s = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#1A1200',
    borderWidth: 1.5,
    borderColor: '#F59E0B',
    borderRadius: radius.full,
    paddingHorizontal: 8,
    paddingVertical: 3,
    alignSelf: 'flex-start',
  },
  fire:  { fontSize: 12 },
  count: { color: '#F59E0B', fontFamily: fonts.bold, fontSize: 12 },
})
