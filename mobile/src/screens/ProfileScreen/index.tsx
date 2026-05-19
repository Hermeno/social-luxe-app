import React, { useState, useEffect } from 'react'
import { View, Text, Image, TouchableOpacity, FlatList, StyleSheet, Alert } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import * as ImagePicker from 'expo-image-picker'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useNavigation } from '@react-navigation/native'
import { StackNavigationProp } from '@react-navigation/stack'
import { useAuthStore } from '../../store/auth.store'
import { api } from '../../services/api'
import { Post } from '../../types'
import { AppStackParams } from '../../navigation/AppNavigator'
import { colors, spacing } from '../../theme'
import ProfileTop from './ProfileTop'
import EditProfileSheet from './EditProfileSheet'
const API_BASE = 'http://192.168.43.184:3000'
type Nav = StackNavigationProp<AppStackParams>
export default function ProfileScreen() {
  const { user, logout, loadUser } = useAuthStore()
  const nav = useNavigation<Nav>()
  const { top } = useSafeAreaInsets()
  const [posts, setPosts]       = useState<Post[]>([])
  const [editOpen, setEditOpen] = useState(false)
  useEffect(() => {
    if (!user) return
    api.get(`/users/${user.id}/posts`).then((r) => setPosts(r.data.data)).catch(() => {})
  }, [user])

  async function pickAvatar() {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (status !== 'granted') return Alert.alert('Permissão necessária', 'Precisamos de acesso à galeria.')
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, allowsEditing: true, aspect: [1, 1], quality: 0.8 })
    if (result.canceled || !result.assets[0]) return
    const uri = result.assets[0].uri
    const form = new FormData()
    form.append('avatar', { uri, name: 'avatar.jpg', type: 'image/jpeg' } as any)
    await api.put('/users/profile', form, { headers: { 'Content-Type': 'multipart/form-data' } })
    await loadUser()
  }
  const avatarUri = user?.avatar ? `${API_BASE}${user.avatar}` : null
  return (
    <View style={[s.container, { paddingTop: top }]}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => nav.goBack()} style={s.backBtn}>
          <Ionicons name="chevron-back" size={26} color={colors.gray800} />
        </TouchableOpacity>
        <Text style={s.title}>{user?.name}</Text>
        <TouchableOpacity onPress={() => Alert.alert('Logout', 'Sair da conta?', [{ text: 'Cancelar' }, { text: 'Sair', style: 'destructive', onPress: logout }])}>
          <Ionicons name="log-out-outline" size={22} color={colors.gray600} />
        </TouchableOpacity>
      </View>
      <ProfileTop avatarUri={avatarUri} bio={user?.bio ?? undefined} postsCount={posts.length}
        availability={user?.availability} onPickAvatar={pickAvatar} onEdit={() => setEditOpen(true)} />
      <FlatList data={posts} keyExtractor={(p) => p.id} numColumns={3}
        renderItem={({ item }) => (
          <Image source={{ uri: `${API_BASE}${item.mediaUrl}` }} style={s.grid} resizeMode="cover" />
        )}
        showsVerticalScrollIndicator={false} />
      <EditProfileSheet visible={editOpen} onClose={() => setEditOpen(false)} />
    </View>
  )
}
const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.white },
  header:    { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.md, paddingBottom: spacing.sm, gap: spacing.sm },
  backBtn:   { marginRight: 4 },
  title:     { flex: 1, fontSize: 18, fontWeight: '700' as const, color: colors.gray800 },
  grid:      { width: '33.33%', aspectRatio: 1, padding: 1 },
})
