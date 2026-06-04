import React, { useState, useCallback } from 'react'
import {
  View, Text, TouchableOpacity, FlatList,
  RefreshControl, StyleSheet, Alert,
  ActivityIndicator, Dimensions,
} from 'react-native'
import { Image } from 'expo-image'
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
import AvatarSection from './AvatarSection'
import AvatarImage from '../../components/AvatarImage'
import EditProfileSheet from './EditProfileSheet'
import FollowersSheet from './FollowersSheet'
import QRModal from '../../components/QRModal'
import * as friendService from '../../services/friendship.service'
import * as followService from '../../services/follow.service'
import { API_BASE } from '../../config'
import { getCache, setCache } from '../../db/database'
import { isConnected } from '../../services/netinfo.service'

type Nav   = StackNavigationProp<AppStackParams>
type Route = RouteProp<AppStackParams, 'Profile'>

const { width: W } = Dimensions.get('window')
const GRID_SIZE    = (W - 3) / 3   // 3 columns, 1.5px gap each side

function resolveUrl(url: string | null): string | null {
  if (!url) return null
  return url.startsWith('http') ? url : `${API_BASE}${url}`
}

export default function ProfileScreen() {
  const { user: me, logout, loadUser } = useAuthStore()
  const nav   = useNavigation<Nav>()
  const route = useRoute<Route>()
  const { top, bottom } = useSafeAreaInsets()

  const viewingId = route.params?.userId && route.params.userId !== me?.id ? route.params.userId : null
  const isOwn     = !viewingId
  const targetId  = viewingId ?? me?.id ?? ''

  const [profile, setProfile]             = useState<User | null>(isOwn ? me : null)
  const [posts, setPosts]                 = useState<Post[]>([])
  const [loading, setLoading]             = useState(!isOwn)
  const [refreshing, setRefreshing]       = useState(false)
  const [followerCount, setFollowerCount] = useState(0)
  const [followingCount, setFollowingCount] = useState(0)
  const [isFriend, setIsFriend]           = useState(false)
  const [isFollowing, setIsFollowing]     = useState(false)
  const [followLoading, setFollowLoading] = useState(false)
  const [editOpen, setEditOpen]           = useState(false)
  const [showQR, setShowQR]               = useState(false)
  const [followSheetMode, setFollowSheetMode] = useState<'followers' | 'following'>('followers')
  const [showFollowSheet, setShowFollowSheet] = useState(false)

  type ProfileCache = {
    user: User; followerCount: number; followingCount: number
    isFollowing: boolean; isFriend: boolean
  }

  useFocusEffect(useCallback(() => {
    let cancelled = false

    async function run() {
      // 1. Serve from SQLite immediately (zero wait)
      const [cachedMeta, cachedPosts] = await Promise.all([
        !isOwn ? getCache<ProfileCache>(`profile:${targetId}`) : null,
        getCache<Post[]>(`profile_posts:${targetId}`),
      ])

      if (!cancelled) {
        if (cachedMeta && !isOwn) {
          setProfile(cachedMeta.user)
          setFollowerCount(cachedMeta.followerCount)
          setFollowingCount(cachedMeta.followingCount)
          setIsFollowing(cachedMeta.isFollowing)
          setIsFriend(cachedMeta.isFriend)
          setLoading(false)
        }
        if (cachedPosts) {
          setPosts(cachedPosts)
          if (isOwn) setLoading(false)
        }
      }

      // 2. Background network sync
      if (!isConnected()) { setLoading(false); setRefreshing(false); return }
      try {
        const [userRes, postsRes, followersRes, followingRes] = await Promise.all([
          isOwn ? Promise.resolve({ data: { data: me } }) : api.get(`/users/${targetId}`),
          api.get(`/users/${targetId}/posts`),
          followService.getUserFollowers(targetId),
          followService.getUserFollowing(targetId),
        ])
        if (cancelled) return

        const p = userRes.data.data as User
        if (!p) throw new Error('not found')
        const freshPosts: Post[] = postsRes.data.data ?? []
        const follCount = followersRes.length
        const folwCount = followingRes.length

        setProfile(p)
        setPosts(freshPosts)
        setFollowerCount(follCount)
        setFollowingCount(folwCount)
        // Cache posts for both own and other profiles
        setCache(`profile_posts:${targetId}`, freshPosts).catch(() => {})

        if (!isOwn) {
          const [friendLevel, followStatus] = await Promise.all([
            friendService.getFriendshipLevel(targetId).catch(() => null),
            followService.getFollowStatus(targetId).catch(() => ({ following: false })),
          ])
          if (cancelled) return
          const following = followStatus.following
          const friend    = !!friendLevel?.isFriend
          setIsFollowing(following)
          setIsFriend(friend)
          setCache(`profile:${targetId}`, {
            user: p, followerCount: follCount, followingCount: folwCount,
            isFollowing: following, isFriend: friend,
          } as ProfileCache).catch(() => {})
        }
      } catch {
        if (!cancelled && loading) Alert.alert('Erro', 'Não foi possível carregar o perfil.')
      }
      if (!cancelled) { setLoading(false); setRefreshing(false) }
    }

    run()
    return () => { cancelled = true }
  }, [targetId]))

  async function handleRefresh() {
    setRefreshing(true)
    await silentReload()
    setRefreshing(false)
  }

  // Lightweight refresh used after friend-add or profile edit (no spinner)
  async function load(_silent = true) { await silentReload() }

  async function silentReload() {
    if (!isConnected()) return
    try {
      const [userRes, postsRes, followersRes, followingRes] = await Promise.all([
        isOwn ? Promise.resolve({ data: { data: me } }) : api.get(`/users/${targetId}`),
        api.get(`/users/${targetId}/posts`),
        followService.getUserFollowers(targetId),
        followService.getUserFollowing(targetId),
      ])
      const p = userRes.data.data as User
      if (!p) return
      const freshPosts: Post[] = postsRes.data.data ?? []
      setProfile(p); setPosts(freshPosts)
      setFollowerCount(followersRes.length); setFollowingCount(followingRes.length)
      setCache(`profile_posts:${targetId}`, freshPosts).catch(() => {})
      if (!isOwn) {
        const [friendLevel, followStatus] = await Promise.all([
          friendService.getFriendshipLevel(targetId).catch(() => null),
          followService.getFollowStatus(targetId).catch(() => ({ following: false })),
        ])
        setIsFollowing(followStatus.following); setIsFriend(!!friendLevel?.isFriend)
        setCache(`profile:${targetId}`, {
          user: p, followerCount: followersRes.length, followingCount: followingRes.length,
          isFollowing: followStatus.following, isFriend: !!friendLevel?.isFriend,
        }).catch(() => {})
      }
    } catch {}
  }

  async function handleFollow() {
    if (followLoading) return
    setFollowLoading(true)
    const prev = isFollowing
    setIsFollowing(!prev)
    setFollowerCount((c) => prev ? c - 1 : c + 1)
    try {
      const res = await followService.toggleFollow(targetId)
      setIsFollowing(res.following)
      setFollowerCount((c) => res.following === prev ? c : res.following ? c + 1 : c - 1)
    } catch {
      setIsFollowing(prev)
      setFollowerCount((c) => prev ? c + 1 : c - 1)
    }
    setFollowLoading(false)
  }

  async function pickAvatar() {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (status !== 'granted') return Alert.alert('Permissão necessária', 'Precisamos acesso à galeria.')
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: 'images', allowsEditing: true, aspect: [1, 1], quality: 0.8 })
    if (result.canceled || !result.assets[0]) return
    const uri = result.assets[0].uri
    setProfile((prev) => prev ? { ...prev, avatar: uri } : prev)
    const form = new FormData()
    form.append('avatar', { uri, name: 'avatar.jpg', type: 'image/jpeg' } as any)
    try {
      await api.put('/users/profile', form, { headers: { 'Content-Type': 'multipart/form-data' } })
      await loadUser()
    } catch {
      setProfile((prev) => prev ? { ...prev, avatar: me?.avatar ?? null } : prev)
      Alert.alert('Erro', 'Não foi possível actualizar a foto.')
    }
  }

  async function handleAddFriend() {
    Alert.alert('Duração da amizade', 'Por quanto tempo?', [
      { text: '1 dia',      onPress: () => sendFriend('ONE_DAY') },
      { text: '7 dias',     onPress: () => sendFriend('SEVEN_DAYS') },
      { text: '30 dias',    onPress: () => sendFriend('THIRTY_DAYS') },
      { text: 'Permanente', onPress: () => sendFriend('PERMANENT') },
    ])
  }

  async function sendFriend(duration: string) {
    try { await friendService.addFriend(targetId, duration as any); load(true) }
    catch (e: any) { Alert.alert('Erro', e.message) }
  }

  function openPost(index: number) {
    nav.navigate('PostViewer', { posts, startIndex: index })
  }

  function renderPost({ item, index }: { item: Post; index: number }) {
    const thumb = resolveUrl(item.thumbnailUrl ?? item.mediaUrl)
    return (
      <TouchableOpacity
        style={s.gridCell}
        onPress={() => openPost(index)}
        activeOpacity={0.85}
      >
        {item.mediaType === 'TEXT' ? (
          <View style={[s.gridImg, { backgroundColor: item.bgColor ?? '#FF4B6E', justifyContent: 'center', alignItems: 'center', padding: 6 }]}>
            <Text style={s.gridText} numberOfLines={4}>{item.caption}</Text>
          </View>
        ) : (
          <Image
            source={{ uri: thumb ?? '' }}
            style={s.gridImg}
            contentFit="cover"
            cachePolicy="disk"
            recyclingKey={`grid-${item.id}`}
          />
        )}
        {item.mediaType === 'VIDEO' && (
          <View style={s.videoIcon}>
            <Ionicons name="play" size={10} color="#fff" />
          </View>
        )}
      </TouchableOpacity>
    )
  }

  if (loading) {
    return (
      <View style={[s.container, s.center, { paddingTop: top }]}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    )
  }

  return (
    <View style={[s.container, { paddingTop: top }]}>
      {/* ── Header bar ── */}
      <View style={s.headerBar}>
        <TouchableOpacity onPress={() => nav.goBack()} style={s.headerBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="chevron-back" size={26} color={colors.gray800} />
        </TouchableOpacity>
        <Text style={s.headerTitle} numberOfLines={1}>{profile?.name ?? ''}</Text>
        {isOwn ? (
          <View style={s.headerRight}>
            <TouchableOpacity onPress={() => setShowQR(true)} style={s.headerBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="qr-code-outline" size={22} color={colors.gray800} />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => Alert.alert('Logout', 'Sair da conta?', [{ text: 'Cancelar' }, { text: 'Sair', style: 'destructive', onPress: logout }])}
              style={s.headerBtn}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="log-out-outline" size={22} color={colors.gray800} />
            </TouchableOpacity>
          </View>
        ) : (
          <View style={{ width: 44 }} />
        )}
      </View>

      <FlatList
        data={posts}
        keyExtractor={(p) => p.id}
        numColumns={3}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.primary} />}
        ListHeaderComponent={
          isOwn ? <OwnHeader
            profile={profile}
            postsCount={posts.length}
            followerCount={followerCount}
            followingCount={followingCount}
            onPickAvatar={pickAvatar}
            onEdit={() => setEditOpen(true)}
            onShowFollowers={() => { setFollowSheetMode('followers'); setShowFollowSheet(true) }}
            onShowFollowing={() => { setFollowSheetMode('following'); setShowFollowSheet(true) }}
            onNavigate={(screen: string, params?: object) => nav.navigate(screen as any, params as any)}
            myId={me?.id ?? ''}
          /> : <OtherHeader
            profile={profile}
            postsCount={posts.length}
            followerCount={followerCount}
            followingCount={followingCount}
            isFollowing={isFollowing}
            followLoading={followLoading}
            isFriend={isFriend}
            onFollow={handleFollow}
            onMessage={() => {
              if (!profile) return
              nav.navigate('Chat', { userId: profile.id, userName: profile.name, userAvatar: profile.avatar })
            }}
            onAddFriend={handleAddFriend}
            onShowFollowers={() => { setFollowSheetMode('followers'); setShowFollowSheet(true) }}
            onShowFollowing={() => { setFollowSheetMode('following'); setShowFollowSheet(true) }}
          />
        }
        renderItem={renderPost}
        ListEmptyComponent={
          <View style={s.emptyGrid}>
            <Ionicons name="images-outline" size={44} color={colors.gray200} />
            <Text style={s.emptyGridText}>Sem publicações ainda</Text>
          </View>
        }
      />

      {isOwn && <EditProfileSheet visible={editOpen} onClose={() => { setEditOpen(false); load(true) }} />}
      {isOwn && profile && <QRModal visible={showQR} userId={profile.id} userName={profile.name} onClose={() => setShowQR(false)} />}
      <FollowersSheet visible={showFollowSheet} mode={followSheetMode} userId={targetId} onClose={() => setShowFollowSheet(false)} />
    </View>
  )
}

// ── Own profile header ─────────────────────────────────────────────────────────
function OwnHeader({ profile, postsCount, followerCount, followingCount, onPickAvatar, onEdit, onShowFollowers, onShowFollowing, onNavigate, myId }: any) {
  if (!profile) return null
  return (
    <View style={s.ownHeader}>
      {/* Avatar + Stats */}
      <View style={s.topRow}>
        <AvatarSection uri={profile.avatar ?? null} availability={profile.availability} onPress={onPickAvatar} />
        <View style={s.statsRow}>
          <Stat num={postsCount} label="Posts" />
          <TouchableOpacity onPress={onShowFollowers} activeOpacity={0.7}>
            <Stat num={followerCount} label="Seguidores" />
          </TouchableOpacity>
          <TouchableOpacity onPress={onShowFollowing} activeOpacity={0.7}>
            <Stat num={followingCount} label="Seguindo" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Bio */}
      {profile.bio ? <Text style={s.bio}>{profile.bio}</Text> : null}
      {profile.availability ? <Text style={s.availability}>● {profile.availability}</Text> : null}

      {/* Edit button */}
      <TouchableOpacity style={s.editBtn} onPress={onEdit} activeOpacity={0.8}>
        <Text style={s.editText}>Editar perfil</Text>
      </TouchableOpacity>

      {/* Quick actions */}
      <View style={s.quickRow}>
        {[
          { icon: 'bookmark-outline',      label: 'Salvos',       screen: 'Bookmarks' },
          { icon: 'trophy-outline',        label: 'Desafios',     screen: 'Challenges' },
          { icon: 'notifications-outline', label: 'Notificações', screen: 'Notifications' },
        ].map(({ icon, label, screen }) => (
          <TouchableOpacity key={label} style={s.quickBtn} onPress={() => onNavigate(screen)} activeOpacity={0.7}>
            <Ionicons name={icon as any} size={20} color={colors.gray600} />
            <Text style={s.quickLabel}>{label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={s.sectionTitle}>Publicações</Text>
    </View>
  )
}

// ── Other user header ─────────────────────────────────────────────────────────
function OtherHeader({ profile, postsCount, followerCount, followingCount, isFollowing, followLoading, isFriend, onFollow, onMessage, onAddFriend, onShowFollowers, onShowFollowing }: any) {
  if (!profile) return null
  return (
    <View style={s.otherHeaderWrap}>
      {/* Avatar centrado */}
      <AvatarImage uri={profile.avatar} size={90} borderColor={colors.primary} borderWidth={2.5} />
      <Text style={s.otherName}>{profile.name}</Text>
      {profile.bio ? <Text style={s.otherBio}>{profile.bio}</Text> : null}
      {profile.availability ? <Text style={s.availability}>● {profile.availability}</Text> : null}

      {/* Stats */}
      <View style={s.otherStats}>
        <Stat num={postsCount} label="Posts" />
        <View style={s.statsDivider} />
        <TouchableOpacity onPress={onShowFollowers} activeOpacity={0.7}>
          <Stat num={followerCount} label="Seguidores" />
        </TouchableOpacity>
        <View style={s.statsDivider} />
        <TouchableOpacity onPress={onShowFollowing} activeOpacity={0.7}>
          <Stat num={followingCount} label="Seguindo" />
        </TouchableOpacity>
      </View>

      {/* Action buttons */}
      <View style={s.actionRow}>
        <TouchableOpacity style={s.msgBtn} onPress={onMessage} activeOpacity={0.8}>
          <Ionicons name="chatbubble-ellipses" size={16} color={colors.white} />
          <Text style={s.msgBtnText}>Mensagem</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[s.followBtn, isFollowing && s.followingBtn]}
          onPress={onFollow}
          disabled={followLoading}
          activeOpacity={0.8}
        >
          {followLoading ? (
            <ActivityIndicator size="small" color={isFollowing ? colors.gray800 : colors.white} />
          ) : (
            <Text style={[s.followBtnText, isFollowing && s.followingBtnText]}>
              {isFollowing ? 'Seguindo' : 'Seguir'}
            </Text>
          )}
        </TouchableOpacity>
        <TouchableOpacity
          style={[s.friendBtn, isFriend && s.friendActiveBtn]}
          onPress={isFriend ? undefined : onAddFriend}
          activeOpacity={isFriend ? 1 : 0.8}
        >
          <Ionicons name={isFriend ? 'people' : 'person-add'} size={18} color={isFriend ? colors.primary : colors.gray800} />
        </TouchableOpacity>
      </View>

      <Text style={s.sectionTitle}>Publicações</Text>
    </View>
  )
}

// ── Stat component ─────────────────────────────────────────────────────────────
function Stat({ num, label }: { num: number; label: string }) {
  return (
    <View style={s.stat}>
      <Text style={s.statNum}>{num}</Text>
      <Text style={s.statLabel}>{label}</Text>
    </View>
  )
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.white },
  center:    { alignItems: 'center', justifyContent: 'center' },

  // Header bar
  headerBar:   { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingBottom: 10, gap: 8 },
  headerBtn:   { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { flex: 1, fontSize: 17, fontFamily: fonts.bold, color: colors.gray800, textAlign: 'center' },
  headerRight: { flexDirection: 'row', gap: 4 },

  // Own header
  ownHeader: { paddingHorizontal: spacing.md, paddingTop: spacing.sm, gap: spacing.md },
  topRow:    { flexDirection: 'row', alignItems: 'center', gap: spacing.lg },
  statsRow:  { flex: 1, flexDirection: 'row', justifyContent: 'space-around' },

  // Other header
  otherHeaderWrap: { paddingHorizontal: spacing.md, paddingTop: spacing.lg, paddingBottom: spacing.sm, alignItems: 'center', gap: spacing.sm },
  otherName:  { fontSize: 20, fontFamily: fonts.bold, color: colors.gray800, letterSpacing: -0.3 },
  otherBio:   { fontSize: 13, fontFamily: fonts.regular, color: colors.gray600, textAlign: 'center', lineHeight: 19 },
  otherStats: { flexDirection: 'row', alignItems: 'center', gap: spacing.xl, marginTop: 4 },
  statsDivider:{ width: 1, height: 32, backgroundColor: colors.gray200 },

  // Shared stats
  stat:      { alignItems: 'center', gap: 1 },
  statNum:   { fontSize: 20, fontFamily: fonts.bold, color: colors.gray800, letterSpacing: -0.5 },
  statLabel: { fontSize: 11, fontFamily: fonts.regular, color: colors.gray400 },

  // Bio/avail
  bio:          { fontSize: 14, fontFamily: fonts.regular, color: colors.gray600, lineHeight: 20 },
  availability: { fontSize: 12, fontFamily: fonts.medium, color: colors.secondary },

  // Edit
  editBtn:  { borderWidth: 1.5, borderColor: colors.gray200, borderRadius: radius.md, paddingVertical: 9, alignItems: 'center' },
  editText: { fontSize: 14, fontFamily: fonts.semiBold, color: colors.gray800 },

  // Quick actions
  quickRow:   { flexDirection: 'row', gap: spacing.sm },
  quickBtn:   { flex: 1, alignItems: 'center', gap: 5, backgroundColor: colors.gray100, borderRadius: radius.md, paddingVertical: 12 },
  quickLabel: { fontSize: 10, fontFamily: fonts.medium, color: colors.gray600 },


  // Action buttons (other profile)
  actionRow:       { flexDirection: 'row', gap: spacing.sm, marginTop: 4, width: '100%' },
  msgBtn:          { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: colors.primary, borderRadius: radius.md, paddingVertical: 11 },
  msgBtnText:      { color: colors.white, fontFamily: fonts.semiBold, fontSize: 14 },
  followBtn:       { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primary, borderRadius: radius.md, paddingVertical: 11 },
  followingBtn:    { backgroundColor: colors.gray100, borderWidth: 1.5, borderColor: colors.gray200 },
  followBtnText:   { color: colors.white, fontFamily: fonts.semiBold, fontSize: 14 },
  followingBtnText:{ color: colors.gray800 },
  friendBtn:       { width: 44, height: 44, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.gray100, borderWidth: 1.5, borderColor: colors.gray200 },
  friendActiveBtn: { backgroundColor: `${colors.primary}15`, borderColor: `${colors.primary}40` },

  // Section title
  sectionTitle: { fontSize: 12, fontFamily: fonts.semiBold, color: colors.gray400, letterSpacing: 0.6, textTransform: 'uppercase', marginTop: 4, marginBottom: 2 },

  // Grid
  gridCell: { width: GRID_SIZE, height: GRID_SIZE, margin: 0.5 },
  gridImg:  { width: '100%', height: '100%' },
  gridText: { fontSize: 10, fontFamily: fonts.medium, color: colors.white, textAlign: 'center' },
  videoIcon:{ position: 'absolute', top: 5, right: 5, backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 4, padding: 3 },

  emptyGrid:     { alignItems: 'center', paddingTop: 60, gap: 10 },
  emptyGridText: { fontSize: 14, fontFamily: fonts.regular, color: colors.gray400 },
})
