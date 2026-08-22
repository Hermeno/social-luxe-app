import React, { useState, useCallback, useEffect, useRef } from 'react'
import {
  View, Text, FlatList, StyleSheet, TextInput,
  TouchableOpacity, Animated, ActivityIndicator, KeyboardAvoidingView,
  Keyboard, LayoutAnimation, Platform, UIManager,
} from 'react-native'
import { Image } from 'expo-image'

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true)
}
import { useFocusEffect, useIsFocused, useNavigation } from '@react-navigation/native'
import type { StackNavigationProp } from '@react-navigation/stack'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import Toast from 'react-native-toast-message'
import * as msgService from '../../services/message.service'
import * as unionService from '../../services/union.service'
import { getConnections } from '../../services/follow.service'
import type { FollowDuration } from '../../services/follow.service'
import type { Connection, Union, UnionMessage, TogetherLivePayload, Pairing, Post } from '../../types'
import { searchPosts as searchPostsApi } from '../../services/post.service'
import * as pairingService from '../../services/pairing.service'
import { useUnionStore } from '../../store/union.store'
import { UNION_ENABLED } from '../../config/features'
import {
  getViewedPostIds,
  getCachedConnections,
  cacheConnections,
  updateCachedConnection,
  getCache,
  setCache,
  getSyncMeta,
  setSyncMeta,
} from '../../db/database'
import type { FollowUser } from '../../services/follow.service'
import { API_BASE } from '../../config'
import FollowSplitButton from '../../components/FollowSplitButton'
import SuggestionsSheet from '../../components/SuggestionsSheet'
import { api } from '../../services/api'
import { getSocket } from '../../socket'
import { useAuthStore } from '../../store/auth.store'
import { useFollowStore } from '../../store/follow.store'
import { useOnlineStore } from '../../store/online.store'
import { isConnected } from '../../services/netinfo.service'
import { useMessageBadgeStore } from '../../store/messageBadge.store'
import { useFeedStore } from '../../store/feed.store'
import { useMessagesStore } from '../../store/messages.store'
import type { AppStackParams } from '../../navigation/AppNavigator'
import { colors, fonts } from '../../theme'
import { useT } from '../../i18n'
import AvatarImage from '../../components/AvatarImage'
import DuoAvatar from '../../components/DuoAvatar'
import { displayHandle } from '../../utils/handle'

type Nav = StackNavigationProp<AppStackParams>

function openProfileOnStack(navigation: Nav, userId: string) {
  const stack = navigation.getState().type === 'stack'
    ? navigation
    : navigation.getParent<Nav>()
  if (stack?.getState().type !== 'stack') return
  stack.push('Profile', { userId })
}

const RING = 64
const AVA  = 54

// ── Helpers ───────────────────────────────────────────────────────────────────

function timeAgo(date: string, nowLabel = 'agora') {
  const diff = Date.now() - new Date(date).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1)  return nowLabel
  if (m < 60) return `${m}m`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h`
  return `${Math.floor(h / 24)}d`
}

function fmtCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000)     return `${(n / 1_000).toFixed(1)}K`
  return String(n)
}

function resolveMediaUri(uri: string | null | undefined): string | null {
  if (!uri) return null
  if (uri.startsWith('http') || uri.startsWith('file://')) return uri
  return `${API_BASE}${uri.startsWith('/') ? '' : '/'}${uri}`
}

interface UserResult {
  id: string
  name: string
  username?: string | null
  avatar: string | null
  bio: string | null
  _count?: { followers: number; posts: number }
}

// ── Person row (search results) ───────────────────────────────────────────────

function UserRow({
  user, followed, followBack, loadingFollow, onFollow, onPress,
}: {
  user: UserResult
  followed: boolean
  followBack: boolean
  loadingFollow: boolean
  onFollow: (duration: FollowDuration) => void
  onPress: () => void
}) {
  const t         = useT()
  const followers = user._count?.followers ?? 0
  const account   = user.username ? displayHandle(user.username) : null
  const audience  = `${fmtCount(followers)} ${followers === 1 ? t.follower : t.followers}`

  return (
    <View style={c.row}>
      <TouchableOpacity
        style={c.person}
        onPress={onPress}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityLabel={account ? `${user.name}, ${account}, ${audience}` : `${user.name}, ${audience}`}
      >
        <AvatarImage uri={user.avatar} name={user.name} size={50} />
        <View style={c.textWrap}>
          <Text style={c.name} numberOfLines={1}>{user.name}</Text>
          <Text style={c.meta} numberOfLines={1}>
            {account ? `${account} · ${audience}` : audience}
          </Text>
        </View>
      </TouchableOpacity>
      <FollowSplitButton
        following={followed}
        followBack={followBack}
        loading={loadingFollow}
        onFollow={onFollow}
        theme="light"
      />
    </View>
  )
}

// ── Quick reply inline form ───────────────────────────────────────────────────

function QuickReplyBox({ userName, onSend, onClose }: {
  userName: string
  onSend: (text: string) => void
  onClose: () => void
}) {
  const t = useT()
  const [text, setText] = useState('')
  const inputRef = useRef<TextInput>(null)

  useEffect(() => {
    const timer = setTimeout(() => inputRef.current?.focus(), 120)
    return () => clearTimeout(timer)
  }, [])

  function handleSend() {
    const msg = text.trim()
    if (!msg) return
    setText('')
    onClose()
    onSend(msg)
  }

  return (
    <View style={q.container}>
      <View style={q.header}>
        <View style={q.replyLabel}>
          <Ionicons name="return-down-forward" size={13} color="#6E6E73" />
          <Text style={q.replyTxt} numberOfLines={1}>
            {t.msg_reply_to} <Text style={q.replyName}>{userName}</Text>
          </Text>
        </View>
        <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="close" size={16} color={colors.gray400} />
        </TouchableOpacity>
      </View>
      <View style={q.row}>
        <TextInput
          ref={inputRef}
          style={q.input}
          placeholder={t.msg_input_ph}
          placeholderTextColor={colors.gray400}
          value={text}
          onChangeText={setText}
          returnKeyType="send"
          onSubmitEditing={handleSend}
          multiline={false}
        />
        <TouchableOpacity
          style={[q.sendBtn, !text.trim() && q.sendBtnOff]}
          onPress={handleSend}
          disabled={!text.trim()}
        >
          <Ionicons name="send" size={15} color={colors.white} />
        </TouchableOpacity>
      </View>
    </View>
  )
}

// ── Conversation row ──────────────────────────────────────────────────────────

function ConvoRow({ item, viewedIds, onPress, index, myUserId, isQuickOpen, onToggleQuick, onQuickSend }: {
  item: Connection
  viewedIds: Set<string>
  onPress: () => void
  index: number
  myUserId: string
  isQuickOpen: boolean
  onToggleQuick: () => void
  onQuickSend: (text: string) => void
}) {
  const t = useT()
  const isOnline    = useOnlineStore((st) => st.isOnline(item.user.id))
  const hasMsg      = !!item.lastMessage
  const unread      = item.unreadCount > 0
  const viewedCount = item.postIds.filter((id) => viewedIds.has(id)).length
  const iMine       = hasMsg && item.lastMessage!.senderId === myUserId
  const showReply   = unread && !iMine

  const opacity    = useRef(new Animated.Value(0)).current
  const translateY = useRef(new Animated.Value(6)).current

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity,    { toValue: 1, duration: 240, delay: index * 28, useNativeDriver: true }),
      Animated.timing(translateY, { toValue: 0, duration: 240, delay: index * 28, useNativeDriver: true }),
    ]).start()
  }, [])

  const preview = hasMsg ? (item.lastMessage!.content ?? t.msg_media_file) : t.msg_empty

  return (
    <Animated.View style={{ opacity, transform: [{ translateY }] }}>
      <TouchableOpacity style={s.row} onPress={onPress} activeOpacity={0.6}>
        {/* Avatar, sem anel — nas conversas o avatar é só a pessoa */}
        <View style={s.avatarWrap}>
          <AvatarImage uri={item.user.avatar} name={item.user.name} size={AVA} />
        </View>

        {/* Text info */}
        <View style={s.info}>
          <View style={s.topRow}>
            <Text style={[s.name, unread && s.nameBold]} numberOfLines={1}>{item.user.username ? displayHandle(item.user.username) : item.user.name}</Text>
            {hasMsg && (
              <Text style={[s.time, unread && s.timeActive]}>
                {timeAgo(item.lastMessage!.createdAt, t.time_now)}
              </Text>
            )}
          </View>

          {/* Pré-visualização + estado (badge não-lido, ou online/offline) */}
          <View style={s.bottomRow}>
            <Text style={[s.preview, s.previewFlex, unread && s.previewBold, !hasMsg && s.previewMuted]} numberOfLines={1}>
              {iMine ? `Você: ${preview}` : preview}
            </Text>
            {unread ? (
              <View style={s.trailing}>
                <View style={s.dot}>
                  <Text style={s.dotTxt}>{item.unreadCount > 9 ? '9+' : item.unreadCount}</Text>
                </View>
                {showReply && (
                  <TouchableOpacity
                    style={[s.replyArrow, isQuickOpen && s.replyArrowActive]}
                    onPress={(e) => { (e as any).stopPropagation?.(); onToggleQuick() }}
                    hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}
                  >
                    <Ionicons name={isQuickOpen ? 'chevron-up' : 'chevron-down'} size={15} color={isQuickOpen ? colors.white : '#6E6E73'} />
                  </TouchableOpacity>
                )}
              </View>
            ) : (
              <View style={s.status}>
                <View style={[s.statusDot, isOnline ? s.statusDotOn : s.statusDotOff]} />
                <Text style={s.statusTxt}>{isOnline ? t.chat_online : t.chat_offline}</Text>
              </View>
            )}
          </View>
        </View>
      </TouchableOpacity>

      {isQuickOpen && (
        <QuickReplyBox
          userName={item.user.name.split(' ')[0]}
          onSend={onQuickSend}
          onClose={onToggleQuick}
        />
      )}
    </Animated.View>
  )
}

// ── Union conversation row ────────────────────────────────────────────────────

function UnionConvoRow({ item, myUnion, liveUnions, onPress }: {
  item: UnionMessage
  myUnion: Union | undefined
  liveUnions: Set<string>
  onPress: () => void
}) {
  const t        = useT()
  const isLive   = liveUnions.has(myUnion?.id ?? '') || liveUnions.has(item.fromUnionId) || liveUnions.has(item.toUnionId)
  const unread   = useUnionStore.getState().unreadCounts[`${item.fromUnionId}|${item.toUnionId}`] ?? 0
  const dispName = item.fromUnion?.name ?? t.un_union
  const memberA  = (item.fromUnion as any)?.memberA
  const memberB  = (item.fromUnion as any)?.memberB

  return (
    <TouchableOpacity style={s.row} activeOpacity={0.6} onPress={onPress}>
      <DuoAvatar
        aUri={memberA?.avatar} aName={memberA?.name}
        bUri={memberB?.avatar} bName={memberB?.name}
        size={34} overlap={10} borderWidth={1.5}
      />

      <View style={s.info}>
        <View style={s.topRow}>
          <Text style={[s.name, unread > 0 && s.nameBold]} numberOfLines={1}>💑 {dispName}</Text>
          {isLive
            ? <View style={s.livePill}><Text style={s.livePillTxt}>{t.msg_live_together}</Text></View>
            : <Text style={[s.time, unread > 0 && s.timeActive]}>{timeAgo(item.createdAt, t.time_now)}</Text>
          }
        </View>
        <Text style={[s.preview, unread > 0 && s.previewBold]} numberOfLines={1}>
          {item.content ?? t.msg_media}
        </Text>
      </View>

      {unread > 0 && (
        <View style={s.dot}><Text style={s.dotTxt}>{unread > 9 ? '9+' : unread}</Text></View>
      )}
    </TouchableOpacity>
  )
}

// ── Pairing card — vertical card in the horizontal carousel ──────────────────

function PairingCard({ data, onPress }: { data: Pairing; onPress: () => void }) {
  return (
    <TouchableOpacity style={g.card} onPress={onPress} activeOpacity={0.7}>
      <DuoAvatar
        aUri={data.userA.avatar} aName={data.userA.name}
        bUri={data.userB.avatar} bName={data.userB.name}
        size={36} overlap={12} borderWidth={2}
      />
      <View style={g.textCol}>
        <View style={g.liveRow}>
          <View style={g.liveDot} />
          <Text style={g.names} numberOfLines={1}>
            {data.userA.name.split(' ')[0]} & {data.userB.name.split(' ')[0]}
          </Text>
        </View>
        <Text style={g.title} numberOfLines={1}>{pairingService.pairingLabel(data)}</Text>
      </View>
    </TouchableOpacity>
  )
}

// ── Linha de "stories" — pessoas no topo, anel crimson quem está online ───────
function StoryAvatar({ item, onPress }: { item: Connection; onPress: () => void }) {
  const online = useOnlineStore((st) => st.isOnline(item.user.id))
  return (
    <TouchableOpacity style={so.item} onPress={onPress} activeOpacity={0.75}>
      <View style={[so.ring, online ? so.ringOn : so.ringOff]}>
        <View style={so.hole}>
          <AvatarImage uri={item.user.avatar} name={item.user.name} size={54} />
        </View>
        {online && <View style={so.onlineDot} />}
      </View>
      <Text style={so.name} numberOfLines={1}>{item.user.name.split(' ')[0]}</Text>
    </TouchableOpacity>
  )
}

function StoriesRow({ connections, onOpen }: { connections: Connection[]; onOpen: (c: Connection) => void }) {
  if (connections.length === 0) return null
  return (
    <FlatList
      data={connections.slice(0, 20)}
      keyExtractor={(c) => `story_${c.user.id}`}
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={so.content}
      style={so.list}
      renderItem={({ item }) => <StoryAvatar item={item} onPress={() => onOpen(item)} />}
    />
  )
}

const so = StyleSheet.create({
  list:    { flexGrow: 0 },
  content: { paddingHorizontal: 16, paddingVertical: 10, gap: 14 },
  item:    { alignItems: 'center', width: 66, gap: 5 },
  ring:    { padding: 2.5, borderRadius: 34, borderWidth: 2, backgroundColor: colors.white },
  ringOn:  { borderColor: colors.primary },
  ringOff: { borderColor: '#E6E6EA' },
  hole:    { width: 54, height: 54, borderRadius: 27, overflow: 'hidden', borderWidth: 2, borderColor: colors.white },
  onlineDot: {
    position: 'absolute', right: 2, bottom: 2, width: 13, height: 13, borderRadius: 6.5,
    backgroundColor: '#22C55E', borderWidth: 2, borderColor: colors.white,
  },
  name:    { fontSize: 11.5, fontFamily: fonts.medium, color: '#6E6E73', maxWidth: 64, textAlign: 'center' },
})

// ── Screen ────────────────────────────────────────────────────────────────────

export default function MessagesScreen() {
  const t               = useT()
  const nav             = useNavigation<Nav>()
  const isFocused       = useIsFocused()
  const { top, bottom } = useSafeAreaInsets()
  const { user }        = useAuthStore()
  const inputRef        = useRef<TextInput>(null)
  const { setTotalUnread } = useMessageBadgeStore()

  const [connections,    setConnections]    = useState<Connection[]>([])
  const [connsLoading,   setConnsLoading]   = useState(false)
  const [connsError,     setConnsError]     = useState(false)
  const [viewedIds,      setViewedIds]      = useState<Set<string>>(new Set())
  const [quickReplyId,   setQuickReplyId]   = useState<string | null>(null)
  const [myHasPosts,     setMyHasPosts]     = useState(false)

  const [query,          setQuery]          = useState('')
  const [isSearchMode,   setIsSearchMode]   = useState(false)
  const [suggested,      setSuggested]      = useState<UserResult[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  // A TabBar também abre esta folha — o pedido chega por aqui.
  const suggestionsRequested = useMessagesStore((s) => s.suggestionsRequested)
  const consumedSuggestionsRef = useRef(0)
  useEffect(() => {
    if (!isFocused || suggestionsRequested <= consumedSuggestionsRef.current) return
    consumedSuggestionsRef.current = suggestionsRequested
    setShowSuggestions(true)
  }, [isFocused, suggestionsRequested])
  const [searchResults,  setSearchResults]  = useState<UserResult[]>([])
  const [postResults,    setPostResults]    = useState<Post[]>([])
  const [searchLoading,  setSearchLoading]  = useState(false)
  const [suggestLoading, setSuggestLoading] = useState(false)
  const followingIds     = useFollowStore((s) => s.followingIds)
  const [followers,      setFollowers]      = useState<Set<string>>(new Set())
  const [followPending,  setFollowPending]  = useState<Set<string>>(new Set())
  // userId → timestamp em que segui agora, para aparecer no topo da lista
  const [justFollowed,   setJustFollowed]   = useState<Record<string, number>>({})

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const searchRequestRef = useRef(0)

  // ── Uniões tab ────────────────────────────────────────────────────────────
  const [unionConvos,     setUnionConvos]     = useState<UnionMessage[]>([])
  const [unionConvoLoad,  setUnionConvoLoad]  = useState(false)
  const [respondingId,    setRespondingId]    = useState<string | null>(null)
  const [liveUnions,      setLiveUnions]      = useState<Set<string>>(new Set())
  const [myPairing,       setMyPairing]       = useState<Pairing | null>(null)
  const { myUnions, setMyUnions, addInvite, incrementUnread, setPendingInvites, removeInvite, addUnion, hydrateFromCache } = useUnionStore()
  const pendingInvites   = useUnionStore((s) => s.pendingInvites)

  // Hydrate from cache on first mount (offline-first)
  useEffect(() => {
    hydrateFromCache()
  }, [])

  useFocusEffect(useCallback(() => {
    if (!UNION_ENABLED) return
    // Background refresh from API (cache is already showing)
    unionService.getMyUnions().then(setMyUnions).catch(() => {})
    unionService.getPendingInvites().then(setPendingInvites).catch(() => {})
    setUnionConvoLoad(true)
    unionService.getUnionConversations().then(setUnionConvos).catch(() => {}).finally(() => setUnionConvoLoad(false))
  }, []))

  // Track current connections in a ref so onNewMessage can read it without closures
  const connectionsRef = useRef<Connection[]>([])
  useEffect(() => { connectionsRef.current = connections }, [connections])

  // Pairing is persistent (DB-backed) — fetch on mount, socket events keep it live after that
  useEffect(() => {
    pairingService.getMyPairing().then(setMyPairing).catch(() => {})
  }, [])

  // ── Respond to union invite ───────────────────────────────────────────────
  async function handleRespondInvite(inviteId: string, accept: boolean) {
    setRespondingId(inviteId)
    try {
      const result = await unionService.respondToInvite(inviteId, accept)
      removeInvite(inviteId)
      if (accept && result.union) {
        addUnion(result.union)
        // Refresh conversations
        unionService.getUnionConversations().then(setUnionConvos).catch(() => {})
      }
    } catch {
      Toast.show({ type: 'error', text1: t.error, text2: t.msg_invite_reply_err, visibilityTime: 2500 })
    } finally {
      setRespondingId(null)
    }
  }

  // Socket: union invite & message notifications
  useEffect(() => {
    const socket = getSocket()
    if (!socket) return
    const onInvite = ({ invite }: any) => addInvite(invite)
    const onMsg    = ({ message }: { message: UnionMessage }) => {
      setUnionConvos((prev) => {
        const key = [message.fromUnionId, message.toUnionId].sort().join('|')
        const filtered = prev.filter((m) => [m.fromUnionId, m.toUnionId].sort().join('|') !== key)
        return [message, ...filtered]
      })
      incrementUnread(`${message.fromUnionId}|${message.toUnionId}`)
    }
    const onLive = ({ unionId }: TogetherLivePayload) => {
      setLiveUnions((prev) => new Set([...prev, unionId]))
    }
    const onEnded = ({ unionId }: { unionId: string }) => {
      setLiveUnions((prev) => { const n = new Set(prev); n.delete(unionId); return n })
    }

    const onPairingInvited = ({ pairing }: { pairing: Pairing }) => {
      if (pairing.userA.id === user?.id || pairing.userB.id === user?.id) setMyPairing(pairing)
    }
    const onPairingActive = ({ pairing }: { pairing: Pairing }) => {
      if (pairing.userA.id === user?.id || pairing.userB.id === user?.id) setMyPairing(pairing)
    }
    const onPairingEnded = ({ pairing }: { pairing: Pairing }) => {
      if (pairing.userA.id === user?.id || pairing.userB.id === user?.id) setMyPairing(null)
    }

    socket.on('union:invite',       onInvite)
    socket.on('union:message:new',  onMsg)
    socket.on('union:together:live',  onLive)
    socket.on('union:together:ended', onEnded)
    socket.on('pairing:invited',    onPairingInvited)
    socket.on('pairing:active',     onPairingActive)
    socket.on('pairing:ended',      onPairingEnded)
    return () => {
      socket.off('union:invite',       onInvite)
      socket.off('union:message:new',  onMsg)
      socket.off('union:together:live',  onLive)
      socket.off('union:together:ended', onEnded)
      socket.off('pairing:invited',    onPairingInvited)
      socket.off('pairing:active',     onPairingActive)
      socket.off('pairing:ended',      onPairingEnded)
    }
  }, [user?.id])

  // ── Load connections (SQLite first → always background sync) ────────────
  const syncConnectionsRef = useRef<(() => Promise<void>) | null>(null)

  useFocusEffect(useCallback(() => {
    let cancelled = false

    async function load() {
      // 1. Show connections_cache instantly
      const [cached, viewed] = await Promise.all([
        getCachedConnections().catch(() => [] as Connection[]),
        getViewedPostIds().catch(() => new Set<string>()),
      ])

      let hasLocalData = false

      if (!cancelled && cached.length > 0) {
        setConnections(cached)
        setViewedIds(viewed)
        setTotalUnread(cached.reduce((s, c) => s + c.unreadCount, 0))
        hasLocalData = true
      } else if (!cancelled) {
        // 2. Fallback: build list from follow store cache (never fails offline)
        // Filter entries that have actual names — bare { id } objects from stale cache
        // would produce '?' avatars and are useless.
        const followCache = await getCache<FollowUser[]>('my_following').catch(() => null)
        const validFollows = followCache?.filter((u) => u.name?.trim()) ?? []
        if (validFollows.length > 0 && !cancelled) {
          const fallback: Connection[] = validFollows.map((u) => ({
            user:        { id: u.id, name: u.name, avatar: u.avatar },
            lastMessage: null,
            unreadCount: 0,
            postIds:     [],
          }))
          setConnections(fallback)
          hasLocalData = true
        }
      }

      // 3. Background refresh from API (enriches with messages/unread/posts)
      if (!isConnected()) return
      // Only show spinner if we have no data at all
      if (!cancelled && !hasLocalData) { setConnsLoading(true); setConnsError(false) }
      try {
        const fresh = await getConnections()
        if (cancelled) return
        // getConnections() is message-history based (see api's getConversations) — it
        // structurally never includes someone you've followed but never messaged yet.
        // Keep those local-only stubs instead of letting this overwrite wipe them out
        // right after handleFollow optimistically added one.
        const freshIds = new Set(fresh.map((c) => c.user.id))
        let merged: Connection[] = fresh
        setConnections((prev) => {
          const localOnly = prev.filter((c) => !c.lastMessage && !freshIds.has(c.user.id))
          merged = localOnly.length > 0 ? [...fresh, ...localOnly] : fresh
          return merged
        })
        setConnsLoading(false)
        setConnsError(false)
        const viewedFresh = await getViewedPostIds().catch(() => new Set<string>())
        if (!cancelled) setViewedIds(viewedFresh)
        cacheConnections(merged).catch(() => {})
        setSyncMeta('connections_sync', String(Date.now())).catch(() => {})
        setTotalUnread(merged.reduce((s, c) => s + c.unreadCount, 0))
      } catch {
        if (!cancelled) {
          setConnsLoading(false)
          // Only show the error banner if we have no data to display
          if (!hasLocalData) setConnsError(true)
        }
      }
    }

    syncConnectionsRef.current = load
    load()

    // Fetch current user's post count for avatar ring
    if (user?.id) {
      api.get(`/users/${user.id}`).then((r) => {
        const count = r.data?._count?.posts ?? r.data?.data?._count?.posts ?? 0
        setMyHasPosts(count > 0)
      }).catch(() => {})
    }

    return () => { cancelled = true }
  }, [user?.id]))

  // ── Socket: live inbox updates ────────────────────────────────────────────
  useEffect(() => {
    const socket = getSocket()
    if (!socket) return

    function onNewMessage(msg: any) {
      const partnerId = msg.senderId === user?.id ? msg.receiverId : msg.senderId
      const newLastMsg = { id: msg.id, content: msg.content, senderId: msg.senderId, readAt: msg.readAt, createdAt: msg.createdAt }

      const known = connectionsRef.current.some((c) => c.user.id === partnerId)

      if (known) {
        setConnections((prev) => {
          const idx = prev.findIndex((c) => c.user.id === partnerId)
          if (idx < 0) return prev
          const update: Partial<Connection> = {
            lastMessage: newLastMsg,
            unreadCount: msg.senderId !== user?.id ? prev[idx].unreadCount + 1 : prev[idx].unreadCount,
          }
          const updated: Connection[] = [{ ...prev[idx], ...update }, ...prev.filter((_, i) => i !== idx)]
          const cacheUpdate = msg.senderId !== user?.id
            ? { lastMessage: newLastMsg }
            : update
          updateCachedConnection(partnerId, cacheUpdate, { user: prev[idx].user, postIds: prev[idx].postIds }).catch(() => {})
          return updated
        })
      } else {
        // Unknown sender — quick profile fetch to show them immediately
        api.get(`/users/${partnerId}`, { timeout: 8000 })
          .then((res) => {
            const u = res.data.data ?? res.data
            if (!u?.id) { syncConnectionsRef.current?.().catch(() => {}); return }
            const newConn: Connection = {
              user:        { id: u.id, name: u.name, avatar: u.avatar ?? null },
              lastMessage: newLastMsg,
              unreadCount: msg.senderId !== user?.id ? 1 : 0,
              postIds:     [],
            }
            setConnections((cur) => {
              if (cur.some((c) => c.user.id === u.id)) return cur
              cacheConnections([newConn]).catch(() => {})
              return [newConn, ...cur]
            })
          })
          .catch(() => syncConnectionsRef.current?.().catch(() => {}))
      }
    }

    socket.on('message:new', onNewMessage)
    return () => { socket.off('message:new', onNewMessage) }
  }, [user?.id])

  // ── Suggested users ───────────────────────────────────────────────────────
  async function loadSuggested() {
    if (suggested.length > 0) return
    setSuggestLoading(true)
    try {
      const res = await api.get('/users/suggested')
      setSuggested(res.data.data ?? res.data)
    } catch {}
    setSuggestLoading(false)
  }

  // ── Search with debounce ──────────────────────────────────────────────────
  useEffect(() => {
    const requestId = ++searchRequestRef.current
    if (!isSearchMode) {
      setSearchLoading(false)
      return
    }
    if (debounceRef.current) clearTimeout(debounceRef.current)
    const requestQuery = query.trim()
    if (!requestQuery) {
      setSearchResults([])
      setPostResults([])
      setSearchLoading(false)
      return
    }
    debounceRef.current = setTimeout(async () => {
      if (requestId !== searchRequestRef.current) return
      setSearchLoading(true)
      const [users, posts] = await Promise.allSettled([
        api.get(`/users/search?q=${encodeURIComponent(requestQuery)}`),
        searchPostsApi(requestQuery),
      ])
      if (requestId !== searchRequestRef.current) return
      setSearchResults(users.status === 'fulfilled' ? (users.value.data.data ?? []) : [])
      setPostResults(posts.status === 'fulfilled' ? posts.value : [])
      setSearchLoading(false)
    }, 300)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [query, isSearchMode])

  // ── Followers state (who follows ME — for "followBack" indicator) ─────────
  // "who I follow" is handled by useFollowStore globally.
  const followersLoadedRef = useRef(false)

  async function loadFollowersState() {
    if (followersLoadedRef.current) return
    followersLoadedRef.current = true
    const cached = await getCache<FollowUser[]>('my_followers').catch(() => null)
    if (cached?.length) setFollowers(new Set(cached.map((u) => u.id)))
    if (!isConnected()) return
    try {
      const res = await api.get('/users/followers')
      const myFollowers: FollowUser[] = res.data.data ?? res.data ?? []
      setFollowers(new Set(myFollowers.map((u) => u.id)))
      setCache('my_followers', myFollowers).catch(() => {})
    } catch {
      followersLoadedRef.current = false
    }
  }

  // ── Search mode ───────────────────────────────────────────────────────────
  function enterSearch() {
    LayoutAnimation.configureNext(LayoutAnimation.create(260, LayoutAnimation.Types.easeInEaseOut, LayoutAnimation.Properties.opacity))
    setIsSearchMode(true)
    loadSuggested()
    loadFollowersState()
  }

  function exitSearch() {
    searchRequestRef.current += 1
    Keyboard.dismiss()
    LayoutAnimation.configureNext(LayoutAnimation.create(260, LayoutAnimation.Types.easeInEaseOut, LayoutAnimation.Properties.opacity))
    setIsSearchMode(false)
    setQuery('')
    setSearchResults([])
    setPostResults([])
    setSearchLoading(false)
  }

  // ── Follow / unfollow ─────────────────────────────────────────────────────
  const handleFollow = useCallback(async (userId: string, duration: FollowDuration = 'forever') => {
    if (followPending.has(userId)) return
    setFollowPending((prev) => new Set([...prev, userId]))
    try {
      const followedUser = (query.trim() ? searchResults : suggested).find((u) => u.id === userId)
      const profile = followedUser
        ? { name: followedUser.name, avatar: followedUser.avatar ?? null }
        : undefined

      // Pass profile so the follow store can write it to connections_cache
      // atomically as part of the toggle — before we trigger any load().
      const nowFollowing = await useFollowStore.getState().toggle(userId, duration, profile)

      if (nowFollowing) {
        if (followedUser) {
          setJustFollowed((prev) => ({ ...prev, [userId]: Date.now() }))
          const newConn: Connection = {
            user:        { id: followedUser.id, name: followedUser.name, avatar: followedUser.avatar ?? null },
            lastMessage: null,
            unreadCount: 0,
            postIds:     [],
          }
          // Update state immediately (no SQLite call inside setState)
          setConnections((prev) => {
            if (prev.some((c) => c.user.id === userId)) return prev
            const updated = [...prev, newConn].sort((a, b) => {
              if (a.lastMessage && b.lastMessage)
                return new Date(b.lastMessage.createdAt).getTime() - new Date(a.lastMessage.createdAt).getTime()
              if (a.lastMessage) return -1
              if (b.lastMessage) return 1
              return a.user.name.localeCompare(b.user.name)
            })
            return updated
          })
          // The follow store already wrote this to connections_cache inside toggle().
          // Trigger a background refresh to enrich with messages / unread counts.
          syncConnectionsRef.current?.().catch(() => {})
        }
      } else {
        // Unfollow → remove from chat list
        setConnections((prev) => prev.filter((c) => c.user.id !== userId))
      }
    } catch {
      Toast.show({ type: 'error', text1: t.error, text2: t.msg_follow_err, visibilityTime: 2500 })
    } finally {
      setFollowPending((prev) => {
        const next = new Set(prev)
        next.delete(userId)
        return next
      })
    }
  }, [followPending, query, searchResults, suggested])

  // ── Quick reply ───────────────────────────────────────────────────────────
  function toggleQuickReply(userId: string) {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut)
    setQuickReplyId((prev) => (prev === userId ? null : userId))
    Keyboard.dismiss()
  }

  function handleQuickSend(userId: string, userName: string, text: string) {
    const tempId  = `pending-${Date.now()}`
    const now     = new Date().toISOString()
    const msgPatch = {
      lastMessage: { id: tempId, content: text, senderId: user!.id, readAt: null, createdAt: now },
      unreadCount: 0,
    }
    setConnections((prev) => {
      const updated = prev.map((c) => c.user.id === userId ? { ...c, ...msgPatch } : c)
      const idx = updated.findIndex((c) => c.user.id === userId)
      if (idx > 0) {
        const [item] = updated.splice(idx, 1)
        return [item, ...updated]
      }
      return updated
    })
    updateCachedConnection(userId, msgPatch, {
      user: { id: userId, name: userName, avatar: null }, postIds: [],
    }).catch(() => {})

    msgService.sendMessage(userId, text).then((sent) => {
      setConnections((prev) => {
        const idx = prev.findIndex((c) => c.user.id === userId)
        if (idx < 0) return prev
        const updated = [...prev]
        if (updated[idx].lastMessage?.id === tempId) {
          updated[idx] = {
            ...updated[idx],
            lastMessage: { id: sent.id, content: sent.content, senderId: user!.id, readAt: null, createdAt: sent.createdAt },
          }
        }
        return updated
      })
    }).catch(() => {
      Toast.show({ type: 'error', text1: t.chat_send_error, text2: t.chat_retry, visibilityTime: 2500 })
    })
  }

  // ── Derived ───────────────────────────────────────────────────────────────
  const displayCards  = query.trim() ? searchResults : suggested
  const isCardLoading = query.trim() ? searchLoading : suggestLoading

  // ── Unified feed — personal + uniões merged by recency ──────────────────
  type FeedItem =
    | { kind: 'personal';   c: Connection; idx: number }
    | { kind: 'union';      m: UnionMessage }

  const allMsgItems: { item: FeedItem; ts: number }[] = [
    ...connections.map((c, i) => ({
      item: { kind: 'personal' as const, c, idx: i },
      // Sem mensagens: se acabei de seguir, sobe ao topo; senão fica em baixo
      ts:   c.lastMessage ? new Date(c.lastMessage.createdAt).getTime() : (justFollowed[c.user.id] ?? 0),
    })),
    ...(!unionConvoLoad ? unionConvos : []).map((m) => ({
      item: { kind: 'union' as const, m },
      ts:   new Date(m.createdAt).getTime(),
    })),
  ]
  allMsgItems.sort((a, b) => b.ts - a.ts)

  const liveTogetherList = myPairing?.status === 'ACTIVE' ? [myPairing] : []
  const feedItems = allMsgItems.map(({ item }) => item)

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <View style={s.screen}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={0}
      >

        {/* ── Header ─────────────────────────────────────────────── */}
        <View style={[s.navbar, { paddingTop: top + 14 }]}>
          {/* Large title + compose — hidden in search mode for focus */}
          {!isSearchMode && (
            <View style={s.titleRow}>
              <Text style={s.bigTitle}>{t.msg_title}</Text>
              <TouchableOpacity
                onPress={() => inputRef.current?.focus()}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                activeOpacity={0.6}
              >
                <Ionicons name="create-outline" size={25} color="#0A0A0C" />
              </TouchableOpacity>
            </View>
          )}

          {/* Search field */}
          <View style={s.searchRow}>
            <View style={[s.searchBar, isSearchMode && s.searchBarActive]}>
              <Ionicons
                name="search"
                size={17}
                color={isSearchMode ? '#6E6E73' : '#9A9AA0'}
              />
              <TextInput
                ref={inputRef}
                style={s.searchInput}
                placeholder={t.msg_search_ph}
                placeholderTextColor="#A0A0A5"
                value={query}
                onChangeText={setQuery}
                onFocus={enterSearch}
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="search"
              />
              {query.length > 0 && (
                <TouchableOpacity
                  onPress={() => { setQuery(''); inputRef.current?.focus() }}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Ionicons name="close-circle" size={17} color="#C0C0C5" />
                </TouchableOpacity>
              )}
            </View>

            {isSearchMode && (
              <TouchableOpacity onPress={exitSearch} hitSlop={{ top: 10, bottom: 10, left: 6, right: 6 }} activeOpacity={0.6}>
                <Text style={s.searchCancel}>{t.cancel}</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>


        {/* ── Content ─────────────────────────────────────────────── */}
        {isSearchMode ? (

          /* ── Search / discovery ─────────────────────────────────── */
          <>
            <View style={s.sectionRow}>
              <Text style={s.sectionLabel}>
                {query.trim() ? t.msg_people_section : t.msg_suggested}
              </Text>
              {query.trim() && !searchLoading && (
                <View style={s.countPill}>
                  <Text style={s.countPillTxt}>{searchResults.length}</Text>
                </View>
              )}
            </View>

            {isCardLoading && (
              <View style={s.spinnerWrap}>
                <ActivityIndicator color={colors.primary} />
              </View>
            )}

            {!isCardLoading && displayCards.length === 0 && postResults.length === 0 && query.trim().length > 0 && (
              <View style={s.emptySearch}>
                <View style={s.emptyIcon}>
                  <Ionicons name="search-outline" size={28} color={colors.gray400} />
                </View>
                <Text style={s.emptyTitle}>{t.msg_no_results}</Text>
                <Text style={s.emptySub}>{t.msg_no_results_sub}</Text>
              </View>
            )}

            {!isCardLoading && (displayCards.length > 0 || postResults.length > 0) && (
              <FlatList
                key="search-results"
                data={displayCards}
                keyExtractor={(u) => u.id}
                contentContainerStyle={s.searchResults}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
                ItemSeparatorComponent={() => <View style={s.peopleSeparator} />}
                renderItem={({ item }) => (
                  <UserRow
                    user={item}
                    followed={followingIds.has(item.id)}
                    followBack={followers.has(item.id) && !followingIds.has(item.id)}
                    loadingFollow={followPending.has(item.id)}
                    onFollow={(duration) => handleFollow(item.id, duration)}
                    onPress={() => { exitSearch(); openProfileOnStack(nav, item.id) }}
                  />
                )}
                ListFooterComponent={
                  query.trim().length > 0 && postResults.length > 0 ? (
                    <View style={s.postsSection}>
                      <View style={s.sectionRow}>
                        <Text style={s.sectionLabel}>{t.msg_posts_section}</Text>
                        <View style={s.countPill}>
                          <Text style={s.countPillTxt}>{postResults.length}</Text>
                        </View>
                      </View>
                      {postResults.map((p) => {
                        const previewUri = resolveMediaUri(p.thumbnailUrl ?? p.mediaUrl)
                        const textBackground = p.bgColor?.split('|')[0] ?? '#111114'
                        const postSummary = p.caption?.trim() || t.msg_post_no_caption
                        return (
                          <TouchableOpacity
                            key={p.id}
                            style={s.postRow}
                            activeOpacity={0.7}
                            accessibilityRole="button"
                            accessibilityLabel={`${p.user.name}. ${postSummary}`}
                            onPress={() => {
                              useFeedStore.getState().showPostInFeed(p)
                              exitSearch()
                              nav.navigate('Tabs', { screen: 'Feed' })
                            }}
                          >
                            {previewUri ? (
                              <Image source={{ uri: previewUri }} style={s.postThumb} contentFit="cover" />
                            ) : (
                              <View style={[s.postThumb, { backgroundColor: textBackground, alignItems: 'center', justifyContent: 'center' }]}>
                                <Ionicons name="text" size={18} color="#fff" />
                              </View>
                            )}
                            <View style={s.postRowBody}>
                              <Text style={s.postCaption} numberOfLines={2}>
                                {postSummary}
                              </Text>
                              <Text style={s.postAuthor} numberOfLines={1}>{p.user.name}</Text>
                            </View>
                            {p.mediaType === 'VIDEO' && (
                              <Ionicons name="play-circle" size={18} color={colors.gray400} />
                            )}
                          </TouchableOpacity>
                        )
                      })}
                    </View>
                  ) : null
                }
              />
            )}
          </>

        ) : (

          /* ── Unified feed (personal + uniões) ───────────────────── */
          <>
            {connsLoading && connections.length === 0 && unionConvos.length === 0 && (
              <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10 }}>
                <ActivityIndicator color={colors.primary} size="large" />
                <Text style={{ fontFamily: fonts.regular, fontSize: 14, color: colors.gray500 }}>{t.msg_loading}</Text>
              </View>
            )}
            {connsError && connections.length === 0 && unionConvos.length === 0 && (
              <View style={s.empty}>
                <View style={s.emptyCircle}>
                  <Ionicons name="wifi-outline" size={36} color="#C0C0C8" />
                </View>
                <Text style={s.emptyTitle}>{t.msg_slow_conn}</Text>
                <Text style={s.emptySub}>{t.msg_slow_conn_sub}</Text>
                <TouchableOpacity
                  style={{ marginTop: 16, backgroundColor: colors.primary, paddingHorizontal: 24, paddingVertical: 10, borderRadius: 20 }}
                  onPress={() => syncConnectionsRef.current?.().catch(() => {})}
                  activeOpacity={0.8}
                >
                  <Text style={{ fontFamily: fonts.semiBold, fontSize: 14, color: colors.white }}>{t.msg_try_again}</Text>
                </TouchableOpacity>
              </View>
            )}
            {!connsLoading && !connsError && feedItems.length === 0 && (
              <View style={s.chatEmptyWrap}>
                <View style={s.chatEmptyIcon}>
                  <Ionicons name="chatbubble-ellipses-outline" size={30} color={colors.gray500} />
                </View>
                <Text style={s.emptyTitle}>{t.msg_start_convo}</Text>
                <Text style={s.emptySub}>{t.msg_empty_follow}</Text>
                <TouchableOpacity
                  style={s.chatEmptyCta}
                  onPress={() => setShowSuggestions(true)}
                  activeOpacity={0.78}
                  accessibilityRole="button"
                  accessibilityLabel={t.follow}
                >
                  <Ionicons name="person-add-outline" size={18} color={colors.white} />
                  <Text style={s.chatEmptyCtaText}>{t.follow}</Text>
                </TouchableOpacity>
              </View>
            )}
            {(!connsLoading || connections.length > 0 || unionConvos.length > 0) && !connsError && feedItems.length > 0 && (
              <FlatList
                key="feed-list"
                data={feedItems}
                keyExtractor={(item) => item.kind === 'union' ? `union_${item.m.id}` : item.c.user.id}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={[s.list, { paddingBottom: Math.max(bottom, 8) + 66 }]}
                ItemSeparatorComponent={() => <View style={s.sep} />}
                ListHeaderComponent={
                  <>
                    <StoriesRow
                      connections={connections}
                      onOpen={(c) => {
                        setQuickReplyId(null)
                        nav.navigate('Chat', {
                          userId:          c.user.id,
                          userName:        c.user.name,
                          userAvatar:      c.user.avatar,
                          partnerHasPosts: c.postIds.length > 0,
                        })
                      }}
                    />
                    {liveTogetherList.length > 0 && (
                      <View style={g.section}>
                        <Text style={g.sectionLabel}>{t.msg_paired}</Text>
                        <FlatList
                          data={liveTogetherList}
                          keyExtractor={(d) => d.id}
                          horizontal
                          showsHorizontalScrollIndicator={false}
                          contentContainerStyle={g.sectionContent}
                          ItemSeparatorComponent={() => <View style={{ width: 10 }} />}
                          renderItem={({ item }) => {
                            const partner = pairingService.pairingPartner(item, user?.id ?? '')
                            return (
                              <PairingCard
                                data={item}
                                onPress={() => nav.navigate('Chat', {
                                  userId:     partner.id,
                                  userName:   partner.name,
                                  userAvatar: partner.avatar,
                                })}
                              />
                            )
                          }}
                        />
                      </View>
                    )}
                    {pendingInvites.length > 0 && (
                      <View style={s.invitesSection}>
                        <View style={s.invitesSectionHeader}>
                          <View style={s.invitesBadge}>
                            <Text style={s.invitesBadgeTxt}>{pendingInvites.length}</Text>
                          </View>
                          <Text style={s.invitesSectionTitle}>{t.msg_pending_invites}</Text>
                        </View>
                        {pendingInvites.map((invite) => {
                          const isResponding = respondingId === invite.id
                          const union = invite.fromUnion
                          return (
                            <View key={invite.id} style={s.inviteCard}>
                              <View style={s.inviteCardTop}>
                                <View style={s.inviteDualAvatar}>
                                  {union.memberA.avatar
                                    ? <Image source={{ uri: union.memberA.avatar }} style={s.inviteAvatarA} contentFit="cover" cachePolicy="memory-disk" />
                                    : <View style={[s.inviteAvatarA, s.inviteAvatarFallback]}><Ionicons name="person" size={13} color={colors.gray400} /></View>
                                  }
                                  {union.memberB.avatar
                                    ? <Image source={{ uri: union.memberB.avatar }} style={s.inviteAvatarB} contentFit="cover" cachePolicy="memory-disk" />
                                    : <View style={[s.inviteAvatarB, s.inviteAvatarFallback]}><Ionicons name="person" size={11} color={colors.gray400} /></View>
                                  }
                                </View>
                                <View style={{ flex: 1 }}>
                                  <View style={s.inviteNameRow}>
                                    <Text style={s.inviteTypEmoji}>💑</Text>
                                    <Text style={s.inviteName} numberOfLines={1}>{union.name}</Text>
                                  </View>
                                  {union.label ? <Text style={s.inviteType}>{union.label}</Text> : null}
                                  <Text style={s.inviteMembers} numberOfLines={1}>{union.memberA.name} & {union.memberB.name}</Text>
                                </View>
                              </View>
                              <View style={s.inviteActions}>
                                <TouchableOpacity
                                  style={[s.inviteBtnReject, isResponding && s.inviteBtnLoading]}
                                  onPress={() => handleRespondInvite(invite.id, false)}
                                  disabled={!!respondingId}
                                  activeOpacity={0.82}
                                >
                                  {isResponding
                                    ? <ActivityIndicator size="small" color={colors.gray500} />
                                    : <Text style={s.inviteBtnRejectTxt}>{t.decline}</Text>
                                  }
                                </TouchableOpacity>
                                <TouchableOpacity
                                  style={[s.inviteBtnAccept, isResponding && s.inviteBtnLoading]}
                                  onPress={() => handleRespondInvite(invite.id, true)}
                                  disabled={!!respondingId}
                                  activeOpacity={0.82}
                                >
                                  {isResponding
                                    ? <ActivityIndicator size="small" color="#fff" />
                                    : <Text style={s.inviteBtnAcceptTxt}>{t.pair_accept}</Text>
                                  }
                                </TouchableOpacity>
                              </View>
                            </View>
                          )
                        })}
                      </View>
                    )}
                  </>
                }
                renderItem={({ item }) => {
                  if (item.kind === 'union') {
                    const myUnion = myUnions.find((u) => u.id === item.m.toUnionId || u.id === item.m.fromUnionId)
                    return (
                      <UnionConvoRow
                        item={item.m}
                        myUnion={myUnion}
                        liveUnions={liveUnions}
                        onPress={() => nav.navigate('UnionChat', {
                          unionId:      myUnion?.id ?? item.m.toUnionId,
                          otherUnionId: item.m.fromUnionId === myUnion?.id ? item.m.toUnionId : item.m.fromUnionId,
                          unionName:    item.m.fromUnion?.name ?? t.un_union,
                        })}
                      />
                    )
                  }
                  return (
                    <ConvoRow
                      item={item.c}
                      viewedIds={viewedIds}
                      index={item.idx}
                      myUserId={user?.id ?? ''}
                      isQuickOpen={quickReplyId === item.c.user.id}
                      onToggleQuick={() => toggleQuickReply(item.c.user.id)}
                      onQuickSend={(text) => handleQuickSend(item.c.user.id, item.c.user.name, text)}
                      onPress={() => {
                        setQuickReplyId(null)
                        nav.navigate('Chat', {
                          userId:          item.c.user.id,
                          userName:        item.c.user.name,
                          userAvatar:      item.c.user.avatar,
                          partnerHasPosts: item.c.postIds.length > 0,
                        })
                      }}
                    />
                  )
                }}
                ListEmptyComponent={
                  <View style={s.empty}>
                    <View style={s.emptyCircle}>
                      <Ionicons name="chatbubble-ellipses-outline" size={36} color="#C0C0C8" />
                    </View>
                    <Text style={s.emptyTitle}>{t.msg_empty}</Text>
                    <Text style={s.emptySub}>{t.msg_empty_sub}</Text>
                  </View>
                }
              />
            )}
          </>
        )}

      </KeyboardAvoidingView>

      {showSuggestions && <SuggestionsSheet onClose={() => setShowSuggestions(false)} />}
    </View>
  )
}

// ── Styles ─────────────────────────────────────────────────────────────────────

const RING_OFFSET = 16 + RING + 14

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.white },

  /* ── Header ── */
  navbar: {
    paddingHorizontal: 20,
    paddingBottom: 12,
    backgroundColor: colors.white,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  bigTitle: {
    fontFamily: fonts.extraBold,
    fontSize: 32,
    lineHeight: 37,
    letterSpacing: -0.9,
    color: '#0A0A0C',
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  // Campo de pesquisa limpo — foco discreto (branco + anel carmim + sombra suave)
  searchBar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F1F4',
    borderRadius: 13,
    paddingHorizontal: 13,
    paddingVertical: 11,
    gap: 9,
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  searchBarActive: {
    backgroundColor: '#FFFFFF',
    borderColor: '#E2E2E6',
  },
  searchInput: {
    flex: 1,
    fontSize: 15.5,
    fontFamily: fonts.medium,
    color: colors.black,
    padding: 0,
  },
  searchCancel: {
    fontFamily: fonts.semiBold,
    fontSize: 15,
    color: '#6E6E73',
  },
  /* ── Nav avatar + ring ── */
  navAvatarOuter: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navAvatarInner: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  navAvatarCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    overflow: 'hidden',
  },
  /* ── Section label ── */
  sectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 12,
    gap: 8,
  },
  sectionLabel: {
    fontSize: 12,
    fontFamily: fonts.bold,
    color: '#8E8E93',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  countPill: {
    backgroundColor: '#F5F5F7',
    borderRadius: 10,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  countPillTxt: { fontSize: 11, fontFamily: fonts.semiBold, color: '#6E6E73' },

  spinnerWrap: { flex: 1, alignItems: 'center', paddingTop: 60 },

  /* ── Empty chat list ── */
  chatEmptyWrap: { flex: 1, alignItems: 'center', paddingTop: 84, paddingHorizontal: 42, gap: 10 },
  chatEmptyIcon: {
    width: 64, height: 64, borderRadius: 32, backgroundColor: colors.gray100,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 4,
  },
  chatEmptyCta: {
    minHeight: 48,
    marginTop: 12,
    paddingHorizontal: 20,
    borderRadius: 24,
    backgroundColor: colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  chatEmptyCtaText: { fontSize: 14, fontFamily: fonts.semiBold, color: colors.white },

  /* ── Conversations list ── */
  list: { paddingTop: 4 },
  sep:  { height: StyleSheet.hairlineWidth, backgroundColor: '#F0F0F5', marginLeft: RING_OFFSET },

  /* ── Conversation row ── */
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingVertical: 12,
    gap: 14,
    backgroundColor: colors.white,
  },
  avatarWrap:  { width: RING, height: RING, alignItems: 'center', justifyContent: 'center' },
  info:        { flex: 1, gap: 3 },
  topRow:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  name:        { fontSize: 15, fontFamily: fonts.semiBold, color: '#1A1A1A', flex: 1, letterSpacing: -0.2 },
  nameBold:    { fontFamily: fonts.extraBold },
  time:        { fontSize: 12, fontFamily: fonts.medium, color: '#ABABAB' },
  timeActive:  { color: '#1A1A1A', fontFamily: fonts.semiBold },
  preview:     { fontSize: 13, fontFamily: fonts.regular, color: '#ABABAB' },
  previewFlex: { flex: 1 },
  previewBold: { fontFamily: fonts.medium, color: '#3A3A3C' },
  previewMuted:{ fontStyle: 'italic', color: '#C0C0C8' },
  bottomRow:   { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dot:         { minWidth: 20, height: 20, borderRadius: 10, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 5 },
  dotTxt:      { fontSize: 11, fontFamily: fonts.extraBold, color: colors.white },
  trailing:    { flexDirection: 'row', alignItems: 'center', gap: 6 },
  // Estado online/offline (chats lidos) — ponto + texto, como no design
  status:      { flexDirection: 'row', alignItems: 'center', gap: 4 },
  statusDot:   { width: 7, height: 7, borderRadius: 3.5 },
  statusDotOn: { backgroundColor: '#22C55E' },
  statusDotOff:{ backgroundColor: '#C9C9CF' },
  statusTxt:   { fontSize: 11, fontFamily: fonts.medium, color: '#ABABAB' },
  rowRight:      { flexDirection: 'row', alignItems: 'center', gap: 6 },
  replyArrow:    { width: 28, height: 28, borderRadius: 14, backgroundColor: '#F5F5F7', alignItems: 'center', justifyContent: 'center' },
  replyArrowActive: { backgroundColor: '#1A1A1A' },

  /* ── Empty states ── */
  empty:       { alignItems: 'center', paddingTop: 100, paddingHorizontal: 48, gap: 10 },
  emptyCircle: { width: 72, height: 72, borderRadius: 36, backgroundColor: colors.gray100, alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
  emptySearch: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, paddingBottom: 100 },
  emptyIcon:   { width: 56, height: 56, borderRadius: 28, backgroundColor: colors.gray100, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  emptyTitle:  { fontSize: 17, fontFamily: fonts.bold, color: '#1A1A1A' },
  emptySub:    { fontSize: 14, fontFamily: fonts.regular, color: '#8E8E93', textAlign: 'center', lineHeight: 21 },

  /* ── People results ── */
  searchResults: { paddingBottom: 40, paddingTop: 2 },
  peopleSeparator: { height: StyleSheet.hairlineWidth, backgroundColor: '#EEEEF2', marginLeft: 82 },

  /* ── Post results ── */
  postsSection: { paddingBottom: 40 },
  postRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 20,
    paddingVertical: 9,
  },
  postThumb: {
    width: 46,
    height: 46,
    borderRadius: 10,
    backgroundColor: colors.gray100,
  },
  postRowBody: { flex: 1, gap: 2 },
  postCaption: { fontSize: 14, fontFamily: fonts.medium, color: colors.gray800, lineHeight: 18 },
  postAuthor:  { fontSize: 12.5, fontFamily: fonts.regular, color: colors.gray400 },

  /* ── Tab selector ── */
  tabRow: {
    flexDirection: 'row', gap: 8,
    paddingHorizontal: 16, paddingBottom: 10,
  },
  tabBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 16, paddingVertical: 7,
    borderRadius: 20, borderWidth: 1.5, borderColor: colors.gray200,
  },
  tabBtnActive: { backgroundColor: colors.black, borderColor: colors.black },
  tabBtnTxt:    { fontFamily: fonts.semiBold, fontSize: 14, color: colors.gray500 },
  tabBtnTxtActive: { color: colors.white },
  tabBadge:     { backgroundColor: '#1A1A1A', borderRadius: 10, minWidth: 18, height: 18, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  tabBadgeTxt:  { fontFamily: fonts.bold, fontSize: 11, color: colors.white },

  livePill:    { backgroundColor: '#FF6766', borderRadius: 10, paddingHorizontal: 7, paddingVertical: 2 },
  livePillTxt: { fontFamily: fonts.bold, fontSize: 10, color: '#fff', letterSpacing: 0.2 },

  /* ── Pending invites section ── */
  invitesSection: { marginHorizontal: 16, marginBottom: 8 },
  invitesSectionHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginBottom: 10, marginTop: 14,
  },
  invitesBadge: {
    backgroundColor: '#1A1A1A', borderRadius: 10,
    minWidth: 20, height: 20, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 5,
  },
  invitesBadgeTxt:    { fontFamily: fonts.bold, fontSize: 11, color: colors.white },
  invitesSectionTitle:{ fontFamily: fonts.semiBold, fontSize: 14, color: colors.black },

  inviteCard: {
    backgroundColor: colors.white,
    borderRadius: 16,
    borderWidth: 1, borderColor: colors.gray200,
    padding: 14, marginBottom: 10,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05, shadowRadius: 4, elevation: 2,
  },
  inviteCardTop: { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 14 },

  inviteDualAvatar: { width: 52, height: 52, position: 'relative', flexShrink: 0 },
  inviteAvatarA: { width: 36, height: 36, borderRadius: 18, position: 'absolute', top: 0, left: 0, borderWidth: 2, borderColor: colors.white },
  inviteAvatarB: { width: 30, height: 30, borderRadius: 15, position: 'absolute', bottom: 0, right: 0, borderWidth: 2, borderColor: colors.white },
  inviteAvatarFallback: { backgroundColor: colors.gray100, alignItems: 'center', justifyContent: 'center' },

  inviteNameRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 2 },
  inviteTypEmoji: { fontSize: 15 },
  inviteName:  { fontFamily: fonts.bold, fontSize: 15, color: colors.black, flex: 1, letterSpacing: -0.2 },
  inviteType:  { fontFamily: fonts.medium, fontSize: 12, color: colors.gray500 },
  inviteMembers: { fontFamily: fonts.regular, fontSize: 12, color: colors.gray400, marginTop: 2 },

  inviteActions: { flexDirection: 'row', gap: 10 },
  inviteBtnReject: {
    flex: 1, height: 40, borderRadius: 20,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.5, borderColor: colors.gray200,
    backgroundColor: colors.white,
  },
  inviteBtnAccept: {
    flex: 1, height: 40, borderRadius: 20,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.primary,
  },
  inviteBtnLoading:    { opacity: 0.6 },
  inviteBtnRejectTxt:  { fontFamily: fonts.semiBold, fontSize: 14, color: colors.gray600 },
  inviteBtnAcceptTxt:  { fontFamily: fonts.semiBold, fontSize: 14, color: colors.white },
})

// ── Quick reply box styles ─────────────────────────────────────────────────────

const q = StyleSheet.create({
  container: {
    backgroundColor: '#FAFAFB',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: '#EDEDF1',
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 12,
    gap: 8,
  },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  replyLabel: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  replyTxt:   { fontSize: 13, fontFamily: fonts.medium, color: colors.gray600 },
  replyName:  { fontFamily: fonts.bold, color: '#1A1A1A' },
  row:        { flexDirection: 'row', alignItems: 'center', gap: 10 },
  input: {
    flex: 1,
    backgroundColor: colors.white,
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingVertical: 11,
    fontSize: 15,
    fontFamily: fonts.medium,
    color: '#1A1A1A',
    borderWidth: 1,
    borderColor: colors.gray200,
    maxHeight: 80,
  },
  sendBtn:    { width: 42, height: 42, borderRadius: 21, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  sendBtnOff: { opacity: 0.35 },
})

// ── People result styles ──────────────────────────────────────────────────────

/* ── União tab styles injected into s ── */
// (appended below the main StyleSheet)

const c = StyleSheet.create({
  row: {
    minHeight: 70,
    paddingHorizontal: 20,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.white,
  },
  person: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 12 },
  textWrap: {
    flex: 1,
    minWidth: 0,
    gap: 3,
  },
  name: {
    fontSize: 15,
    fontFamily: fonts.semiBold,
    color: colors.gray800,
    letterSpacing: -0.2,
  },
  meta: {
    fontSize: 12.5,
    fontFamily: fonts.regular,
    color: colors.gray400,
  },
})

// ── "Juntos agora" horizontal carousel ────────────────────────────────────────
const g = StyleSheet.create({
  section: { marginTop: 18, marginBottom: 8 },
  sectionLabel: {
    fontSize: 12, fontFamily: fonts.bold, color: '#8E8E93',
    letterSpacing: 0.6, textTransform: 'uppercase',
    marginBottom: 12, paddingHorizontal: 16,
  },
  sectionContent: { paddingHorizontal: 16 },

  // Horizontal rectangle — black/white/transparent, colour only as a small accent
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: '#EEEEF0',
    borderRadius: 16,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  textCol: { gap: 2 },
  liveRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.primary },
  names: { fontSize: 13, fontFamily: fonts.bold, color: '#0A0A0A', letterSpacing: -0.1 },
  title: { fontSize: 11.5, fontFamily: fonts.regular, color: '#8E8E93' },
})
