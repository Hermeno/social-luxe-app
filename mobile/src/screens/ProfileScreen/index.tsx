import React, { useState, useEffect, useCallback } from 'react'
import { View, Text, Image, TouchableOpacity, FlatList, RefreshControl, StyleSheet, Alert, Switch, ActivityIndicator } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import * as ImagePicker from 'expo-image-picker'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useNavigation, useRoute, RouteProp, useFocusEffect } from '@react-navigation/native'
import { StackNavigationProp } from '@react-navigation/stack'
import { useAuthStore } from '../../store/auth.store'
import { api } from '../../services/api'
import { Post, User } from '../../types'
import { AppStackParams } from '../../navigation/AppNavigator'
import { colors, spacing, fonts, radius } from '../../theme'
import ProfileTop from './ProfileTop'
import EditProfileSheet from './EditProfileSheet'
import FollowersSheet from './FollowersSheet'
import QRModal from '../../components/QRModal'
import AvatarImage from '../../components/AvatarImage'
import * as friendService from '../../services/friendship.service'
import * as followService from '../../services/follow.service'
import { API_BASE } from '../../config'

type Nav   = StackNavigationProp<AppStackParams>
type Route = RouteProp<AppStackParams, 'Profile'>

export default function ProfileScreen() {
  const { user: me, logout, loadUser } = useAuthStore()
  const nav   = useNavigation<Nav>()
  const route = useRoute<Route>()
  const { top } = useSafeAreaInsets()

  const viewingId  = route.params?.userId && route.params.userId !== me?.id ? route.params.userId : null
  const isOwn      = !viewingId

  const [profile, setProfile]         = useState<User | null>(isOwn ? me : null)
  const [posts, setPosts]             = useState<Post[]>([])
  const [editOpen, setEditOpen]       = useState(false)
  const [ghostMode, setGhostMode]     = useState(me?.ghostMode ?? false)
  const [loading, setLoading]         = useState(!isOwn)
  const [isFriend, setIsFriend]       = useState(false)
  const [followerCount, setFollowerCount] = useState(0)
  const [followingCount, setFollowingCount] = useState(0)
  const [showFollowSheet, setShowFollowSheet] = useState(false)
  const [followSheetMode, setFollowSheetMode] = useState<'followers' | 'following'>('followers')
  const [showQR, setShowQR] = useState(false)

  const targetId = viewingId ?? me?.id ?? ''

  useFocusEffect(useCallback(() => {
    load()
  }, [targetId]))

  async function load() {
    setLoading(true)
    try {
      const [userRes, postsRes, followersRes, followingRes] = await Promise.all([
        isOwn ? Promise.resolve({ data: { data: me } }) : api.get(`/users/${targetId}`),
        api.get(`/users/${targetId}/posts`),
        followService.getUserFollowers(targetId),
        followService.getUserFollowing(targetId),
      ])
      const p = userRes.data.data as User
      setProfile(p)
      setPosts(postsRes.data.data)
      setFollowerCount(followersRes.length)
      setFollowingCount(followingRes.length)
      if (isOwn) setGhostMode(p.ghostMode)

      if (!isOwn) {
        const level = await friendService.getFriendshipLevel(targetId).catch(() => null)
        setIsFriend(!!level?.isFriend)
      }
    } catch {}
    setLoading(false)
  }

  function openFollowSheet(mode: 'followers' | 'following') {
    setFollowSheetMode(mode)
    setShowFollowSheet(true)
  }

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
    load()
  }

  async function toggleGhostMode(val: boolean) {
    setGhostMode(val)
    try { await api.put('/users/profile', { ghostMode: val }); await loadUser() }
    catch { setGhostMode(!val) }
  }

  async function handleAddFriend() {
    Alert.alert('Duração da amizade', 'Por quanto tempo?', [
      { text: '1 dia',       onPress: () => sendFriend('ONE_DAY') },
      { text: '7 dias',      onPress: () => sendFriend('SEVEN_DAYS') },
      { text: '30 dias',     onPress: () => sendFriend('THIRTY_DAYS') },
      { text: 'Permanente',  onPress: () => sendFriend('PERMANENT') },
    ])
  }

  async function sendFriend(duration: string) {
    try { await friendService.addFriend(targetId, duration as any); load() }
    catch (e: any) { Alert.alert('Erro', e.message) }
  }

  async function handleMessage() {
    if (!profile) return
    nav.navigate('Chat', { userId: profile.id, userName: profile.name, userAvatar: profile.avatar })
  }

  if (loading) {
    return (
      <View style={[s.container, s.center, { paddingTop: top }]}>
        <ActivityIndicator color={colors.primary} />
      </View>
    )
  }

  return (
    <View style={[s.container, { paddingTop: top }]}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => nav.goBack()} style={s.backBtn}>
          <Ionicons name="chevron-back" size={26} color={colors.gray800} />
        </TouchableOpacity>
        <Text style={s.title}>{profile?.name ?? ''}</Text>
        {isOwn ? (
          <View style={{ flexDirection: 'row', gap: 12 }}>
            <TouchableOpacity onPress={() => setShowQR(true)}>
              <Ionicons name="qr-code-outline" size={22} color={colors.gray600} />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => Alert.alert('Logout', 'Sair da conta?', [{ text: 'Cancelar' }, { text: 'Sair', style: 'destructive', onPress: logout }])}>
              <Ionicons name="log-out-outline" size={22} color={colors.gray600} />
            </TouchableOpacity>
          </View>
        ) : <View style={{ width: 22 }} />}
      </View>

      <FlatList
        data={posts}
        keyExtractor={(p) => p.id}
        numColumns={3}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor={colors.primary} />}
        ListHeaderComponent={
          <>
            {isOwn ? (
              <ProfileTop
                avatarUri={profile?.avatar ?? null}
                bio={profile?.bio ?? undefined}
                postsCount={posts.length}
                followerCount={followerCount}
                followingCount={followingCount}
                availability={profile?.availability}
                onPickAvatar={pickAvatar}
                onEdit={() => setEditOpen(true)}
                onShowFollowers={() => openFollowSheet('followers')}
                onShowFollowing={() => openFollowSheet('following')}
              />
            ) : (
              <View style={s.otherHeader}>
                <AvatarImage uri={profile?.avatar} size={80} borderColor={colors.primary} borderWidth={2} />
                <View style={s.otherInfo}>
                  <Text style={s.otherName}>{profile?.name}</Text>
                  {profile?.bio ? <Text style={s.otherBio}>{profile.bio}</Text> : null}
                  {profile?.availability ? <Text style={s.otherAvail}>● {profile.availability}</Text> : null}
                  <View style={s.otherStats}>
                    <Text style={s.otherStatItem}>{posts.length} posts</Text>
                    <TouchableOpacity onPress={() => openFollowSheet('followers')}>
                      <Text style={s.otherStatItem}>{followerCount} seguidores</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => openFollowSheet('following')}>
                      <Text style={s.otherStatItem}>{followingCount} seguindo</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            )}

            {!isOwn && (
              <View style={s.actionRow}>
                <TouchableOpacity style={[s.actionBtn, s.primaryBtn]} onPress={handleMessage} activeOpacity={0.8}>
                  <Ionicons name="chatbubble-ellipses-outline" size={17} color={colors.white} />
                  <Text style={s.primaryBtnText}>Mensagem</Text>
                </TouchableOpacity>
                {isFriend ? (
                  <TouchableOpacity style={[s.actionBtn, s.outlineBtn]} activeOpacity={0.8}>
                    <Ionicons name="checkmark-outline" size={17} color={colors.gray600} />
                    <Text style={s.outlineBtnText}>Amigos</Text>
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity style={[s.actionBtn, s.outlineBtn]} onPress={handleAddFriend} activeOpacity={0.8}>
                    <Ionicons name="person-add-outline" size={17} color={colors.gray800} />
                    <Text style={s.outlineBtnText}>Adicionar</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}

            {isOwn && (
              <>
                <View style={s.quickRow}>
                  <TouchableOpacity style={s.quickBtn} onPress={() => nav.navigate('Bookmarks')}>
                    <Ionicons name="bookmark-outline" size={20} color={colors.gray600} />
                    <Text style={s.quickLabel}>Salvos</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={s.quickBtn} onPress={() => nav.navigate('Highlights', { userId: me?.id ?? '' })}>
                    <Ionicons name="star-outline" size={20} color={colors.gray600} />
                    <Text style={s.quickLabel}>Destaques</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={s.quickBtn} onPress={() => nav.navigate('Coins')}>
                    <Ionicons name="logo-bitcoin" size={20} color={colors.gray600} />
                    <Text style={s.quickLabel}>{me?.coinBalance ?? 0} coins</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={s.quickBtn} onPress={() => nav.navigate('FriendshipMap')}>
                    <Ionicons name="git-network-outline" size={20} color={colors.gray600} />
                    <Text style={s.quickLabel}>Mapa</Text>
                  </TouchableOpacity>
                </View>
                <View style={s.ghostRow}>
                  <View style={s.ghostLeft}>
                    <Ionicons name="eye-off-outline" size={20} color={ghostMode ? colors.primary : colors.gray600} />
                    <View>
                      <Text style={[s.ghostTitle, ghostMode && s.ghostActive]}>Modo Fantasma</Text>
                      <Text style={s.ghostSub}>Seus posts não registram visualizações</Text>
                    </View>
                  </View>
                  <Switch value={ghostMode} onValueChange={toggleGhostMode}
                    trackColor={{ false: colors.gray200, true: `${colors.primary}66` }}
                    thumbColor={ghostMode ? colors.primary : colors.gray400} />
                </View>
              </>
            )}

            <Text style={s.gridTitle}>Posts</Text>
          </>
        }
        renderItem={({ item }) => (
          <Image
            source={{ uri: item.mediaUrl ?? ''.startsWith('http') ? item.mediaUrl ?? '' : `${API_BASE}${item.mediaUrl ?? ''}` }}
            style={s.grid}
            resizeMode="cover"
          />
        )}
      />

      {isOwn && <EditProfileSheet visible={editOpen} onClose={() => setEditOpen(false)} />}
      {isOwn && profile && (
        <QRModal visible={showQR} userId={profile.id} userName={profile.name} onClose={() => setShowQR(false)} />
      )}

      <FollowersSheet
        visible={showFollowSheet}
        mode={followSheetMode}
        userId={targetId}
        onClose={() => setShowFollowSheet(false)}
      />
    </View>
  )
}

const s = StyleSheet.create({
  container:      { flex: 1, backgroundColor: colors.white },
  center:         { alignItems: 'center', justifyContent: 'center' },
  header:         { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.md, paddingBottom: spacing.sm, gap: spacing.sm },
  backBtn:        { marginRight: 4 },
  title:          { flex: 1, fontSize: 18, fontFamily: fonts.bold, color: colors.gray800 },
  otherHeader:    { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.md, paddingVertical: spacing.md, gap: spacing.md },
  otherInfo:      { flex: 1, gap: 4 },
  otherName:      { fontSize: 18, fontFamily: fonts.bold, color: colors.gray800 },
  otherBio:       { fontSize: 13, fontFamily: fonts.regular, color: colors.gray600 },
  otherAvail:     { fontSize: 12, fontFamily: fonts.regular, color: colors.gray400 },
  otherStats:     { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 2 },
  otherStatItem:  { fontSize: 12, fontFamily: fonts.medium, color: colors.gray600 },
  actionRow:      { flexDirection: 'row', gap: spacing.sm, paddingHorizontal: spacing.md, marginBottom: spacing.md },
  actionBtn:      { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, borderRadius: radius.md },
  primaryBtn:     { backgroundColor: colors.primary },
  primaryBtnText: { color: colors.white, fontFamily: fonts.semiBold, fontSize: 14 },
  outlineBtn:     { borderWidth: 1.5, borderColor: colors.gray200 },
  outlineBtnText: { color: colors.gray800, fontFamily: fonts.semiBold, fontSize: 14 },
  quickRow:       { flexDirection: 'row', paddingHorizontal: spacing.md, marginBottom: spacing.md, gap: spacing.sm },
  quickBtn:       { flex: 1, alignItems: 'center', gap: 4, backgroundColor: colors.gray100, borderRadius: radius.md, paddingVertical: spacing.sm },
  quickLabel:     { fontSize: 10, fontFamily: fonts.medium, color: colors.gray600 },
  ghostRow:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginHorizontal: spacing.md, marginBottom: spacing.md, backgroundColor: colors.gray100, borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  ghostLeft:      { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flex: 1 },
  ghostTitle:     { fontSize: 14, fontFamily: fonts.semiBold, color: colors.gray800 },
  ghostActive:    { color: colors.primary },
  ghostSub:       { fontSize: 11, color: colors.gray400, fontFamily: fonts.regular },
  gridTitle:      { fontSize: 13, fontFamily: fonts.semiBold, color: colors.gray400, paddingHorizontal: spacing.md, marginBottom: spacing.xs },
  grid:           { width: '33.33%', aspectRatio: 1, padding: 1 },
})
