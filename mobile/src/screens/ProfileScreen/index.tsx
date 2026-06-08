import React, { useState, useCallback } from 'react'
import {
  View, Text, TouchableOpacity, FlatList,
  RefreshControl, StyleSheet, Alert, Dimensions,
  ActivityIndicator,
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
import { colors, fonts } from '../../theme'
import AvatarImage from '../../components/AvatarImage'
import FollowersSheet from './FollowersSheet'
import QRModal from '../../components/QRModal'
import * as followService from '../../services/follow.service'
import { API_BASE } from '../../config'
import { getCache, setCache } from '../../db/database'
import { isConnected } from '../../services/netinfo.service'
import { useFeedStore } from '../../store/feed.store'

type Nav   = StackNavigationProp<AppStackParams>
type Route = RouteProp<AppStackParams, 'Profile'>

const { width: W } = Dimensions.get('window')
const GRID_GAP  = 2
const GRID_SIZE = (W - GRID_GAP * 2) / 3

function resolveUrl(url: string | null | undefined): string | null {
  if (!url) return null
  return url.startsWith('http') ? url : `${API_BASE}${url}`
}

interface PartnerRequest {
  id: string
  senderId: string
  status: string
  sender: { id: string; name: string; avatar: string | null; bio: string | null }
}

export default function ProfileScreen() {
  const { user: me, logout, loadUser } = useAuthStore()
  const nav   = useNavigation<Nav>()
  const route = useRoute<Route>()
  const { top, bottom } = useSafeAreaInsets()

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
      if (!cancelled) {
        if (cachedMeta && !isOwn) {
          setProfile(cachedMeta.user)
          setFollowerCount(cachedMeta.followerCount)
          setFollowingCount(cachedMeta.followingCount)
          setIsFollowing(cachedMeta.isFollowing)
          setTheyFollowMe(cachedMeta.theyFollowMe ?? false)
        }
        if (cachedPosts) setPosts(cachedPosts)
        if (isOwn && me) setProfile(me)
      }
      if (!isConnected()) { setRefreshing(false); return }
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

  // Load partner requests — offline-first, own profile only
  useFocusEffect(useCallback(() => {
    if (!isOwn) return
    let active = true
    async function loadPartnerReqs() {
      // 1. Serve from cache immediately
      const cached = await getCache<PartnerRequest[]>('partner_requests').catch(() => null)
      if (cached && active) setPartnerRequests(cached)
      // 2. Background network sync
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
      if (isOwn) await loadUser()
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
    // Optimistic update — remove from list immediately
    setPartnerRequests((prev) => {
      const updated = prev.filter((r) => r.id !== id)
      setCache('partner_requests', updated).catch(() => {})
      return updated
    })
    try {
      await api.put(`/users/partner-requests/${id}/${accept ? 'accept' : 'reject'}`)
      if (accept) {
        await loadUser()
        setProfile((p) => p ? { ...p, ...me } : p)
      }
    } catch {
      // Rollback not practical here — just reload fresh
      api.get('/users/partner-requests')
        .then((r) => {
          const fresh = r.data.data ?? []
          setPartnerRequests(fresh)
          setCache('partner_requests', fresh).catch(() => {})
        }).catch(() => {})
      Alert.alert('Erro', 'Não foi possível processar o pedido.')
    }
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

  const setJumpToPostId = useFeedStore((s) => s.setJumpToPostId)
  function openPost(index: number) {
    const postId = posts[index]?.id
    if (!postId) return
    setJumpToPostId(postId)
    nav.navigate('Tabs' as any, { screen: 'Feed' } as any)
  }

  function renderPost({ item, index }: { item: Post; index: number }) {
    const thumb = resolveUrl(item.thumbnailUrl ?? item.mediaUrl)
    return (
      <TouchableOpacity style={s.gridCell} onPress={() => openPost(index)} activeOpacity={0.88}>
        {item.mediaType === 'TEXT' ? (
          <View style={[s.gridImg, { backgroundColor: item.bgColor ?? '#FF4B6E', justifyContent: 'center', alignItems: 'center', padding: 4 }]}>
            <Text style={s.gridText} numberOfLines={4}>{item.caption}</Text>
          </View>
        ) : (
          <Image source={{ uri: thumb ?? '' }} style={s.gridImg} contentFit="cover" cachePolicy="disk" recyclingKey={`grid-${item.id}`} />
        )}
        {item.mediaType === 'VIDEO' && (
          <View style={s.videoIcon}><Ionicons name="play" size={10} color="#fff" /></View>
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
        onEdit={() => nav.navigate('EditProfile' as any)}
        onShowFollowers={() => { setFollowSheetMode('followers'); setShowFollowSheet(true) }}
        onShowFollowing={() => { setFollowSheetMode('following'); setShowFollowSheet(true) }}
        onNavigate={(screen: string) => nav.navigate(screen as any)}
        onPartnerResponse={handlePartnerResponse}
        onLogout={() => Alert.alert('Logout', 'Sair da conta?', [{ text: 'Cancelar' }, { text: 'Sair', style: 'destructive', onPress: logout }])}
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
    <View style={[s.container, { paddingTop: top }]}>
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
            <Ionicons name="images-outline" size={44} color={colors.gray200} />
            <Text style={s.emptyGridText}>Sem publicações ainda</Text>
          </View>
        }
        contentContainerStyle={{ paddingBottom: bottom + 16 }}
      />
      {isOwn && profile && <QRModal visible={showQR} userId={profile.id} userName={profile.name} onClose={() => setShowQR(false)} />}
      <FollowersSheet visible={showFollowSheet} mode={followSheetMode} userId={targetId} onClose={() => setShowFollowSheet(false)} />
    </View>
  )
}

// ─── Own Profile Header ────────────────────────────────────────────────────────
function OwnHeader({ profile, me, postsCount, followerCount, followingCount, partnerRequests, onPickAvatar, onEdit, onShowFollowers, onShowFollowing, onNavigate, onPartnerResponse, onLogout, onShowQR }: any) {
  const nav        = useNavigation<Nav>()
  const canGoBack  = nav.canGoBack()
  const hasPartner = Boolean(profile?.partnerId && profile?.partnerName)

  return (
    <View>
      {/* ── Top bar ── */}
      <View style={s.topBar}>
        {canGoBack ? (
          <TouchableOpacity onPress={() => nav.goBack()} style={s.iconBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="chevron-back" size={26} color={colors.gray800} />
          </TouchableOpacity>
        ) : (
          <View style={s.iconBtn} />
        )}
        <Text style={s.screenTitle}>Perfil</Text>
        <View style={s.topBarRight}>
          <TouchableOpacity onPress={onShowQR} style={s.iconBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="qr-code-outline" size={22} color={colors.gray800} />
          </TouchableOpacity>
          <TouchableOpacity onPress={onLogout} style={s.iconBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="log-out-outline" size={22} color={colors.gray800} />
          </TouchableOpacity>
        </View>
      </View>

      {/* ── Hero ── */}
      <View style={s.hero}>
        {/* Avatars */}
        <View style={s.avatarRow}>
          <TouchableOpacity onPress={onPickAvatar} activeOpacity={0.85} style={s.avatarWrap}>
            <AvatarImage uri={profile?.avatar} size={88} borderColor={colors.primary} borderWidth={2.5} />
            <View style={s.cameraBtn}>
              <Ionicons name="camera" size={12} color="#fff" />
            </View>
          </TouchableOpacity>
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

        {/* Name */}
        <Text style={s.heroName}>{profile?.name ?? ''}</Text>
        {profile?.bio ? <Text style={s.heroBio}>{profile.bio}</Text> : null}

        {/* Stats */}
        <View style={s.statsCard}>
          <TouchableOpacity style={s.statItem} activeOpacity={0.7}>
            <Text style={s.statNum}>{postsCount}</Text>
            <Text style={s.statLabel}>Posts</Text>
          </TouchableOpacity>
          <View style={s.statDivider} />
          <TouchableOpacity style={s.statItem} onPress={onShowFollowers} activeOpacity={0.7}>
            <Text style={s.statNum}>{followerCount}</Text>
            <Text style={s.statLabel}>Seguidores</Text>
          </TouchableOpacity>
          <View style={s.statDivider} />
          <TouchableOpacity style={s.statItem} onPress={onShowFollowing} activeOpacity={0.7}>
            <Text style={s.statNum}>{followingCount}</Text>
            <Text style={s.statLabel}>Seguindo</Text>
          </TouchableOpacity>
        </View>

        {/* Partner association badge */}
        {hasPartner && (
          <View style={s.partnerBadge}>
            <Ionicons name="heart" size={13} color="#FF4B6E" />
            <Text style={s.partnerBadgeText}>Associado/a a {profile.partnerName}</Text>
          </View>
        )}

        {/* Edit profile button */}
        <TouchableOpacity style={s.editProfileBtn} onPress={onEdit} activeOpacity={0.85}>
          <Ionicons name="pencil-outline" size={15} color={colors.gray800} />
          <Text style={s.editProfileBtnText}>Editar perfil</Text>
        </TouchableOpacity>

        {/* ── Partner requests — inline below edit button ── */}
        {partnerRequests.length > 0 && (
          <View style={s.inlinePartnerWrap}>
            <View style={s.inlinePartnerHeader}>
              <Ionicons name="heart-circle" size={15} color="#FF4B6E" />
              <Text style={s.inlinePartnerTitle}>PEDIDO DE ASSOCIAÇÃO</Text>
            </View>
            {partnerRequests.map((req: any) => (
              <View key={req.id} style={s.inlinePartnerRow}>
                <AvatarImage uri={req.sender.avatar} size={42} />
                <View style={{ flex: 1 }}>
                  <Text style={s.partnerReqName}>{req.sender.name}</Text>
                  {req.sender.bio
                    ? <Text style={s.partnerReqBio} numberOfLines={1}>{req.sender.bio}</Text>
                    : <Text style={s.partnerReqBio}>Quer associar-se a ti 💑</Text>
                  }
                </View>
                <TouchableOpacity
                  style={s.acceptBtn}
                  onPress={() => onPartnerResponse(req.id, true)}
                  activeOpacity={0.8}
                >
                  <Text style={s.acceptBtnText}>Aceitar</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={s.rejectBtn}
                  onPress={() => onPartnerResponse(req.id, false)}
                  activeOpacity={0.8}
                >
                  <Ionicons name="close" size={16} color={colors.gray600} />
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}
      </View>

      {/* ── Info cards ── */}
      {(profile?.city || profile?.district || profile?.relationshipStatus || profile?.contact || profile?.availability || profile?.autoReply) && (
        <View style={s.infoSection}>
          {(profile?.district || profile?.city) && (
            <InfoRow icon="location-outline" value={[profile.district, profile.city].filter(Boolean).join(', ')} />
          )}
          {profile?.relationshipStatus && (
            <InfoRow
              icon="heart-outline"
              value={
                profile.relationshipStatus === 'married'         ? `Casado/a${hasPartner ? ` com ${profile.partnerName}` : ''}` :
                profile.relationshipStatus === 'in_relationship' ? `Em relacionamento${hasPartner ? ` com ${profile.partnerName}` : ''}` :
                'Solteiro/a'
              }
              color={profile.relationshipStatus !== 'single' ? colors.primary : undefined}
            />
          )}
          {profile?.contact && (
            <InfoRow icon="call-outline" value={profile.contact} />
          )}
          {profile?.availability && (
            <InfoRow
              icon="radio-button-on"
              value={profile.availability}
              color={profile.availability === 'Disponível' ? '#22C55E' : profile.availability === 'Ocupado' ? '#F59E0B' : colors.gray400}
            />
          )}
          {profile?.autoReply && (
            <InfoRow icon="chatbubble-ellipses-outline" value={`Auto-reply: ${profile.autoReply}`} muted />
          )}
        </View>
      )}


      {/* ── Quick actions ── */}
      <View style={s.quickRow}>
        {[
          { icon: 'bookmark-outline',      label: 'Salvos',       screen: 'Bookmarks'     },
          { icon: 'trophy-outline',        label: 'Desafios',     screen: 'Challenges'    },
          { icon: 'notifications-outline', label: 'Notificações', screen: 'Notifications' },
        ].map(({ icon, label, screen }) => (
          <TouchableOpacity key={label} style={s.quickBtn} onPress={() => onNavigate(screen)} activeOpacity={0.75}>
            <Ionicons name={icon as any} size={20} color={colors.gray600} />
            <Text style={s.quickLabel}>{label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={s.gridHeader}>
        <Ionicons name="grid-outline" size={16} color={colors.gray600} />
        <Text style={s.gridHeaderText}>Publicações</Text>
      </View>
    </View>
  )
}

// ─── Other User Header ─────────────────────────────────────────────────────────
function OtherHeader({ profile, postsCount, followerCount, followingCount, isFollowing, theyFollowMe, followLoading, onFollow, onMessage, onShowFollowers, onShowFollowing }: any) {
  const nav = useNavigation<Nav>()

  // Skeleton while loading
  if (!profile) {
    return (
      <View style={s.otherHero}>
        <View style={[s.skeletonCircle, { width: 88, height: 88, borderRadius: 44 }]} />
        <View style={[s.skeletonLine, { width: 140, height: 20, marginTop: 12 }]} />
        <View style={[s.skeletonLine, { width: 200, height: 14, marginTop: 8 }]} />
        <View style={s.gridHeader}>
          <Text style={s.gridHeaderText}>Publicações</Text>
        </View>
      </View>
    )
  }

  const hasPartner = Boolean(profile.partnerId && profile.partnerName)
  const relLabel =
    profile.relationshipStatus === 'married'         ? `Casado/a${hasPartner ? ` com ${profile.partnerName}` : ''}` :
    profile.relationshipStatus === 'in_relationship' ? `Em relacionamento${hasPartner ? ` com ${profile.partnerName}` : ''}` :
    profile.relationshipStatus === 'single'          ? 'Solteiro/a' : null

  return (
    <View>
      {/* ── Top bar ── */}
      <View style={s.topBar}>
        <TouchableOpacity onPress={() => nav.goBack()} style={s.iconBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="chevron-back" size={26} color={colors.gray800} />
        </TouchableOpacity>
        <Text style={s.screenTitle} numberOfLines={1}>{profile.name}</Text>
        <View style={{ width: 44 }} />
      </View>

      <View style={s.otherHero}>
        {/* Avatar */}
        <View style={s.avatarRow}>
          <AvatarImage uri={profile.avatar} size={88} borderColor={colors.primary} borderWidth={2.5} />
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

        <Text style={s.heroName}>{profile.name}</Text>
        {profile.bio ? <Text style={s.heroBio}>{profile.bio}</Text> : null}

        {/* Stats */}
        <View style={s.statsCard}>
          <View style={s.statItem}>
            <Text style={s.statNum}>{postsCount}</Text>
            <Text style={s.statLabel}>Posts</Text>
          </View>
          <View style={s.statDivider} />
          <TouchableOpacity style={s.statItem} onPress={onShowFollowers} activeOpacity={0.7}>
            <Text style={s.statNum}>{followerCount}</Text>
            <Text style={s.statLabel}>Seguidores</Text>
          </TouchableOpacity>
          <View style={s.statDivider} />
          <TouchableOpacity style={s.statItem} onPress={onShowFollowing} activeOpacity={0.7}>
            <Text style={s.statNum}>{followingCount}</Text>
            <Text style={s.statLabel}>Seguindo</Text>
          </TouchableOpacity>
        </View>

        {/* Action buttons */}
        <View style={s.actionRow}>
          <TouchableOpacity style={s.msgBtn} onPress={onMessage} activeOpacity={0.85}>
            <Ionicons name="chatbubble-ellipses" size={16} color="#fff" />
            <Text style={s.msgBtnText}>Mensagem</Text>
          </TouchableOpacity>
          {isFollowing ? (
            <TouchableOpacity style={s.followingBtn} onPress={onFollow} disabled={followLoading} activeOpacity={0.85}>
              {followLoading
                ? <ActivityIndicator size="small" color={colors.gray600} />
                : <><Ionicons name="checkmark" size={14} color={colors.gray600} /><Text style={s.followingBtnText}>Seguindo</Text></>
              }
            </TouchableOpacity>
          ) : (
            <TouchableOpacity style={s.followBtn} onPress={onFollow} disabled={followLoading} activeOpacity={0.85}>
              {followLoading
                ? <ActivityIndicator size="small" color="#fff" />
                : <Text style={s.followBtnText}>{theyFollowMe ? 'Seguir de volta' : 'Seguir'}</Text>
              }
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* ── Info section ── */}
      {(profile.city || profile.district || relLabel || profile.contact || profile.availability) && (
        <View style={s.infoSection}>
          {(profile.district || profile.city) && (
            <InfoRow icon="location-outline" value={[profile.district, profile.city].filter(Boolean).join(', ')} />
          )}
          {relLabel && (
            <InfoRow icon="heart-outline" value={relLabel}
              color={profile.relationshipStatus !== 'single' ? colors.primary : undefined}
            />
          )}
          {profile.contact && <InfoRow icon="call-outline" value={profile.contact} />}
          {profile.availability && (
            <InfoRow icon="radio-button-on" value={profile.availability}
              color={profile.availability === 'Disponível' ? '#22C55E' : profile.availability === 'Ocupado' ? '#F59E0B' : colors.gray400}
            />
          )}
        </View>
      )}

      <View style={s.gridHeader}>
        <Ionicons name="grid-outline" size={16} color={colors.gray600} />
        <Text style={s.gridHeaderText}>Publicações</Text>
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

// ─── Styles ───────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },

  // Top bar
  topBar: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 10,
    backgroundColor: '#fff',
  },
  screenTitle: {
    flex: 1, fontSize: 18, fontFamily: fonts.bold,
    color: colors.gray800, textAlign: 'center', letterSpacing: -0.3,
  },
  topBarRight: { flexDirection: 'row', gap: 4 },
  iconBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },

  // Hero section
  hero: {
    backgroundColor: colors.white,
    marginHorizontal: 16, borderRadius: 20,
    paddingHorizontal: 20, paddingTop: 24, paddingBottom: 20,
    alignItems: 'center', gap: 12,
    marginBottom: 12,
  },
  otherHero: {
    backgroundColor: colors.white,
    marginHorizontal: 16, borderRadius: 20,
    paddingHorizontal: 20, paddingTop: 24, paddingBottom: 20,
    alignItems: 'center', gap: 12,
    marginBottom: 12,
  },

  // Avatar
  avatarRow: { flexDirection: 'row', alignItems: 'flex-end' },
  avatarWrap: { position: 'relative' },
  cameraBtn: {
    position: 'absolute', bottom: 0, right: 0,
    width: 24, height: 24, borderRadius: 12,
    backgroundColor: colors.primary, borderWidth: 2, borderColor: colors.white,
    alignItems: 'center', justifyContent: 'center',
  },
  partnerAvatarWrap: { marginLeft: -16, position: 'relative' },
  partnerAvatarCircle: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: `${colors.primary}22`,
    borderWidth: 3, borderColor: colors.white,
    alignItems: 'center', justifyContent: 'center',
  },
  partnerAvatarInitial: { fontSize: 26, fontFamily: fonts.bold, color: colors.primary },
  heartBadge: {
    position: 'absolute', bottom: 0, left: 0,
    width: 18, height: 18, borderRadius: 9,
    backgroundColor: '#FF4B6E', borderWidth: 1.5, borderColor: colors.white,
    alignItems: 'center', justifyContent: 'center',
  },

  // Name / bio
  heroName: { fontSize: 22, fontFamily: fonts.bold, color: colors.gray800, letterSpacing: -0.5, textAlign: 'center' },
  heroBio:  { fontSize: 14, fontFamily: fonts.regular, color: colors.gray400, textAlign: 'center', lineHeight: 20, paddingHorizontal: 8 },

  // Stats
  statsCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#fff', borderRadius: 14,
    paddingVertical: 14, paddingHorizontal: 8,
    width: '100%',
  },
  statItem:   { flex: 1, alignItems: 'center', gap: 2 },
  statDivider:{ width: 1, height: 28, backgroundColor: colors.gray200 },
  statNum:    { fontSize: 20, fontFamily: fonts.bold, color: colors.gray800, letterSpacing: -0.5 },
  statLabel:  { fontSize: 11, fontFamily: fonts.regular, color: colors.gray400 },

  // Partner badge
  partnerBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: '#FFF0F3', borderRadius: 20,
    paddingHorizontal: 12, paddingVertical: 6,
  },
  partnerBadgeText: { fontSize: 13, fontFamily: fonts.semiBold, color: '#FF4B6E' },

  // Edit profile button
  editProfileBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    borderWidth: 1.5, borderColor: colors.gray200, borderRadius: 10,
    paddingVertical: 9, paddingHorizontal: 20, width: '100%', justifyContent: 'center',
  },
  editProfileBtnText: { fontSize: 14, fontFamily: fonts.semiBold, color: colors.gray800 },

  // Info section
  infoSection: {
    backgroundColor: colors.white,
    marginHorizontal: 16, borderRadius: 16,
    paddingHorizontal: 16, paddingVertical: 12,
    gap: 12, marginBottom: 12,
  },
  infoRow:  { flexDirection: 'row', alignItems: 'center', gap: 10 },
  infoText: { fontSize: 14, fontFamily: fonts.regular, color: colors.gray600, flex: 1, lineHeight: 19 },

  // Partner requests — inline inside hero card
  inlinePartnerWrap: {
    width: '100%',
    borderTopWidth: 1, borderTopColor: colors.gray200,
    paddingTop: 14, gap: 10,
  },
  inlinePartnerHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
  },
  inlinePartnerTitle: {
    fontSize: 10, fontFamily: fonts.bold, color: '#FF4B6E', letterSpacing: 1,
  },
  inlinePartnerRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
  },
  partnerReqName: { fontSize: 14, fontFamily: fonts.semiBold, color: colors.gray800 },
  partnerReqBio:  { fontSize: 12, fontFamily: fonts.regular, color: colors.gray400 },
  acceptBtn: {
    backgroundColor: colors.primary, borderRadius: 8,
    paddingHorizontal: 12, paddingVertical: 7,
  },
  acceptBtnText: { fontSize: 13, fontFamily: fonts.semiBold, color: '#fff' },
  rejectBtn: {
    width: 32, height: 32, borderRadius: 8,
    backgroundColor: colors.gray100, alignItems: 'center', justifyContent: 'center',
  },

  // Quick actions
  quickRow: {
    flexDirection: 'row', gap: 10,
    marginHorizontal: 16, marginBottom: 12,
  },
  quickBtn: {
    flex: 1, alignItems: 'center', gap: 6,
    backgroundColor: colors.white, borderRadius: 14,
    paddingVertical: 14,
  },
  quickLabel: { fontSize: 10, fontFamily: fonts.medium, color: colors.gray600 },

  // Action buttons (other profile)
  actionRow: { flexDirection: 'row', gap: 10, width: '100%' },
  msgBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, backgroundColor: colors.primary, borderRadius: 12, paddingVertical: 12,
  },
  msgBtnText: { color: '#fff', fontFamily: fonts.semiBold, fontSize: 14 },
  followBtn: {
    flex: 1, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 5,
    backgroundColor: colors.primary, borderRadius: 12, paddingVertical: 12,
  },
  followBtnText: { color: '#fff', fontFamily: fonts.semiBold, fontSize: 14 },
  followingBtn: {
    flex: 1, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 5,
    backgroundColor: colors.gray100, borderRadius: 12, paddingVertical: 12,
    borderWidth: 1.5, borderColor: colors.gray200,
  },
  followingBtnText: { color: colors.gray800, fontFamily: fonts.semiBold, fontSize: 14 },

  // Grid header
  gridHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    marginHorizontal: 16, marginBottom: 8, marginTop: 4,
  },
  gridHeaderText: { fontSize: 13, fontFamily: fonts.semiBold, color: colors.gray600, letterSpacing: 0.2 },

  // Grid
  gridCell: { width: GRID_SIZE, height: GRID_SIZE, margin: GRID_GAP / 2 },
  gridImg:  { width: '100%', height: '100%', borderRadius: 2 },
  gridText: { fontSize: 9, fontFamily: fonts.medium, color: '#fff', textAlign: 'center' },
  videoIcon:{ position: 'absolute', top: 5, right: 5, backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 4, padding: 3 },

  emptyGrid:     { alignItems: 'center', paddingTop: 48, gap: 10 },
  emptyGridText: { fontSize: 14, fontFamily: fonts.regular, color: colors.gray400 },

  // Skeletons
  skeletonCircle: { backgroundColor: colors.gray100, alignSelf: 'center' },
  skeletonLine:   { backgroundColor: colors.gray100, borderRadius: 8, alignSelf: 'center' },
})
