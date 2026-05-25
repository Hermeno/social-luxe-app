import React, { useState, useRef } from 'react'
import { View, Text, Pressable, TouchableOpacity, StyleSheet, Alert, Animated } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useNavigation } from '@react-navigation/native'
import { StackNavigationProp } from '@react-navigation/stack'
import { UserSummary, addFriend } from '../../services/friendship.service'
import { FriendshipDuration } from '../../types'
import { AppStackParams } from '../../navigation/AppNavigator'
import { colors, spacing, radius, fonts } from '../../theme'
import AvatarImage from '../../components/AvatarImage'

type Nav = StackNavigationProp<AppStackParams>
interface Props { user: UserSummary; onAdded: () => void }

const DURATIONS: { label: string; value: FriendshipDuration }[] = [
  { label: '1 dia',      value: 'ONE_DAY' },
  { label: '7 dias',     value: 'SEVEN_DAYS' },
  { label: '30 dias',    value: 'THIRTY_DAYS' },
  { label: 'Permanente', value: 'PERMANENT' },
]

export default function UserCard({ user, onAdded }: Props) {
  const nav = useNavigation<Nav>()
  const [adding, setAdding]   = useState(false)
  const [added, setAdded]     = useState(false)
  const scaleAnim = useRef(new Animated.Value(1)).current

  function bounce() {
    Animated.sequence([
      Animated.spring(scaleAnim, { toValue: 0.82, useNativeDriver: true, speed: 60, bounciness: 0 }),
      Animated.spring(scaleAnim, { toValue: 1,    useNativeDriver: true, speed: 20, bounciness: 14 }),
    ]).start()
  }

  function pickDuration() {
    if (added) return
    bounce()
    Alert.alert('Duração da amizade', 'Por quanto tempo?',
      DURATIONS.map((d) => ({ text: d.label, onPress: () => sendRequest(d.value) }))
    )
  }

  async function sendRequest(duration: FriendshipDuration) {
    setAdding(true)
    try {
      await addFriend(user.id, duration)
      setAdded(true)
      onAdded()
    } catch (e: unknown) {
      Alert.alert('Erro', e instanceof Error ? e.message : 'Falhou')
    } finally { setAdding(false) }
  }

  return (
    <View style={s.row}>
      <TouchableOpacity onPress={() => nav.navigate('Profile', { userId: user.id })} activeOpacity={0.8}>
        <AvatarImage uri={user.avatar} size={50} />
      </TouchableOpacity>

      <TouchableOpacity style={s.info} onPress={() => nav.navigate('Profile', { userId: user.id })} activeOpacity={0.7}>
        <Text style={s.name}>{user.name}</Text>
        {user.bio && <Text style={s.bio} numberOfLines={1}>{user.bio}</Text>}
      </TouchableOpacity>

      <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
        <Pressable
          style={[s.addBtn, added && s.addedBtn, adding && s.addOff]}
          onPress={pickDuration}
          disabled={adding || added}
        >
          <Ionicons
            name={added ? 'checkmark-outline' : 'person-add-outline'}
            size={16}
            color={added ? colors.gray400 : colors.gray800}
          />
          <Text style={[s.addTxt, added && s.addedTxt]}>
            {added ? 'Adicionado' : 'Adicionar'}
          </Text>
        </Pressable>
      </Animated.View>
    </View>
  )
}

const s = StyleSheet.create({
  row:     { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.md, paddingVertical: 10, gap: spacing.sm },
  info:    { flex: 1 },
  name:    { fontSize: 15, fontFamily: fonts.semiBold, color: colors.gray800 },
  bio:     { fontSize: 12, fontFamily: fonts.regular, color: colors.gray400, marginTop: 2 },
  addBtn:  {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    borderWidth: 1.5, borderColor: colors.gray200,
    borderRadius: radius.full,
    paddingHorizontal: 14, paddingVertical: 7,
  },
  addedBtn:{ borderColor: colors.gray200, backgroundColor: colors.gray100 },
  addOff:  { opacity: 0.45 },
  addTxt:  { fontFamily: fonts.semiBold, fontSize: 13, color: colors.gray800 },
  addedTxt:{ color: colors.gray400 },
})
