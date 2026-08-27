import React from 'react'
import { View, Text, StyleSheet, ViewStyle } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { colors, fonts, radius } from '../theme'

interface Props {
  streakDays: number
  style?: ViewStyle
}

export default function StreakBadge({ streakDays, style }: Props) {
  if (streakDays <= 0) return null

  return (
    <View style={[s.badge, style]}>
      <Ionicons name="flame" size={13} color={colors.warning} />
      <Text style={s.count}>{streakDays}</Text>
    </View>
  )
}

const s = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#1A1A1A',
    borderWidth: 1.5,
    borderColor: colors.warning,
    borderRadius: radius.full,
    paddingHorizontal: 8,
    paddingVertical: 3,
    alignSelf: 'flex-start',
  },
  count: { color: colors.warning, fontFamily: fonts.bold, fontSize: 12 },
})
