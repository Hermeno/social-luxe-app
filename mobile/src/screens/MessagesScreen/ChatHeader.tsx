import React from 'react'
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { colors, fonts, spacing } from '../../theme'
import AvatarImage from '../../components/AvatarImage'

interface Props {
  userName: string
  avatarUri: string | null
  isOnline: boolean
  isTyping: boolean
  onBack: () => void
}

export default function ChatHeader({ userName, avatarUri, isOnline, isTyping, onBack }: Props) {
  const statusText = isTyping ? 'digitando...' : isOnline ? 'online' : 'offline'
  const statusColor = isTyping ? colors.primary : isOnline ? '#22C55E' : colors.gray400

  return (
    <View style={s.header}>
      <TouchableOpacity onPress={onBack} style={s.back} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
        <Ionicons name="chevron-back" size={28} color={colors.gray800} />
      </TouchableOpacity>

      <View style={s.avatarWrap}>
        <AvatarImage uri={avatarUri} size={42} />
        {isOnline && <View style={s.onlineDot} />}
      </View>

      <View style={s.info}>
        <Text style={s.name} numberOfLines={1}>{userName}</Text>
        <Text style={[s.status, { color: statusColor }]}>{statusText}</Text>
      </View>

      <TouchableOpacity style={s.menuBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
        <Ionicons name="ellipsis-vertical" size={20} color={colors.gray600} />
      </TouchableOpacity>
    </View>
  )
}

const s = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    backgroundColor: colors.white,
    gap: 10,
  },
  back:      { marginRight: 2 },
  avatarWrap:{ position: 'relative' },
  onlineDot: {
    position: 'absolute', bottom: 1, right: 1,
    width: 11, height: 11, borderRadius: 6,
    backgroundColor: '#22C55E', borderWidth: 2, borderColor: colors.white,
  },
  info:    { flex: 1 },
  name:    { fontSize: 16, fontFamily: fonts.semiBold, color: colors.gray800, letterSpacing: -0.3 },
  status:  { fontSize: 12, fontFamily: fonts.regular, marginTop: 1 },
  menuBtn: { padding: 4 },
})
