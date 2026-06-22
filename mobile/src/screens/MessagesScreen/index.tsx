import React, { useState, useCallback, useEffect, useRef } from 'react'
import {
  View, Text, FlatList, StyleSheet, TextInput,
  TouchableOpacity, Animated, ActivityIndicator, KeyboardAvoidingView,
  Dimensions, Keyboard, LayoutAnimation, Platform, UIManager,
} from 'react-native'
import { Image } from 'expo-image'
import { LinearGradient } from 'expo-linear-gradient'

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true)
}
import { useNavigation } from '@react-navigation/native'
import { StackNavigationProp } from '@react-navigation/stack'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useFocusEffect } from '@react-navigation/native'
import { Ionicons } from '@expo/vector-icons'
import Toast from 'react-native-toast-message'
import * as msgService from '../../services/message.service'
import { getConnections, FollowDuration } from '../../services/follow.service'
import { Connection } from '../../types'
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
import { FollowUser } from '../../services/follow.service'
import { API_BASE } from '../../config'
import FollowSplitButton from '../../components/FollowSplitButton'
import { api } from '../../services/api'
import { getSocket } from '../../socket'
import { useAuthStore } from '../../store/auth.store'
import { useFollowStore } from '../../store/follow.store'
import { isConnected } from '../../services/netinfo.service'
import { useMessageBadgeStore } from '../../store/messageBadge.store'
import { useFeedStore } from '../../store/feed.store'
import { AppStackParams } from '../../navigation/AppNavigator'
import { colors, fonts } from '../../theme'
import { useT } from '../../i18n'
import AvatarImage from '../../components/AvatarImage'
import SegmentedRing from '../../components/SegmentedRing'
import DiscoveryRow from '../../components/DiscoveryRow'

type Nav = StackNavigationProp<AppStackParams>

const { width: W } = Dimensions.get('window')
const CARD_GAP   = 12
const CARD_H_PAD = 16
const CARD_W     = (W - CARD_H_PAD * 2 - CARD_GAP) / 2

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

interface UserResult {
  id: string
  name: string
  avatar: string | null
  bio: string | null
  _count?: { followers: number; posts: number }
}

// ── User card (search results) ────────────────────────────────────────────────

function resolveUri(uri: string | null | undefined): string | null {
  if (!uri) return null
  return uri.startsWith('http') || uri.startsWith('file://') ? uri : `${API_BASE}${uri}`
}

function UserCard({
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
  const posts     = user._count?.posts     ?? 0
  const photoUri  = resolveUri(user.avatar)

  return (
    <TouchableOpacity style={c.card} onPress={onPress} activeOpacity={0.88}>
      {/* Full-bleed photo */}
      {photoUri
        ? <Image source={{ uri: photoUri }} style={StyleSheet.absoluteFill} contentFit="cover" cachePolicy="memory-disk" />
        : <View style={[StyleSheet.absoluteFill, c.photoFallback]}>
            <Ionicons name="person" size={44} color="rgba(255,255,255,0.25)" />
          </View>
      }

      {/* Dark gradient — fades in from mid-card downward */}
      <LinearGradient
        colors={['transparent', 'rgba(0,0,0,0.55)', 'rgba(0,0,0,0.92)']}
        locations={[0.3, 0.6, 1]}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />

      {/* Info + button pinned to bottom */}
      <View style={c.info}>
        <Text style={c.cardName} numberOfLines={1}>{user.name}</Text>
        <View style={c.statsRow}>
          <Text style={c.statTxt}>{fmtCount(posts)} posts</Text>
          <View style={c.statDot} />
          <Text style={c.statTxt}>{fmtCount(followers)} {followers === 1 ? t.follower : t.followers}</Text>
        </View>
        <View style={c.followWrap}>
          <FollowSplitButton
            following={followed}
            followBack={followBack}
            loading={loadingFollow}
            onFollow={onFollow}
            theme="light"
          />
        </View>
      </View>
    </TouchableOpacity>
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
          <Ionicons name="return-down-forward" size={13} color={colors.primary} />
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
  const hasMsg      = !!item.lastMessage
  const unread      = item.unreadCount > 0
  const hasPosts    = item.postIds.length > 0
  const viewedCount = item.postIds.filter((id) => viewedIds.has(id)).length
  const iMine       = hasMsg && item.lastMessage!.senderId === myUserId
  const isRead      = hasMsg && !!item.lastMessage!.readAt
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
        {/* Avatar with optional story ring */}
        <View style={s.avatarWrap}>
          {hasPosts ? (
            <>
              <SegmentedRing count={item.postIds.length} size={RING} strokeWidth={2} />
              <View style={s.avatarInner}>
                <AvatarImage uri={item.user.avatar} name={item.user.name} size={AVA} />
              </View>
            </>
          ) : (
            <AvatarImage uri={item.user.avatar} name={item.user.name} size={AVA} />
          )}
        </View>

        {/* Text info */}
        <View style={s.info}>
          <View style={s.topRow}>
            <Text style={[s.name, unread && s.nameBold]} numberOfLines={1}>{item.user.name}</Text>
            {hasMsg && (
              <Text style={[s.time, unread && s.timeActive]}>
                {timeAgo(item.lastMessage!.createdAt, t.time_now)}
              </Text>
            )}
          </View>
          <Text style={[s.preview, unread && s.previewBold, !hasMsg && s.previewMuted]} numberOfLines={1}>
            {iMine ? `Você: ${preview}` : preview}
          </Text>
        </View>

        {/* Right indicators */}
        <View style={s.rowRight}>
          {showReply ? (
            <>
              <View style={s.dot}>
                <Text style={s.dotTxt}>{item.unreadCount > 9 ? '9+' : item.unreadCount}</Text>
              </View>
              <TouchableOpacity
                style={[s.replyArrow, isQuickOpen && s.replyArrowActive]}
                onPress={(e) => { (e as any).stopPropagation?.(); onToggleQuick() }}
                hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}
              >
                <Ionicons
                  name={isQuickOpen ? 'chevron-up' : 'chevron-down'}
                  size={16}
                  color={isQuickOpen ? colors.white : colors.primary}
                />
              </TouchableOpacity>
            </>
          ) : iMine ? (
            <Ionicons name="checkmark-done" size={16} color={isRead ? '#4FC3F7' : '#C8C8C8'} />
          ) : null}
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

// ── Screen ────────────────────────────────────────────────────────────────────

export default function MessagesScreen() {
  const t               = useT()
  const nav             = useNavigation<Nav>()
  const { top, bottom } = useSafeAreaInsets()
  const { user }        = useAuthStore()
  const inputRef        = useRef<TextInput>(null)
  const { setTotalUnread, increment } = useMessageBadgeStore()
  const newPostsCount = useFeedStore((s) => s.newPostsCount)

  const [connections,    setConnections]    = useState<Connection[]>([])
  const [viewedIds,      setViewedIds]      = useState<Set<string>>(new Set())
  const [quickReplyId,   setQuickReplyId]   = useState<string | null>(null)
  const [showDiscovery,  setShowDiscovery]  = useState(true)
  const [myHasPosts,     setMyHasPosts]     = useState(false)

  const [query,          setQuery]          = useState('')
  const [isSearchMode,   setIsSearchMode]   = useState(false)
  const [suggested,      setSuggested]      = useState<UserResult[]>([])
  const [searchResults,  setSearchResults]  = useState<UserResult[]>([])
  const [searchLoading,  setSearchLoading]  = useState(false)
  const [suggestLoading, setSuggestLoading] = useState(false)
  const followingIds     = useFollowStore((s) => s.followingIds)
  const [followers,      setFollowers]      = useState<Set<string>>(new Set())
  const [followPending,  setFollowPending]  = useState<Set<string>>(new Set())

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // ── Load connections (SQLite first → always background sync) ────────────
  const syncConnectionsRef = useRef<(() => Promise<void>) | null>(null)

  useFocusEffect(useCallback(() => {
    let cancelled = false

    async function load() {
      // 1. Show cache instantly (offline-first)
      const [cached, viewed] = await Promise.all([
        getCachedConnections().catch(() => [] as Connection[]),
        getViewedPostIds().catch(() => new Set<string>()),
      ])
      if (!cancelled && cached.length > 0) {
        setConnections(cached)
        setViewedIds(viewed)
        setTotalUnread(cached.reduce((s, c) => s + c.unreadCount, 0))
      }

      // 2. Always refresh from API — no TTL gate (TTL was blocking new follows)
      if (!isConnected()) return
      try {
        const fresh = await getConnections()
        if (cancelled) return
        setConnections(fresh)
        const viewedFresh = await getViewedPostIds().catch(() => new Set<string>())
        if (!cancelled) setViewedIds(viewedFresh)
        cacheConnections(fresh).catch(() => {})
        setSyncMeta('connections_sync', String(Date.now())).catch(() => {})
        setTotalUnread(fresh.reduce((s, c) => s + c.unreadCount, 0))
      } catch {}
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
      setConnections((prev) => {
        const idx = prev.findIndex((c) => c.user.id === partnerId)
        const update: Partial<Connection> = {
          lastMessage: { id: msg.id, content: msg.content, senderId: msg.senderId, readAt: msg.readAt, createdAt: msg.createdAt },
          unreadCount: idx >= 0
            ? (msg.senderId !== user?.id ? prev[idx].unreadCount + 1 : prev[idx].unreadCount)
            : 1,
        }

        if (idx >= 0) {
          // Known conversation — move to top
          const updated: Connection[] = [{ ...prev[idx], ...update }, ...prev.filter((_, i) => i !== idx)]
          updateCachedConnection(partnerId, update).catch(() => {})
          if (msg.senderId !== user?.id) increment()
          return updated
        }

        // Unknown partner — fetch full connections to get their profile + add to list
        syncConnectionsRef.current?.().catch(() => {})
        if (msg.senderId !== user?.id) increment()
        return prev
      })
    }

    socket.on('message:new', onNewMessage)
    return () => { socket.off('message:new', onNewMessage) }
  }, [user?.id, increment])

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
    if (!isSearchMode) return
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (!query.trim()) { setSearchResults([]); return }
    debounceRef.current = setTimeout(async () => {
      setSearchLoading(true)
      try {
        const res = await api.get(`/users/search?q=${encodeURIComponent(query)}`)
        setSearchResults(res.data.data ?? [])
      } catch { setSearchResults([]) }
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
    setIsSearchMode(true)
    loadSuggested()
    loadFollowersState()
  }

  function exitSearch() {
    Keyboard.dismiss()
    setIsSearchMode(false)
    setQuery('')
    setSearchResults([])
  }

  // ── Follow / unfollow ─────────────────────────────────────────────────────
  const handleFollow = useCallback(async (userId: string, duration: FollowDuration = 'forever') => {
    if (followPending.has(userId)) return
    setFollowPending((prev) => new Set([...prev, userId]))
    try {
      const nowFollowing = await useFollowStore.getState().toggle(userId, duration)
      // New follow → refresh connections so the person appears in the list instantly
      if (nowFollowing) syncConnectionsRef.current?.().catch(() => {})
    } catch {
      Toast.show({ type: 'error', text1: t.error, text2: t.msg_follow_err, visibilityTime: 2500 })
    } finally {
      setFollowPending((prev) => {
        const next = new Set(prev)
        next.delete(userId)
        return next
      })
    }
  }, [followPending])

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

  // ── Conversation list items (with injected discovery row) ─────────────────
  type ConvoListItem =
    | { kind: 'convo'; c: Connection; idx: number }
    | { kind: 'discovery' }

  const INJECT_AT = 3
  const convoListItems: ConvoListItem[] = []
  connections.forEach((c, i) => {
    if (i === INJECT_AT && showDiscovery) convoListItems.push({ kind: 'discovery' })
    convoListItems.push({ kind: 'convo', c, idx: i })
  })
  if (showDiscovery && connections.length > 0 && connections.length <= INJECT_AT) {
    convoListItems.push({ kind: 'discovery' })
  }

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <View style={s.screen}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={0}
      >

        {/* ── Nav bar: ← | + | search field | avatar ──────────────── */}
        <View style={[s.navbar, { paddingTop: top + 12 }]}>
          <TouchableOpacity
            onPress={() => isSearchMode ? exitSearch() : nav.goBack()}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="chevron-back" size={26} color="#000" />
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => nav.navigate('Tabs', { screen: 'Create' })}
            activeOpacity={0.75}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="add" size={26} color="#000" />
          </TouchableOpacity>

          <View style={[s.searchBar, isSearchMode && s.searchBarActive]}>
            <Ionicons
              name="search-outline"
              size={16}
              color={isSearchMode ? colors.primary : '#1A1A1A'}
            />
            <TextInput
              ref={inputRef}
              style={s.searchInput}
              placeholder={t.msg_search_ph}
              placeholderTextColor="#ABABAB"
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
                <Ionicons name="close-circle" size={16} color="#ABABAB" />
              </TouchableOpacity>
            )}
          </View>

          {/* Avatar + ring if user has posts */}
          <TouchableOpacity
            onPress={() => nav.navigate('Profile', { userId: user?.id })}
            activeOpacity={0.75}
          >
            <View style={s.navAvatarOuter}>
              {myHasPosts && (
                <SegmentedRing count={1} size={32} strokeWidth={1.5} />
              )}
              <View style={s.navAvatarInner}>
                <View style={s.navAvatarCircle}>
                  <AvatarImage uri={user?.avatar ?? null} size={26} borderWidth={0} borderColor="transparent" />
                </View>
              </View>
            </View>
          </TouchableOpacity>
        </View>

        {/* ── Content ─────────────────────────────────────────────── */}
        {isSearchMode ? (

          /* ── Search / discovery ─────────────────────────────────── */
          <>
            <View style={s.sectionRow}>
              <Text style={s.sectionLabel}>
                {query.trim() ? t.msg_results : t.msg_suggested}
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

            {!isCardLoading && displayCards.length === 0 && query.trim().length > 0 && (
              <View style={s.emptySearch}>
                <View style={s.emptyIcon}>
                  <Ionicons name="search-outline" size={28} color={colors.gray400} />
                </View>
                <Text style={s.emptyTitle}>{t.msg_no_results}</Text>
                <Text style={s.emptySub}>{t.msg_no_results_sub}</Text>
              </View>
            )}

            {!isCardLoading && displayCards.length > 0 && (
              <FlatList
                data={displayCards}
                keyExtractor={(u) => u.id}
                numColumns={2}
                columnWrapperStyle={s.cardRow}
                contentContainerStyle={s.cardGrid}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
                renderItem={({ item }) => (
                  <UserCard
                    user={item}
                    followed={followingIds.has(item.id)}
                    followBack={followers.has(item.id) && !followingIds.has(item.id)}
                    loadingFollow={followPending.has(item.id)}
                    onFollow={(duration) => handleFollow(item.id, duration)}
                    onPress={() => { exitSearch(); nav.navigate('Profile', { userId: item.id }) }}
                  />
                )}
              />
            )}
          </>

        ) : (

          /* ── Conversations list ──────────────────────────────────── */
          <FlatList
            data={convoListItems}
            keyExtractor={(item) => item.kind === 'discovery' ? '__discovery__' : item.c.user.id}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={[s.list, { paddingBottom: Math.max(bottom, 8) + 66 }]}
            ItemSeparatorComponent={({ leadingItem }) =>
              (leadingItem as ConvoListItem).kind === 'discovery' ? null : <View style={s.sep} />
            }
            renderItem={({ item }) => {
              if (item.kind === 'discovery') {
                return <DiscoveryRow onDismiss={() => setShowDiscovery(false)} />
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
                      userId:           item.c.user.id,
                      userName:         item.c.user.name,
                      userAvatar:       item.c.user.avatar,
                      partnerHasPosts:  item.c.postIds.length > 0,
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

      </KeyboardAvoidingView>
    </View>
  )
}

// ── Styles ─────────────────────────────────────────────────────────────────────

const RING_OFFSET = 16 + RING + 14

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.white },

  /* ── Nav bar ── */
  navbar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 14,
    gap: 10,
  },
  searchBar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0F0F5',
    borderRadius: 22,
    paddingHorizontal: 14,
    paddingVertical: 7,
    gap: 8,
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  searchBarActive: {
    backgroundColor: `${colors.primary}0A`,
    borderColor: `${colors.primary}30`,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    fontFamily: fonts.medium,
    color: '#1A1A1A',
    padding: 0,
  },
  /* ── Nav avatar + ring ── */
  navAvatarOuter: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navAvatarInner: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  navAvatarCircle: {
    width: 26,
    height: 26,
    borderRadius: 13,
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
    backgroundColor: `${colors.primary}18`,
    borderRadius: 10,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  countPillTxt: { fontSize: 11, fontFamily: fonts.semiBold, color: colors.primary },

  spinnerWrap: { flex: 1, alignItems: 'center', paddingTop: 60 },

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
  avatarInner: { position: 'absolute' },
  info:        { flex: 1, gap: 3 },
  topRow:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  name:        { fontSize: 15, fontFamily: fonts.semiBold, color: '#1A1A1A', flex: 1, letterSpacing: -0.2 },
  nameBold:    { fontFamily: fonts.extraBold },
  time:        { fontSize: 12, fontFamily: fonts.medium, color: '#ABABAB' },
  timeActive:  { color: colors.primary, fontFamily: fonts.semiBold },
  preview:     { fontSize: 13, fontFamily: fonts.regular, color: '#ABABAB' },
  previewBold: { fontFamily: fonts.medium, color: '#3A3A3C' },
  previewMuted:{ fontStyle: 'italic', color: '#C0C0C8' },
  dot:         { minWidth: 20, height: 20, borderRadius: 10, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 5 },
  dotTxt:      { fontSize: 11, fontFamily: fonts.extraBold, color: colors.white },
  rowRight:      { flexDirection: 'row', alignItems: 'center', gap: 6 },
  replyArrow:    { width: 28, height: 28, borderRadius: 14, backgroundColor: `${colors.primary}12`, alignItems: 'center', justifyContent: 'center' },
  replyArrowActive: { backgroundColor: colors.primary },

  /* ── Empty states ── */
  empty:       { alignItems: 'center', paddingTop: 100, paddingHorizontal: 48, gap: 10 },
  emptyCircle: { width: 72, height: 72, borderRadius: 36, backgroundColor: colors.gray100, alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
  emptySearch: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, paddingBottom: 100 },
  emptyIcon:   { width: 56, height: 56, borderRadius: 28, backgroundColor: colors.gray100, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  emptyTitle:  { fontSize: 17, fontFamily: fonts.bold, color: '#1A1A1A' },
  emptySub:    { fontSize: 14, fontFamily: fonts.regular, color: '#8E8E93', textAlign: 'center', lineHeight: 21 },

  /* ── Card grid (search) ── */
  cardGrid: { paddingHorizontal: CARD_H_PAD, paddingBottom: 40, paddingTop: 4 },
  cardRow:  { gap: CARD_GAP, marginBottom: CARD_GAP },
})

// ── Quick reply box styles ─────────────────────────────────────────────────────

const q = StyleSheet.create({
  container: {
    backgroundColor: `${colors.primary}08`,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: `${colors.primary}25`,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 12,
    gap: 8,
  },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  replyLabel: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  replyTxt:   { fontSize: 13, fontFamily: fonts.medium, color: colors.gray600 },
  replyName:  { fontFamily: fonts.bold, color: colors.primary },
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

// ── User card styles ──────────────────────────────────────────────────────────

const CARD_H = Math.round(CARD_W * 1.45)

const c = StyleSheet.create({
  card: {
    width:        CARD_W,
    height:       CARD_H,
    borderRadius: 18,
    overflow:     'hidden',
    backgroundColor: '#1A1A1A',
  },
  photoFallback: {
    backgroundColor: '#2A2A2A',
    alignItems:      'center',
    justifyContent:  'center',
  },
  info: {
    position: 'absolute',
    bottom:   0,
    left:     0,
    right:    0,
    padding:  12,
    gap:      4,
  },
  cardName: {
    fontSize:    14,
    fontFamily:  fonts.bold,
    color:       '#fff',
    letterSpacing: -0.2,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           5,
  },
  statTxt: {
    fontSize:   11,
    fontFamily: fonts.regular,
    color:      'rgba(255,255,255,0.65)',
  },
  statDot: {
    width:        3,
    height:       3,
    borderRadius: 1.5,
    backgroundColor: 'rgba(255,255,255,0.35)',
  },
  followWrap: {
    marginTop: 8,
  },
})
