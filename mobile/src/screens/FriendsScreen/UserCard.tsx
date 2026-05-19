import React, { useState } from 'react'
import { View, Text, Image, Pressable, StyleSheet, Alert } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { UserSummary, addFriend } from '../../services/friendship.service'
import { FriendshipDuration } from '../../types'
import { colors, spacing, radius } from '../../theme'

interface Props { user: UserSummary; onAdded: () => void }

const DURATIONS: { label: string; value: FriendshipDuration }[] = [
  { label: '1 dia',      value: 'ONE_DAY' },
  { label: '7 dias',     value: 'SEVEN_DAYS' },
  { label: '30 dias',    value: 'THIRTY_DAYS' },
  { label: 'Permanente', value: 'PERMANENT' },
]

export default function UserCard({ user, onAdded }: Props) {
  const [adding, setAdding] = useState(false)
  const uri = user.avatar ?? `https://ui-avatars.com/api/?name=${user.name}&background=FF4B6E&color=fff`

  function pickDuration() {
    Alert.alert('Duração da amizade', 'Por quanto tempo?',
      DURATIONS.map((d) => ({
        text: d.label,
        onPress: () => sendRequest(d.value),
      }))
    )
  }

  async function sendRequest(duration: FriendshipDuration) {
    setAdding(true)
    try {
      await addFriend(user.id, duration)
      Alert.alert('Amizade enviada!', `Você e ${user.name} são amigos agora.`)
      onAdded()
    } catch (e: unknown) {
      Alert.alert('Erro', e instanceof Error ? e.message : 'Falhou')
    } finally { setAdding(false) }
  }

  return (
    <View style={s.row}>
      <Image source={{ uri }} style={s.avatar} />
      <View style={s.info}>
        <Text style={s.name}>{user.name}</Text>
        {user.bio && <Text style={s.bio} numberOfLines={1}>{user.bio}</Text>}
      </View>
      <Pressable style={({ pressed }) => [s.addBtn, adding && s.addOff, { transform: [{ scale: pressed ? 0.91 : 1 }] }]} onPress={pickDuration} disabled={adding}>
        <Ionicons name="person-add-outline" size={16} color={colors.white} />
        <Text style={s.addTxt}>Adicionar</Text>
      </Pressable>
    </View>
  )
}

const s = StyleSheet.create({
  row:    { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.md, paddingVertical: spacing.sm, gap: spacing.sm },
  avatar: { width: 50, height: 50, borderRadius: 25 },
  info:   { flex: 1 },
  name:   { fontSize: 14, fontWeight: '600' as const, color: colors.gray800 },
  bio:    { fontSize: 12, color: colors.gray400, marginTop: 2 },
  addBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: colors.primary, borderRadius: radius.full, paddingHorizontal: spacing.md, paddingVertical: 7 },
  addOff: { opacity: 0.5 },
  addTxt: { color: colors.white, fontSize: 12, fontWeight: '700' as const },
})
