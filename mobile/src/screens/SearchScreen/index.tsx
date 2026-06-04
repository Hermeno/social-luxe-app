import React, { useState, useEffect, useRef, useCallback } from 'react'
import {
  View, Text, TextInput, FlatList, TouchableOpacity, Pressable,
  StyleSheet, ActivityIndicator, ListRenderItemInfo,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useNavigation } from '@react-navigation/native'
import { StackNavigationProp } from '@react-navigation/stack'
import { Ionicons } from '@expo/vector-icons'
import * as Haptics from 'expo-haptics'
import Toast from 'react-native-toast-message'
import { api } from '../../services/api'
import { AppStackParams } from '../../navigation/AppNavigator'
import { colors, fonts } from '../../theme'
import { toggleFollow } from '../../services/follow.service'
import AvatarImage from '../../components/AvatarImage'

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
  onFollow: () => void
  onPress: () => void
}

function UserRow({ user, followed, loadingFollow, onFollow, onPress }: RowProps) {
  const sub = user.bio?.trim()
    || (user._count?.followers ? `${fmtCount(user._count.followers)} seguidores` : null)

  return (
    <View style={s.row}>
      {/* Left: avatar + info → navigate to profile */}
      <TouchableOpacity style={s.rowLeft} onPress={onPress} activeOpacity={0.7}>
        <AvatarImage uri={user.avatar} size={48} />
        <View style={s.rowInfo}>
          <Text style={s.rowName} numberOfLines={1}>{user.name}</Text>
          {!!sub && <Text style={s.rowSub} numberOfLines={1}>{sub}</Text>}
        </View>
      </TouchableOpacity>

      {/* Right: follow button — sibling, NOT nested in the touchable */}
      <Pressable
        onPress={onFollow}
        disabled={loadingFollow}
        style={({ pressed }) => [
          s.followBtn,
          followed && s.followingBtn,
          pressed && s.followBtnPressed,
        ]}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        {loadingFollow
          ? <ActivityIndicator size="small" color={followed ? colors.primary : colors.white} />
          : <Text style={[s.followBtnText, followed && s.followingBtnText]}>
              {followed ? 'A seguir' : 'Seguir'}
            </Text>
        }
      </Pressable>
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

  const [query,         setQuery]         = useState('')
  const [results,       setResults]       = useState<UserResult[]>([])
  const [suggested,     setSuggested]     = useState<UserResult[]>([])
  const [loadingSug,    setLoadingSug]    = useState(true)
  const [loadingSearch, setLoadingSearch] = useState(false)
  const [followed,      setFollowed]      = useState<Set<string>>(new Set())
  const [followPending, setFollowPending] = useState<Set<string>>(new Set())

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const inputRef    = useRef<TextInput>(null)

  // Load suggestions once
  useEffect(() => {
    api.get('/users/suggested')
      .then((r) => setSuggested(r.data.data ?? r.data))
      .catch(() => {})
      .finally(() => setLoadingSug(false))
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

  const handleFollow = useCallback(async (userId: string) => {
    if (followPending.has(userId)) return
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)

    // Optimistic update — flip state immediately so UI responds at once
    const wasFollowed = followed.has(userId)
    setFollowed((prev) => {
      const next = new Set(prev)
      wasFollowed ? next.delete(userId) : next.add(userId)
      return next
    })
    setFollowPending((prev) => new Set([...prev, userId]))

    try {
      const res = await toggleFollow(userId)
      // Reconcile with server truth
      setFollowed((prev) => {
        const next = new Set(prev)
        res.following ? next.add(userId) : next.delete(userId)
        return next
      })
    } catch {
      // Rollback optimistic update
      setFollowed((prev) => {
        const next = new Set(prev)
        wasFollowed ? next.add(userId) : next.delete(userId)
        return next
      })
      Toast.show({ type: 'error', text1: 'Sem ligação', text2: 'Não foi possível seguir.', visibilityTime: 2500 })
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
      onFollow={() => handleFollow(item.id)}
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
            placeholder="Pesquisar pessoas..."
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
          {isSearching ? 'Resultados' : 'Sugeridos para ti'}
        </Text>
        {isSearching && !loadingSearch && (
          <Text style={s.sectionCount}>{results.length}</Text>
        )}
      </View>

      {/* ── Skeleton while loading suggestions ─────────────────────────────── */}
      {isLoading && !isSearching && (
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
          <Text style={s.emptyTitle}>Nenhum resultado</Text>
          <Text style={s.emptySub}>Tenta pesquisar por outro nome</Text>
        </View>
      )}

      {!isLoading && !isSearching && suggested.length === 0 && (
        <View style={s.emptyWrap}>
          <View style={s.emptyIcon}>
            <Ionicons name="people-outline" size={32} color={colors.gray400} />
          </View>
          <Text style={s.emptyTitle}>Sem sugestões</Text>
          <Text style={s.emptySub}>Usa a pesquisa para encontrar pessoas</Text>
        </View>
      )}

      {/* ── List ────────────────────────────────────────────────────────────── */}
      {!isLoading && displayList.length > 0 && (
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

  // Follow button
  followBtn: {
    paddingHorizontal: 18,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: colors.primary,
    minWidth: 84,
    alignItems: 'center',
    justifyContent: 'center',
  },
  followingBtn: {
    backgroundColor: colors.white,
    borderWidth: 1.5,
    borderColor: colors.gray200,
  },
  followBtnPressed: { opacity: 0.7 },
  followBtnText: {
    fontSize: 13,
    fontFamily: fonts.semiBold,
    color: colors.white,
    letterSpacing: -0.1,
  },
  followingBtnText: { color: colors.gray600 },

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
