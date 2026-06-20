import React, { useState, useEffect, useRef, useCallback } from 'react'
import {
  View, Text, TextInput, FlatList, TouchableOpacity,
  StyleSheet, ActivityIndicator, ListRenderItemInfo,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useNavigation } from '@react-navigation/native'
import { StackNavigationProp } from '@react-navigation/stack'
import { Ionicons } from '@expo/vector-icons'
import Toast from 'react-native-toast-message'
import { api } from '../../services/api'
import { AppStackParams } from '../../navigation/AppNavigator'
import { colors, fonts } from '../../theme'
import { toggleFollow, FollowDuration } from '../../services/follow.service'
import { getCache, setCache } from '../../db/database'
import { isConnected } from '../../services/netinfo.service'
import AvatarImage from '../../components/AvatarImage'
import FollowSplitButton from '../../components/FollowSplitButton'
import { useT } from '../../i18n'

type Nav = StackNavigationProp<AppStackParams>

interface UserResult {
  id: string
  name: string
  avatar: string | null
  bio: string | null
  _count?: { followers: number }
}

function fmtCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000)     return `${(n / 1_000).toFixed(1)}K`
  return String(n)
}

// ── User row ──────────────────────────────────────────────────────────────────

interface RowProps {
  user: UserResult
  followed: boolean
  loadingFollow: boolean
  onFollow: (duration: FollowDuration) => void
  onPress: () => void
}

function UserRow({ user, followed, loadingFollow, onFollow, onPress }: RowProps) {
  const t = useT()
  const sub = user.bio?.trim()
    || (user._count?.followers ? `${fmtCount(user._count.followers)} ${t.followers}` : null)

  return (
    <View style={s.row}>
      {/* Left: avatar + info → navigate to profile */}
      <TouchableOpacity style={s.rowLeft} onPress={onPress} activeOpacity={0.7}>
        <AvatarImage uri={user.avatar} name={user.name} size={48} />
        <View style={s.rowInfo}>
          <Text style={s.rowName} numberOfLines={1}>{user.name}</Text>
          {!!sub && <Text style={s.rowSub} numberOfLines={1}>{sub}</Text>}
        </View>
      </TouchableOpacity>

      {/* Right: follow split button — sibling, NOT nested in the touchable */}
      <FollowSplitButton
        following={followed}
        loading={loadingFollow}
        onFollow={onFollow}
        theme="light"
      />
    </View>
  )
}

// ── Skeleton placeholder ───────────────────────────────────────────────────────

function SkeletonRow() {
  return (
    <View style={[s.row, { opacity: 0.45 }]}>
      <View style={s.rowLeft}>
        <View style={s.skeletonAvatar} />
        <View style={s.skeletonInfo}>
          <View style={s.skeletonName} />
          <View style={s.skeletonSub} />
        </View>
      </View>
      <View style={s.skeletonBtn} />
    </View>
  )
}

// ── Main screen ───────────────────────────────────────────────────────────────

export default function SearchScreen() {
  const nav     = useNavigation<Nav>()
  const { top } = useSafeAreaInsets()
  const t       = useT()

  const [query,         setQuery]         = useState('')
  const [results,       setResults]       = useState<UserResult[]>([])
  const [suggested,     setSuggested]     = useState<UserResult[]>([])
  const [loadingSug,    setLoadingSug]    = useState(true)
  const [loadingSearch, setLoadingSearch] = useState(false)
  const [followed,      setFollowed]      = useState<Set<string>>(new Set())
  const [followPending, setFollowPending] = useState<Set<string>>(new Set())

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const inputRef    = useRef<TextInput>(null)

  // Load suggestions — cache-first (offline-first)
  useEffect(() => {
    async function loadSuggested() {
      // 1. Serve cache immediately — no wait
      const cached = await getCache<UserResult[]>('suggested_users').catch(() => null)
      if (cached && cached.length > 0) {
        setSuggested(cached)
        setLoadingSug(false)
      }
      // 2. Background network sync
      if (!isConnected()) { setLoadingSug(false); return }
      try {
        const r = await api.get('/users/suggested')
        const fresh: UserResult[] = r.data.data ?? r.data ?? []
        setSuggested(fresh)
        setCache('suggested_users', fresh).catch(() => {})
      } catch {}
      setLoadingSug(false)
    }
    loadSuggested()
  }, [])

  const search = useCallback(async (q: string) => {
    if (!q.trim()) { setResults([]); return }
    setLoadingSearch(true)
    try {
      const res = await api.get(`/users/search?q=${encodeURIComponent(q)}`)
      setResults(res.data.data ?? [])
    } catch {
      setResults([])
    } finally {
      setLoadingSearch(false)
    }
  }, [])

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => search(query), 300)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [query])

  const handleFollow = useCallback(async (userId: string, duration: FollowDuration = 'forever') => {
    if (followPending.has(userId)) return

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
      Toast.show({ type: 'error', text1: t.search_no_network, text2: t.search_follow_err, visibilityTime: 2500 })
    } finally {
      setFollowPending((prev) => {
        const next = new Set(prev)
        next.delete(userId)
        return next
      })
    }
  }, [followed, followPending])

  const isSearching = query.trim().length > 0
  const displayList = isSearching ? results : suggested
  const isLoading   = isSearching ? loadingSearch : loadingSug

  const renderItem = useCallback(({ item }: ListRenderItemInfo<UserResult>) => (
    <UserRow
      user={item}
      followed={followed.has(item.id)}
      loadingFollow={followPending.has(item.id)}
      onFollow={(duration) => handleFollow(item.id, duration)}
      onPress={() => nav.navigate('Profile', { userId: item.id })}
    />
  ), [followed, followPending, handleFollow, nav])

  return (
    <View style={[s.screen, { paddingTop: top }]}>

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <View style={s.header}>
        <TouchableOpacity
          onPress={() => nav.goBack()}
          style={s.backBtn}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Ionicons name="chevron-back" size={24} color={colors.gray800} />
        </TouchableOpacity>

        <View style={s.searchBar}>
          <Ionicons name="search-outline" size={16} color={colors.gray400} />
          <TextInput
            ref={inputRef}
            style={s.searchInput}
            placeholder={t.search_ph}
            placeholderTextColor={colors.gray400}
            value={query}
            onChangeText={setQuery}
            autoFocus
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
      </View>

      {/* ── Section label ──────────────────────────────────────────────────── */}
      <View style={s.sectionRow}>
        <Text style={s.sectionLabel}>
          {isSearching ? t.search_results : t.search_suggested}
        </Text>
        {isSearching && !loadingSearch && (
          <Text style={s.sectionCount}>{results.length}</Text>
        )}
      </View>

      {/* ── Skeleton only when no cached data yet ──────────────────────────── */}
      {isLoading && !isSearching && suggested.length === 0 && (
        <View>
          {[0, 1, 2, 3, 4].map((i) => <SkeletonRow key={i} />)}
        </View>
      )}

      {/* ── Search spinner ──────────────────────────────────────────────────── */}
      {isLoading && isSearching && (
        <View style={s.spinnerWrap}>
          <ActivityIndicator color={colors.primary} />
        </View>
      )}

      {/* ── Empty state ─────────────────────────────────────────────────────── */}
      {!isLoading && isSearching && results.length === 0 && (
        <View style={s.emptyWrap}>
          <View style={s.emptyIcon}>
            <Ionicons name="search-outline" size={32} color={colors.gray400} />
          </View>
          <Text style={s.emptyTitle}>{t.search_no_results}</Text>
          <Text style={s.emptySub}>{t.search_no_results_sub}</Text>
        </View>
      )}

      {!isLoading && !isSearching && suggested.length === 0 && (
        <View style={s.emptyWrap}>
          <View style={s.emptyIcon}>
            <Ionicons name="people-outline" size={32} color={colors.gray400} />
          </View>
          <Text style={s.emptyTitle}>{t.search_no_suggestions}</Text>
          <Text style={s.emptySub}>{t.search_no_suggestions_sub}</Text>
        </View>
      )}

      {/* ── List — show even while loading if cache exists ──────────────────── */}
      {displayList.length > 0 && (
        <FlatList
          data={displayList}
          keyExtractor={(u) => u.id}
          renderItem={renderItem}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={s.listContent}
          keyboardShouldPersistTaps="handled"
          ItemSeparatorComponent={() => <View style={s.separator} />}
        />
      )}
    </View>
  )
}

// ── Styles ─────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.white },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 12,
    gap: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.gray200,
  },
  backBtn: { padding: 2 },
  searchBar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.gray100,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    fontFamily: fonts.regular,
    color: colors.gray800,
    padding: 0,
  },

  // Section
  sectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 8,
    gap: 8,
  },
  sectionLabel: {
    fontSize: 12,
    fontFamily: fonts.semiBold,
    color: colors.gray400,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  sectionCount: {
    fontSize: 12,
    fontFamily: fonts.semiBold,
    color: colors.primary,
    backgroundColor: `${colors.primary}15`,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 10,
  },

  // List
  listContent: { paddingBottom: 40 },
  separator:   { height: StyleSheet.hairlineWidth, backgroundColor: colors.gray200, marginLeft: 84 },

  // Row
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    gap: 12,
  },
  rowLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minWidth: 0,
  },
  rowInfo: { flex: 1, minWidth: 0 },
  rowName: {
    fontSize: 15,
    fontFamily: fonts.semiBold,
    color: colors.gray800,
    letterSpacing: -0.2,
  },
  rowSub: {
    fontSize: 13,
    fontFamily: fonts.regular,
    color: colors.gray400,
    marginTop: 2,
  },

  // Skeleton
  skeletonAvatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: colors.gray200 },
  skeletonInfo:   { flex: 1, gap: 6 },
  skeletonName:   { width: '55%', height: 14, borderRadius: 7, backgroundColor: colors.gray200 },
  skeletonSub:    { width: '35%', height: 11, borderRadius: 6, backgroundColor: colors.gray100 },
  skeletonBtn:    { width: 84, height: 34, borderRadius: 20, backgroundColor: colors.gray200 },

  // States
  spinnerWrap: { flex: 1, alignItems: 'center', paddingTop: 60 },
  emptyWrap:   { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, paddingBottom: 80 },
  emptyIcon:   {
    width: 64, height: 64, borderRadius: 32,
    backgroundColor: colors.gray100,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 4,
  },
  emptyTitle: { fontSize: 16, fontFamily: fonts.semiBold, color: colors.gray800 },
  emptySub:   { fontSize: 14, fontFamily: fonts.regular, color: colors.gray400, textAlign: 'center', paddingHorizontal: 40 },
})
