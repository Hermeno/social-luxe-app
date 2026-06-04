import React, { useState, useCallback, useEffect, useRef } from 'react'
import {
  View, Text, FlatList, StyleSheet, TextInput,
  TouchableOpacity, Animated, Pressable, ActivityIndicator,
  Dimensions, Keyboard,
} from 'react-native'
import { useNavigation } from '@react-navigation/native'
import { StackNavigationProp } from '@react-navigation/stack'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useFocusEffect } from '@react-navigation/native'
import { Ionicons } from '@expo/vector-icons'
import * as Haptics from 'expo-haptics'
import Toast from 'react-native-toast-message'
import { getConnections } from '../../services/follow.service'
import { toggleFollow } from '../../services/follow.service'
import { Connection } from '../../types'
import {
  getViewedPostIds,
  getCachedConnections,
  cacheConnections,
  updateCachedConnection,
  getCache,
  setCache,
} from '../../db/database'
import { FollowUser } from '../../services/follow.service'
import { api } from '../../services/api'
import { getSocket } from '../../socket'
import { useAuthStore } from '../../store/auth.store'
import { isConnected } from '../../services/netinfo.service'
import { useMessageBadgeStore } from '../../store/messageBadge.store'
import { AppStackParams } from '../../navigation/AppNavigator'
import { colors, fonts } from '../../theme'
import AvatarImage from '../../components/AvatarImage'
import SegmentedRing from '../../components/SegmentedRing'

type Nav = StackNavigationProp<AppStackParams>

const { width: W } = Dimensions.get('window')
const CARD_GAP  = 12
const CARD_H_PAD = 16
const CARD_W = (W - CARD_H_PAD * 2 - CARD_GAP) / 2

const RING = 54
const AVA  = 44

// ── Helpers ───────────────────────────────────────────────────────────────────

function timeAgo(date: string) {
  const diff = Date.now() - new Date(date).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1)  return 'agora'
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

// ── User card (search / suggestions) ─────────────────────────────────────────

function UserCard({
  user, followed, loadingFollow, onFollow, onPress,
}: {
  user: UserResult
  followed: boolean
  loadingFollow: boolean
  onFollow: () => void
  onPress: () => void
}) {
  const followers = user._count?.followers ?? 0
  const posts     = user._count?.posts     ?? 0

  return (
    <View style={c.card}>
      {/* tappable area → profile */}
      <TouchableOpacity style={c.cardBody} onPress={onPress} activeOpacity={0.8}>
        <AvatarImage uri={user.avatar} size={84} />
        <Text style={c.cardName} numberOfLines={1}>{user.name}</Text>

        {/* Stats row */}
        <View style={c.statsRow}>
          <View style={c.statItem}>
            <Text style={c.statValue}>{fmtCount(posts)}</Text>
            <Text style={c.statLabel}>{posts === 1 ? 'post' : 'posts'}</Text>
          </View>
          <View style={c.statDivider} />
          <View style={c.statItem}>
            <Text style={c.statValue}>{fmtCount(followers)}</Text>
            <Text style={c.statLabel}>{followers === 1 ? 'seguidor' : 'seguidores'}</Text>
          </View>
        </View>
      </TouchableOpacity>

      {/* follow button — sibling, not nested */}
      <Pressable
        style={({ pressed }) => [
          c.followBtn,
          followed && c.followingBtn,
          pressed && { opacity: 0.7 },
        ]}
        onPress={onFollow}
        disabled={loadingFollow}
        hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
      >
        {loadingFollow
          ? <ActivityIndicator size="small" color={followed ? colors.primary : colors.white} />
          : <Text style={[c.followBtnTxt, followed && c.followingBtnTxt]}>
              {followed ? 'A seguir' : 'Seguir'}
            </Text>
        }
      </Pressable>
    </View>
  )
}

// ── Conversation row ──────────────────────────────────────────────────────────

function ConvoRow({ item, viewedIds, onPress, index, myUserId }: {
  item: Connection; viewedIds: Set<string>; onPress: () => void; index: number; myUserId: string
}) {
  const hasMsg      = !!item.lastMessage
  const unread      = item.unreadCount > 0
  const hasPosts    = item.postIds.length > 0
  const viewedCount = item.postIds.filter((id) => viewedIds.has(id)).length
  const iMine       = hasMsg && item.lastMessage!.senderId === myUserId
  const isRead      = hasMsg && !!item.lastMessage!.readAt

  const opacity    = useRef(new Animated.Value(0)).current
  const translateY = useRef(new Animated.Value(8)).current

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity,    { toValue: 1, duration: 260, delay: index * 35, useNativeDriver: true }),
      Animated.timing(translateY, { toValue: 0, duration: 260, delay: index * 35, useNativeDriver: true }),
    ]).start()
  }, [])

  const preview = hasMsg
    ? (item.lastMessage!.content ?? 'Ficheiro de media')
    : 'Sem mensagens ainda'

  return (
    <Animated.View style={{ opacity, transform: [{ translateY }] }}>
      <TouchableOpacity style={s.row} onPress={onPress} activeOpacity={0.65}>
        <View style={s.avatarWrap}>
          {hasPosts ? (
            <>
              <SegmentedRing count={item.postIds.length} viewedCount={viewedCount} size={RING} strokeWidth={2} />
              <View style={s.avatarInner}><AvatarImage uri={item.user.avatar} size={AVA} /></View>
            </>
          ) : (
            <AvatarImage uri={item.user.avatar} size={AVA} />
          )}
        </View>

        <View style={s.info}>
          <View style={s.topRow}>
            <Text style={[s.name, unread && s.nameBold]} numberOfLines={1}>{item.user.name}</Text>
            {hasMsg && (
              <Text style={[s.time, unread && s.timeActive]}>
                {timeAgo(item.lastMessage!.createdAt)}
              </Text>
            )}
          </View>
          <Text style={[s.preview, unread && s.previewBold, !hasMsg && s.previewMuted]} numberOfLines={1}>
            {preview}
          </Text>
        </View>

        {unread && !iMine ? (
          <View style={s.dot}>
            <Text style={s.dotTxt}>{item.unreadCount > 9 ? '9+' : item.unreadCount}</Text>
          </View>
        ) : iMine ? (
          // My last message: 2 gray ticks = sent, 2 blue ticks = read
          <Ionicons
            name="checkmark-done"
            size={17}
            color={isRead ? '#4FC3F7' : '#C8C8C8'}
          />
        ) : null}
      </TouchableOpacity>
    </Animated.View>
  )
}

// ── Screen ────────────────────────────────────────────────────────────────────

export default function MessagesScreen() {
  const nav        = useNavigation<Nav>()
  const { top }    = useSafeAreaInsets()
  const { user }   = useAuthStore()
  const inputRef   = useRef<TextInput>(null)
  const { setTotalUnread, increment } = useMessageBadgeStore()

  // Conversations state
  const [connections, setConnections] = useState<Connection[]>([])
  const [viewedIds,   setViewedIds]   = useState<Set<string>>(new Set())

  // Search / discovery state
  const [query,         setQuery]         = useState('')
  const [isSearchMode,  setIsSearchMode]  = useState(false)
  const [suggested,     setSuggested]     = useState<UserResult[]>([])
  const [searchResults, setSearchResults] = useState<UserResult[]>([])
  const [searchLoading, setSearchLoading] = useState(false)
  const [suggestLoading, setSuggestLoading] = useState(false)
  const [followed,      setFollowed]      = useState<Set<string>>(new Set())
  const [followPending, setFollowPending] = useState<Set<string>>(new Set())

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // ── Load connections: SQLite first → background network sync ──────────────
  useFocusEffect(useCallback(() => {
    let cancelled = false

    async function load() {
      const [cached, viewed] = await Promise.all([
        getCachedConnections().catch(() => [] as Connection[]),
        getViewedPostIds().catch(() => new Set<string>()),
      ])
      if (!cancelled && cached.length > 0) {
        setConnections(cached)
        setViewedIds(viewed)
        setTotalUnread(cached.reduce((s, c) => s + c.unreadCount, 0))
      }
      if (!isConnected()) return
      try {
        const [fresh, viewedFresh] = await Promise.all([
          getConnections().catch(() => [] as Connection[]),
          getViewedPostIds().catch(() => new Set<string>()),
        ])
        if (cancelled) return
        setConnections(fresh)
        setViewedIds(viewedFresh)
        cacheConnections(fresh).catch(() => {})
        setTotalUnread(fresh.reduce((s, c) => s + c.unreadCount, 0))
      } catch {}
    }

    load()
    return () => { cancelled = true }
  }, []))

  // ── Socket: update inbox live ─────────────────────────────────────────────
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
        const updated: Connection[] = idx >= 0
          ? [{ ...prev[idx], ...update }, ...prev.filter((_, i) => i !== idx)]
          : prev
        updateCachedConnection(partnerId, update).catch(() => {})
        // Only count badge for messages received from others
        if (msg.senderId !== user?.id) increment()
        return updated
      })
    }

    socket.on('message:new', onNewMessage)
    return () => { socket.off('message:new', onNewMessage) }
  }, [user?.id, increment])

  // ── Load suggested users (lazy — only when search mode first opens) ───────
  async function loadSuggested() {
    if (suggested.length > 0) return
    setSuggestLoading(true)
    try {
      const res = await api.get('/users/suggested')
      setSuggested(res.data.data ?? res.data)
    } catch {}
    finally { setSuggestLoading(false) }
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
      finally { setSearchLoading(false) }
    }, 300)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [query, isSearchMode])

  // ── Load who I follow (cache first → API fallback) ───────────────────────
  const followedLoadedRef = useRef(false)

  async function loadFollowedState() {
    if (followedLoadedRef.current) return
    followedLoadedRef.current = true

    // 1. Cache (FriendsScreen may have saved it)
    const cached = await getCache<FollowUser[]>('my_following').catch(() => null)
    if (cached && cached.length > 0) {
      setFollowed(new Set(cached.map((u) => u.id)))
    }

    // 2. Always refresh from API (source of truth)
    if (!isConnected()) return
    try {
      const res = await api.get('/users/following')
      const list: FollowUser[] = res.data.data ?? res.data ?? []
      setFollowed(new Set(list.map((u) => u.id)))
      setCache('my_following', list).catch(() => {})
    } catch {
      followedLoadedRef.current = false // allow retry
    }
  }

  // ── Enter / exit search mode ──────────────────────────────────────────────
  function enterSearch() {
    setIsSearchMode(true)
    loadSuggested()
    loadFollowedState()
  }

  function exitSearch() {
    Keyboard.dismiss()
    setIsSearchMode(false)
    setQuery('')
    setSearchResults([])
  }

  // ── Follow / unfollow ─────────────────────────────────────────────────────
  const handleFollow = useCallback(async (userId: string) => {
    if (followPending.has(userId)) return
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)

    const wasFollowed = followed.has(userId)
    setFollowed((prev) => {
      const next = new Set(prev)
      wasFollowed ? next.delete(userId) : next.add(userId)
      return next
    })
    setFollowPending((prev) => new Set([...prev, userId]))

    try {
      const res = await toggleFollow(userId)
      setFollowed((prev) => {
        const next = new Set(prev)
        res.following ? next.add(userId) : next.delete(userId)
        return next
      })
    } catch {
      setFollowed((prev) => {
        const next = new Set(prev)
        wasFollowed ? next.add(userId) : next.delete(userId)
        return next
      })
      Toast.show({ type: 'error', text1: 'Erro', text2: 'Não foi possível seguir.', visibilityTime: 2500 })
    } finally {
      setFollowPending((prev) => {
        const next = new Set(prev)
        next.delete(userId)
        return next
      })
    }
  }, [followed, followPending])

  // ── Derived display state ─────────────────────────────────────────────────
  const totalUnread    = connections.reduce((sum, c) => sum + c.unreadCount, 0)
  const displayCards   = query.trim() ? searchResults : suggested
  const isCardLoading  = query.trim() ? searchLoading : suggestLoading

  return (
    <View style={[s.screen, { paddingTop: top }]}>

      {/* ── Header ──────────────────────────────────────────────────── */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => nav.goBack()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Ionicons name="chevron-back" size={26} color={colors.gray800} />
        </TouchableOpacity>

        <View style={s.titleWrap}>
          <Text style={s.title}>Mensagens</Text>
          {totalUnread > 0 && (
            <View style={s.unreadPill}>
              <Text style={s.unreadPillTxt}>{totalUnread}</Text>
            </View>
          )}
        </View>
      </View>

      {/* ── Search bar ──────────────────────────────────────────────── */}
      <View style={s.searchRow}>
        <View style={[s.searchBar, isSearchMode && s.searchBarActive]}>
          <Ionicons
            name="search-outline"
            size={16}
            color={isSearchMode ? colors.primary : colors.gray400}
          />
          <TextInput
            ref={inputRef}
            style={s.searchInput}
            placeholder="Pesquisar pessoas..."
            placeholderTextColor={colors.gray400}
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
              <Ionicons name="close-circle" size={16} color={colors.gray400} />
            </TouchableOpacity>
          )}
        </View>

        {isSearchMode && (
          <TouchableOpacity onPress={exitSearch} style={s.cancelBtn}>
            <Text style={s.cancelTxt}>Cancelar</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* ── Content ─────────────────────────────────────────────────── */}
      {isSearchMode ? (

        /* ── Search / discovery: user cards 2-column grid ─────────── */
        <>
          {/* Section label */}
          <View style={s.sectionRow}>
            <Text style={s.sectionLabel}>
              {query.trim() ? 'Resultados' : 'Sugeridos para ti'}
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
              <Text style={s.emptyTitle}>Nenhum resultado</Text>
              <Text style={s.emptySub}>Tenta outro nome</Text>
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
                  followed={followed.has(item.id)}
                  loadingFollow={followPending.has(item.id)}
                  onFollow={() => handleFollow(item.id)}
                  onPress={() => { exitSearch(); nav.navigate('Profile', { userId: item.id }) }}
                />
              )}
            />
          )}
        </>

      ) : (

        /* ── Normal: conversations list ────────────────────────────── */
        <FlatList
          data={connections}
          keyExtractor={(c) => c.user.id}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={s.list}
          ItemSeparatorComponent={() => <View style={s.sep} />}
          renderItem={({ item, index }) => (
            <ConvoRow
              item={item}
              viewedIds={viewedIds}
              index={index}
              myUserId={user?.id ?? ''}
              onPress={() => nav.navigate('Chat', {
                userId:     item.user.id,
                userName:   item.user.name,
                userAvatar: item.user.avatar,
              })}
            />
          )}
          ListEmptyComponent={
            <View style={s.empty}>
              <View style={s.emptyCircle}>
                <Ionicons name="chatbubble-ellipses-outline" size={36} color="#C0C0C8" />
              </View>
              <Text style={s.emptyTitle}>Sem conversas</Text>
              <Text style={s.emptySub}>Usa a pesquisa acima para encontrar pessoas</Text>
            </View>
          }
        />
      )}
    </View>
  )
}

// ── Styles ─────────────────────────────────────────────────────────────────────

const RING_OFFSET = 16 + RING + 14

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.white },

  /* header */
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingTop: 10,
    paddingBottom: 6,
    gap: 12,
  },
  titleWrap:     { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 },
  title:         { fontSize: 26, fontFamily: fonts.bold, color: colors.gray800, letterSpacing: -0.5 },
  unreadPill:    { backgroundColor: colors.primary, borderRadius: 10, paddingHorizontal: 7, paddingVertical: 2, minWidth: 20, alignItems: 'center' },
  unreadPillTxt: { fontSize: 11, fontFamily: fonts.bold, color: colors.white },

  /* search bar */
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.gray200,
  },
  searchBar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.gray100,
    borderRadius: 14,
    paddingHorizontal: 13,
    paddingVertical: 11,
    gap: 8,
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  searchBarActive: {
    borderColor: colors.primary,
    backgroundColor: `${colors.primary}08`,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    fontFamily: fonts.regular,
    color: colors.gray800,
    padding: 0,
  },
  cancelBtn: { paddingHorizontal: 4, paddingVertical: 6 },
  cancelTxt: { fontSize: 14, fontFamily: fonts.semiBold, color: colors.primary },

  /* section label */
  sectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 18,
    paddingBottom: 12,
    gap: 8,
  },
  sectionLabel: {
    fontSize: 12,
    fontFamily: fonts.semiBold,
    color: colors.gray400,
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

  /* empty (search) */
  emptySearch: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, paddingBottom: 100 },
  emptyIcon:   { width: 56, height: 56, borderRadius: 28, backgroundColor: colors.gray100, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },

  /* card grid */
  cardGrid: { paddingHorizontal: CARD_H_PAD, paddingBottom: 40 },
  cardRow:  { gap: CARD_GAP, marginBottom: CARD_GAP },

  /* connections list */
  list: { paddingBottom: 80 },
  sep:  { height: StyleSheet.hairlineWidth, backgroundColor: colors.gray200, marginLeft: RING_OFFSET },

  /* conversation row */
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingVertical: 13,
    gap: 14,
    backgroundColor: colors.white,
  },
  avatarWrap:  { width: RING, height: RING, alignItems: 'center', justifyContent: 'center' },
  avatarInner: { position: 'absolute' },
  info:        { flex: 1, gap: 3 },
  topRow:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  name:        { fontSize: 15, fontFamily: fonts.semiBold, color: colors.gray800, flex: 1, letterSpacing: -0.1 },
  nameBold:    { fontFamily: fonts.bold },
  time:        { fontSize: 12, fontFamily: fonts.regular, color: colors.gray400 },
  timeActive:  { color: colors.primary, fontFamily: fonts.medium },
  preview:     { fontSize: 13, fontFamily: fonts.regular, color: colors.gray400 },
  previewBold: { fontFamily: fonts.medium, color: colors.gray600 },
  previewMuted:{ fontStyle: 'italic' },
  dot:         { minWidth: 20, height: 20, borderRadius: 10, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 5 },
  dotTxt:      { fontSize: 11, fontFamily: fonts.bold, color: colors.white },

  /* empty (conversations) */
  empty:       { alignItems: 'center', paddingTop: 80, paddingHorizontal: 48, gap: 10 },
  emptyCircle: { width: 72, height: 72, borderRadius: 36, backgroundColor: colors.gray100, alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
  emptyTitle:  { fontSize: 17, fontFamily: fonts.semiBold, color: colors.gray800 },
  emptySub:    { fontSize: 14, fontFamily: fonts.regular, color: colors.gray400, textAlign: 'center', lineHeight: 21 },
})

// ── User card styles ──────────────────────────────────────────────────────────

const c = StyleSheet.create({
  card: {
    width: CARD_W,
    backgroundColor: colors.white,
    borderRadius: 20,
    paddingBottom: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.gray200,
  },
  cardBody: {
    alignItems: 'center',
    paddingTop: 22,
    paddingHorizontal: 10,
    paddingBottom: 12,
    width: '100%',
    gap: 8,
  },
  cardName: {
    fontSize: 14,
    fontFamily: fonts.bold,
    color: colors.gray800,
    textAlign: 'center',
    letterSpacing: -0.2,
  },

  /* stats */
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 2,
  },
  statItem: { alignItems: 'center', gap: 1 },
  statValue: {
    fontSize: 14,
    fontFamily: fonts.bold,
    color: colors.gray800,
    letterSpacing: -0.3,
  },
  statLabel: {
    fontSize: 10,
    fontFamily: fonts.regular,
    color: colors.gray400,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  statDivider: {
    width: 1,
    height: 22,
    backgroundColor: colors.gray200,
  },

  /* follow button */
  followBtn: {
    marginTop: 2,
    paddingHorizontal: 24,
    paddingVertical: 9,
    borderRadius: 22,
    backgroundColor: colors.primary,
    minWidth: 110,
    alignItems: 'center',
    justifyContent: 'center',
  },
  followingBtn: {
    backgroundColor: colors.white,
    borderWidth: 1.5,
    borderColor: colors.gray200,
  },
  followBtnTxt: {
    fontSize: 13,
    fontFamily: fonts.semiBold,
    color: colors.white,
    letterSpacing: -0.1,
  },
  followingBtnTxt: { color: colors.gray600 },
})
