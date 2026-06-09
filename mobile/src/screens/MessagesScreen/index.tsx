import React, { useState, useCallback, useEffect, useRef } from 'react'
import {
  View, Text, FlatList, StyleSheet, TextInput,
  TouchableOpacity, Animated, ActivityIndicator, KeyboardAvoidingView,
  Dimensions, Keyboard, LayoutAnimation, Platform, UIManager,
} from 'react-native'

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true)
}
import { useNavigation } from '@react-navigation/native'
import { StackNavigationProp } from '@react-navigation/stack'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useFocusEffect } from '@react-navigation/native'
import { Ionicons } from '@expo/vector-icons'
import * as Haptics from 'expo-haptics'
import Toast from 'react-native-toast-message'
import * as msgService from '../../services/message.service'
import { getConnections, toggleFollow, FollowDuration } from '../../services/follow.service'
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
import { getMyGroups, Group } from '../../services/group.service'
import FollowSplitButton from '../../components/FollowSplitButton'
import { api } from '../../services/api'
import { getSocket } from '../../socket'
import { useAuthStore } from '../../store/auth.store'
import { isConnected } from '../../services/netinfo.service'
import { useMessageBadgeStore } from '../../store/messageBadge.store'
import { useFeedStore } from '../../store/feed.store'
import { AppStackParams } from '../../navigation/AppNavigator'
import { colors, fonts } from '../../theme'
import AvatarImage from '../../components/AvatarImage'
import SegmentedRing from '../../components/SegmentedRing'
import SpeechBadge from '../../components/SpeechBadge'

type Nav = StackNavigationProp<AppStackParams>

const { width: W } = Dimensions.get('window')
const CARD_GAP  = 12
const CARD_H_PAD = 16
const CARD_W = (W - CARD_H_PAD * 2 - CARD_GAP) / 2

const RING = 78
const AVA  = 66

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

// ── Group row (communities tab) ───────────────────────────────────────────────

function GroupRow({ group, onPress }: { group: Group; onPress: () => void }) {
  return (
    <TouchableOpacity style={s.row} onPress={onPress} activeOpacity={0.65}>
      <View style={s.avatarWrap}>
        {group.avatar
          ? <AvatarImage uri={group.avatar} size={AVA} />
          : (
            <View style={s.groupFallback}>
              <Ionicons name="people" size={20} color={colors.white} />
            </View>
          )
        }
      </View>
      <View style={s.info}>
        <View style={s.topRow}>
          <Text style={s.name} numberOfLines={1}>{group.name}</Text>
          {group.lastMessage && (
            <Text style={s.time}>{timeAgo(group.lastMessage.createdAt)}</Text>
          )}
        </View>
        <Text style={[s.preview, s.previewMuted]} numberOfLines={1}>
          {group.lastMessage?.content ?? `${group.memberCount} ${group.memberCount === 1 ? 'membro' : 'membros'}`}
        </Text>
      </View>
    </TouchableOpacity>
  )
}

// ── User card (search / suggestions) ─────────────────────────────────────────

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

function QuickReplyBox({
  userName, onSend, onClose,
}: {
  userName: string
  onSend: (text: string) => void
  onClose: () => void
}) {
  const [text, setText] = useState('')
  const inputRef = useRef<TextInput>(null)

  useEffect(() => {
    const t = setTimeout(() => inputRef.current?.focus(), 120)
    return () => clearTimeout(t)
  }, [])

  function handleSend() {
    const msg = text.trim()
    if (!msg) return
    setText('')
    onClose()   // fecha imediatamente — sem spinner
    onSend(msg) // fire-and-forget
  }

  return (
    <View style={q.container}>
      {/* Header bar */}
      <View style={q.header}>
        <View style={q.replyLabel}>
          <Ionicons name="return-down-forward" size={13} color={colors.primary} />
          <Text style={q.replyTxt} numberOfLines={1}>Responder a <Text style={q.replyName}>{userName}</Text></Text>
        </View>
        <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="close" size={16} color={colors.gray400} />
        </TouchableOpacity>
      </View>

      {/* Input row */}
      <View style={q.row}>
        <TextInput
          ref={inputRef}
          style={q.input}
          placeholder="Escreve uma mensagem..."
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
  const hasMsg      = !!item.lastMessage
  const unread      = item.unreadCount > 0
  const hasPosts    = item.postIds.length > 0
  const viewedCount = item.postIds.filter((id) => viewedIds.has(id)).length
  const iMine       = hasMsg && item.lastMessage!.senderId === myUserId
  const isRead      = hasMsg && !!item.lastMessage!.readAt
  const showReply   = unread && !iMine  // new message from the other person

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

        {/* Right side indicators */}
        <View style={s.rowRight}>
          {showReply ? (
            <>
              <View style={s.dot}>
                <Text style={s.dotTxt}>{item.unreadCount > 9 ? '9+' : item.unreadCount}</Text>
              </View>
              {/* Quick reply arrow — inner TouchableOpacity takes priority */}
              <TouchableOpacity
                style={[s.replyArrow, isQuickOpen && s.replyArrowActive]}
                onPress={(e) => { (e as any).stopPropagation?.(); onToggleQuick() }}
                hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}
              >
                <Ionicons
                  name={isQuickOpen ? 'chevron-up' : 'chevron-down'}
                  size={18}
                  color={isQuickOpen ? colors.white : colors.primary}
                />
              </TouchableOpacity>
            </>
          ) : iMine ? (
            <Ionicons name="checkmark-done" size={17} color={isRead ? '#4FC3F7' : '#C8C8C8'} />
          ) : null}
        </View>
      </TouchableOpacity>

      {/* Inline quick reply form */}
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
  const nav        = useNavigation<Nav>()
  const { top, bottom } = useSafeAreaInsets()
  const { user }   = useAuthStore()
  const inputRef   = useRef<TextInput>(null)
  const { setTotalUnread, increment } = useMessageBadgeStore()
  const newPostsCount = useFeedStore((s) => s.newPostsCount)

  // Tab
  const [activeTab, setActiveTab] = useState<'messages' | 'communities'>('messages')

  // Conversations state
  const [connections,    setConnections]    = useState<Connection[]>([])
  const [viewedIds,      setViewedIds]      = useState<Set<string>>(new Set())
  const [quickReplyId,   setQuickReplyId]   = useState<string | null>(null)

  // Communities state
  const [groups,        setGroups]        = useState<Group[]>([])
  const [loadingGroups, setLoadingGroups] = useState(false)

  // Search / discovery state
  const [query,         setQuery]         = useState('')
  const [isSearchMode,  setIsSearchMode]  = useState(false)
  const [suggested,     setSuggested]     = useState<UserResult[]>([])
  const [searchResults, setSearchResults] = useState<UserResult[]>([])
  const [searchLoading, setSearchLoading] = useState(false)
  const [suggestLoading, setSuggestLoading] = useState(false)
  const [followed,      setFollowed]      = useState<Set<string>>(new Set())
  const [followers,     setFollowers]     = useState<Set<string>>(new Set()) // who follows ME
  const [followPending, setFollowPending] = useState<Set<string>>(new Set())

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // ── Load connections: SQLite first → background network sync (60s TTL) ───
  useFocusEffect(useCallback(() => {
    let cancelled = false
    const SYNC_TTL = 60_000 // 1 minute

    async function load() {
      const [cached, viewed, lastSyncStr] = await Promise.all([
        getCachedConnections().catch(() => [] as Connection[]),
        getViewedPostIds().catch(() => new Set<string>()),
        getSyncMeta('connections_sync').catch(() => null),
      ])

      if (!cancelled && cached.length > 0) {
        setConnections(cached)
        setViewedIds(viewed)
        setTotalUnread(cached.reduce((s, c) => s + c.unreadCount, 0))
      }

      // Skip API if cache is fresh and we already have data
      const cacheAge = lastSyncStr ? Date.now() - parseInt(lastSyncStr, 10) : Infinity
      if (cached.length > 0 && cacheAge < SYNC_TTL) return

      if (!isConnected()) return
      try {
        const [fresh, viewedFresh] = await Promise.all([
          getConnections().catch(() => [] as Connection[]),
          getViewedPostIds().catch(() => new Set<string>()),
        ])
        if (cancelled) return
        setConnections(fresh)
        setViewedIds(viewedFresh)
        await Promise.all([
          cacheConnections(fresh).catch(() => {}),
          setSyncMeta('connections_sync', String(Date.now())).catch(() => {}),
        ])
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

  // ── Load follow state: who I follow + who follows me ─────────────────────
  const followedLoadedRef = useRef(false)

  async function loadFollowedState() {
    if (followedLoadedRef.current) return
    followedLoadedRef.current = true

    // 1. Cache
    const [cachedFollowing, cachedFollowers] = await Promise.all([
      getCache<FollowUser[]>('my_following').catch(() => null),
      getCache<FollowUser[]>('my_followers').catch(() => null),
    ])
    if (cachedFollowing?.length) setFollowed(new Set(cachedFollowing.map((u) => u.id)))
    if (cachedFollowers?.length) setFollowers(new Set(cachedFollowers.map((u) => u.id)))

    // 2. Refresh both from API
    if (!isConnected()) return
    try {
      const [followingRes, followersRes] = await Promise.all([
        api.get('/users/following'),
        api.get('/users/followers'),
      ])
      const following: FollowUser[] = followingRes.data.data ?? followingRes.data ?? []
      const myFollowers: FollowUser[] = followersRes.data.data ?? followersRes.data ?? []
      setFollowed(new Set(following.map((u) => u.id)))
      setFollowers(new Set(myFollowers.map((u) => u.id)))
      setCache('my_following', following).catch(() => {})
      setCache('my_followers', myFollowers).catch(() => {})
    } catch {
      followedLoadedRef.current = false
    }
  }

  // ── Load groups (communities tab) ────────────────────────────────────────
  async function loadGroups() {
    setLoadingGroups(true)
    const cached = await getCache<Group[]>('my_groups').catch(() => null)
    if (cached) { setGroups(cached); setLoadingGroups(false) }
    if (!isConnected()) { setLoadingGroups(false); return }
    try {
      const fresh = await getMyGroups()
      setGroups(fresh)
      setCache('my_groups', fresh).catch(() => {})
    } catch {}
    setLoadingGroups(false)
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
  const handleFollow = useCallback(async (userId: string, duration: FollowDuration = 'forever') => {
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
      const res = await toggleFollow(userId, duration)
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

  // ── Quick reply ───────────────────────────────────────────────────────────
  function toggleQuickReply(userId: string) {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut)
    setQuickReplyId((prev) => (prev === userId ? null : userId))
    Keyboard.dismiss()
  }

  function handleQuickSend(userId: string, userName: string, text: string) {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)

    // Optimistic: update inbox instantly with a temp ID
    const tempId = `pending-${Date.now()}`
    const now    = new Date().toISOString()
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

    // Fire-and-forget — UI já respondeu, API sincroniza em background
    msgService.sendMessage(userId, text).then((sent) => {
      // Substitui o tempId pelo ID real na inbox
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
      Toast.show({ type: 'error', text1: 'Erro ao enviar', text2: 'Tenta novamente.', visibilityTime: 2500 })
    })
  }

  // ── Derived display state ─────────────────────────────────────────────────
  const totalUnread    = connections.reduce((sum, c) => sum + c.unreadCount, 0)
  const displayCards   = query.trim() ? searchResults : suggested
  const isCardLoading  = query.trim() ? searchLoading : suggestLoading

  function switchTab(tab: 'messages' | 'communities') {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut)
    setActiveTab(tab)
    if (tab === 'communities' && groups.length === 0) loadGroups()
    if (tab === 'messages' && isSearchMode) exitSearch()
  }

  return (
    <View style={[s.screen, { paddingTop: top }]}>
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? top : 8}
    >

      {/* ── Header ──────────────────────────────────────────────────── */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => nav.goBack()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Ionicons name="chevron-back" size={26} color={colors.gray800} />
        </TouchableOpacity>

        <View style={s.titleWrap}>
          <Text style={s.title}>Mensagens</Text>
        </View>

        {/* COMMUNITY BLOCKED FOR LAUNCH
        {activeTab === 'communities' && (
          <TouchableOpacity
            style={s.createBtn}
            onPress={() => nav.navigate('CreateGroup')}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="add" size={22} color={colors.primary} />
          </TouchableOpacity>
        )}
        */}
      </View>

      {/* ── Tab switcher ────────────────────────────────────────────── */}
      <View style={s.tabRow}>
        <TouchableOpacity
          style={[s.tabPill, activeTab === 'messages' && s.tabPillActive]}
          onPress={() => switchTab('messages')}
          activeOpacity={0.7}
        >
          <Ionicons
            name="chatbubbles-outline"
            size={14}
            color={activeTab === 'messages' ? colors.white : colors.gray400}
          />
          <Text style={[s.tabLabel, activeTab === 'messages' && s.tabLabelActive]}>
            Mensagens
          </Text>
        </TouchableOpacity>

        {/* COMMUNITY BLOCKED FOR LAUNCH
        <TouchableOpacity
          style={[s.tabPill, activeTab === 'communities' && s.tabPillActive]}
          onPress={() => switchTab('communities')}
          activeOpacity={0.7}
        >
          <Ionicons
            name="people-outline"
            size={14}
            color={activeTab === 'communities' ? colors.white : colors.gray400}
          />
          <Text style={[s.tabLabel, activeTab === 'communities' && s.tabLabelActive]}>
            Comunidades
          </Text>
        </TouchableOpacity>
        */}
      </View>

      {/* ── Search bar (messages tab only) ──────────────────────────── */}
      {activeTab === 'messages' && (
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
      )}

      {/* ── Content ─────────────────────────────────────────────────── */}
      {/* COMMUNITY BLOCKED FOR LAUNCH — communities branch removed, always show messages/search
      {activeTab === 'communities' ? ( ... ) : */}
      {isSearchMode ? (

        /* ── Search / discovery: user cards 2-column grid ─────────── */
        <>
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
                  followBack={followers.has(item.id) && !followed.has(item.id)}
                  loadingFollow={followPending.has(item.id)}
                  onFollow={(duration) => handleFollow(item.id, duration)}
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
              isQuickOpen={quickReplyId === item.user.id}
              onToggleQuick={() => toggleQuickReply(item.user.id)}
              onQuickSend={(text) => handleQuickSend(item.user.id, item.user.name, text)}
              onPress={() => {
                setQuickReplyId(null)
                nav.navigate('Chat', {
                  userId:     item.user.id,
                  userName:   item.user.name,
                  userAvatar: item.user.avatar,
                })
              }}
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
    </KeyboardAvoidingView>

      {/* ── Floating home FAB — hidden when quick-reply keyboard is open ── */}
      {!quickReplyId && (
        <>
          <TouchableOpacity
            style={[ms.homeFab, { bottom: bottom + 24 }]}
            onPress={() => nav.goBack()}
            activeOpacity={0.85}
          >
            <Ionicons name="home" size={28} color="#fff" />
          </TouchableOpacity>
          <View style={[ms.homeFabBadgePos, { bottom: bottom + 74 }]} pointerEvents="none">
            <SpeechBadge count={newPostsCount} />
          </View>
        </>
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

  /* tab switcher */
  tabRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.gray200,
  },
  tabPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: colors.gray100,
  },
  tabPillActive: { backgroundColor: colors.primary },
  tabLabel:      { fontSize: 13, fontFamily: fonts.semiBold, color: colors.gray400 },
  tabLabelActive:{ color: colors.white },

  /* header create button */
  createBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: `${colors.primary}15`,
    alignItems: 'center', justifyContent: 'center',
  },

  /* group avatar fallback */
  groupFallback: {
    width: AVA, height: AVA, borderRadius: AVA / 2,
    backgroundColor: colors.primary,
    alignItems: 'center', justifyContent: 'center',
  },

  /* empty create button */
  emptyCreateBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    marginTop: 8, backgroundColor: colors.primary,
    paddingHorizontal: 20, paddingVertical: 10, borderRadius: 22,
  },
  emptyCreateTxt: { fontSize: 14, fontFamily: fonts.semiBold, color: colors.white },

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
    paddingVertical: 8,
    gap: 16,
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

  /* row right section */
  rowRight:      { flexDirection: 'row', alignItems: 'center', gap: 6 },
  replyArrow:    { width: 30, height: 30, borderRadius: 15, backgroundColor: `${colors.primary}15`, alignItems: 'center', justifyContent: 'center' },
  replyArrowActive: { backgroundColor: colors.primary },

  /* empty (conversations) */
  empty:       { alignItems: 'center', paddingTop: 80, paddingHorizontal: 48, gap: 10 },
  emptyCircle: { width: 72, height: 72, borderRadius: 36, backgroundColor: colors.gray100, alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
  emptyTitle:  { fontSize: 17, fontFamily: fonts.semiBold, color: colors.gray800 },
  emptySub:    { fontSize: 14, fontFamily: fonts.regular, color: colors.gray400, textAlign: 'center', lineHeight: 21 },
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  replyLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  replyTxt: {
    fontSize: 12,
    fontFamily: fonts.regular,
    color: colors.gray600,
  },
  replyName: {
    fontFamily: fonts.semiBold,
    color: colors.primary,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  input: {
    flex: 1,
    backgroundColor: colors.white,
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 14,
    fontFamily: fonts.regular,
    color: colors.gray800,
    borderWidth: 1,
    borderColor: colors.gray200,
    maxHeight: 80,
  },
  sendBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnOff: { opacity: 0.35 },
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

})

// ── Floating FAB styles (separate const to avoid name collision) ────────────
const ms = StyleSheet.create({
  homeFab: {
    position: 'absolute',
    right: 20,
    width: 62, height: 62,
    borderRadius: 31,
    backgroundColor: colors.primary,
    alignItems: 'center', justifyContent: 'center',
    zIndex: 30,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  // Badge sibling of FAB — bottom: fabBottom + fabHeight - overlap (bottom+24+62-12=bottom+74)
  homeFabBadgePos: {
    position: 'absolute',
    right: 20,
    width: 62,
    alignItems: 'center',
    zIndex: 31,
    elevation: 10,
  },
})
