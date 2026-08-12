import React, { useState, useCallback, useRef, useEffect, useLayoutEffect } from 'react'
import {
  View, Text, TouchableOpacity, FlatList, ScrollView,
  RefreshControl, StyleSheet, Alert, Dimensions,
  ActivityIndicator, Modal, TextInput, KeyboardAvoidingView,
  Platform, Image as RNImage, Animated, Share,
} from 'react-native'
import { Image } from 'expo-image'
import { LinearGradient } from 'expo-linear-gradient'
import { Ionicons } from '@expo/vector-icons'
import * as ImagePicker from 'expo-image-picker'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useNavigation, useRoute, useFocusEffect, useIsFocused } from '@react-navigation/native'
import type { RouteProp } from '@react-navigation/native'
import type { StackNavigationProp } from '@react-navigation/stack'
import { useAuthStore } from '../../store/auth.store'
import { api } from '../../services/api'
import type { Post, User } from '../../types'
import type { AppStackParams } from '../../navigation/AppNavigator'
import { colors, fonts } from '../../theme'
import AvatarImage from '../../components/AvatarImage'
import AvatarStack from '../../components/AvatarStack'
import SegmentedRing from '../../components/SegmentedRing'
import FollowersSheet from './FollowersSheet'
import BusinessBlock from './BusinessBlock'
import SocialRow from './SocialRow'
import QRModal from '../../components/QRModal'
import * as followService from '../../services/follow.service'
import type { MutualConnections } from '../../services/follow.service'
import { blockUser, unblockUser, getBlockedUsers } from '../../services/block.service'
import { createReport, REPORT_REASONS } from '../../services/report.service'
import { confirm } from '../../components/confirm'
import { API_BASE } from '../../config'
import { getCache, setCache } from '../../db/database'
import { isConnected } from '../../services/netinfo.service'
import { useFeedStore } from '../../store/feed.store'
import { useProfileUiStore } from '../../store/profileUi.store'
import { useFollowStore } from '../../store/follow.store'
import { deletePost as apiDeletePost, updatePost as apiUpdatePost } from '../../services/post.service'
import { toast } from '../../utils/toast'
import { lifeTier, lifeLabel, isEliteTier } from '../../utils/postLife'
import { getMyUnions, getPendingInvites, respondToInvite } from '../../services/union.service'
import { UNION_ENABLED } from '../../config/features'
import type { Union, UnionInvite, Pairing } from '../../types'
import * as pairingService from '../../services/pairing.service'
import { useT } from '../../i18n'

// ── Types ──────────────────────────────────────────────────────────────────────
type Nav   = StackNavigationProp<AppStackParams>
type Route = RouteProp<AppStackParams, 'Profile'>

type FeaturedRow = { type: 'featured'; main: Post; side: (Post | null)[] }
type RegularRow  = { type: 'regular';  items: Post[] }
type GridRow = FeaturedRow | RegularRow

// ── Constants ──────────────────────────────────────────────────────────────────
const { width: W, height: H } = Dimensions.get('window')
const HERO_H      = Math.round(H * 0.38)
const AV_OUTER    = 106          // ring container
const AV_SIZE     = 92           // crisp avatar inside ring
const RING_STROKE = 4
const GAP         = 2
const SMALL_W     = (W - GAP * 2) / 3
const SMALL_H     = SMALL_W
const FEAT_W      = SMALL_W * 2 + GAP
const FEAT_H      = SMALL_H * 2 + GAP
const HIT         = { top: 10, bottom: 10, left: 10, right: 10 }

// ── Helpers ────────────────────────────────────────────────────────────────────
function resolveUrl(url: string | null | undefined): string | null {
  if (!url) return null
  if (url.startsWith('http') || url.startsWith('file://')) return url
  return `${API_BASE}${url}`
}

function openProfileOnStack(navigation: Nav, userId: string) {
  const stack = navigation.getState().type === 'stack'
    ? navigation
    : navigation.getParent<Nav>()
  if (stack?.getState().type !== 'stack') return
  stack.push('Profile', { userId })
}

function fmtStat(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 10_000)    return `${Math.round(n / 1_000)}K`
  if (n >= 1_000)     return `${(n / 1_000).toFixed(1)}K`
  return String(n)
}

function buildInfoLine(profile: any, union: Union | null): string {
  const parts: string[] = []
  const loc = [profile?.district, profile?.city].filter(Boolean).join(', ')
  if (loc) parts.push(loc)
  if (union?.label) parts.push(union.label)
  return parts.join(' · ')
}

function buildRows(posts: Post[]): GridRow[] {
  if (posts.length === 0) return []
  const rows: GridRow[] = []
  rows.push({ type: 'featured', main: posts[0], side: [posts[1] ?? null, posts[2] ?? null] })
  for (let i = 3; i < posts.length; i += 3) {
    rows.push({ type: 'regular', items: posts.slice(i, i + 3) })
  }
  return rows
}

// ── PostThumb ──────────────────────────────────────────────────────────────────
function PostThumb({
  post, width, height, isOwn, yearLabel,
  onPress, onMenu,
}: {
  post: Post; width: number; height: number; isOwn: boolean; yearLabel: string
  onPress: () => void; onMenu: () => void
}) {
  const thumb = resolveUrl(post.thumbnailUrl ?? post.mediaUrl)

  // Vida conquistada — visível para toda a gente. A grelha deixa de ser "o que
  // ele publicou" e passa a ser "o que dele sobreviveu".
  const tier  = lifeTier(post)
  const life  = lifeLabel(tier, yearLabel)
  const elite = isEliteTier(tier)

  return (
    <TouchableOpacity
      activeOpacity={0.88}
      onPress={onPress}
      style={{ width, height }}
    >
      {post.mediaType === 'TEXT' ? (() => {
        const parts = post.bgColor?.split('|') ?? []
        const gc: [string, string] = parts.length === 2 ? [parts[0], parts[1]] : ['#FF6B35', '#E63946']
        return (
          <LinearGradient
            colors={gc}
            style={[g.cellImg, { width, height, justifyContent: 'center', alignItems: 'center', padding: 4 }]}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
          >
            <Text style={g.cellText} numberOfLines={5}>{post.caption}</Text>
          </LinearGradient>
        )
      })() : (
        <Image source={{ uri: thumb ?? '' }} style={[g.cellImg, { width, height }]} contentFit="cover" cachePolicy="disk" recyclingKey={`grid-${post.id}`} />
      )}
      {post.mediaType === 'VIDEO' && (
        <View style={g.videoIcon}><Ionicons name="play" size={10} color="#fff" /></View>
      )}
      {isOwn && (
        <TouchableOpacity style={g.menuBtn} onPress={onMenu} hitSlop={{ top: 6, right: 6, bottom: 6, left: 6 }}>
          <Ionicons name="ellipsis-horizontal" size={13} color="#fff" />
        </TouchableOpacity>
      )}
      {/* Views — só o autor vê, no seu próprio perfil */}
      {isOwn && (
        <View style={g.viewsBadge} pointerEvents="none">
          <Ionicons name="eye-outline" size={11} color="#fff" />
          <Text style={g.viewsBadgeTxt}>{post._count?.views ?? 0}</Text>
        </View>
      )}

      {/* Escalão de vida — neutro nos primeiros, cor da marca só no 1 ano / para sempre */}
      {life && (
        elite ? (
          <LinearGradient
            colors={['#FF7A1C', '#FF6766']}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
            style={g.lifeBadge}
            pointerEvents="none"
          >
            <Text style={g.lifeBadgeTxt}>{life}</Text>
          </LinearGradient>
        ) : (
          <View style={[g.lifeBadge, g.lifeBadgeQuiet]} pointerEvents="none">
            <Text style={g.lifeBadgeTxt}>{life}</Text>
          </View>
        )
      )}
    </TouchableOpacity>
  )
}

// ── Grid rows ──────────────────────────────────────────────────────────────────
function FeaturedRowComp({ row, isOwn, yearLabel, onPress, onMenu }: {
  row: FeaturedRow; isOwn: boolean; yearLabel: string
  onPress: (p: Post) => void; onMenu: (p: Post) => void
}) {
  return (
    <View style={{ flexDirection: 'row', gap: GAP, marginBottom: GAP }}>
      <PostThumb post={row.main} width={FEAT_W} height={FEAT_H} isOwn={isOwn} yearLabel={yearLabel} onPress={() => onPress(row.main)} onMenu={() => onMenu(row.main)} />
      <View style={{ gap: GAP }}>
        {row.side.map((p, i) =>
          p ? (
            <PostThumb key={p.id} post={p} width={SMALL_W} height={SMALL_H} isOwn={isOwn} yearLabel={yearLabel} onPress={() => onPress(p)} onMenu={() => onMenu(p)} />
          ) : (
            <View key={i} style={{ width: SMALL_W, height: SMALL_H, backgroundColor: colors.gray100 }} />
          )
        )}
      </View>
    </View>
  )
}

function RegularRowComp({ row, isOwn, yearLabel, onPress, onMenu }: {
  row: RegularRow; isOwn: boolean; yearLabel: string
  onPress: (p: Post) => void; onMenu: (p: Post) => void
}) {
  return (
    <View style={{ flexDirection: 'row', gap: GAP, marginBottom: GAP }}>
      {row.items.map((p) => (
        <PostThumb key={p.id} post={p} width={SMALL_W} height={SMALL_H} isOwn={isOwn} yearLabel={yearLabel} onPress={() => onPress(p)} onMenu={() => onMenu(p)} />
      ))}
    </View>
  )
}

// ── Main screen ────────────────────────────────────────────────────────────────
export default function ProfileScreen() {
  const t = useT()
  const { user: me, logout, refreshUser } = useAuthStore()
  const nav   = useNavigation<Nav>()
  const route = useRoute<Route>()
  const isFocused = useIsFocused()
  const { bottom, top } = useSafeAreaInsets()
  const connectionsRequested = useProfileUiStore((s) => s.connectionsRequested)

  const viewingId = route.params?.userId && route.params.userId !== me?.id ? route.params.userId : null
  const isOwn     = !viewingId
  const targetId  = viewingId ?? me?.id ?? ''

  const [profile,        setProfile]        = useState<User | null>(isOwn ? me : null)
  const [posts,          setPosts]          = useState<Post[]>([])
  const [refreshing,     setRefreshing]     = useState(false)
  const [followerCount,  setFollowerCount]  = useState(0)
  const [followingCount, setFollowingCount] = useState(0)
  const isFollowing    = useFollowStore((s) => s.followingIds.has(targetId))
  const [theyFollowMe,   setTheyFollowMe]   = useState(false)
  const [followLoading,  setFollowLoading]  = useState(false)
  const [showQR,         setShowQR]         = useState(false)
  const [followSheetMode, setFollowSheetMode] = useState<'followers' | 'following'>('followers')
  const [showFollowSheet, setShowFollowSheet] = useState(false)
  const [myUnion,      setMyUnion]      = useState<Union | null>(null)
  const [unionInvites, setUnionInvites] = useState<UnionInvite[]>([])
  const [profilePairing, setProfilePairing] = useState<Pairing | null>(null)
  const [menuPost,        setMenuPost]        = useState<Post | null>(null)
  const [editEditing,     setEditEditing]     = useState(false)
  const [editCaption,     setEditCaption]     = useState('')
  const [editLoading,     setEditLoading]     = useState(false)
  const [pendingAvatarUri, setPendingAvatarUri] = useState<string | null>(null)
  const [savingAvatar,     setSavingAvatar]     = useState(false)
  const [isBlocked,        setIsBlocked]        = useState(false)
  const [blockBusy,        setBlockBusy]        = useState(false)
  const [mutuals,          setMutuals]          = useState<MutualConnections | null>(null)
  const [followingList,    setFollowingList]    = useState<followService.FollowUser[]>([])
  const [followersList,    setFollowersList]    = useState<followService.FollowUser[]>([])
  const [showUserMenu,     setShowUserMenu]     = useState(false)
  const userMenuSlide = useRef(new Animated.Value(300)).current
  const handledConnectionsRequest = useRef(connectionsRequested)
  const activeTargetRef = useRef(targetId)
  const activeOwnerRef = useRef(me?.id ?? null)
  const profileLifecycleGeneration = useRef(0)
  const refreshRequestGeneration = useRef(0)
  const followRequestGeneration = useRef(0)
  const followRequestBusy = useRef(false)

  function isCurrentProfileRequest(targetAtStart: string, ownerAtStart: string | null, lifecycleAtStart: number) {
    return profileLifecycleGeneration.current === lifecycleAtStart
      && activeTargetRef.current === targetAtStart
      && activeOwnerRef.current === ownerAtStart
      && (useAuthStore.getState().user?.id ?? null) === ownerAtStart
  }

  // A mesma instância pode mudar de pessoa quando os parâmetros da rota mudam.
  // Limpar em layout effect impede que dados do perfil anterior cheguem ao ecrã
  // enquanto cache/rede do novo alvo ainda estão a ser consultados.
  useLayoutEffect(() => {
    const lifecycle = ++profileLifecycleGeneration.current
    activeTargetRef.current = targetId
    activeOwnerRef.current = me?.id ?? null
    refreshRequestGeneration.current += 1
    followRequestGeneration.current += 1
    followRequestBusy.current = false
    setProfile(isOwn ? useAuthStore.getState().user : null)
    setPosts([])
    setRefreshing(false)
    setFollowerCount(0)
    setFollowingCount(0)
    setTheyFollowMe(false)
    setFollowLoading(false)
    setShowQR(false)
    setFollowSheetMode('followers')
    setShowFollowSheet(false)
    setMyUnion(null)
    setUnionInvites([])
    setProfilePairing(null)
    setMenuPost(null)
    setEditEditing(false)
    setEditCaption('')
    setEditLoading(false)
    setPendingAvatarUri(null)
    setSavingAvatar(false)
    setIsBlocked(false)
    setBlockBusy(false)
    setMutuals(null)
    setFollowingList([])
    setFollowersList([])
    setShowUserMenu(false)
    userMenuSlide.setValue(300)
    handledConnectionsRequest.current = connectionsRequested
    return () => {
      if (profileLifecycleGeneration.current !== lifecycle) return
      profileLifecycleGeneration.current += 1
      refreshRequestGeneration.current += 1
      followRequestGeneration.current += 1
      followRequestBusy.current = false
    }
  }, [targetId, me?.id])

  // A folha pertence ao perfil que está realmente visível. Perfis montados por
  // baixo de outra rota ignoram o sinal, em vez de abrirem um modal escondido.
  useEffect(() => {
    if (!isFocused || !isOwn) {
      handledConnectionsRequest.current = connectionsRequested
      return
    }
    if (connectionsRequested <= handledConnectionsRequest.current) {
      handledConnectionsRequest.current = connectionsRequested
      return
    }
    handledConnectionsRequest.current = connectionsRequested
    setFollowSheetMode(followingCount > 0 || followerCount === 0 ? 'following' : 'followers')
    setShowFollowSheet(true)
  }, [connectionsRequested, followerCount, followingCount, isFocused, isOwn])

  type ProfileCache = {
    user: User; followerCount: number; followingCount: number
    isFollowing: boolean; theyFollowMe: boolean
  }

  useFocusEffect(useCallback(() => {
    let cancelled = false
    async function run() {
      const [cachedMeta, cachedPosts, cachedMutuals, cachedFollowing] = await Promise.all([
        !isOwn ? getCache<ProfileCache>(`profile:${targetId}`) : null,
        getCache<Post[]>(`profile_posts:${targetId}`),
        !isOwn ? getCache<MutualConnections>(`mutuals:${targetId}`) : null,
        isOwn ? getCache<followService.FollowUser[]>('my_following') : null,
      ])
      const latestMe = useAuthStore.getState().user
      if (!cancelled) {
        if (cachedMeta && !isOwn) {
          setProfile(cachedMeta.user)
          setFollowerCount(cachedMeta.followerCount)
          setFollowingCount(cachedMeta.followingCount)
          setTheyFollowMe(cachedMeta.theyFollowMe ?? false)
        }
        if (cachedPosts)     setPosts(cachedPosts)
        if (cachedMutuals)   setMutuals(cachedMutuals)
        if (cachedFollowing) setFollowingList(cachedFollowing)
        if (isOwn && latestMe) setProfile(latestMe)
      }
      if (!isConnected()) { setRefreshing(false); return }
      try {
        const followRevisionAtStart = useFollowStore.getState().getRevision()
        const [userRes, postsRes, followStatus] = await Promise.all([
          isOwn
            ? Promise.resolve({ data: { data: latestMe } })
            : api.get(`/users/${targetId}`),
          api.get(`/users/${targetId}/posts`),
          isOwn
            ? Promise.resolve(null)
            : followService.getFollowStatus(targetId).catch(() => null),
        ])
        if (cancelled) return
        const p = userRes.data.data as User
        if (!p) throw new Error('not found')
        const freshPosts: Post[] = postsRes.data.data ?? []
        setProfile(p)
        setPosts(freshPosts)
        setCache(`profile_posts:${targetId}`, freshPosts).catch(() => {})
        if (!isOwn) {
          getBlockedUsers().then((list) => { if (!cancelled) setIsBlocked(list.some((u) => u.id === targetId)) }).catch(() => {})
          // Conexões em comum — acessório, nunca deve travar o perfil
          followService.getMutualConnections(targetId)
            .then((res) => {
              if (cancelled) return
              setMutuals(res)
              setCache(`mutuals:${targetId}`, res).catch(() => {})
            })
            .catch(() => {})
        }
        if (!isOwn && followStatus) {
          setTheyFollowMe(followStatus.followsMe)
          // Uma resposta de status só pode reconciliar este perfil. Nunca deve
          // cancelar toggles pendentes das restantes relações.
          useFollowStore.getState().reconcileOne(
            targetId,
            followStatus.following,
            followRevisionAtStart,
          )
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
            const followerSnapshotIsCurrent = useFollowStore
              .getState()
              .isRevisionCurrent(followRevisionAtStart)
            if (followerSnapshotIsCurrent) {
              setFollowerCount(followersRes.length)
              setFollowersList(followersRes)
              setCache(`profile:${targetId}`, {
                user: p, followerCount: followersRes.length,
                followingCount: followingRes.length,
                isFollowing: followStatus?.following ?? useFollowStore.getState().followingIds.has(targetId),
                theyFollowMe: followStatus?.followsMe ?? cachedMeta?.theyFollowMe ?? false,
              } as ProfileCache).catch(() => {})
              setCache(`followers:${targetId}`, followersRes).catch(() => {})
            }
            setFollowingCount(followingRes.length)
            setCache(`following:${targetId}`, followingRes).catch(() => {})
          }).catch(() => {})
        }
        // O meu próprio perfil também precisa de contar seguidores/seguindo frescos
        if (isOwn) {
          const followStoreAtStart = useFollowStore.getState()
          const followingRevisionAtStart = followStoreAtStart.getRevision()
          const followingStateWasStable = followStoreAtStart.isRevisionCurrent(followingRevisionAtStart)
          Promise.all([
            followService.getUserFollowers(targetId),
            followService.getUserFollowing(targetId),
          ]).then(([followersRes, followingRes]) => {
            if (cancelled) return
            setFollowerCount(followersRes.length)
            setFollowersList(followersRes)
            setCache('my_followers', followersRes).catch(() => {})

            const followStore = useFollowStore.getState()
            followStore.reconcileSnapshot(
              followingRes.map((user) => user.id),
              followingRevisionAtStart,
            )
            const snapshotCanReplaceLocalState = followingStateWasStable
              && followStore.isRevisionCurrent(followingRevisionAtStart)
            if (!snapshotCanReplaceLocalState) {
              const currentIds = useFollowStore.getState().followingIds
              setFollowingCount(currentIds.size)
              setFollowingList((current) => {
                const serverUsers = followingRes.filter((user) => currentIds.has(user.id))
                const serverIds = new Set(serverUsers.map((user) => user.id))
                return [
                  ...serverUsers,
                  ...current.filter((user) => currentIds.has(user.id) && !serverIds.has(user.id)),
                ]
              })
              return
            }
            setFollowingCount(followingRes.length)
            setFollowingList(followingRes)
            setCache('my_following', followingRes).catch(() => {})
          }).catch(() => {})
        }
      } catch {}
      if (!cancelled) setRefreshing(false)
    }
    run()
    return () => { cancelled = true }
  }, [targetId]))

  useFocusEffect(useCallback(() => {
    if (!isOwn || !UNION_ENABLED) return
    let active = true
    async function loadUnionData() {
      const [cachedUnions, cachedInvites] = await Promise.all([
        getCache<Union[]>('my_unions').catch(() => null),
        getCache<UnionInvite[]>('union_invites').catch(() => null),
      ])
      if (active) {
        if (cachedUnions) setMyUnion(cachedUnions[0] ?? null)
        if (cachedInvites) setUnionInvites(cachedInvites)
      }
      if (!isConnected()) return
      try {
        const [unions, invites] = await Promise.all([getMyUnions(), getPendingInvites()])
        if (active) {
          setMyUnion(unions[0] ?? null)
          setUnionInvites(invites)
        }
        setCache('my_unions', unions).catch(() => {})
        setCache('union_invites', invites).catch(() => {})
      } catch {}
    }
    loadUnionData()
    return () => { active = false }
  }, [isOwn]))

  // Pairing badge — visible to anyone viewing this profile, not just the owner
  useFocusEffect(useCallback(() => {
    let active = true
    pairingService.getUserPairing(targetId).then((p) => { if (active) setProfilePairing(p) }).catch(() => {})
    return () => { active = false }
  }, [targetId]))

  async function handleRefresh() {
    const targetAtStart = targetId
    const ownerAtStart = useAuthStore.getState().user?.id ?? null
    const ownProfileAtStart = isOwn
    const lifecycleAtStart = profileLifecycleGeneration.current
    const requestGeneration = ++refreshRequestGeneration.current
    const followStoreAtStart = useFollowStore.getState()
    const followingRevisionAtStart = followStoreAtStart.getRevision()
    const followingStateWasStable = followStoreAtStart.isRevisionCurrent(followingRevisionAtStart)
    const requestIsCurrent = () => (
      refreshRequestGeneration.current === requestGeneration
      && isCurrentProfileRequest(targetAtStart, ownerAtStart, lifecycleAtStart)
    )

    setRefreshing(true)
    if (!isConnected()) {
      if (requestIsCurrent()) setRefreshing(false)
      return
    }
    try {
      const latestMe = useAuthStore.getState().user
      const [userRes, postsRes] = await Promise.all([
        ownProfileAtStart ? Promise.resolve({ data: { data: latestMe } }) : api.get(`/users/${targetAtStart}`),
        api.get(`/users/${targetAtStart}/posts`),
      ])
      if (!requestIsCurrent()) return
      const p = userRes.data.data as User
      if (!p) return
      const freshPosts: Post[] = postsRes.data.data ?? []
      setProfile(p)
      setPosts(freshPosts)
      setCache(`profile_posts:${targetAtStart}`, freshPosts).catch(() => {})
      if (ownProfileAtStart) {
        await refreshUser()
        if (!requestIsCurrent()) return
        const refreshedMe = useAuthStore.getState().user
        if (refreshedMe) setProfile(refreshedMe)
      }

      const [followersRes, followingRes] = await Promise.all([
        followService.getUserFollowers(targetAtStart),
        followService.getUserFollowing(targetAtStart),
      ])
      if (!requestIsCurrent()) return

      const followStore = useFollowStore.getState()
      const snapshotCanReplaceLocalState = followingStateWasStable
        && followStore.isRevisionCurrent(followingRevisionAtStart)

      if (!ownProfileAtStart) {
        // O meu toggle deste perfil altera apenas a lista/contagem de seguidores.
        // Não deixe um GET iniciado antes desse toggle desfazer o valor otimista.
        if (snapshotCanReplaceLocalState) {
          setFollowerCount(followersRes.length)
          setCache(`followers:${targetAtStart}`, followersRes).catch(() => {})
        }
        setFollowingCount(followingRes.length)
        setCache(`following:${targetAtStart}`, followingRes).catch(() => {})
        return
      }

      setFollowerCount(followersRes.length)
      setCache('my_followers', followersRes).catch(() => {})
      followStore.reconcileSnapshot(
        followingRes.map((user) => user.id),
        followingRevisionAtStart,
      )
      if (!snapshotCanReplaceLocalState) {
        const currentIds = useFollowStore.getState().followingIds
        setFollowingCount(currentIds.size)
        setFollowingList((current) => {
          const serverUsers = followingRes.filter((user) => currentIds.has(user.id))
          const serverIds = new Set(serverUsers.map((user) => user.id))
          return [
            ...serverUsers,
            ...current.filter((user) => currentIds.has(user.id) && !serverIds.has(user.id)),
          ]
        })
        return
      }
      setFollowingCount(followingRes.length)
      setFollowingList(followingRes)
      setCache('my_following', followingRes).catch(() => {})
    } catch {
      // O perfil continua com os dados já apresentados; o refresh pode ser repetido.
    } finally {
      if (requestIsCurrent()) setRefreshing(false)
    }
  }

  async function handleFollow() {
    if (followRequestBusy.current) return
    const targetAtStart = targetId
    const ownerAtStart = useAuthStore.getState().user?.id ?? null
    const lifecycleAtStart = profileLifecycleGeneration.current
    if (!ownerAtStart || !isCurrentProfileRequest(targetAtStart, ownerAtStart, lifecycleAtStart)) return

    const requestGeneration = ++followRequestGeneration.current
    const requestIsCurrent = () => (
      followRequestGeneration.current === requestGeneration
      && isCurrentProfileRequest(targetAtStart, ownerAtStart, lifecycleAtStart)
    )
    const profileAtStart = profile?.id === targetAtStart
      ? { name: profile.name, avatar: profile.avatar ?? null }
      : undefined
    const wasFollowing = useFollowStore.getState().followingIds.has(targetAtStart)
    const optimisticDelta = wasFollowing ? -1 : 1

    followRequestBusy.current = true
    setFollowLoading(true)
    setFollowerCount((count) => Math.max(0, count + optimisticDelta))
    try {
      const nowFollowing = await useFollowStore.getState().toggle(
        targetAtStart,
        undefined,
        profileAtStart,
      )
      if (!requestIsCurrent()) return
      if (nowFollowing === wasFollowing) {
        setFollowerCount((count) => Math.max(0, count - optimisticDelta))
      }
    } catch {
      if (!requestIsCurrent()) return
      setFollowerCount((count) => Math.max(0, count - optimisticDelta))
      toast.error(t.follow_err)
    } finally {
      if (followRequestGeneration.current === requestGeneration) followRequestBusy.current = false
      if (requestIsCurrent()) setFollowLoading(false)
    }
  }

  const handleOwnFollowingChange = useCallback((users: followService.FollowUser[]) => {
    if (!isOwn) return
    setFollowingList(users)
    setFollowingCount(useFollowStore.getState().followingIds.size)
  }, [isOwn])

  const handleConnectionCountChange = useCallback((mode: 'followers' | 'following', count: number) => {
    if (mode === 'followers') setFollowerCount(count)
    else setFollowingCount(count)
  }, [])

  // ── Menu do utilizador (bloquear / denunciar / partilhar) ──────────────────
  useEffect(() => {
    if (showUserMenu) {
      userMenuSlide.setValue(300)
      Animated.spring(userMenuSlide, { toValue: 0, useNativeDriver: true, damping: 24, stiffness: 240 }).start()
    }
  }, [showUserMenu])

  async function handleToggleBlock() {
    if (!profile || blockBusy) return
    setShowUserMenu(false)
    const wasBlocked = isBlocked
    setBlockBusy(true)
    setIsBlocked(!wasBlocked)
    try {
      if (wasBlocked) { await unblockUser(profile.id); toast.success(t.blk_okTitle, '') }
      else            { await blockUser(profile.id);   toast.success(t.pf_blocked_ok, '') }
    } catch {
      setIsBlocked(wasBlocked)
      toast.error(t.error, t.blk_fail)
    }
    setBlockBusy(false)
  }

  function handleReport() {
    if (!profile) return
    setShowUserMenu(false)
    Alert.alert(t.pf_report_title, t.pf_report_msg, [
      ...REPORT_REASONS.map((reason) => ({
        text: reason,
        onPress: () => {
          createReport(profile.id, 'USER', reason).catch(() => {})
          toast.success(t.pf_report_done, '')
        },
      })),
      { text: t.cancel, style: 'cancel' as const },
    ])
  }

  async function handleShareProfile() {
    if (!profile) return
    setShowUserMenu(false)
    try { await Share.share({ message: `${profile.name} — luxee` }) } catch {}
  }

  async function handleUnionInviteResponse(id: string, accept: boolean) {
    setUnionInvites((prev) => {
      const updated = prev.filter((r) => r.id !== id)
      setCache('union_invites', updated).catch(() => {})
      return updated
    })
    try {
      const result = await respondToInvite(id, accept)
      if (accept && result.union) {
        setMyUnion(result.union)
        setCache('my_unions', [result.union]).catch(() => {})
      }
    } catch {
      getPendingInvites().then((fresh) => {
        setUnionInvites(fresh)
        setCache('union_invites', fresh).catch(() => {})
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
    } finally { setSavingAvatar(false) }
  }

  const showPostInFeed = useFeedStore((s) => s.showPostInFeed)
  function openPost(post: Post) {
    showPostInFeed(post)
    nav.navigate('Tabs', { screen: 'Feed' })
  }

  async function handleDeletePost(post: Post) {
    const ok = await confirm({
      title: t.profile_del_title, message: t.profile_del_msg,
      confirmText: t.delete, cancelText: t.cancel, destructive: true, icon: 'trash-outline',
    })
    if (!ok) return
    setMenuPost(null)
    setPosts((prev) => prev.filter((p) => p.id !== post.id))
    try { await apiDeletePost(post.id) } catch {
      setPosts((prev) => [...prev, post].sort((a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()))
      toast.error(t.error, t.profile_del_err)
    }
  }

  async function handleSaveEdit() {
    if (!menuPost) return
    setEditLoading(true)
    const original = menuPost.caption ?? ''
    const updated  = editCaption.trim()
    setPosts((prev) => prev.map((p) => p.id === menuPost.id ? { ...p, caption: updated } : p))
    setEditEditing(false)
    setMenuPost(null)
    try { await apiUpdatePost(menuPost.id, updated) } catch {
      setPosts((prev) => prev.map((p) => p.id === menuPost.id ? { ...p, caption: original } : p))
      Alert.alert(t.error, t.profile_save_err)
    }
    setEditLoading(false)
  }

  // ── Derived ──────────────────────────────────────────────────────────────────
  const nav2         = useNavigation<Nav>()
  const canGoBack    = nav2.canGoBack()
  const displayUri   = resolveUrl(pendingAvatarUri ?? profile?.avatar)
  const hasPosts     = posts.length > 0
  const hasUnion     = isOwn && Boolean(myUnion)
  const otherMember  = myUnion ? (myUnion.memberA.id === targetId ? myUnion.memberB : myUnion.memberA) : null
  const rows         = buildRows(posts)

  // ── Header component ─────────────────────────────────────────────────────────
  // Esquerda: no meu perfil, o "+" ocupa o lugar do voltar; noutro perfil, o voltar.
  const topLeft = isOwn ? (
    <TouchableOpacity onPress={() => nav2.navigate('Tabs', { screen: 'Create' })} hitSlop={HIT} style={m.floatBtn}>
      <Ionicons name="add" size={26} color="#fff" />
    </TouchableOpacity>
  ) : canGoBack ? (
    <TouchableOpacity onPress={() => nav2.goBack()} hitSlop={HIT} style={m.floatBtn}>
      <Ionicons name="chevron-back" size={26} color="#fff" />
    </TouchableOpacity>
  ) : <View style={{ width: 36 }} />

  // Direita: só o menu "..." no meu perfil (logout); nada noutro perfil.
  const topRight = isOwn ? (
    <View style={{ flexDirection: 'row', gap: 8 }}>
      <TouchableOpacity
        onPress={async () => {
          const ok = await confirm({
            title: t.profile_logout, message: t.profile_logout_confirm,
            confirmText: t.profile_logout_btn, cancelText: t.cancel, destructive: true, icon: 'log-out-outline',
          })
          if (ok) logout()
        }}
        hitSlop={HIT}
        style={m.floatBtn}
      >
        <Ionicons name="ellipsis-horizontal" size={26} color="#fff" />
      </TouchableOpacity>
    </View>
  ) : null

  const ListHeader = (
    <View>
      {/* ── Hero ── */}
      <View style={{ height: HERO_H }}>
        {displayUri ? (
          <RNImage source={{ uri: displayUri }} style={StyleSheet.absoluteFill} blurRadius={22} resizeMode="cover" />
        ) : (
          <LinearGradient colors={['#FF7A1C', '#FF6766', '#FFB173']} style={StyleSheet.absoluteFill} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} />
        )}
        <LinearGradient
          colors={['rgba(255,255,255,0)', 'rgba(255,255,255,0.55)', '#ffffff']}
          locations={[0, 0.62, 1]}
          style={StyleSheet.absoluteFill}
        />

        {/* Floating nav */}
        <View style={[m.floatNav, { top: top + 8 }]}>
          {topLeft}
          <View style={{ flexDirection: 'row', gap: 8 }}>{topRight}</View>
        </View>

        {/* Avatar + name at bottom of hero */}
        <View style={m.identity}>
          {/* Avatar tap — own profile picks new photo */}
          <TouchableOpacity
            onPress={isOwn ? pickAvatar : undefined}
            activeOpacity={isOwn ? 0.8 : 1}
            style={m.avatarOuter}
          >
            {hasPosts && (
              <View style={StyleSheet.absoluteFill} pointerEvents="none">
                <SegmentedRing count={1} size={AV_OUTER} strokeWidth={RING_STROKE} color={colors.ring} />
              </View>
            )}
            <View style={m.avatarCircle}>
              {displayUri ? (
                <Image source={{ uri: displayUri }} style={m.avatarImg} contentFit="cover"
                  cachePolicy={displayUri.startsWith('file://') ? 'none' : 'disk'} />
              ) : (
                <View style={[m.avatarImg, m.avatarFallback]}>
                  <Text style={m.avatarInitial}>{profile?.name?.[0]?.toUpperCase() ?? '?'}</Text>
                </View>
              )}
            </View>
            {isOwn && !pendingAvatarUri && (
              <View style={m.camDot}>
                <Ionicons name="camera" size={10} color="#fff" />
              </View>
            )}
          </TouchableOpacity>

          <Text style={m.name} numberOfLines={1}>
            {profile?.username ? `@${profile.username}` : (profile?.name ?? '')}
          </Text>

          {!!profile?.statusLabel && (
            <View style={m.statusPill}>
              <Text style={m.statusTxt} numberOfLines={1}>{profile.statusLabel}</Text>
            </View>
          )}
        </View>
      </View>

      {/* ── Stats ── */}
      <View style={m.statsRow}>
        <View style={m.statCol}>
          <Text style={m.statNum}>{fmtStat(posts.length)}</Text>
          <Text style={m.statLbl}>{t.profile_posts}</Text>
        </View>
        <View style={m.statDivider} />
        <TouchableOpacity
          style={m.statCol}
          onPress={() => { setFollowSheetMode('followers'); setShowFollowSheet(true) }}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel={`${followerCount} ${t.profile_followers}`}
          accessibilityState={{ expanded: showFollowSheet && followSheetMode === 'followers' }}
        >
          <Text style={m.statNum}>{fmtStat(followerCount)}</Text>
          <Text style={m.statLbl}>{t.profile_followers}</Text>
        </TouchableOpacity>
        <View style={m.statDivider} />
        <TouchableOpacity
          style={m.statCol}
          onPress={() => { setFollowSheetMode('following'); setShowFollowSheet(true) }}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel={`${followingCount} ${t.profile_following}`}
          accessibilityState={{ expanded: showFollowSheet && followSheetMode === 'following' }}
        >
          <Text style={m.statNum}>{fmtStat(followingCount)}</Text>
          <Text style={m.statLbl}>{t.profile_following}</Text>
        </TouchableOpacity>
      </View>

      {/* ── Pilha de seguidores → página de seguidores ──
             O número acima abre a folha; esta linha leva à página inteira. ── */}
      {followersList.length > 0 && (
        <TouchableOpacity
          style={m.networkBar}
          onPress={() => nav.push('Followers', {
            userId: isOwn ? undefined : targetId,
            name: isOwn ? undefined : profile?.name,
            mode: 'followers',
          })}
          activeOpacity={0.72}
          accessibilityRole="button"
          accessibilityLabel={`${followerCount} ${t.profile_followers}`}
        >
          <AvatarStack users={followersList} max={5} size={32} />
          <View style={{ flex: 1 }} />
          <Text style={m.networkLink}>{t.profile_followers}</Text>
          <Ionicons name="chevron-forward" size={15} color={colors.gray400} />
        </TouchableOpacity>
      )}

      {/* ── Bio card ── */}
      {(profile?.bio || buildInfoLine(profile, hasUnion ? myUnion : null) || hasUnion) && (
        <View style={m.bioCard}>
          {!!profile?.bio && <Text style={m.bioTxt}>{profile.bio}</Text>}
          {!!buildInfoLine(profile, hasUnion ? myUnion : null) && (
            <View style={m.infoRow}>
              <Ionicons name="location-outline" size={12} color={colors.gray400} />
              <Text style={m.infoTxt}>{buildInfoLine(profile, hasUnion ? myUnion : null)}</Text>
            </View>
          )}
          {hasUnion && otherMember && (
            <LinearGradient colors={['#FF7A1C', '#FF6766']} style={m.partnerPill} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
              <Ionicons name="heart" size={11} color="#fff" />
              <Text style={m.partnerTxt}>Parceiro · {otherMember.name}</Text>
            </LinearGradient>
          )}
          {profilePairing?.status === 'ACTIVE' && (
            <View style={m.pairingPill}>
              <View style={m.pairingPillDot} />
              <Text style={m.pairingPillTxt}>
                {pairingService.pairingLabel(profilePairing)} · {pairingService.pairingPartner(profilePairing, targetId).name}
              </Text>
            </View>
          )}
        </View>
      )}

      {/* ── Bloco comercial — categoria, aberto/fechado, morada, ações ── */}
      {profile?.accountType === 'PROFESSIONAL' && (
        <BusinessBlock
          profile={profile}
          isOwn={isOwn}
          onMessage={() => nav2.navigate('Chat', { userId: profile.id, userName: profile.name, userAvatar: profile.avatar })}
        />
      )}

      {/* ── Redes sociais — cores das marcas, rola na horizontal ── */}
      <SocialRow socialLinks={profile?.socialLinks} />

      {/* ── Quem sigo — só no meu próprio perfil ── */}
      {isOwn && followingList.length > 0 && (
        <View style={m.followingBlock}>
          <View style={m.followingHead}>
            <Text style={m.followingTitle}>{t.sl_following_title}</Text>
            <TouchableOpacity
              onPress={() => { setFollowSheetMode('following'); setShowFollowSheet(true) }}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Text style={m.followingAll}>{t.sl_see_all}</Text>
            </TouchableOpacity>
          </View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={m.followingRow}
          >
            {followingList.slice(0, 20).map((u) => (
              <TouchableOpacity
                key={u.id}
                style={m.followingItem}
                onPress={() => openProfileOnStack(nav, u.id)}
                activeOpacity={0.75}
              >
                <AvatarImage uri={u.avatar} name={u.name} size={52} />
                <Text style={m.followingName} numberOfLines={1}>{u.name.split(' ')[0]}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}

      {/* ── Conexões em comum — o sinal de confiança num perfil desconhecido ── */}
      {!isOwn && mutuals && mutuals.total > 0 && (
        <View style={m.mutualRow}>
          <View style={m.mutualAvatars}>
            {mutuals.users.map((u, i) => (
              <View key={u.id} style={[m.mutualAvatarWrap, { marginLeft: i === 0 ? 0 : -8, zIndex: 3 - i }]}>
                <AvatarImage uri={u.avatar} name={u.name} size={22} borderWidth={1.5} borderColor="#FFFFFF" />
              </View>
            ))}
          </View>
          <Text style={m.mutualTxt} numberOfLines={2}>
            {(() => {
              const names  = mutuals.users.map((u) => u.name.split(' ')[0])
              const hidden = mutuals.total - names.length
              const label  = mutuals.total === 1 ? t.pf_mutual_one : t.pf_mutual_many
              if (hidden <= 0) return `${names.join(', ')} · ${label}`
              const others = hidden === 1
                ? t.pf_mutual_others_one
                : t.pf_mutual_others_many.replace('{n}', String(hidden))
              return `${names.join(', ')} ${t.pf_mutual_and} ${others} · ${label}`
            })()}
          </Text>
        </View>
      )}

      {/* ── Interests ── */}
      {!!profile?.interests?.length && (
        <View style={m.interestsWrap}>
          {profile.interests.map((tag) => (
            <View key={tag} style={m.interestChip}>
              <Text style={m.interestChipTxt}>{tag}</Text>
            </View>
          ))}
        </View>
      )}

      {/* ── Action buttons ── */}
      <View style={m.actionsArea}>
        {isOwn ? (
          pendingAvatarUri ? (
            <View style={m.btnRow}>
              <TouchableOpacity style={[m.outlineBtn, { flex: 1 }]} onPress={() => setPendingAvatarUri(null)} activeOpacity={0.8}>
                <Text style={m.outlineBtnTxt}>{t.cancel}</Text>
              </TouchableOpacity>
              <LinearGradient colors={['#FF7A1C', '#FF6766']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={[m.gradBtn, { flex: 1 }]}>
                <TouchableOpacity onPress={savePendingAvatar} disabled={savingAvatar} activeOpacity={0.85} style={m.gradBtnInner}>
                  {savingAvatar
                    ? <ActivityIndicator size="small" color="#fff" />
                    : <Text style={m.gradBtnTxt}>{t.save}</Text>
                  }
                </TouchableOpacity>
              </LinearGradient>
            </View>
          ) : (
            <View style={m.btnRow}>
              <TouchableOpacity style={[m.outlineBtn, { flex: 1 }]} onPress={() => nav2.navigate('EditProfile')} activeOpacity={0.85}>
                <Text style={m.outlineBtnTxt}>{t.profile_edit_btn}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={m.iconBtn} onPress={() => setShowQR(true)} activeOpacity={0.85}>
                <Ionicons name="qr-code-outline" size={18} color={colors.dark} />
              </TouchableOpacity>
              <TouchableOpacity style={m.iconBtn} onPress={() => nav2.navigate('Settings' as any)} activeOpacity={0.85}>
                <Ionicons name="settings-outline" size={18} color={colors.dark} />
              </TouchableOpacity>
            </View>
          )
        ) : (
          <View style={m.btnRow}>
            {isFollowing ? (
              <TouchableOpacity style={[m.outlineBtn, { flex: 1 }]} onPress={handleFollow} disabled={followLoading} activeOpacity={0.85}>
                {followLoading
                  ? <ActivityIndicator size="small" color={colors.gray600} />
                  : <Text style={m.outlineBtnTxt}>{t.following}</Text>
                }
              </TouchableOpacity>
            ) : (
              <LinearGradient colors={['#FF7A1C', '#FF6766']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={[m.gradBtn, { flex: 1 }]}>
                <TouchableOpacity onPress={handleFollow} disabled={followLoading} activeOpacity={0.85} style={m.gradBtnInner}>
                  {followLoading
                    ? <ActivityIndicator size="small" color="#fff" />
                    : <Text style={m.gradBtnTxt}>{theyFollowMe ? t.profile_follow_back : t.follow}</Text>
                  }
                </TouchableOpacity>
              </LinearGradient>
            )}
            <TouchableOpacity
              style={[m.outlineBtn, { flex: 1 }]}
              onPress={() => { if (!profile) return; nav2.navigate('Chat', { userId: profile.id, userName: profile.name, userAvatar: profile.avatar }) }}
              activeOpacity={0.85}
            >
              <Text style={m.outlineBtnTxt}>{t.profile_message}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={m.iconBtn} onPress={() => setShowUserMenu(true)} activeOpacity={0.85}>
              <Ionicons name="ellipsis-horizontal" size={18} color={colors.dark} />
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* ── Action sheet do utilizador (bloquear / denunciar / partilhar) ── */}
      <Modal visible={showUserMenu} transparent animationType="fade" onRequestClose={() => setShowUserMenu(false)}>
        <TouchableOpacity style={um.backdrop} activeOpacity={1} onPress={() => setShowUserMenu(false)}>
          <Animated.View style={[um.wrap, { paddingBottom: Math.max(bottom, 12), transform: [{ translateY: userMenuSlide }] }]}>
            <View style={um.group}>
              <TouchableOpacity style={um.item} activeOpacity={0.6} onPress={handleShareProfile}>
                <Text style={um.itemText}>{t.pf_share}</Text>
                <Ionicons name="share-outline" size={20} color={colors.gray800} />
              </TouchableOpacity>
              <View style={um.hairline} />
              <TouchableOpacity style={um.item} activeOpacity={0.6} onPress={handleReport}>
                <Text style={um.itemText}>{t.pf_report}</Text>
                <Ionicons name="flag-outline" size={20} color={colors.gray800} />
              </TouchableOpacity>
              <View style={um.hairline} />
              <TouchableOpacity style={um.item} activeOpacity={0.6} onPress={handleToggleBlock}>
                <Text style={[um.itemText, um.itemDanger]}>{isBlocked ? t.pf_unblock : t.pf_block}</Text>
                <Ionicons name="ban-outline" size={20} color="#FF3B30" />
              </TouchableOpacity>
            </View>
            <TouchableOpacity style={um.cancel} activeOpacity={0.6} onPress={() => setShowUserMenu(false)}>
              <Text style={um.cancelText}>{t.cancel}</Text>
            </TouchableOpacity>
          </Animated.View>
        </TouchableOpacity>
      </Modal>

      {/* ── Union invites ── */}
      {isOwn && unionInvites.length > 0 && (
        <View style={m.partnerReqs}>
          <View style={m.partnerReqsHeader}>
            <Ionicons name="heart-circle" size={14} color={colors.primary} />
            <Text style={m.partnerReqsTitle}>{t.profile_partner_req}</Text>
          </View>
          {unionInvites.map((inv) => (
            <View key={inv.id} style={m.partnerReqRow}>
              <AvatarImage uri={inv.fromUnion.memberA.avatar} size={38} />
              <View style={{ flex: 1 }}>
                <Text style={m.partnerReqName}>{inv.fromUnion.memberA.name}</Text>
                <Text style={m.partnerReqBio} numberOfLines={1}>{inv.fromUnion.label ?? t.profile_partner_req_msg}</Text>
              </View>
              <TouchableOpacity style={m.acceptBtn} onPress={() => handleUnionInviteResponse(inv.id, true)} activeOpacity={0.8}>
                <Text style={m.acceptBtnTxt}>{t.profile_accept}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={m.rejectBtn} onPress={() => handleUnionInviteResponse(inv.id, false)} activeOpacity={0.8}>
                <Ionicons name="close" size={15} color={colors.gray600} />
              </TouchableOpacity>
            </View>
          ))}
        </View>
      )}

      {/* ── Grid separator ── */}
      <View style={m.gridSep}>
        <View style={m.gridSepLine} />
        <Ionicons name="grid-outline" size={14} color={colors.gray400} />
        <View style={m.gridSepLine} />
      </View>
    </View>
  )

  // ── Render grid row ──────────────────────────────────────────────────────────
  function renderRow({ item }: { item: GridRow }) {
    if (item.type === 'featured') {
      return (
        <FeaturedRowComp
          row={item}
          isOwn={isOwn}
          yearLabel={t.pf_life_year}
          onPress={openPost}
          onMenu={(p) => { setMenuPost(p); setEditEditing(false) }}
        />
      )
    }
    return (
      <RegularRowComp
        row={item}
        isOwn={isOwn}
        yearLabel={t.pf_life_year}
        onPress={openPost}
        onMenu={(p) => { setMenuPost(p); setEditEditing(false) }}
      />
    )
  }

  return (
    <View style={m.container}>
      <FlatList
        data={rows}
        keyExtractor={(_, i) => String(i)}
        renderItem={renderRow}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.primary} />}
        ListHeaderComponent={ListHeader}
        ListEmptyComponent={
          <View style={m.emptyGrid}>
            <Ionicons name="images-outline" size={44} color="#E5E5EA" />
            <Text style={m.emptyGridTxt}>{t.profile_no_posts}</Text>
          </View>
        }
        contentContainerStyle={{ paddingBottom: Math.max(bottom, 8) + 58 }}
      />

      {isOwn && profile && <QRModal visible={showQR} userId={profile.id} userName={profile.name} onClose={() => setShowQR(false)} />}
      <FollowersSheet
        visible={showFollowSheet}
        mode={followSheetMode}
        userId={targetId}
        followerCount={followerCount}
        followingCount={followingCount}
        onClose={() => setShowFollowSheet(false)}
        onOwnFollowingChange={handleOwnFollowingChange}
        onCountChange={handleConnectionCountChange}
      />

      {/* Post options sheet */}
      <Modal visible={!!menuPost && !editEditing} transparent animationType="fade" onRequestClose={() => setMenuPost(null)}>
        <TouchableOpacity style={m.overlay} activeOpacity={1} onPress={() => setMenuPost(null)}>
          <View style={m.sheet}>
            <View style={m.sheetHandle} />
            <TouchableOpacity style={m.sheetRow} activeOpacity={0.75}
              onPress={() => { setEditCaption(menuPost?.caption ?? ''); setEditEditing(true) }}>
              <Ionicons name="create-outline" size={20} color={colors.gray800} />
              <Text style={m.sheetRowTxt}>{t.profile_edit_caption}</Text>
            </TouchableOpacity>
            <View style={m.sheetDiv} />
            <TouchableOpacity style={m.sheetRow} activeOpacity={0.75}
              onPress={() => menuPost && handleDeletePost(menuPost)}>
              <Ionicons name="trash-outline" size={20} color="#FF3B30" />
              <Text style={[m.sheetRowTxt, { color: '#FF3B30' }]}>{t.profile_del_title}</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Edit caption sheet */}
      <Modal visible={editEditing} transparent animationType="slide" onRequestClose={() => setEditEditing(false)}>
        <KeyboardAvoidingView style={m.overlay} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={() => setEditEditing(false)} />
          <View style={m.sheet}>
            <View style={m.sheetHandle} />
            <Text style={m.editTitle}>{t.profile_edit_caption}</Text>
            <TextInput
              style={m.editInput}
              value={editCaption}
              onChangeText={setEditCaption}
              placeholder={t.profile_caption_ph}
              placeholderTextColor={colors.gray400}
              multiline
              maxLength={200}
              autoFocus
            />
            <View style={m.editBtnRow}>
              <TouchableOpacity style={m.editCancelBtn} onPress={() => setEditEditing(false)} activeOpacity={0.75}>
                <Text style={m.editCancelTxt}>{t.cancel}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={m.editSaveBtn} onPress={handleSaveEdit} disabled={editLoading} activeOpacity={0.85}>
                {editLoading
                  ? <ActivityIndicator color="#fff" size="small" />
                  : <Text style={m.editSaveTxt}>{t.save}</Text>
                }
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  )
}

// ── Styles ─────────────────────────────────────────────────────────────────────
const m = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.white },

  // ── Floating nav ────────────────────────────────────────────────────────────
  floatNav: {
    position: 'absolute', left: 14, right: 14,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    zIndex: 10,
  },
  floatBtn: {
    width: 36, height: 36,
    alignItems: 'center', justifyContent: 'center',
  },

  // ── Avatar + identity (inside hero) ─────────────────────────────────────────
  identity: {
    position: 'absolute', bottom: 14, left: 0, right: 0,
    alignItems: 'center', gap: 6,
  },
  avatarOuter: {
    width: AV_OUTER, height: AV_OUTER,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarCircle: {
    width: AV_SIZE, height: AV_SIZE, borderRadius: AV_SIZE / 2,
    overflow: 'hidden', backgroundColor: colors.gray100,
  },
  avatarImg:      { width: '100%', height: '100%' },
  avatarFallback: { alignItems: 'center', justifyContent: 'center', backgroundColor: `${colors.primary}20` },
  avatarInitial:  { fontSize: 34, fontFamily: fonts.bold, color: colors.primary },
  camDot: {
    position: 'absolute', bottom: 2, right: 2,
    width: 22, height: 22, borderRadius: 11,
    backgroundColor: colors.dark,
    borderWidth: 2, borderColor: '#fff',
    alignItems: 'center', justifyContent: 'center',
  },

  name: {
    fontSize: 22, fontFamily: fonts.bold, color: colors.dark,
    letterSpacing: -0.5, textAlign: 'center', paddingHorizontal: 24,
  },
  handle: {
    fontSize: 14, fontFamily: fonts.medium, color: colors.gray400,
    textAlign: 'center', marginTop: 2,
  },
  statusPill: {
    backgroundColor: 'rgba(0,0,0,0.07)',
    borderRadius: 20, paddingHorizontal: 10, paddingVertical: 3,
  },
  statusTxt: {
    fontSize: 12, fontFamily: fonts.medium, color: colors.gray600, letterSpacing: 0.1,
  },

  // ── Stats ───────────────────────────────────────────────────────────────────
  statsRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingVertical: 18, paddingHorizontal: 24,
  },
  statCol:     { flex: 1, alignItems: 'center', gap: 3 },
  statNum:     { fontSize: 20, fontFamily: fonts.bold, color: colors.dark, letterSpacing: -0.4 },
  statLbl:     { fontSize: 11, fontFamily: fonts.regular, color: colors.gray500, letterSpacing: 0.1 },
  statDivider: { width: 1, height: 28, backgroundColor: colors.gray200 },

  // Pilha de seguidores + atalho para a página inteira.
  networkBar: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    marginHorizontal: 18, marginTop: 14,
    paddingVertical: 11,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.gray200,
  },
  networkLink: {
    fontSize: 13.5, fontFamily: fonts.semiBold, color: colors.gray800, letterSpacing: -0.2,
  },

  // ── Bio card ─────────────────────────────────────────────────────────────────
  bioCard: {
    marginHorizontal: 16, marginBottom: 14,
    backgroundColor: '#F7F7F7',
    borderRadius: 16, padding: 14, gap: 8,
  },
  bioTxt:  { fontSize: 14, fontFamily: fonts.regular, color: colors.gray800, lineHeight: 20 },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  infoTxt: { fontSize: 12.5, fontFamily: fonts.regular, color: colors.gray500 },
  partnerPill: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    borderRadius: 20, paddingHorizontal: 10, paddingVertical: 5,
    alignSelf: 'flex-start',
  },
  partnerTxt: { fontSize: 12, fontFamily: fonts.semiBold, color: '#fff' },
  pairingPill: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    borderRadius: 20, paddingHorizontal: 10, paddingVertical: 5,
    alignSelf: 'flex-start',
    borderWidth: 1.3, borderColor: '#0A0A0A',
  },
  pairingPillDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.primary },
  pairingPillTxt: { fontSize: 12, fontFamily: fonts.semiBold, color: '#0A0A0A' },

  // ── Interests ──────────────────────────────────────────────────────────────
  // Quem sigo — fila horizontal, só no próprio perfil
  followingBlock: { marginBottom: 16 },
  followingHead: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginHorizontal: 16, marginBottom: 10,
  },
  followingTitle: { fontFamily: fonts.semiBold, fontSize: 14, color: colors.gray800 },
  followingAll:   { fontFamily: fonts.semiBold, fontSize: 12.5, color: colors.primary },
  followingRow:   { paddingHorizontal: 16, gap: 14 },
  followingItem:  { alignItems: 'center', gap: 6, width: 58 },
  followingName: {
    fontFamily: fonts.medium, fontSize: 11, color: colors.gray500,
    textAlign: 'center', maxWidth: 58,
  },

  // Conexões em comum — linha discreta, sem cartão: é contexto, não conteúdo
  mutualRow: {
    flexDirection: 'row', alignItems: 'center', gap: 9,
    marginHorizontal: 16, marginBottom: 14,
  },
  mutualAvatars:    { flexDirection: 'row', alignItems: 'center' },
  mutualAvatarWrap: { borderRadius: 13 },
  mutualTxt: {
    flex: 1, fontSize: 12.5, fontFamily: fonts.regular,
    color: colors.gray500, lineHeight: 17,
  },

  interestsWrap: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 8,
    marginHorizontal: 16, marginBottom: 16,
  },
  interestChip: {
    borderWidth: 1, borderColor: colors.gray200,
    borderRadius: 14, paddingHorizontal: 12, paddingVertical: 6,
  },
  interestChipTxt: { fontSize: 12.5, fontFamily: fonts.medium, color: colors.gray800 },

  // ── Action buttons ───────────────────────────────────────────────────────────
  actionsArea: { paddingHorizontal: 16, marginBottom: 6 },
  btnRow: { flexDirection: 'row', gap: 8 },
  gradBtn: {
    height: 42, borderRadius: 21,
    alignItems: 'center', justifyContent: 'center',
    ...Platform.select({
      ios: { shadowColor: '#FF7A1C', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8 },
      android: { elevation: 4 },
    }),
  },
  gradBtnInner: { flex: 1, width: '100%', alignItems: 'center', justifyContent: 'center' },
  gradBtnTxt:   { fontSize: 14, fontFamily: fonts.semiBold, color: '#fff' },
  outlineBtn: {
    height: 42, borderRadius: 21,
    borderWidth: 1.5, borderColor: colors.gray300,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.white,
  },
  outlineBtnTxt: { fontSize: 14, fontFamily: fonts.semiBold, color: colors.dark },
  iconBtn: {
    width: 42, height: 42, borderRadius: 21,
    borderWidth: 1.5, borderColor: colors.gray300,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.white,
  },

  // ── Partner requests ─────────────────────────────────────────────────────────
  partnerReqs:       { marginHorizontal: 16, marginTop: 8, gap: 10, paddingTop: 14, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.gray200 },
  partnerReqsHeader: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  partnerReqsTitle:  { fontSize: 10, fontFamily: fonts.bold, color: colors.primary, letterSpacing: 1, textTransform: 'uppercase' },
  partnerReqRow:     { flexDirection: 'row', alignItems: 'center', gap: 10 },
  partnerReqName:    { fontSize: 14, fontFamily: fonts.semiBold, color: colors.dark },
  partnerReqBio:     { fontSize: 12, fontFamily: fonts.regular, color: colors.gray500 },
  acceptBtn:         { backgroundColor: colors.primary, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8 },
  acceptBtnTxt:      { fontSize: 13, fontFamily: fonts.semiBold, color: '#fff' },
  rejectBtn:         { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.gray100, alignItems: 'center', justifyContent: 'center' },

  // ── Grid separator ───────────────────────────────────────────────────────────
  gridSep:     { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingVertical: 14 },
  gridSepLine: { flex: 1, height: 1, backgroundColor: colors.gray200 },

  // ── Empty state ──────────────────────────────────────────────────────────────
  emptyGrid:    { alignItems: 'center', paddingTop: 48, gap: 10 },
  emptyGridTxt: { fontSize: 14, fontFamily: fonts.regular, color: colors.gray400 },

  // ── Modals ───────────────────────────────────────────────────────────────────
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: colors.white, borderTopLeftRadius: 24, borderTopRightRadius: 24,
    paddingTop: 10, paddingBottom: 36, paddingHorizontal: 20,
  },
  sheetHandle:  { width: 36, height: 4, borderRadius: 2, backgroundColor: colors.gray200, alignSelf: 'center', marginBottom: 16 },
  sheetRow:     { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 16, paddingHorizontal: 4 },
  sheetRowTxt:  { fontSize: 16, fontFamily: fonts.medium, color: colors.gray800 },
  sheetDiv:     { height: 1, backgroundColor: colors.gray100 },
  editTitle:    { fontSize: 16, fontFamily: fonts.semiBold, color: colors.gray800, marginBottom: 14, textAlign: 'center' },
  editInput: {
    borderWidth: 1.5, borderColor: colors.gray200, borderRadius: 14,
    paddingHorizontal: 14, paddingVertical: 12,
    fontSize: 15, fontFamily: fonts.regular, color: colors.gray800,
    minHeight: 90, textAlignVertical: 'top', marginBottom: 16,
  },
  editBtnRow:    { flexDirection: 'row', gap: 10 },
  editCancelBtn: { flex: 1, alignItems: 'center', paddingVertical: 14, borderRadius: 21, borderWidth: 1.5, borderColor: colors.gray200 },
  editCancelTxt: { fontSize: 15, fontFamily: fonts.semiBold, color: colors.gray600 },
  editSaveBtn:   { flex: 2, alignItems: 'center', paddingVertical: 14, borderRadius: 21, backgroundColor: colors.primary },
  editSaveTxt:   { fontSize: 15, fontFamily: fonts.semiBold, color: '#fff' },
})

// ── Grid cell styles ──────────────────────────────────────────────────────────
const g = StyleSheet.create({
  cellImg:  { backgroundColor: colors.gray100 },
  cellText: { fontSize: 9, fontFamily: fonts.medium, color: '#fff', textAlign: 'center' },
  videoIcon: {
    position: 'absolute', top: 5, right: 5,
    backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 4, padding: 3,
  },
  menuBtn: {
    position: 'absolute', top: 5, right: 5,
    backgroundColor: 'rgba(0,0,0,0.52)', borderRadius: 10,
    paddingHorizontal: 5, paddingVertical: 3,
  },
  viewsBadge: {
    position: 'absolute', bottom: 5, left: 5,
    flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: 'rgba(0,0,0,0.52)', borderRadius: 10,
    paddingHorizontal: 6, paddingVertical: 3,
  },
  viewsBadgeTxt: { color: '#fff', fontSize: 10, fontFamily: fonts.semiBold },

  lifeBadge: {
    position: 'absolute', bottom: 5, right: 5,
    borderRadius: 10, paddingHorizontal: 6, paddingVertical: 3,
    alignItems: 'center', justifyContent: 'center',
  },
  lifeBadgeQuiet: { backgroundColor: 'rgba(0,0,0,0.52)' },
  lifeBadgeTxt:   { color: '#fff', fontSize: 10, fontFamily: fonts.semiBold, letterSpacing: 0.2 },
})

// ── User action sheet (bloquear / denunciar / partilhar) ──────────────────────
const um = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  wrap:     { paddingHorizontal: 10, gap: 8 },
  group:    {
    backgroundColor: '#FFFFFF', borderRadius: 20, overflow: 'hidden',
    shadowColor: '#000', shadowOpacity: 0.14, shadowRadius: 24, shadowOffset: { width: 0, height: 10 },
  },
  item:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 17 },
  itemText: { fontSize: 16.5, fontFamily: fonts.medium, color: colors.gray800, letterSpacing: -0.2 },
  itemDanger:{ color: '#FF3B30', fontFamily: fonts.semiBold },
  hairline: { height: StyleSheet.hairlineWidth, backgroundColor: '#E8E8EA', marginLeft: 20 },
  cancel:   {
    backgroundColor: '#FFFFFF', borderRadius: 20, paddingVertical: 17, alignItems: 'center',
    shadowColor: '#000', shadowOpacity: 0.14, shadowRadius: 24, shadowOffset: { width: 0, height: 10 },
  },
  cancelText:{ fontSize: 16.5, fontFamily: fonts.bold, color: colors.gray800, letterSpacing: -0.2 },
})
