import React, { useState, useEffect } from 'react'
import { Modal, View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { useNavigation } from '@react-navigation/native'
import { StackNavigationProp } from '@react-navigation/stack'
import { AppStackParams } from '../../navigation/AppNavigator'
import { colors, spacing, fonts } from '../../theme'
import AvatarImage from '../../components/AvatarImage'
import * as followService from '../../services/follow.service'
import { FollowUser } from '../../services/follow.service'

interface Props {
  visible: boolean
  mode: 'followers' | 'following'
  userId: string
  onClose: () => void
}

type Nav = StackNavigationProp<AppStackParams>

export default function FollowersSheet({ visible, mode, userId, onClose }: Props) {
  const nav = useNavigation<Nav>()
  const [users, setUsers] = useState<FollowUser[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!visible) return
    setUsers([])
    load()
  }, [visible, userId, mode])

  async function load() {
    setLoading(true)
    try {
      const list = mode === 'followers'
        ? await followService.getUserFollowers(userId)
        : await followService.getUserFollowing(userId)
      setUsers(list)
    } catch {}
    setLoading(false)
  }

  function handleUserPress(user: FollowUser) {
    onClose()
    nav.navigate('Profile', { userId: user.id })
  }

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose} presentationStyle="pageSheet">
      <SafeAreaView style={s.container}>
        <View style={s.header}>
          <Text style={s.title}>{mode === 'followers' ? 'Seguidores' : 'Seguindo'}</Text>
          <TouchableOpacity onPress={onClose} hitSlop={{ top: 12, right: 12, bottom: 12, left: 12 }}>
            <Ionicons name="close" size={22} color={colors.gray600} />
          </TouchableOpacity>
        </View>

        {loading ? (
          <ActivityIndicator style={s.loader} color={colors.primary} />
        ) : (
          <FlatList
            data={users}
            keyExtractor={u => u.id}
            ListEmptyComponent={
              <Text style={s.empty}>
                {mode === 'followers' ? 'Nenhum seguidor ainda' : 'Não segue ninguém ainda'}
              </Text>
            }
            renderItem={({ item }) => (
              <TouchableOpacity style={s.item} onPress={() => handleUserPress(item)} activeOpacity={0.7}>
                <AvatarImage uri={item.avatar} name={item.name} size={46} />
                <View style={s.info}>
                  <Text style={s.name}>{item.name}</Text>
                  {item.bio ? <Text style={s.bio} numberOfLines={1}>{item.bio}</Text> : null}
                </View>
                <Ionicons name="chevron-forward" size={16} color={colors.gray400} />
              </TouchableOpacity>
            )}
          />
        )}
      </SafeAreaView>
    </Modal>
  )
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.white },
  header:    {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.md, paddingVertical: spacing.md,
    borderBottomWidth: 1, borderBottomColor: colors.gray100,
  },
  title:     { fontSize: 16, fontFamily: fonts.bold, color: colors.gray800 },
  loader:    { marginTop: 40 },
  item:      { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.md, paddingVertical: spacing.sm, gap: spacing.sm },
  info:      { flex: 1 },
  name:      { fontSize: 15, fontFamily: fonts.semiBold, color: colors.gray800 },
  bio:       { fontSize: 13, fontFamily: fonts.regular, color: colors.gray400, marginTop: 2 },
  empty:     { textAlign: 'center', color: colors.gray400, fontFamily: fonts.regular, fontSize: 14, marginTop: 40 },
})
