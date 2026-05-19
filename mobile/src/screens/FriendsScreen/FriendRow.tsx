import React from 'react'
import { View, Text, Image, TouchableOpacity, StyleSheet } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { Friendship, FriendshipDuration } from '../../types'
import { colors, spacing, radius } from '../../theme'

const LABELS: Record<FriendshipDuration, string> = {
  ONE_DAY: '1 dia', THREE_DAYS: '3 dias', SEVEN_DAYS: '7 dias',
  THIRTY_DAYS: '30 dias', PERMANENT: 'Permanente',
}

function daysLeft(expiresAt: string | null) {
  if (!expiresAt) return null
  const h = Math.floor((new Date(expiresAt).getTime() - Date.now()) / 3600000)
  return h < 24 ? `${h}h restantes` : `${Math.floor(h / 24)}d restantes`
}

interface Props { item: Friendship; onRenew: () => void; onRemove: () => void }

export default function FriendRow({ item, onRenew, onRemove }: Props) {
  const uri = item.friend.avatar ?? `https://ui-avatars.com/api/?name=${item.friend.name}&background=FF4B6E&color=fff`
  const left = daysLeft(item.expiresAt)
  return (
    <View style={s.row}>
      <Image source={{ uri }} style={s.avatar} />
      <View style={s.info}>
        <Text style={s.name}>{item.friend.name}</Text>
        <Text style={s.dur}>{LABELS[item.duration]}</Text>
        {left && <Text style={[s.left, Number(left.split('h')[0]) < 24 && s.urgent]}>{left}</Text>}
      </View>
      <TouchableOpacity style={s.renewBtn} onPress={onRenew}>
        <Ionicons name="refresh-outline" size={16} color={colors.primary} />
        <Text style={s.renewText}>Renovar</Text>
      </TouchableOpacity>
      <TouchableOpacity onPress={onRemove}>
        <Ionicons name="close-outline" size={22} color={colors.gray400} />
      </TouchableOpacity>
    </View>
  )
}

const s = StyleSheet.create({
  row:      { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.md, paddingVertical: spacing.sm, gap: spacing.sm },
  avatar:   { width: 50, height: 50, borderRadius: 25 },
  info:     { flex: 1 },
  name:     { fontSize: 14, fontWeight: '600' as const, color: colors.gray800 },
  dur:      { fontSize: 12, color: colors.gray400, marginTop: 2 },
  left:     { fontSize: 11, color: colors.gray600, marginTop: 2 },
  urgent:   { color: colors.primary, fontWeight: '600' as const },
  renewBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: spacing.sm, paddingVertical: 6, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.primary },
  renewText:{ color: colors.primary, fontSize: 12, fontWeight: '600' as const },
})
