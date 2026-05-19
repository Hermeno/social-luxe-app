import React from 'react'
import { View, Text, Image, TouchableOpacity, StyleSheet } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { colors, spacing } from '../../theme'

interface Props { userName: string; avatarUri: string; onBack: () => void }

export default function ChatHeader({ userName, avatarUri, onBack }: Props) {
  return (
    <View style={s.header}>
      <TouchableOpacity onPress={onBack} style={s.back}>
        <Ionicons name="chevron-back" size={26} color={colors.gray800} />
      </TouchableOpacity>
      <Image source={{ uri: avatarUri }} style={s.avatar} />
      <View style={s.info}>
        <Text style={s.name}>{userName}</Text>
        <Ionicons name="checkmark-circle" size={14} color={colors.primary} />
      </View>
      <TouchableOpacity>
        <Ionicons name="ellipsis-horizontal" size={22} color={colors.gray800} />
      </TouchableOpacity>
    </View>
  )
}

const s = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderBottomWidth: 1, borderColor: colors.gray200, gap: spacing.sm },
  back:   { marginRight: 4 },
  avatar: { width: 40, height: 40, borderRadius: 20 },
  info:   { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 4 },
  name:   { fontSize: 17, fontWeight: '600' as const, color: colors.gray800 },
})
