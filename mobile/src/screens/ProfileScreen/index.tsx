import React, { useState, useCallback } from 'react'
import {
  View, Text, TouchableOpacity, FlatList,
  RefreshControl, StyleSheet, Alert, Dimensions,
  ActivityIndicator, Modal, TextInput, KeyboardAvoidingView, Platform,
} from 'react-native'
import { Image } from 'expo-image'
import { LinearGradient } from 'expo-linear-gradient'
import { Ionicons } from '@expo/vector-icons'
import * as ImagePicker from 'expo-image-picker'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useNavigation, useRoute, RouteProp, useFocusEffect } from '@react-navigation/native'
import { StackNavigationProp } from '@react-navigation/stack'
import { useAuthStore } from '../../store/auth.store'
import { api } from '../../services/api'
import { Post, User } from '../../types'
import { AppStackParams } from '../../navigation/AppNavigator'
import { colors, fonts } from '../../theme'
import AvatarImage from '../../components/AvatarImage'
import SegmentedRing from '../../components/SegmentedRing'
import FollowersSheet from './FollowersSheet'
import QRModal from '../../components/QRModal'
import * as followService from '../../services/follow.service'
import { API_BASE } from '../../config'
import { getCache, setCache } from '../../db/database'
import { isConnected } from '../../services/netinfo.service'
import { useFeedStore } from '../../store/feed.store'
import { deletePost as apiDeletePost, updatePost as apiUpdatePost } from '../../services/post.service'
import { useT } from '../../i18n'

type Nav   = StackNavigationProp<AppStackParams>
type Route = RouteProp<AppStackParams, 'Profile'>

const { width: W } = Dimensions.get('window')
const BANNER_H  = 370
const AVATAR    = 104
const RING_SZ   = 124
const GRID_GAP  = 1.5
const GRID_SIZE = (W - GRID_GAP * 2) / 3

function resolveUrl(url: string | null | undefined): string | null {
  if (!url) return null
  if (url.startsWith('http') || url.startsWith('file://')) return url
  return `${API_BASE}${url}`
}

interface PartnerRequest {
  id: string
  senderId: string
  status: string
  sender: { id: string; name: string; avatar: string | null; bio: string | null }
}

export default function ProfileScreen() {
  const t = useT()
  const { user: me, logout, refreshUser } = useAuthStore()
  const nav   = useNavigation<Nav>()
  const route = useRoute<Route>()
  const { bottom } = useSafeAreaInsets()

  const viewingId = route.params?.userId && route.params.userId !== me?.id ? route.params.userId : null
  const isOwn     = !viewingId
  const targetId  = viewingId ?? me?.id ?? ''

  const [profile,        setProfile]        = useState<User | null>(isOwn ? me : null)
  const [posts,          setPosts]          = useState<Post[]>([])
  const [refreshing,     setRefreshing]     = useState(false)
  const [followerCount,  setFollowerCount]  = useState(0)
  const [followingCount, setFollowingCount] = useState(0)
  const [isFollowing,    setIsFollowing]    = useState(false)
  const [theyFollowMe,   setTheyFollowMe]   = useState(false)
  const [followLoading,  setFollowLoading]  = useState(false)
  const [showQR,         setShowQR]         = useState(false)
  const [followSheetMode, setFollowSheetMode] = useState<'followers' | 'following'>('followers')
  const [showFollowSheet, setShowFollowSheet] = useState(false)
  const [partnerRequests, setPartnerRequests] = useState<PartnerRequest[]>([])
  const [menuPost,        setMenuPost]        = useState<Post | null>(null)
  const [editEditing,     setEditEditing]     = useState(false)
  const [editCaption,     setEditCaption]     = useState('')
  const [editLoading,     setEditLoading]     = useState(false)
  const [pendingAvatarUri, setPendingAvatarUri] = useState<string | null>(null)
  const [savingAvatar,     setSavingAvatar]     = useState(false)

  type ProfileCache = {
    user: User; followerCount: number; followingCount: number
    isFollowing: boolean; theyFollowMe: boolean
  }

  useFocusEffect(useCallback(() => {
    let cancelled = false

    async function run() {
      const [cachedMeta, cachedPosts] = await Promise.all([
        !isOwn ? getCache<ProfileCache>(`profile:${targetId}`) : null,
        getCache<Post[]>(`profile_posts:${targetId}`),
      ])
      const latestMe = useAuthStore.getState().user
      if (!cancelled) {
        if (cachedMeta && !isOwn) {
          setProfile(cachedMeta.user)
          setFollowerCount(cachedMeta.followerCount)
          setFollowingCount(cachedMeta.followingCount)
          setIsFollowing(cachedMeta.isFollowing)
          setTheyFollowMe(cachedMeta.theyFollowMe ?? false)
        }
        if (cachedPosts) setPosts(cachedPosts)
        if (isOwn && latestMe) setProfile(latestMe)
      }
      if (!isConnected()) { setRefreshing(false); return }
      try {
        const [userRes, postsRes, followersRes, followingRes] = await Promise.all([
          isOwn ? Promise.resolve({ data: { data: latestMe } }) : api.get(`/users/${targetId}`),
          api.get(`/users/${targetId}/posts`),
          followService.getUserFollowers(targetId),
          followService.getUserFollowing(targetId),
        ])
        if (cancelled) return
        const p = userRes.data.data as User
        if (!p) throw new Error('not found')
        const freshPosts: Post[] = postsRes.data.data ?? []
        setProfile(p); setPosts(freshPosts)
        setFollowerCount(followersRes.length); setFollowingCount(followingRes.length)
        setCache(`profile_posts:${targetId}`, freshPosts).catch(() => {})
        if (!isOwn) {
          const followStatus = await followService.getFollowStatus(targetId)
            .catch(() => ({ following: false, followsMe: false }))
          if (cancelled) return
          setIsFollowing(followStatus.following)
          setTheyFollowMe(followStatus.followsMe)
          setCache(`profile:${targetId}`, {
            user: p, followerCount: followersRes.length,
            followingCount: followingRes.length,
            isFollowing: followStatus.following, theyFollowMe: followStatus.followsMe,
          } as ProfileCache).catch(() => {})
        }
      } catch {}
      if (!cancelled) setRefreshing(false)
    }
    run()
    return () => { cancelled = true }
  }, [targetId]))

  useFocusEffect(useCallback(() => {
    if (!isOwn) return
    let active = true
    async function loadPartnerReqs() {
      const cached = await getCache<PartnerRequest[]>('partner_requests').catch(() => null)
      if (cached && active) setPartnerRequests(cached)
      if (!isConnected()) return
      try {
        const r = await api.get('/users/partner-requests')
        const fresh: PartnerRequest[] = r.data.data ?? []
        if (active) setPartnerRequests(fresh)
        setCache('partner_requests', fresh).catch(() => {})
      } catch {}
    }
    loadPartnerReqs()
    return () => { active = false }
  }, [isOwn]))

  async function handleRefresh() {
    setRefreshing(true)
    await silentReload()
    setRefreshing(false)
  }

  async function silentReload() {
    if (!isConnected()) return
    try {
      const latestMe = useAuthStore.getState().user
      const [userRes, postsRes, followersRes, followingRes] = await Promise.all([
        isOwn ? Promise.resolve({ data: { data: latestMe } }) : api.get(`/users/${targetId}`),
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
      if (isOwn) {
        await refreshUser()
        const refreshedMe = useAuthStore.getState().user
        if (refreshedMe) setProfile(refreshedMe)
      }
    } catch {}
  }

  async function handleFollow() {
    if (followLoading) return
    setFollowLoading(true)
    const prev = isFollowing
    setIsFollowing(!prev); setFollowerCount((c) => prev ? c - 1 : c + 1)
    try {
      const res = await followService.toggleFollow(targetId)
      setIsFollowing(res.following)
      setFollowerCount((c) => res.following === prev ? c : res.following ? c + 1 : c - 1)
    } catch { setIsFollowing(prev); setFollowerCount((c) => prev ? c + 1 : c - 1) }
    setFollowLoading(false)
  }

  async function handlePartnerResponse(id: string, accept: boolean) {
    setPartnerRequests((prev) => {
      const updated = prev.filter((r) => r.id !== id)
      setCache('partner_requests', updated).catch(() => {})
      return updated
    })
    try {
      await api.put(`/users/partner-requests/${id}/${accept ? 'accept' : 'reject'}`)
      if (accept) {
        await refreshUser()
        setProfile((p) => p ? { ...p, ...me } : p)
      }
    } catch {
      api.get('/users/partner-requests')
        .then((r) => {
          const fresh = r.data.data ?? []
          setPartnerRequests(fresh)
          setCache('partner_requests', fresh).catch(() => {})
        }).catch(() => {})
      Alert.alert(t.error, t.notifs_err_msg)
    }
  }

  async function pickAvatar() {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (status !== 'granted') return Alert.alert(t.profile_perm_title, t.profile_perm_msg)
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: 'images', allowsEditing: true, aspect: [1, 1], quality: 0.8 })
    if (result.canceled || !result.assets[0]) return
    setPendingAvatarUri(result.assets[0].uri)
  }

  async function savePendingAvatar() {
    if (!pendingAvatarUri || savingAvatar) return
    setSavingAvatar(true)
    const uri = pendingAvatarUri
    setPendingAvatarUri(null)
    setProfile((prev) => prev ? { ...prev, avatar: uri } : prev)
    useAuthStore.setState((s) => ({ user: s.user ? { ...s.user, avatar: uri } : null }))
    const form = new FormData()
    form.append('avatar', { uri, name: 'avatar.jpg', type: 'image/jpeg' } as any)
    try {
      await api.put('/users/profile', form, { headers: { 'Content-Type': 'multipart/form-data' } })
      await refreshUser()
    } catch {
      setProfile((prev) => prev ? { ...prev, avatar: me?.avatar ?? null } : prev)
      useAuthStore.setState((s) => ({ user: s.user ? { ...s.user, avatar: me?.avatar ?? null } : null }))
      Alert.alert(t.error, t.profile_photo_err)
    } finally {
      setSavingAvatar(false)
    }
  }

  const setJumpToPostId = useFeedStore((s) => s.setJumpToPostId)
  function openPost(postId: string) {
    if (!postId) return
    setJumpToPostId(postId)
    nav.navigate('Tabs', { screen: 'Feed' })
  }

  function handleMenuOpen(post: Post) {
    setMenuPost(post)
    setEditEditing(false)
  }

  function handleDeletePost(post: Post) {
    Alert.alert(
      t.profile_del_title,
      t.profile_del_msg,
      [
        { text: t.cancel, style: 'cancel' },
        {
          text: t.delete, style: 'destructive',
          onPress: async () => {
            setMenuPost(null)
            setPosts((prev) => prev.filter((p) => p.id !== post.id))
            try {
              await apiDeletePost(post.id)
            } catch {
              setPosts((prev) => [...prev, post].sort((a, b) =>
                new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()))
              Alert.alert(t.error, t.profile_del_err)
            }
          },
        },
      ]
    )
  }

  async function handleSaveEdit() {
    if (!menuPost) return
    setEditLoading(true)
    const original = menuPost.caption ?? ''
    const updated  = editCaption.trim()
    setPosts((prev) => prev.map((p) => p.id === menuPost.id ? { ...p, caption: updated } : p))
    setEditEditing(false)
    setMenuPost(null)
    try {
      await apiUpdatePost(menuPost.id, updated)
    } catch {
      setPosts((prev) => prev.map((p) => p.id === menuPost.id ? { ...p, caption: original } : p))
      Alert.alert(t.error, t.profile_save_err)
    }
    setEditLoading(false)
  }

  function renderPost({ item }: { item: Post; index: number }) {
    const thumb = resolveUrl(item.thumbnailUrl ?? item.mediaUrl)
    return (
      <TouchableOpacity style={s.gridCell} onPress={() => openPost(item.id)} activeOpacity={0.88}>
        {item.mediaType === 'TEXT' ? (() => {
          const parts = item.bgColor?.split('|') ?? []
          const gc: [string, string] = parts.length === 2 ? [parts[0], parts[1]] : ['#FF6B35', '#E63946']
          return (
            <LinearGradient colors={gc} style={[s.gridImg, { justifyContent: 'center', alignItems: 'center', padding: 4 }]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
              <Text style={s.gridText} numberOfLines={4}>{item.caption}</Text>
            </LinearGradient>
          )
        })() : (
          <Image source={{ uri: thumb ?? '' }} style={s.gridImg} contentFit="cover" cachePolicy="disk" recyclingKey={`grid-${item.id}`} />
        )}
        {item.mediaType === 'VIDEO' && (
          <View style={s.videoIcon}><Ionicons name="play" size={10} color="#fff" /></View>
        )}
        {isOwn && (
          <TouchableOpacity style={s.postMenuBtn} onPress={() => handleMenuOpen(item)} hitSlop={{ top: 6, right: 6, bottom: 6, left: 6 }}>
            <Ionicons name="ellipsis-horizontal" size={13} color="#fff" />
          </TouchableOpacity>
        )}
      </TouchableOpacity>
    )
  }

  const header = isOwn
    ? <OwnHeader
        profile={profile} me={me}
        postsCount={posts.length}
        followerCount={followerCount} followingCount={followingCount}
        partnerRequests={partnerRequests}
        onPickAvatar={pickAvatar}
        pendingAvatarUri={pendingAvatarUri}
        savingAvatar={savingAvatar}
        onSaveAvatar={savePendingAvatar}
        onCancelAvatar={() => setPendingAvatarUri(null)}
        onEdit={() => nav.navigate('EditProfile')}
        onShowFollowers={() => { setFollowSheetMode('followers'); setShowFollowSheet(true) }}
        onShowFollowing={() => { setFollowSheetMode('following'); setShowFollowSheet(true) }}
        onNavigate={(screen: keyof AppStackParams) => nav.navigate(screen as any)}
        onPartnerResponse={handlePartnerResponse}
        onLogout={() => Alert.alert(t.profile_logout, t.profile_logout_confirm, [{ text: t.cancel }, { text: t.profile_logout_btn, style: 'destructive', onPress: logout }])}
        onShowQR={() => setShowQR(true)}
      />
    : <OtherHeader
        profile={profile}
        postsCount={posts.length}
        followerCount={followerCount} followingCount={followingCount}
        isFollowing={isFollowing} theyFollowMe={theyFollowMe}
        followLoading={followLoading}
        onFollow={handleFollow}
        onMessage={() => { if (!profile) return; nav.navigate('Chat', { userId: profile.id, userName: profile.name, userAvatar: profile.avatar }) }}
        onShowFollowers={() => { setFollowSheetMode('followers'); setShowFollowSheet(true) }}
        onShowFollowing={() => { setFollowSheetMode('following'); setShowFollowSheet(true) }}
      />

  return (
    <View style={s.container}>
      <FlatList
        data={posts}
        keyExtractor={(p) => p.id}
        numColumns={3}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.primary} />}
        ListHeaderComponent={header}
        renderItem={renderPost}
        ListEmptyComponent={
          <View style={s.emptyGrid}>
            <Ionicons name="images-outline" size={48} color="#E5E5EA" />
            <Text style={s.emptyGridText}>{t.profile_no_posts}</Text>
          </View>
        }
        contentContainerStyle={{ paddingBottom: bottom + 16 }}
      />
      {isOwn && profile && <QRModal visible={showQR} userId={profile.id} userName={profile.name} onClose={() => setShowQR(false)} />}
      <FollowersSheet visible={showFollowSheet} mode={followSheetMode} userId={targetId} onClose={() => setShowFollowSheet(false)} />

      {/* Post action sheet */}
      <Modal visible={!!menuPost && !editEditing} transparent animationType="fade" onRequestClose={() => setMenuPost(null)}>
        <TouchableOpacity style={s.modalOverlay} activeOpacity={1} onPress={() => setMenuPost(null)}>
          <View style={s.actionSheet}>
            <View style={s.sheetHandle} />
            <TouchableOpacity
              style={s.sheetRow}
              activeOpacity={0.75}
              onPress={() => { setEditCaption(menuPost?.caption ?? ''); setEditEditing(true) }}
            >
              <Ionicons name="create-outline" size={20} color={colors.gray800} />
              <Text style={s.sheetRowText}>{t.profile_edit_caption}</Text>
            </TouchableOpacity>
            <View style={s.sheetDivider} />
            <TouchableOpacity
              style={s.sheetRow}
              activeOpacity={0.75}
              onPress={() => menuPost && handleDeletePost(menuPost)}
            >
              <Ionicons name="trash-outline" size={20} color="#FF3B30" />
              <Text style={[s.sheetRowText, { color: '#FF3B30' }]}>{t.profile_del_title}</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Edit caption modal */}
      <Modal visible={editEditing} transparent animationType="slide" onRequestClose={() => setEditEditing(false)}>
        <KeyboardAvoidingView style={s.modalOverlay} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={() => setEditEditing(false)} />
          <View style={s.editSheet}>
            <View style={s.sheetHandle} />
            <Text style={s.editSheetTitle}>{t.profile_edit_caption}</Text>
            <TextInput
              style={s.editInput}
              value={editCaption}
              onChangeText={setEditCaption}
              placeholder={t.profile_caption_ph}
              placeholderTextColor={colors.gray400}
              multiline
              maxLength={200}
              autoFocus
            />
            <View style={s.editBtnRow}>
              <TouchableOpacity style={s.editCancelBtn} onPress={() => setEditEditing(false)} activeOpacity={0.75}>
                <Text style={s.editCancelTxt}>{t.cancel}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.editSaveBtn} onPress={handleSaveEdit} disabled={editLoading} activeOpacity={0.85}>
                {editLoading
                  ? <ActivityIndicator color="#fff" size="small" />
                  : <Text style={s.editSaveTxt}>{t.save}</Text>
                }
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  )
}

// ─── Own Profile Header ────────────────────────────────────────────────────────
function OwnHeader({ profile, postsCount, followerCount, followingCount, partnerRequests, onPickAvatar, pendingAvatarUri, savingAvatar, onSaveAvatar, onCancelAvatar, onEdit, onShowFollowers, onShowFollowing, onNavigate, onPartnerResponse, onLogout, onShowQR }: any) {
  const t          = useT()
  const nav        = useNavigation<Nav>()
  const { top }    = useSafeAreaInsets()
  const canGoBack  = nav.canGoBack()
  const hasPartner = Boolean(profile?.partnerId && profile?.partnerName)
  const displayUri = pendingAvatarUri ?? (profile?.avatar ? resolveUrl(profile.avatar) : null)

  return (
    <View>
      {/* Banner */}
      <View style={[s.banner, { height: BANNER_H }]}>
        {displayUri ? (
          <Image
            key={displayUri}
            source={{ uri: displayUri }}
            style={s.bannerImg}
            contentFit="cover"
            cachePolicy={displayUri.startsWith('file://') ? 'none' : 'disk'}
          />
        ) : (
          <LinearGradient
            colors={['#CA2851', '#FF6766', '#FFB173']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
        )}
        <LinearGradient
          colors={['transparent', 'transparent', 'rgba(0,0,0,0.55)', 'rgba(0,0,0,0.9)']}
          locations={[0, 0.3, 0.62, 1]}
          style={StyleSheet.absoluteFill}
        />
        {/* Top bar */}
        <View style={[s.bannerTopBar, { paddingTop: top + 8 }]}>
          {canGoBack ? (
            <TouchableOpacity onPress={() => nav.goBack()} style={s.iconBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="chevron-back" size={24} color="#fff" />
            </TouchableOpacity>
          ) : (
            <View style={s.iconBtn} />
          )}
          <View style={s.topBarRight}>
            {pendingAvatarUri ? (
              <>
                <TouchableOpacity style={s.avatarCancelBtn} onPress={onCancelAvatar}>
                  <Ionicons name="close" size={18} color="#fff" />
                </TouchableOpacity>
                <TouchableOpacity style={s.avatarSaveBtn} onPress={onSaveAvatar} disabled={savingAvatar} activeOpacity={0.8}>
                  {savingAvatar
                    ? <ActivityIndicator size="small" color="#fff" />
                    : <Text style={s.avatarSaveTxt}>{t.save}</Text>
                  }
                </TouchableOpacity>
              </>
            ) : (
              <>
                <TouchableOpacity onPress={onShowQR} style={s.iconBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Ionicons name="qr-code-outline" size={22} color="#fff" />
                </TouchableOpacity>
                <TouchableOpacity onPress={onLogout} style={s.iconBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Ionicons name="log-out-outline" size={22} color="#fff" />
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </View>

      {/* Hero card */}
      <View style={s.hero}>
        {/* Drag handle */}
        <View style={s.dragHandle} />

        {/* Avatar — straddles banner/card boundary */}
        <TouchableOpacity style={s.ownAvatarWrap} onPress={onPickAvatar} activeOpacity={0.85}>
          <View style={s.avatarShadow}>
            <SegmentedRing count={1} viewedCount={0} size={RING_SZ} strokeWidth={3} />
            <AvatarImage uri={displayUri ?? undefined} size={AVATAR} borderColor="#fff" borderWidth={3.5} />
            {!pendingAvatarUri && (
              <View style={s.avatarCamBadge}>
                <Ionicons name="camera" size={14} color="#fff" />
              </View>
            )}
          </View>
        </TouchableOpacity>

        {/* Name */}
        <Text style={s.heroName}>{profile?.name ?? ''}</Text>

        {/* Status label chip */}
        {profile?.statusLabel ? (
          <View style={s.statusChip}>
            <Text style={s.statusChipText}>{profile.statusLabel}</Text>
          </View>
        ) : null}

        {/* Bio */}
        {profile?.bio ? (
          <Text style={s.heroBio} numberOfLines={3}>{profile.bio}</Text>
        ) : null}

        {/* Stats row */}
        <View style={s.statsRow}>
          <TouchableOpacity style={s.statItem} activeOpacity={0.7}>
            <Text style={s.statNum}>{postsCount}</Text>
            <Text style={s.statLabel}>{t.profile_posts}</Text>
          </TouchableOpacity>
          <View style={s.statDivider} />
          <TouchableOpacity style={s.statItem} onPress={onShowFollowers} activeOpacity={0.7}>
            <Text style={s.statNum}>{followerCount}</Text>
            <Text style={s.statLabel}>{t.profile_followers}</Text>
          </TouchableOpacity>
          <View style={s.statDivider} />
          <TouchableOpacity style={s.statItem} onPress={onShowFollowing} activeOpacity={0.7}>
            <Text style={s.statNum}>{followingCount}</Text>
            <Text style={s.statLabel}>{t.profile_following}</Text>
          </TouchableOpacity>
        </View>

        {/* Own action row */}
        <View style={s.ownActionRow}>
          <TouchableOpacity style={s.editProfileBtn} onPress={onEdit} activeOpacity={0.85}>
            <Ionicons name="pencil-outline" size={16} color="#1A1A1A" />
            <Text style={s.editProfileBtnText}>{t.profile_edit_btn}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.iconSquareBtn} onPress={() => onNavigate('Notifications')} activeOpacity={0.85}>
            <Ionicons name="notifications-outline" size={20} color="#3A3A3C" />
          </TouchableOpacity>
          <TouchableOpacity style={s.iconSquareBtn} onPress={() => onNavigate('Bookmarks')} activeOpacity={0.85}>
            <Ionicons name="bookmark-outline" size={20} color="#3A3A3C" />
          </TouchableOpacity>
          <TouchableOpacity style={s.iconSquareBtn} onPress={() => onNavigate('Settings')} activeOpacity={0.85}>
            <Ionicons name="settings-outline" size={20} color="#3A3A3C" />
          </TouchableOpacity>
        </View>

        {/* Partner badge */}
        {hasPartner && (
          <View style={s.partnerBadge}>
            <Ionicons name="heart" size={14} color="#E8345A" />
            <Text style={s.partnerBadgeText}>{t.profile_partner} {profile.partnerName}</Text>
          </View>
        )}

        {/* Partner requests */}
        {partnerRequests.length > 0 && (
          <View style={s.inlinePartnerWrap}>
            <View style={s.inlinePartnerHeader}>
              <Ionicons name="heart-circle" size={15} color="#E8345A" />
              <Text style={s.inlinePartnerTitle}>{t.profile_partner_req}</Text>
            </View>
            {partnerRequests.map((req: any) => (
              <View key={req.id} style={s.inlinePartnerRow}>
                <AvatarImage uri={req.sender.avatar} size={42} />
                <View style={{ flex: 1 }}>
                  <Text style={s.partnerReqName}>{req.sender.name}</Text>
                  <Text style={s.partnerReqBio} numberOfLines={1}>
                    {req.sender.bio ?? t.profile_partner_req_msg}
                  </Text>
                </View>
                <TouchableOpacity style={s.acceptBtn} onPress={() => onPartnerResponse(req.id, true)} activeOpacity={0.8}>
                  <Text style={s.acceptBtnText}>{t.profile_accept}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={s.rejectBtn} onPress={() => onPartnerResponse(req.id, false)} activeOpacity={0.8}>
                  <Ionicons name="close" size={16} color={colors.gray600} />
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}
      </View>

      {/* Info section */}
      {(profile?.city || profile?.district || profile?.relationshipStatus || profile?.contact || profile?.autoReply) && (
        <View style={s.infoSection}>
          {(profile?.district || profile?.city) && (
            <InfoRow icon="location-outline" value={[profile.district, profile.city].filter(Boolean).join(', ')} />
          )}
          {profile?.relationshipStatus && (
            <InfoRow
              icon="heart-outline"
              value={
                profile.relationshipStatus === 'married'         ? `${t.profile_married}${hasPartner ? ` com ${profile.partnerName}` : ''}` :
                profile.relationshipStatus === 'in_relationship' ? `${t.profile_dating}${hasPartner ? ` com ${profile.partnerName}` : ''}` :
                t.profile_single
              }
              color={profile.relationshipStatus !== 'single' ? colors.primary : undefined}
            />
          )}
          {profile?.contact && <InfoRow icon="call-outline" value={profile.contact} />}
          {profile?.autoReply && <InfoRow icon="chatbubble-ellipses-outline" value={`${t.profile_autoreply} ${profile.autoReply}`} muted />}
        </View>
      )}

      {/* Grid header */}
      <View style={s.gridHeader}>
        <Ionicons name="grid-outline" size={15} color="#8E8E93" />
        <Text style={s.gridHeaderText}>{t.profile_publications}</Text>
      </View>
    </View>
  )
}

// ─── Other User Header ─────────────────────────────────────────────────────────
function OtherHeader({ profile, postsCount, followerCount, followingCount, isFollowing, theyFollowMe, followLoading, onFollow, onMessage, onShowFollowers, onShowFollowing }: any) {
  const t        = useT()
  const nav      = useNavigation<Nav>()
  const { top }  = useSafeAreaInsets()

  if (!profile) {
    return (
      <View>
        <View style={[s.banner, { height: BANNER_H, backgroundColor: '#F2F2F7' }]}>
          <View style={[s.bannerTopBar, { paddingTop: top + 8 }]}>
            <TouchableOpacity onPress={() => nav.goBack()} style={s.iconBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="chevron-back" size={24} color={colors.gray800} />
            </TouchableOpacity>
          </View>
        </View>
        <View style={s.hero}>
          <View style={s.dragHandle} />
          <View style={[s.skeletonCircle, { width: RING_SZ, height: RING_SZ, borderRadius: RING_SZ / 2, marginTop: -(RING_SZ / 2) }]} />
          <View style={[s.skeletonLine, { width: 140, height: 20, marginTop: 14 }]} />
          <View style={[s.skeletonLine, { width: 200, height: 14, marginTop: 8 }]} />
        </View>
      </View>
    )
  }

  const hasPartner = Boolean(profile.partnerId && profile.partnerName)
  const relLabel =
    profile.relationshipStatus === 'married'         ? `${t.profile_married}${hasPartner ? ` com ${profile.partnerName}` : ''}` :
    profile.relationshipStatus === 'in_relationship' ? `${t.profile_dating}${hasPartner ? ` com ${profile.partnerName}` : ''}` :
    profile.relationshipStatus === 'single'          ? t.profile_single : null

  return (
    <View>
      {/* Banner */}
      <View style={[s.banner, { height: BANNER_H }]}>
        {profile.avatar ? (
          <Image
            key={profile.avatar}
            source={{ uri: resolveUrl(profile.avatar) ?? '' }}
            style={s.bannerImg}
            contentFit="cover"
            cachePolicy="disk"
          />
        ) : (
          <LinearGradient
            colors={['#CA2851', '#FF6766', '#FFB173']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
        )}
        <LinearGradient
          colors={['transparent', 'transparent', 'rgba(0,0,0,0.55)', 'rgba(0,0,0,0.9)']}
          locations={[0, 0.3, 0.62, 1]}
          style={StyleSheet.absoluteFill}
        />
        <View style={[s.bannerTopBar, { paddingTop: top + 8 }]}>
          <TouchableOpacity onPress={() => nav.goBack()} style={s.iconBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="chevron-back" size={24} color="#fff" />
          </TouchableOpacity>
          <View style={s.topBarRight}>
            <TouchableOpacity style={s.iconBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="qr-code-outline" size={22} color="#fff" />
            </TouchableOpacity>
            <TouchableOpacity style={s.iconBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="share-outline" size={22} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* Hero card */}
      <View style={s.hero}>
        {/* Drag handle */}
        <View style={s.dragHandle} />

        {/* Avatar */}
        <View style={s.otherAvatarWrap}>
          <View style={s.avatarShadow}>
            <SegmentedRing count={1} viewedCount={0} size={RING_SZ} strokeWidth={3} />
            <AvatarImage uri={profile.avatar} size={AVATAR} borderColor="#fff" borderWidth={3.5} />
            {hasPartner && (
              <View style={s.partnerAvatarWrap}>
                <View style={s.partnerAvatarCircle}>
                  <Text style={s.partnerAvatarInitial}>{profile.partnerName?.[0]?.toUpperCase()}</Text>
                </View>
                <View style={s.heartBadge}>
                  <Ionicons name="heart" size={8} color="#fff" />
                </View>
              </View>
            )}
          </View>
        </View>

        {/* Name */}
        <Text style={s.heroName}>{profile.name}</Text>

        {/* Status label chip */}
        {profile.statusLabel ? (
          <View style={s.statusChip}>
            <Text style={s.statusChipText}>{profile.statusLabel}</Text>
          </View>
        ) : null}

        {/* Bio */}
        {profile.bio ? (
          <Text style={s.heroBio} numberOfLines={3}>{profile.bio}</Text>
        ) : null}

        {/* Stats */}
        <View style={s.statsRow}>
          <View style={s.statItem}>
            <Text style={s.statNum}>{postsCount}</Text>
            <Text style={s.statLabel}>{t.profile_posts}</Text>
          </View>
          <View style={s.statDivider} />
          <TouchableOpacity style={s.statItem} onPress={onShowFollowers} activeOpacity={0.7}>
            <Text style={s.statNum}>{followerCount}</Text>
            <Text style={s.statLabel}>{t.profile_followers}</Text>
          </TouchableOpacity>
          <View style={s.statDivider} />
          <TouchableOpacity style={s.statItem} onPress={onShowFollowing} activeOpacity={0.7}>
            <Text style={s.statNum}>{followingCount}</Text>
            <Text style={s.statLabel}>{t.profile_following}</Text>
          </TouchableOpacity>
        </View>

        {/* Action buttons */}
        <View style={s.actionRow}>
          {isFollowing ? (
            <TouchableOpacity style={s.followingBtn} onPress={onFollow} disabled={followLoading} activeOpacity={0.85}>
              {followLoading
                ? <ActivityIndicator size="small" color={colors.gray600} />
                : <><Ionicons name="checkmark" size={15} color="#1A1A1A" /><Text style={s.followingBtnText}>{t.following}</Text></>
              }
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={s.followBtn}
              onPress={onFollow}
              disabled={followLoading}
              activeOpacity={0.85}
            >
              {followLoading
                ? <ActivityIndicator size="small" color="#fff" />
                : <Text style={s.followBtnText}>{theyFollowMe ? t.profile_follow_back : t.follow}</Text>
              }
            </TouchableOpacity>
          )}
          <TouchableOpacity style={s.msgBtn} onPress={onMessage} activeOpacity={0.85}>
            <Text style={s.msgBtnText}>{t.profile_message}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.moreSquareBtn} activeOpacity={0.85}>
            <Ionicons name="ellipsis-horizontal" size={20} color="#3A3A3C" />
          </TouchableOpacity>
        </View>

        {/* Partner badge */}
        {hasPartner && (
          <View style={s.partnerBadge}>
            <Ionicons name="heart" size={14} color="#E8345A" />
            <Text style={s.partnerBadgeText}>{t.profile_partner} {profile.partnerName}</Text>
          </View>
        )}

        {/* Info pills */}
        {(profile.city || profile.district || relLabel || profile.contact) && (
          <View style={s.otherInfoRow}>
            {(profile.district || profile.city) && (
              <InfoPill icon="location-outline" value={[profile.district, profile.city].filter(Boolean).join(', ')} />
            )}
            {relLabel && (
              <InfoPill
                icon="heart-outline"
                value={relLabel}
                color={profile.relationshipStatus !== 'single' ? colors.primary : undefined}
              />
            )}
            {profile.contact && <InfoPill icon="call-outline" value={profile.contact} />}
          </View>
        )}
      </View>

      {/* Grid header */}
      <View style={s.gridHeader}>
        <Ionicons name="grid-outline" size={15} color="#8E8E93" />
        <Text style={s.gridHeaderText}>{t.profile_publications}</Text>
      </View>
    </View>
  )
}

// ─── Info Row ─────────────────────────────────────────────────────────────────
function InfoRow({ icon, value, color, muted }: { icon: string; value: string; color?: string; muted?: boolean }) {
  return (
    <View style={s.infoRow}>
      <Ionicons name={icon as any} size={16} color={color ?? colors.gray400} />
      <Text style={[s.infoText, muted && { color: colors.gray400 }, color ? { color } : null]} numberOfLines={2}>
        {value}
      </Text>
    </View>
  )
}

function InfoPill({ icon, value, color }: { icon: string; value: string; color?: string }) {
  return (
    <View style={s.infoPill}>
      <Ionicons name={icon as any} size={13} color={color ?? colors.gray400} />
      <Text style={[s.infoPillText, color ? { color } : null]} numberOfLines={1}>{value}</Text>
    </View>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },

  // Banner
  banner:      { width: '100%', overflow: 'hidden' },
  bannerImg:   { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  bannerTopBar: {
    position: 'absolute', top: 0, left: 0, right: 0,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingBottom: 8,
  },
  topBarRight: { flexDirection: 'row', gap: 6 },
  iconBtn: {
    width: 36, height: 36, borderRadius: 18,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.38)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)',
  },

  // Avatar save/cancel buttons
  avatarCancelBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.35)',
  },
  avatarSaveBtn: {
    height: 40, paddingHorizontal: 18, borderRadius: 20,
    backgroundColor: '#CA2851',
    alignItems: 'center', justifyContent: 'center',
    minWidth: 80,
  },
  avatarSaveTxt: {
    color: '#fff', fontFamily: fonts.semiBold, fontSize: 14,
  },

  // Hero card
  hero: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 30, borderTopRightRadius: 30,
    paddingHorizontal: 20, paddingBottom: 24,
    alignItems: 'center',
    marginTop: -30, zIndex: 1,
  },

  // Drag handle
  dragHandle: {
    width: 36, height: 4, borderRadius: 2,
    backgroundColor: '#E5E5EA',
    marginTop: 10, marginBottom: 4,
    alignSelf: 'center',
  },

  // Avatar overlaps
  ownAvatarWrap: {
    width: RING_SZ, height: RING_SZ,
    marginTop: -62,
    alignItems: 'center', justifyContent: 'center',
  },
  otherAvatarWrap: {
    width: RING_SZ, height: RING_SZ,
    marginTop: -62,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarShadow: {
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 12,
    elevation: 8,
  },
  avatarCamBadge: {
    position: 'absolute', bottom: 4, right: 4,
    width: 30, height: 30, borderRadius: 15,
    backgroundColor: '#CA2851',
    borderWidth: 2.5, borderColor: '#fff',
    alignItems: 'center', justifyContent: 'center',
  },

  // Partner avatar
  partnerAvatarWrap:    { marginLeft: -16, position: 'relative' },
  partnerAvatarCircle: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: `${colors.primary}22`,
    borderWidth: 3, borderColor: '#fff',
    alignItems: 'center', justifyContent: 'center',
  },
  partnerAvatarInitial: { fontSize: 26, fontFamily: fonts.bold, color: colors.primary },
  heartBadge: {
    position: 'absolute', bottom: 0, left: 0,
    width: 18, height: 18, borderRadius: 9,
    backgroundColor: '#FF4B6E', borderWidth: 1.5, borderColor: '#fff',
    alignItems: 'center', justifyContent: 'center',
  },

  // Name / bio
  heroName: {
    fontSize: 24, fontFamily: fonts.bold, color: '#0A0A0A',
    letterSpacing: -0.6, marginTop: 12, textAlign: 'center',
  },
  heroBio: {
    fontSize: 14, fontFamily: fonts.regular, color: '#52525B',
    textAlign: 'center', lineHeight: 21, maxWidth: 280, marginTop: 4,
  },

  // Status chip
  statusChip: {
    borderRadius: 20, paddingHorizontal: 12, paddingVertical: 5,
    borderWidth: 1, borderColor: '#E8E8EC',
    backgroundColor: '#F5F5F7', marginTop: 6,
  },
  statusChipText: {
    color: '#555', fontFamily: fonts.medium, fontSize: 12,
  },

  // Stats row
  statsRow: {
    flexDirection: 'row', alignItems: 'center',
    width: '100%',
    paddingVertical: 20,
    borderTopWidth: 1, borderTopColor: '#F2F2F7',
    marginTop: 8,
  },
  statItem:    { flex: 1, alignItems: 'center', gap: 3 },
  statDivider: { width: 1, height: 30, backgroundColor: '#F2F2F7' },
  statNum: {
    fontSize: 22, fontFamily: fonts.extraBold,
    color: '#0A0A0A', letterSpacing: -0.8,
  },
  statLabel: {
    fontSize: 10, fontFamily: fonts.medium,
    color: '#8E8E93', textTransform: 'uppercase', letterSpacing: 0.6,
  },

  // Own action row
  ownActionRow: { flexDirection: 'row', gap: 10, width: '100%' },
  editProfileBtn: {
    flex: 1, height: 46, backgroundColor: '#F5F5F7', borderRadius: 14,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7,
  },
  editProfileBtnText: { fontFamily: fonts.semiBold, fontSize: 14, color: '#1A1A1A' },
  iconSquareBtn: {
    width: 46, height: 46, borderRadius: 14,
    backgroundColor: '#F5F5F7',
    alignItems: 'center', justifyContent: 'center',
  },

  // Partner badge
  partnerBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: '#FFF0F4', borderRadius: 20,
    paddingHorizontal: 14, paddingVertical: 7,
    borderWidth: 1, borderColor: '#FFD6E0',
    marginTop: 4,
  },
  partnerBadgeText: { fontSize: 13, fontFamily: fonts.semiBold, color: '#E8345A' },

  // Partner requests inline
  inlinePartnerWrap: {
    width: '100%',
    borderTopWidth: 1, borderTopColor: '#F2F2F7',
    paddingTop: 14, gap: 10,
    marginTop: 8,
  },
  inlinePartnerHeader: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  inlinePartnerTitle:  { fontSize: 10, fontFamily: fonts.bold, color: '#E8345A', letterSpacing: 1 },
  inlinePartnerRow:    { flexDirection: 'row', alignItems: 'center', gap: 12 },
  partnerReqName:      { fontSize: 14, fontFamily: fonts.semiBold, color: '#0A0A0A' },
  partnerReqBio:       { fontSize: 12, fontFamily: fonts.regular, color: colors.gray400 },
  acceptBtn: {
    backgroundColor: '#CA2851', borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 8,
  },
  acceptBtnText: { fontSize: 13, fontFamily: fonts.semiBold, color: '#fff' },
  rejectBtn: {
    width: 32, height: 32, borderRadius: 8,
    backgroundColor: '#F5F5F7',
    alignItems: 'center', justifyContent: 'center',
  },

  // Action row (other profile)
  actionRow: { flexDirection: 'row', gap: 10, width: '100%' },
  followBtn: {
    flex: 1, height: 46, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#CA2851',
    ...Platform.select({
      ios: { shadowColor: '#CA2851', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.4, shadowRadius: 10 },
      android: { elevation: 6 },
    }),
  },
  followBtnText:   { color: '#fff', fontFamily: fonts.bold, fontSize: 15 },
  followingBtn: {
    flex: 1, height: 46, borderRadius: 14,
    backgroundColor: '#F5F5F7',
    alignItems: 'center', justifyContent: 'center',
    flexDirection: 'row', gap: 5,
  },
  followingBtnText: { color: '#1A1A1A', fontFamily: fonts.semiBold, fontSize: 15 },
  msgBtn: {
    flex: 1, height: 46, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.5, borderColor: '#E5E5EA',
  },
  msgBtnText:  { color: colors.gray800, fontFamily: fonts.semiBold, fontSize: 15 },
  moreSquareBtn: {
    width: 46, height: 46, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.5, borderColor: '#E5E5EA',
  },

  // Info pills (other profile)
  otherInfoRow: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 8,
    width: '100%', paddingTop: 8,
  },
  infoPill: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: '#F5F5F7', borderRadius: 20,
    paddingHorizontal: 12, paddingVertical: 6,
  },
  infoPillText: { fontSize: 12.5, fontFamily: fonts.medium, color: '#52525B' },

  // Info section (own profile, below hero card)
  infoSection: {
    marginHorizontal: 16, marginBottom: 4,
    paddingHorizontal: 16, paddingVertical: 14,
    backgroundColor: '#FAFAFA', borderRadius: 18, gap: 12,
  },
  infoRow:  { flexDirection: 'row', alignItems: 'center', gap: 10 },
  infoText: { fontSize: 14, fontFamily: fonts.regular, color: '#52525B', flex: 1, lineHeight: 19 },

  // Grid header
  gridHeader: {
    paddingHorizontal: 16, paddingVertical: 12, paddingTop: 16,
    flexDirection: 'row', alignItems: 'center', gap: 6,
  },
  gridHeaderText: {
    fontSize: 12, fontFamily: fonts.bold,
    color: '#8E8E93', letterSpacing: 1, textTransform: 'uppercase',
  },

  // Grid
  gridCell:    { width: GRID_SIZE, height: GRID_SIZE, margin: GRID_GAP / 2 },
  gridImg:     { width: '100%', height: '100%' },
  gridText:    { fontSize: 9, fontFamily: fonts.medium, color: '#fff', textAlign: 'center' },
  videoIcon:   {
    position: 'absolute', top: 5, right: 5,
    backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 4, padding: 3,
  },
  postMenuBtn: {
    position: 'absolute', top: 5, right: 5,
    backgroundColor: 'rgba(0,0,0,0.52)', borderRadius: 10,
    paddingHorizontal: 5, paddingVertical: 3,
  },

  // Modals
  modalOverlay: { flex: 1, backgroundColor: 'transparent', justifyContent: 'flex-end' },
  actionSheet: {
    backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20,
    paddingTop: 10, paddingBottom: 32, paddingHorizontal: 16,
  },
  sheetHandle:  { width: 36, height: 4, borderRadius: 2, backgroundColor: colors.gray200, alignSelf: 'center', marginBottom: 14 },
  sheetRow:     { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 16, paddingHorizontal: 4 },
  sheetRowText: { fontSize: 16, fontFamily: fonts.medium, color: colors.gray800 },
  sheetDivider: { height: 1, backgroundColor: colors.gray100, marginHorizontal: -4 },

  editSheet: {
    backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20,
    paddingTop: 10, paddingBottom: 32, paddingHorizontal: 20,
  },
  editSheetTitle: { fontSize: 16, fontFamily: fonts.semiBold, color: colors.gray800, marginBottom: 14, textAlign: 'center' },
  editInput: {
    borderWidth: 1.5, borderColor: colors.gray200, borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 12,
    fontSize: 15, fontFamily: fonts.regular, color: colors.gray800,
    minHeight: 90, textAlignVertical: 'top', marginBottom: 16,
  },
  editBtnRow:    { flexDirection: 'row', gap: 10 },
  editCancelBtn: { flex: 1, alignItems: 'center', paddingVertical: 14, borderRadius: 12, borderWidth: 1.5, borderColor: colors.gray200 },
  editCancelTxt: { fontSize: 15, fontFamily: fonts.semiBold, color: colors.gray600 },
  editSaveBtn:   { flex: 2, alignItems: 'center', paddingVertical: 14, borderRadius: 12, backgroundColor: colors.primary },
  editSaveTxt:   { fontSize: 15, fontFamily: fonts.semiBold, color: '#fff' },

  // Empty grid
  emptyGrid:     { alignItems: 'center', paddingTop: 56, gap: 12 },
  emptyGridText: { fontSize: 14, color: '#AEAEB2' },

  // Skeletons
  skeletonCircle: { backgroundColor: '#EFEFEF', alignSelf: 'center' },
  skeletonLine:   { backgroundColor: '#EFEFEF', borderRadius: 8, alignSelf: 'center' },
})
