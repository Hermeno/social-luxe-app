import React from 'react'
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { colors, fonts, spacing } from '../../theme'
import AvatarImage from '../../components/AvatarImage'
import SegmentedRing from '../../components/SegmentedRing'
import { useT } from '../../i18n'

const AV_SIZE    = 30
const RING_OUTER = AV_SIZE + 6  // 36

interface Props {
  userName: string
  avatarUri: string | null
  hasPosts: boolean
  isOnline: boolean
  isTyping: boolean
  onBack: () => void
  onSchedule: () => void
  onProfilePress: () => void
  hasScheduled: boolean
  isLiveChat: boolean
  hasSharedLive: boolean
  onShareLive: () => void
}

export default function ChatHeader({
  userName, avatarUri, hasPosts, isOnline, isTyping,
  onBack, onProfilePress, isLiveChat, hasSharedLive, onShareLive,
}: Props) {
  const t = useT()
  const statusText = isTyping ? t.chat_typing : isOnline ? t.chat_online : t.chat_offline

  function renderLiveBtn() {
    if (!isLiveChat) return null
    return (
      <TouchableOpacity onPress={onShareLive} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} style={s.liveChip}>
        <View style={s.liveChipDot} />
        <Text style={s.liveChipTxt}>{hasSharedLive ? 'ao vivo' : 'partilhar'}</Text>
      </TouchableOpacity>
    )
  }

  return (
    <View style={s.header}>
      <TouchableOpacity onPress={onBack} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
        <Ionicons name="chevron-back" size={26} color="#000" />
      </TouchableOpacity>

      <TouchableOpacity onPress={onProfilePress} activeOpacity={0.75}>
        <View style={s.avatarOuter}>
          {hasPosts && (
            <SegmentedRing count={1} size={RING_OUTER} strokeWidth={1.5} />
          )}
          <View style={s.avatarInner}>
            <View style={s.avatarCircle}>
              <AvatarImage uri={avatarUri} name={userName} size={AV_SIZE} borderWidth={0} borderColor="transparent" />
            </View>
          </View>
        </View>
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
        {renderLiveBtn()}
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
    gap: 12,
  },

  avatarOuter: {
    width:           RING_OUTER,
    height:          RING_OUTER,
    alignItems:      'center',
    justifyContent:  'center',
  },
  avatarInner: {
    position:        'absolute',
    alignItems:      'center',
    justifyContent:  'center',
  },
  avatarCircle: {
    width:           AV_SIZE,
    height:          AV_SIZE,
    borderRadius:    AV_SIZE / 2,
    overflow:        'hidden',
  },

  info:   { flex: 1, minWidth: 0 },
  name:   { fontSize: 16, fontFamily: fonts.semiBold, color: colors.gray800, letterSpacing: -0.3 },

  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 1 },
  onlineDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#22C55E' },
  status:    { fontSize: 12, fontFamily: fonts.regular },

  actions: { alignItems: 'center', justifyContent: 'center' },

  liveChip: {
    flexDirection:  'row',
    alignItems:     'center',
    gap:            5,
    backgroundColor: '#22C55E',
    paddingHorizontal: 10,
    paddingVertical:  4,
    borderRadius:    20,
  },
  liveChipDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#fff' },
  liveChipTxt: { fontSize: 12, fontFamily: fonts.semiBold, color: '#fff' },
})
