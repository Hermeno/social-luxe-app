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
const GRID_GAP  = 1.5
const GRID_SIZE = (W - GRID_GAP * 2) / 3
const AVATAR_SZ = 86
const HIT       = { top: 10, bottom: 10, left: 10, right: 10 }

function resolveUrl(url: string | null | undefined): string | null {
  if (!url) return null
  if (url.startsWith('http') || url.startsWith('file://')) return url
  return `${API_BASE}${url}`
}

function fmtStat(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 10_000)    return `${Math.round(n / 1_000)}K`
  if (n >= 1_000)     return `${(n / 1_000).toFixed(1)}K`
  return String(n)
}

function buildInfoLine(profile: any, hasPartner: boolean): string {
  const parts: string[] = []
  const loc = [profile?.district, profile?.city].filter(Boolean).join(', ')
  if (loc) parts.push(loc)
  if (profile?.relationshipStatus) {
    const pName = hasPartner ? ` com ${profile.partnerName}` : ''
    const rel =
      profile.relationshipStatus === 'married'         ? `Casado${pName}` :
      profile.relationshipStatus === 'in_relationship' ? `Relacionamento${pName}` :
      profile.relationshipStatus === 'single'          ? 'Solteiro(a)' : ''
    if (rel) parts.push(rel)
  }
  return parts.join(' · ')
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
        const [userRes, postsRes, followStatus] = await Promise.all([
          isOwn
            ? Promise.resolve({ data: { data: latestMe } })
            : api.get(`/users/${targetId}`),
          api.get(`/users/${targetId}/posts`),
          isOwn
            ? Promise.resolve(null)
            : followService.getFollowStatus(targetId)
                .catch(() => ({ following: false, followsMe: false })),
        ])
        if (cancelled) return

        const p = userRes.data.data as User
        if (!p) throw new Error('not found')
        const freshPosts: Post[] = postsRes.data.data ?? []

        setProfile(p)
        setPosts(freshPosts)
        setCache(`profile_posts:${targetId}`, freshPosts).catch(() => {})

        if (!isOwn && followStatus) {
          setIsFollowing(followStatus.following)
          setTheyFollowMe(followStatus.followsMe)
        }

        if (!isOwn) {
          const cachedFollowerCount  = cachedMeta?.followerCount  ?? 0
          const cachedFollowingCount = cachedMeta?.followingCount ?? 0
          setFollowerCount(cachedFollowerCount)
          setFollowingCount(cachedFollowingCount)

          Promise.all([
            followService.getUserFollowers(targetId),
            followService.getUserFollowing(targetId),
          ]).then(([followersRes, followingRes]) => {
            if (cancelled) return
            setFollowerCount(followersRes.length)
            setFollowingCount(followingRes.length)
            setCache(`profile:${targetId}`, {
              user: p,
              followerCount: followersRes.length,
              followingCount: followingRes.length,
              isFollowing: followStatus?.following ?? false,
              theyFollowMe: followStatus?.followsMe ?? false,
            } as ProfileCache).catch(() => {})
          }).catch(() => {})
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
      const [userRes, postsRes] = await Promise.all([
        isOwn ? Promise.resolve({ data: { data: latestMe } }) : api.get(`/users/${targetId}`),
        api.get(`/users/${targetId}/posts`),
      ])
      const p = userRes.data.data as User
      if (!p) return
      const freshPosts: Post[] = postsRes.data.data ?? []
      setProfile(p)
      setPosts(freshPosts)
      setCache(`profile_posts:${targetId}`, freshPosts).catch(() => {})
      if (isOwn) {
        await refreshUser()
        const refreshedMe = useAuthStore.getState().user
        if (refreshedMe) setProfile(refreshedMe)
      }
      if (!isOwn) {
        Promise.all([
          followService.getUserFollowers(targetId),
          followService.getUserFollowing(targetId),
        ]).then(([f, fo]) => {
          setFollowerCount(f.length)
          setFollowingCount(fo.length)
        }).catch(() => {})
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

  function renderPost({ item }: { item: Post }) {
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
          <View style={s.videoIcon}><Ionicons name="play" size={10} color={colors.white} /></View>
        )}
        {isOwn && (
          <TouchableOpacity style={s.postMenuBtn} onPress={() => handleMenuOpen(item)} hitSlop={{ top: 6, right: 6, bottom: 6, left: 6 }}>
            <Ionicons name="ellipsis-horizontal" size={13} color={colors.white} />
          </TouchableOpacity>
        )}
      </TouchableOpacity>
    )
  }

  const header = isOwn
    ? <OwnHeader
        profile={profile}
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
        contentContainerStyle={{ paddingBottom: Math.max(bottom, 8) + 58 }}
      />
      {isOwn && profile && <QRModal visible={showQR} userId={profile.id} userName={profile.name} onClose={() => setShowQR(false)} />}
      <FollowersSheet visible={showFollowSheet} mode={followSheetMode} userId={targetId} onClose={() => setShowFollowSheet(false)} />

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
                  ? <ActivityIndicator color={colors.white} size="small" />
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
      {/* ── Top bar ── */}
      <View style={[n.topBar, { paddingTop: top + 6 }]}>
        {canGoBack
          ? <TouchableOpacity onPress={() => nav.goBack()} hitSlop={HIT}>
              <Ionicons name="chevron-back" size={26} color={colors.dark} />
            </TouchableOpacity>
          : <View style={{ width: 32 }} />
        }
        <Text style={n.topBarName} numberOfLines={1}>{profile?.name ?? ''}</Text>
        <TouchableOpacity onPress={onLogout} hitSlop={HIT}>
          <Ionicons name="ellipsis-horizontal" size={22} color={colors.dark} />
        </TouchableOpacity>
      </View>

      {/* ── Body ── */}
      <View style={n.body}>

        {/* Avatar + stats */}
        <View style={n.asr}>
          <TouchableOpacity onPress={onPickAvatar} activeOpacity={0.85} style={n.avatarWrap}>
            {displayUri
              ? <Image source={{ uri: displayUri }} style={n.avatar} contentFit="cover"
                  cachePolicy={displayUri.startsWith('file://') ? 'none' : 'disk'} />
              : <View style={[n.avatar, n.avatarFallback]}>
                  <Text style={n.avatarInitial}>{profile?.name?.[0]?.toUpperCase() ?? '?'}</Text>
                </View>
            }
            {!pendingAvatarUri && (
              <View style={n.camBadge}>
                <Ionicons name="camera" size={11} color={colors.white} />
              </View>
            )}
          </TouchableOpacity>

          <View style={n.stats}>
            <TouchableOpacity style={n.statCol} activeOpacity={0.7}>
              <Text style={n.statNum}>{postsCount}</Text>
              <Text style={n.statLbl}>{t.profile_posts}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={n.statCol} onPress={onShowFollowers} activeOpacity={0.7}>
              <Text style={n.statNum}>{fmtStat(followerCount)}</Text>
              <Text style={n.statLbl}>{t.profile_followers}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={n.statCol} onPress={onShowFollowing} activeOpacity={0.7}>
              <Text style={n.statNum}>{fmtStat(followingCount)}</Text>
              <Text style={n.statLbl}>{t.profile_following}</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Name + bio + info */}
        <Text style={n.name}>{profile?.name ?? ''}</Text>
        {!!profile?.statusLabel && <Text style={n.statusLbl}>{profile.statusLabel}</Text>}
        {!!profile?.bio && <Text style={n.bio} numberOfLines={4}>{profile.bio}</Text>}
        {!!buildInfoLine(profile, hasPartner) && (
          <Text style={n.infoLine}>{buildInfoLine(profile, hasPartner)}</Text>
        )}
        {hasPartner && (
          <View style={n.partnerBadge}>
            <Ionicons name="heart" size={12} color={colors.primary} />
            <Text style={n.partnerBadgeTxt}>{t.profile_partner} {profile.partnerName}</Text>
          </View>
        )}

        {/* Action buttons */}
        {pendingAvatarUri ? (
          <View style={n.btnRow}>
            <TouchableOpacity style={n.outlineBtn} onPress={onCancelAvatar} activeOpacity={0.8}>
              <Text style={n.outlineBtnTxt}>{t.cancel}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={n.primaryBtn} onPress={onSaveAvatar} disabled={savingAvatar} activeOpacity={0.8}>
              {savingAvatar
                ? <ActivityIndicator size="small" color={colors.white} />
                : <Text style={n.primaryBtnTxt}>{t.save}</Text>
              }
            </TouchableOpacity>
          </View>
        ) : (
          <View style={n.btnRow}>
            <TouchableOpacity style={n.outlineBtn} onPress={onEdit} activeOpacity={0.85}>
              <Text style={n.outlineBtnTxt}>{t.profile_edit_btn}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={n.squareBtn} onPress={onShowQR} activeOpacity={0.85}>
              <Ionicons name="qr-code-outline" size={17} color={colors.dark} />
            </TouchableOpacity>
            <TouchableOpacity style={n.squareBtn} onPress={() => onNavigate('Settings')} activeOpacity={0.85}>
              <Ionicons name="settings-outline" size={17} color={colors.dark} />
            </TouchableOpacity>
          </View>
        )}

        {/* Partner requests */}
        {partnerRequests?.length > 0 && (
          <View style={n.partnerReqs}>
            <View style={n.partnerReqsHeader}>
              <Ionicons name="heart-circle" size={14} color={colors.primary} />
              <Text style={n.partnerReqsTitle}>{t.profile_partner_req}</Text>
            </View>
            {partnerRequests.map((req: any) => (
              <View key={req.id} style={n.partnerReqRow}>
                <AvatarImage uri={req.sender.avatar} size={38} />
                <View style={{ flex: 1 }}>
                  <Text style={n.partnerReqName}>{req.sender.name}</Text>
                  <Text style={n.partnerReqBio} numberOfLines={1}>
                    {req.sender.bio ?? t.profile_partner_req_msg}
                  </Text>
                </View>
                <TouchableOpacity style={n.acceptBtn} onPress={() => onPartnerResponse(req.id, true)} activeOpacity={0.8}>
                  <Text style={n.acceptBtnTxt}>{t.profile_accept}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={n.rejectBtn} onPress={() => onPartnerResponse(req.id, false)} activeOpacity={0.8}>
                  <Ionicons name="close" size={15} color={colors.gray600} />
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}
      </View>

      {/* ── Grid tab bar ── */}
      <View style={n.tabBar}>
        <View style={n.tabActive}>
          <Ionicons name="grid" size={20} color={colors.dark} />
          <View style={n.tabUnderline} />
        </View>
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
        <View style={[n.topBar, { paddingTop: top + 6 }]}>
          <TouchableOpacity onPress={() => nav.goBack()} hitSlop={HIT}>
            <Ionicons name="chevron-back" size={26} color={colors.dark} />
          </TouchableOpacity>
          <View style={[n.skelLine, { flex: 1, height: 14, marginHorizontal: 24 }]} />
          <View style={{ width: 32 }} />
        </View>
        <View style={n.body}>
          <View style={n.asr}>
            <View style={n.skelAvatar} />
            <View style={n.stats}>
              {[0, 1, 2].map((i) => (
                <View key={i} style={n.statCol}>
                  <View style={[n.skelLine, { width: 32, height: 18, marginBottom: 5 }]} />
                  <View style={[n.skelLine, { width: 48, height: 11 }]} />
                </View>
              ))}
            </View>
          </View>
          <View style={[n.skelLine, { width: 120, height: 14, marginTop: 14 }]} />
          <View style={[n.skelLine, { width: 200, height: 11, marginTop: 8 }]} />
        </View>
      </View>
    )
  }

  const hasPartner = Boolean(profile.partnerId && profile.partnerName)

  return (
    <View>
      {/* ── Top bar ── */}
      <View style={[n.topBar, { paddingTop: top + 6 }]}>
        <TouchableOpacity onPress={() => nav.goBack()} hitSlop={HIT}>
          <Ionicons name="chevron-back" size={26} color={colors.dark} />
        </TouchableOpacity>
        <Text style={n.topBarName} numberOfLines={1}>{profile.name}</Text>
        <View style={{ width: 32 }} />
      </View>

      {/* ── Body ── */}
      <View style={n.body}>

        {/* Avatar + stats */}
        <View style={n.asr}>
          <View style={n.avatarWrap}>
            {profile.avatar
              ? <Image source={{ uri: resolveUrl(profile.avatar) ?? '' }} style={n.avatar} contentFit="cover" cachePolicy="disk" />
              : <View style={[n.avatar, n.avatarFallback]}>
                  <Text style={n.avatarInitial}>{profile.name?.[0]?.toUpperCase() ?? '?'}</Text>
                </View>
            }
          </View>

          <View style={n.stats}>
            <View style={n.statCol}>
              <Text style={n.statNum}>{postsCount}</Text>
              <Text style={n.statLbl}>{t.profile_posts}</Text>
            </View>
            <TouchableOpacity style={n.statCol} onPress={onShowFollowers} activeOpacity={0.7}>
              <Text style={n.statNum}>{fmtStat(followerCount)}</Text>
              <Text style={n.statLbl}>{t.profile_followers}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={n.statCol} onPress={onShowFollowing} activeOpacity={0.7}>
              <Text style={n.statNum}>{fmtStat(followingCount)}</Text>
              <Text style={n.statLbl}>{t.profile_following}</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Name + bio + info */}
        <Text style={n.name}>{profile.name}</Text>
        {!!profile.statusLabel && <Text style={n.statusLbl}>{profile.statusLabel}</Text>}
        {!!profile.bio && <Text style={n.bio} numberOfLines={4}>{profile.bio}</Text>}
        {!!buildInfoLine(profile, hasPartner) && (
          <Text style={n.infoLine}>{buildInfoLine(profile, hasPartner)}</Text>
        )}
        {hasPartner && (
          <View style={n.partnerBadge}>
            <Ionicons name="heart" size={12} color={colors.primary} />
            <Text style={n.partnerBadgeTxt}>{t.profile_partner} {profile.partnerName}</Text>
          </View>
        )}

        {/* Action buttons */}
        <View style={n.btnRow}>
          {isFollowing ? (
            <TouchableOpacity style={n.outlineBtn} onPress={onFollow} disabled={followLoading} activeOpacity={0.85}>
              {followLoading
                ? <ActivityIndicator size="small" color={colors.gray600} />
                : <Text style={n.outlineBtnTxt}>{t.following}</Text>
              }
            </TouchableOpacity>
          ) : (
            <TouchableOpacity style={n.primaryBtn} onPress={onFollow} disabled={followLoading} activeOpacity={0.85}>
              {followLoading
                ? <ActivityIndicator size="small" color={colors.white} />
                : <Text style={n.primaryBtnTxt}>{theyFollowMe ? t.profile_follow_back : t.follow}</Text>
              }
            </TouchableOpacity>
          )}
          <TouchableOpacity style={n.outlineBtn} onPress={onMessage} activeOpacity={0.85}>
            <Text style={n.outlineBtnTxt}>{t.profile_message}</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* ── Grid tab bar ── */}
      <View style={n.tabBar}>
        <View style={n.tabActive}>
          <Ionicons name="grid" size={20} color={colors.dark} />
          <View style={n.tabUnderline} />
        </View>
      </View>
    </View>
  )
}

// ─── Header styles (Instagram layout) ─────────────────────────────────────────
const n = StyleSheet.create({
  topBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingBottom: 12,
    backgroundColor: colors.white,
  },
  topBarName: {
    flex: 1, textAlign: 'center',
    fontSize: 16, fontFamily: fonts.bold, color: colors.dark,
    letterSpacing: -0.3, marginHorizontal: 4,
  },

  body: { paddingHorizontal: 16, paddingBottom: 4 },

  asr: { flexDirection: 'row', alignItems: 'center', gap: 20, marginBottom: 14 },

  avatarWrap: { position: 'relative' },
  avatar: {
    width: AVATAR_SZ, height: AVATAR_SZ, borderRadius: AVATAR_SZ / 2,
    backgroundColor: colors.gray100,
  },
  avatarFallback: {
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: `${colors.primary}20`,
  },
  avatarInitial: { fontSize: 32, fontFamily: fonts.bold, color: colors.primary },
  camBadge: {
    position: 'absolute', bottom: 1, right: 1,
    width: 24, height: 24, borderRadius: 12,
    backgroundColor: colors.dark,
    borderWidth: 2, borderColor: colors.white,
    alignItems: 'center', justifyContent: 'center',
  },

  stats: { flex: 1, flexDirection: 'row', justifyContent: 'space-around' },
  statCol: { alignItems: 'center', gap: 2 },
  statNum: { fontSize: 18, fontFamily: fonts.bold, color: colors.dark, letterSpacing: -0.4 },
  statLbl: { fontSize: 12, fontFamily: fonts.regular, color: colors.gray600 },

  name:      { fontSize: 14, fontFamily: fonts.bold, color: colors.dark, letterSpacing: -0.1 },
  statusLbl: { fontSize: 13, fontFamily: fonts.medium, color: colors.gray600, marginTop: 2 },
  bio:       { fontSize: 13.5, fontFamily: fonts.regular, color: colors.gray800, lineHeight: 19, marginTop: 3 },
  infoLine:  { fontSize: 12.5, fontFamily: fonts.regular, color: colors.gray500, marginTop: 4 },

  partnerBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 6 },
  partnerBadgeTxt: { fontSize: 13, fontFamily: fonts.semiBold, color: colors.primary },

  btnRow: { flexDirection: 'row', gap: 8, marginTop: 14, marginBottom: 6 },
  outlineBtn: {
    flex: 1, height: 34, borderRadius: 8,
    borderWidth: 1, borderColor: colors.gray300,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.white,
  },
  outlineBtnTxt: { fontSize: 14, fontFamily: fonts.semiBold, color: colors.dark },
  primaryBtn: {
    flex: 1, height: 34, borderRadius: 8,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.primary,
  },
  primaryBtnTxt: { fontSize: 14, fontFamily: fonts.semiBold, color: colors.white },
  squareBtn: {
    width: 34, height: 34, borderRadius: 8,
    borderWidth: 1, borderColor: colors.gray300,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.white,
  },

  partnerReqs: {
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.gray200,
    paddingTop: 12, marginTop: 10, gap: 10,
  },
  partnerReqsHeader: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  partnerReqsTitle: {
    fontSize: 10, fontFamily: fonts.bold, color: colors.primary,
    letterSpacing: 1, textTransform: 'uppercase',
  },
  partnerReqRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  partnerReqName: { fontSize: 14, fontFamily: fonts.semiBold, color: colors.dark },
  partnerReqBio:  { fontSize: 12, fontFamily: fonts.regular, color: colors.gray500 },
  acceptBtn: {
    backgroundColor: colors.primary, borderRadius: 8,
    paddingHorizontal: 12, paddingVertical: 7,
  },
  acceptBtnTxt: { fontSize: 13, fontFamily: fonts.semiBold, color: colors.white },
  rejectBtn: {
    width: 30, height: 30, borderRadius: 7,
    backgroundColor: colors.gray100,
    alignItems: 'center', justifyContent: 'center',
  },

  tabBar: {
    flexDirection: 'row',
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.gray300,
    marginTop: 12,
  },
  tabActive: {
    flex: 1, alignItems: 'center', paddingVertical: 10, position: 'relative',
  },
  tabUnderline: {
    position: 'absolute', bottom: 0, left: 0, right: 0, height: 1,
    backgroundColor: colors.dark,
  },

  skelLine:   { backgroundColor: colors.gray100, borderRadius: 6 },
  skelAvatar: {
    width: AVATAR_SZ, height: AVATAR_SZ, borderRadius: AVATAR_SZ / 2,
    backgroundColor: colors.gray100,
  },
})

// ─── Grid / Modal styles ───────────────────────────────────────────────────────
const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.white },

  gridCell:    { width: GRID_SIZE, height: GRID_SIZE, margin: GRID_GAP / 2 },
  gridImg:     { width: '100%', height: '100%' },
  gridText:    { fontSize: 9, fontFamily: fonts.medium, color: colors.white, textAlign: 'center' },
  videoIcon: {
    position: 'absolute', top: 5, right: 5,
    backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 4, padding: 3,
  },
  postMenuBtn: {
    position: 'absolute', top: 5, right: 5,
    backgroundColor: 'rgba(0,0,0,0.52)', borderRadius: 10,
    paddingHorizontal: 5, paddingVertical: 3,
  },

  emptyGrid:     { alignItems: 'center', paddingTop: 56, gap: 12 },
  emptyGridText: { fontSize: 14, color: colors.gray400 },

  modalOverlay: { flex: 1, backgroundColor: 'transparent', justifyContent: 'flex-end' },
  actionSheet: {
    backgroundColor: colors.white, borderTopLeftRadius: 20, borderTopRightRadius: 20,
    paddingTop: 10, paddingBottom: 32, paddingHorizontal: 16,
  },
  sheetHandle:  { width: 36, height: 4, borderRadius: 2, backgroundColor: colors.gray200, alignSelf: 'center', marginBottom: 14 },
  sheetRow:     { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 16, paddingHorizontal: 4 },
  sheetRowText: { fontSize: 16, fontFamily: fonts.medium, color: colors.gray800 },
  sheetDivider: { height: 1, backgroundColor: colors.gray100, marginHorizontal: -4 },

  editSheet: {
    backgroundColor: colors.white, borderTopLeftRadius: 20, borderTopRightRadius: 20,
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
  editSaveTxt:   { fontSize: 15, fontFamily: fonts.semiBold, color: colors.white },
})
