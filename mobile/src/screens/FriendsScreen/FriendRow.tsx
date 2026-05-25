import React from 'react'
import { View, Text, TouchableOpacity, StyleSheet, Animated } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useNavigation } from '@react-navigation/native'
import { StackNavigationProp } from '@react-navigation/stack'
import { Friendship, FriendshipDuration } from '../../types'
import { AppStackParams } from '../../navigation/AppNavigator'
import { colors, spacing, radius, fonts } from '../../theme'
import AvatarImage from '../../components/AvatarImage'

type Nav = StackNavigationProp<AppStackParams>

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
  const nav = useNavigation<Nav>()
  const left = daysLeft(item.expiresAt)

  function goProfile() {
    nav.navigate('Profile', { userId: item.friend.id })
  }

  function goChat() {
    nav.navigate('Chat', {
      userId: item.friend.id,
      userName: item.friend.name,
      userAvatar: item.friend.avatar,
    })
  }

  return (
    <View style={s.row}>
      <TouchableOpacity onPress={goProfile} activeOpacity={0.8}>
        <AvatarImage uri={item.friend.avatar} size={50} />
      </TouchableOpacity>

      <TouchableOpacity style={s.info} onPress={goProfile} activeOpacity={0.7}>
        <Text style={s.name}>{item.friend.name}</Text>
        <Text style={s.dur}>{LABELS[item.duration]}</Text>
        {left && <Text style={[s.left, left.includes('h') && s.urgent]}>{left}</Text>}
      </TouchableOpacity>

      <TouchableOpacity style={s.chatBtn} onPress={goChat} activeOpacity={0.75}>
        <Ionicons name="chatbubble-ellipses-outline" size={20} color={colors.primary} />
      </TouchableOpacity>

      <TouchableOpacity style={s.renewBtn} onPress={onRenew} activeOpacity={0.75}>
        <Ionicons name="refresh-outline" size={15} color={colors.primary} />
      </TouchableOpacity>

      <TouchableOpacity onPress={onRemove} activeOpacity={0.75} style={s.removeBtn}>
        <Ionicons name="close-outline" size={22} color={colors.gray400} />
      </TouchableOpacity>
    </View>
  )
}

const s = StyleSheet.create({
  row:      { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.md, paddingVertical: 10, gap: spacing.sm },
  info:     { flex: 1 },
  name:     { fontSize: 15, fontFamily: fonts.semiBold, color: colors.gray800 },
  dur:      { fontSize: 12, fontFamily: fonts.regular, color: colors.gray400, marginTop: 2 },
  left:     { fontSize: 11, fontFamily: fonts.medium, color: colors.gray600, marginTop: 1 },
  urgent:   { color: colors.primary },
  chatBtn:  { width: 38, height: 38, borderRadius: 19, borderWidth: 1.5, borderColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  renewBtn: { width: 34, height: 34, borderRadius: 17, borderWidth: 1, borderColor: colors.gray200, alignItems: 'center', justifyContent: 'center' },
  removeBtn:{ padding: 4 },
})
