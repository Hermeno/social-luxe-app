import React from 'react'
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { colors, fonts, spacing } from '../../theme'
import AvatarImage from '../../components/AvatarImage'
import SegmentedRing from '../../components/SegmentedRing'
import { useT } from '../../i18n'
import { Pairing } from '../../types'
import { pairingLabel } from '../../services/pairing.service'

const AV_SIZE    = 30
const RING_OUTER = AV_SIZE + 8  // 38 — small visible gap between avatar and ring

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
  pairing: Pairing | null
  myUserId: string
  onInvitePairing: () => void
  onAcceptPairing: () => void
  onDeclinePairing: () => void
  onEndPairing: () => void
}

export default function ChatHeader({
  userName, avatarUri, hasPosts, isOnline, isTyping,
  onBack, onProfilePress, pairing, myUserId,
  onInvitePairing, onAcceptPairing, onDeclinePairing, onEndPairing,
}: Props) {
  const t = useT()
  const statusText = isTyping ? t.chat_typing : isOnline ? t.chat_online : t.chat_offline

  function renderPairingChip() {
    if (!pairing) {
      return (
        <TouchableOpacity onPress={onInvitePairing} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} style={s.chip}>
          <Ionicons name="heart-outline" size={13} color="#0A0A0A" />
          <Text style={s.chipTxt}>Formar par</Text>
        </TouchableOpacity>
      )
    }

    if (pairing.status === 'PENDING') {
      if (pairing.requestedBy === myUserId) {
        return (
          <TouchableOpacity onPress={onEndPairing} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} style={s.chip}>
            <View style={s.pendingDot} />
            <Text style={s.chipTxt}>Convite enviado</Text>
          </TouchableOpacity>
        )
      }
      return (
        <View style={s.pendingActions}>
          <TouchableOpacity onPress={onDeclinePairing} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} style={s.chipGhost}>
            <Ionicons name="close" size={14} color="#0A0A0A" />
          </TouchableOpacity>
          <TouchableOpacity onPress={onAcceptPairing} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} style={s.chip}>
            <Ionicons name="heart" size={13} color="#0A0A0A" />
            <Text style={s.chipTxt}>Aceitar</Text>
          </TouchableOpacity>
        </View>
      )
    }

    return (
      <TouchableOpacity onPress={onEndPairing} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} style={s.chip}>
        <View style={s.liveDot} />
        <Text style={s.chipTxt}>{pairingLabel(pairing)}</Text>
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
        {renderPairingChip()}
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

  chip: {
    flexDirection:  'row',
    alignItems:     'center',
    gap:            6,
    backgroundColor: 'transparent',
    borderWidth:    1.3,
    borderColor:    '#0A0A0A',
    paddingHorizontal: 12,
    paddingVertical:  6,
    borderRadius:    20,
  },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#22C55E' },
  pendingDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#FFB173' },
  chipTxt: { fontSize: 12.5, fontFamily: fonts.semiBold, color: '#0A0A0A' },

  pendingActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  chipGhost: {
    alignItems: 'center', justifyContent: 'center',
    width: 28, height: 28, borderRadius: 14,
    borderWidth: 1.3, borderColor: '#0A0A0A',
  },
})
