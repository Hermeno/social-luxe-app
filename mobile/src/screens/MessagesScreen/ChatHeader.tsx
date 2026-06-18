import React from 'react'
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { colors, fonts, spacing } from '../../theme'
import AvatarImage from '../../components/AvatarImage'
import { useT } from '../../i18n'

interface Props {
  userName: string
  avatarUri: string | null
  isOnline: boolean
  isTyping: boolean
  onBack: () => void
  onSchedule: () => void
  onProfilePress: () => void
  hasScheduled: boolean
}

export default function ChatHeader({
  userName, avatarUri, isOnline, isTyping,
  onBack, onSchedule, onProfilePress,
}: Props) {
  const t = useT()
  const statusText = isTyping ? t.chat_typing : isOnline ? t.chat_online : t.chat_offline

  return (
    <View style={s.header}>
      <TouchableOpacity onPress={onBack} style={s.back} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
        <Ionicons name="chevron-back" size={26} color={colors.gray800} />
      </TouchableOpacity>

      <TouchableOpacity onPress={onProfilePress} activeOpacity={0.75}>
        <AvatarImage uri={avatarUri} name={userName} size={44} borderWidth={0} borderColor="transparent" />
      </TouchableOpacity>

      <View style={s.info}>
        <Text style={s.name} numberOfLines={1}>{userName}</Text>
        <View style={s.statusRow}>
          {(isOnline || isTyping) && <View style={s.onlineDot} />}
          <Text style={[s.status, { color: isOnline || isTyping ? '#22C55E' : colors.gray400 }]}>
            {statusText}
          </Text>
        </View>
      </View>

      <View style={s.actions}>
        <View style={s.callBtn}>
          <Ionicons name="videocam-outline" size={20} color="#1A1A1A" />
        </View>
        <View style={s.callBtn}>
          <Ionicons name="call-outline" size={19} color="#1A1A1A" />
        </View>
      </View>
    </View>
  )
}

const s = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    paddingBottom: 10,
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
    gap: 12,
  },
  back:   {},
  info:   { flex: 1, minWidth: 0 },
  name:   { fontSize: 16, fontFamily: fonts.semiBold, color: colors.gray800, letterSpacing: -0.3 },

  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 1 },
  onlineDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#22C55E' },
  status:    { fontSize: 12, fontFamily: fonts.regular },

  actions: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  callBtn: {
    width: 36, height: 36, borderRadius: 18,
    borderWidth: 1.5, borderColor: '#D1D1D6',
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#F5F5F7',
  },
})
