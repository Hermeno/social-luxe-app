import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ActivityIndicator,
  Animated,
  FlatList,
  Modal,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { useNavigation } from '@react-navigation/native'
import type { StackNavigationProp } from '@react-navigation/stack'
import type { AppStackParams } from '../../navigation/AppNavigator'
import { colors, fonts } from '../../theme'
import AvatarImage from '../../components/AvatarImage'
import FollowSplitButton from '../../components/FollowSplitButton'
import type { FollowDuration } from '../../components/FollowSplitButton'
import * as followService from '../../services/follow.service'
import type { FollowUser } from '../../services/follow.service'
import { useAuthStore } from '../../store/auth.store'
import { useFollowStore } from '../../store/follow.store'
import { getCache, setCache } from '../../db/database'
import { isConnected } from '../../services/netinfo.service'
import { toast } from '../../utils/toast'
import { useT } from '../../i18n'
import useReducedMotionPreference from '../../hooks/useReducedMotionPreference'
import { displayHandle } from '../../utils/handle'

type Mode = 'followers' | 'following'
type Nav = StackNavigationProp<AppStackParams>
type Lists = Record<Mode, FollowUser[]>
type Flags = Record<Mode, boolean>

interface Props {
  visible: boolean
  mode: Mode
  userId: string
  followerCount?: number
  followingCount?: number
  onClose: () => void
  onOwnFollowingChange?: (users: FollowUser[]) => void
  onCountChange?: (mode: Mode, count: number) => void
}

const EMPTY_LISTS: Lists = { followers: [], following: [] }
const EMPTY_FLAGS: Flags = { followers: false, following: false }

function openProfileOnStack(navigation: Nav, userId: string) {
  const stack = navigation.getState().type === 'stack'
    ? navigation
    : navigation.getParent<Nav>()
  if (stack?.getState().type !== 'stack') return
  stack.push('Profile', { userId })
}

function cacheKey(mode: Mode, ownProfile: boolean, userId: string): string {
  if (ownProfile) return mode === 'followers' ? 'my_followers' : 'my_following'
  return `${mode}:${userId}`
}

function requestList(mode: Mode, ownProfile: boolean, userId: string): Promise<FollowUser[]> {
  if (ownProfile) {
    return mode === 'followers'
      ? followService.getMyFollowers()
      : followService.getMyFollowing()
  }
  return mode === 'followers'
    ? followService.getUserFollowers(userId)
    : followService.getUserFollowing(userId)
}

function normalizeSearch(value: string | null | undefined): string {
  return (value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase()
    .trim()
}

function compactCount(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1).replace('.0', '')}M`
  if (value >= 10_000) return `${Math.round(value / 1_000)}K`
  if (value >= 1_000) return `${(value / 1_000).toFixed(1).replace('.0', '')}K`
  return String(Math.max(0, value))
}

function PeopleSkeleton({ reduceMotion, label }: { reduceMotion: boolean; label: string }) {
  const pulse = useRef(new Animated.Value(reduceMotion ? 0.68 : 0.42)).current

  useEffect(() => {
    if (reduceMotion) {
      pulse.setValue(0.68)
      return
    }
    const animation = Animated.loop(Animated.sequence([
      Animated.timing(pulse, { toValue: 0.78, duration: 620, useNativeDriver: true }),
      Animated.timing(pulse, { toValue: 0.42, duration: 620, useNativeDriver: true }),
    ]))
    animation.start()
    return () => animation.stop()
  }, [pulse, reduceMotion])

  return (
    <View
      style={s.skeletonList}
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={label}
    >
      {Array.from({ length: 7 }).map((_, index) => (
        <Animated.View key={index} style={[s.skeletonRow, { opacity: pulse }]}>
          <View style={s.skeletonAvatar} />
          <View style={s.skeletonCopy}>
            <View style={[s.skeletonLine, { width: index % 2 === 0 ? '48%' : '39%' }]} />
            <View style={[s.skeletonLine, s.skeletonLineSmall, { width: index % 3 === 0 ? '66%' : '55%' }]} />
          </View>
          <View style={s.skeletonButton} />
        </Animated.View>
      ))}
    </View>
  )
}

export default function FollowersSheet({
  visible,
  mode,
  userId,
  followerCount = 0,
  followingCount = 0,
  onClose,
  onOwnFollowingChange,
  onCountChange,
}: Props) {
  const nav = useNavigation<Nav>()
  const t = useT()
  const reduceMotion = useReducedMotionPreference()
  const myId = useAuthStore((state) => state.user?.id ?? null)
  const followingIds = useFollowStore((state) => state.followingIds)
  const followingLoaded = useFollowStore((state) => state.loaded)
  const ownProfile = Boolean(myId && myId === userId)
  const targetSignature = `${ownProfile ? 'own' : 'other'}:${userId}`

  const [activeMode, setActiveMode] = useState<Mode>(mode)
  const [query, setQuery] = useState('')
  const [lists, setLists] = useState<Lists>(EMPTY_LISTS)
  const [ready, setReady] = useState<Flags>(EMPTY_FLAGS)
  const [failed, setFailed] = useState<Flags>(EMPTY_FLAGS)
  const [refreshingMode, setRefreshingMode] = useState<Mode | null>(null)
  const [retryingMode, setRetryingMode] = useState<Mode | null>(null)
  const [pendingIds, setPendingIds] = useState<Set<string>>(() => new Set())

  const targetRef = useRef(targetSignature)
  const visibleRef = useRef(visible)
  const requestVersions = useRef<Record<Mode, number>>({ followers: 0, following: 0 })
  const onOwnFollowingChangeRef = useRef(onOwnFollowingChange)
  const onCountChangeRef = useRef(onCountChange)
  const listsRef = useRef<Lists>(EMPTY_LISTS)
  const mutationGenerationRef = useRef(0)

  useEffect(() => { onOwnFollowingChangeRef.current = onOwnFollowingChange }, [onOwnFollowingChange])
  useEffect(() => { onCountChangeRef.current = onCountChange }, [onCountChange])
  useEffect(() => { visibleRef.current = visible }, [visible])
  useEffect(() => { targetRef.current = targetSignature }, [targetSignature])
  useEffect(() => { mutationGenerationRef.current += 1 }, [myId, targetSignature, visible])

  const setModeList = useCallback((listMode: Mode, users: FollowUser[]) => {
    setLists((current) => {
      const next = { ...current, [listMode]: users }
      listsRef.current = next
      return next
    })
  }, [])

  const fetchMode = useCallback(async (
    listMode: Mode,
    reason: 'background' | 'refresh' | 'retry' = 'background',
  ) => {
    const requestVersion = ++requestVersions.current[listMode]
    const signature = targetSignature
    if (reason === 'refresh') setRefreshingMode(listMode)
    if (reason === 'retry') setRetryingMode(listMode)
    const followRevision = ownProfile && listMode === 'following'
      ? useFollowStore.getState().getRevision()
      : 0

    try {
      if (!isConnected()) throw new Error('offline')
      const users = await requestList(listMode, ownProfile, userId)
      if (
        !visibleRef.current
        || targetRef.current !== signature
        || requestVersions.current[listMode] !== requestVersion
      ) return

      let resolvedUsers = users
      if (ownProfile && listMode === 'following') {
        const followStore = useFollowStore.getState()
        followStore.reconcileSnapshot(users.map((user) => user.id), followRevision)

        // A resposta pode ter sido iniciada antes de um follow/unfollow. Nesse
        // caso, a store já preservou a decisão mais recente; a lista visível e
        // o cache precisam refletir exatamente o mesmo conjunto de IDs.
        if (!followStore.isRevisionCurrent(followRevision)) {
          const currentIds = useFollowStore.getState().followingIds
          const serverUsers = users.filter((user) => currentIds.has(user.id))
          const serverIds = new Set(serverUsers.map((user) => user.id))
          resolvedUsers = [
            ...serverUsers,
            ...listsRef.current.following.filter((user) => (
              currentIds.has(user.id) && !serverIds.has(user.id)
            )),
          ]
        }
      }
      setModeList(listMode, resolvedUsers)
      const resolvedCount = ownProfile && listMode === 'following'
        ? useFollowStore.getState().followingIds.size
        : resolvedUsers.length
      onCountChangeRef.current?.(listMode, resolvedCount)
      setReady((current) => ({ ...current, [listMode]: true }))
      setFailed((current) => ({ ...current, [listMode]: false }))
      setCache(cacheKey(listMode, ownProfile, userId), resolvedUsers).catch(() => {})
      if (ownProfile && listMode === 'following') onOwnFollowingChangeRef.current?.(resolvedUsers)
    } catch {
      if (
        !visibleRef.current
        || targetRef.current !== signature
        || requestVersions.current[listMode] !== requestVersion
      ) return
      setReady((current) => ({ ...current, [listMode]: true }))
      setFailed((current) => ({ ...current, [listMode]: true }))
    } finally {
      if (targetRef.current === signature && requestVersions.current[listMode] === requestVersion) {
        setRefreshingMode((current) => current === listMode ? null : current)
        setRetryingMode((current) => current === listMode ? null : current)
      }
    }
  }, [ownProfile, setModeList, targetSignature, userId])

  useEffect(() => {
    if (!visible) return

    let active = true
    const signature = targetSignature
    requestVersions.current.followers += 1
    requestVersions.current.following += 1
    setActiveMode(mode)
    setQuery('')
    listsRef.current = EMPTY_LISTS
    setLists(EMPTY_LISTS)
    setReady(EMPTY_FLAGS)
    setFailed(EMPTY_FLAGS)
    setRefreshingMode(null)
    setRetryingMode(null)
    setPendingIds(new Set())

    async function hydrate() {
      const [cachedFollowers, cachedFollowing] = await Promise.all([
        getCache<FollowUser[]>(cacheKey('followers', ownProfile, userId)).catch(() => null),
        getCache<FollowUser[]>(cacheKey('following', ownProfile, userId)).catch(() => null),
      ])
      if (!active || targetRef.current !== signature) return

      const cachedLists: Lists = {
        followers: cachedFollowers ?? [],
        following: cachedFollowing ?? [],
      }
      listsRef.current = cachedLists
      setLists(cachedLists)
      setReady({
        followers: cachedFollowers !== null,
        following: cachedFollowing !== null,
      })
      void fetchMode('followers')
      void fetchMode('following')
    }

    void hydrate()
    return () => {
      active = false
      requestVersions.current.followers += 1
      requestVersions.current.following += 1
    }
  }, [fetchMode, mode, ownProfile, targetSignature, userId, visible])

  useEffect(() => {
    if (visible) setActiveMode(mode)
  }, [mode, visible])

  const activeUsers = lists[activeMode]
  const normalizedQuery = normalizeSearch(query)
  const filteredUsers = useMemo(() => {
    if (!normalizedQuery) return activeUsers
    return activeUsers.filter((user) => normalizeSearch([
      user.name,
      user.username,
      user.bio,
    ].filter(Boolean).join(' ')).includes(normalizedQuery))
  }, [activeUsers, normalizedQuery])

  const tabCounts: Record<Mode, number> = {
    followers: ready.followers && !(failed.followers && lists.followers.length === 0)
      ? lists.followers.length
      : followerCount,
    following: ready.following && !(failed.following && lists.following.length === 0)
      ? lists.following.length
      : followingCount,
  }

  function handleUserPress(user: FollowUser) {
    onClose()
    openProfileOnStack(nav, user.id)
  }

  async function handleFollow(user: FollowUser, duration: FollowDuration) {
    if (!myId || user.id === myId || pendingIds.has(user.id) || !useFollowStore.getState().loaded) return
    const signature = targetSignature
    const sessionId = myId
    const mutationGeneration = mutationGenerationRef.current
    setPendingIds((current) => new Set(current).add(user.id))
    if (ownProfile) requestVersions.current.following += 1

    try {
      const nowFollowing = await useFollowStore.getState().toggle(user.id, duration, {
        name: user.name,
        avatar: user.avatar,
      })

      if (
        !visibleRef.current
        || targetRef.current !== signature
        || useAuthStore.getState().user?.id !== sessionId
        || mutationGenerationRef.current !== mutationGeneration
      ) return

      if (ownProfile) {
        const current = listsRef.current
        const alreadyListed = current.following.some((item) => item.id === user.id)
        const nextFollowing = nowFollowing
          ? alreadyListed
            ? current.following
            : [{ ...user, followedAt: new Date().toISOString() }, ...current.following]
          : current.following.filter((item) => item.id !== user.id)
        const next = { ...current, following: nextFollowing }
        listsRef.current = next
        setLists(next)
        setCache('my_following', nextFollowing).catch(() => {})
        onOwnFollowingChangeRef.current?.(nextFollowing)
        setReady((current) => ({ ...current, following: true }))
        setFailed((current) => ({ ...current, following: false }))
        // O primeiro carregamento de "Seguindo" pode ainda estar em voo quando
        // a ação parte da aba Seguidores. Uma leitura iniciada depois do toggle
        // recompõe a lista completa sem perder as restantes relações.
        void fetchMode('following')
      }
    } catch {
      if (
        visibleRef.current
        && targetRef.current === signature
        && useAuthStore.getState().user?.id === sessionId
        && mutationGenerationRef.current === mutationGeneration
      ) toast.error(t.follow_err)
    } finally {
      if (
        visibleRef.current
        && targetRef.current === signature
        && useAuthStore.getState().user?.id === sessionId
        && mutationGenerationRef.current === mutationGeneration
      ) {
        setPendingIds((current) => {
          const next = new Set(current)
          next.delete(user.id)
          return next
        })
      }
    }
  }

  function switchMode(nextMode: Mode) {
    if (nextMode === activeMode) return
    setActiveMode(nextMode)
    setQuery('')
  }

  function renderEmpty() {
    if (failed[activeMode] && activeUsers.length === 0 && !normalizedQuery) {
      return (
        <View style={s.emptyState}>
          <Ionicons name="cloud-offline-outline" size={34} color={colors.gray300} />
          <Text style={s.emptyTitle}>{t.followers_sheet_load_error}</Text>
          <TouchableOpacity
            style={s.retryButton}
            onPress={() => { void fetchMode(activeMode, 'retry') }}
            disabled={retryingMode === activeMode}
            accessibilityRole="button"
            accessibilityLabel={t.msg_try_again}
          >
            {retryingMode === activeMode
              ? <ActivityIndicator size="small" color={colors.primary} />
              : <Text style={s.retryText}>{t.msg_try_again}</Text>}
          </TouchableOpacity>
        </View>
      )
    }

    if (normalizedQuery) {
      return (
        <View style={s.emptyState}>
          <Ionicons name="search-outline" size={34} color={colors.gray300} />
          <Text style={s.emptyTitle}>{t.search_no_results}</Text>
          <Text style={s.emptyBody}>{t.search_no_results_sub}</Text>
        </View>
      )
    }

    return (
      <View style={s.emptyState}>
        <Ionicons
          name={activeMode === 'followers' ? 'people-outline' : 'person-add-outline'}
          size={34}
          color={colors.gray300}
        />
        <Text style={s.emptyTitle}>
          {activeMode === 'followers' ? t.friends_no_followers : t.friends_no_following}
        </Text>
      </View>
    )
  }

  return (
    <Modal
      visible={visible}
      animationType={reduceMotion ? 'none' : 'slide'}
      onRequestClose={onClose}
      presentationStyle="pageSheet"
      allowSwipeDismissal
    >
      <SafeAreaView style={s.container} accessibilityViewIsModal>
        <View style={s.handle} />

        <View style={s.header}>
          <View style={s.headerSide} />
          <Text style={s.title}>{t.friends_title}</Text>
          <TouchableOpacity
            style={s.closeButton}
            onPress={onClose}
            hitSlop={{ top: 6, right: 6, bottom: 6, left: 6 }}
            accessibilityRole="button"
            accessibilityLabel={t.circle_close}
          >
            <Ionicons name="close" size={23} color={colors.gray800} />
          </TouchableOpacity>
        </View>

        <View style={s.tabs}>
          {(['followers', 'following'] as Mode[]).map((tabMode) => {
            const selected = activeMode === tabMode
            const label = tabMode === 'followers' ? t.profile_followers : t.profile_following
            return (
              <TouchableOpacity
                key={tabMode}
                style={s.tab}
                onPress={() => switchMode(tabMode)}
                activeOpacity={0.65}
                accessibilityRole="tab"
                accessibilityState={{ selected }}
                accessibilityLabel={`${label}, ${tabCounts[tabMode]}`}
              >
                <View style={s.tabLabelRow}>
                  <Text style={[s.tabText, selected && s.tabTextActive]}>{label}</Text>
                  <Text style={[s.tabCount, selected && s.tabCountActive]}>{compactCount(tabCounts[tabMode])}</Text>
                </View>
                {selected ? <View style={s.tabIndicator} /> : null}
              </TouchableOpacity>
            )
          })}
        </View>

        <View style={s.searchField}>
          <Ionicons name="search-outline" size={19} color={colors.gray500} />
          <TextInput
            style={s.searchInput}
            value={query}
            onChangeText={setQuery}
            placeholder={t.friends_search_ph}
            placeholderTextColor={colors.gray400}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="search"
            accessibilityLabel={t.friends_search_ph}
          />
          {query.length > 0 ? (
            <TouchableOpacity
              style={s.clearButton}
              onPress={() => setQuery('')}
              hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}
              accessibilityRole="button"
              accessibilityLabel={t.followers_sheet_clear_search}
            >
              <Ionicons name="close-circle" size={19} color={colors.gray400} />
            </TouchableOpacity>
          ) : null}
        </View>

        {!ready[activeMode] ? (
          <PeopleSkeleton reduceMotion={reduceMotion} label={t.msg_loading} />
        ) : (
          <FlatList
            data={filteredUsers}
            keyExtractor={(user) => user.id}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            contentContainerStyle={[s.listContent, filteredUsers.length === 0 && s.listContentEmpty]}
            refreshControl={(
              <RefreshControl
                refreshing={refreshingMode === activeMode}
                onRefresh={() => { void fetchMode(activeMode, 'refresh') }}
                tintColor={colors.primary}
                colors={[colors.primary]}
              />
            )}
            ListHeaderComponent={failed[activeMode] && activeUsers.length > 0 ? (
              <TouchableOpacity
                style={s.staleNotice}
                onPress={() => { void fetchMode(activeMode, 'retry') }}
                disabled={retryingMode === activeMode}
                accessibilityRole="button"
                accessibilityLabel={`${t.followers_sheet_stale} ${t.msg_try_again}`}
              >
                <Ionicons name="cloud-offline-outline" size={17} color={colors.gray500} />
                <Text style={s.staleText}>{t.followers_sheet_stale}</Text>
                {retryingMode === activeMode
                  ? <ActivityIndicator size="small" color={colors.primary} />
                  : <Text style={s.staleAction}>{t.msg_try_again}</Text>}
              </TouchableOpacity>
            ) : null}
            ItemSeparatorComponent={() => <View style={s.separator} />}
            ListEmptyComponent={renderEmpty}
            renderItem={({ item }) => {
              const following = followingIds.has(item.id)
              const showFollowButton = Boolean(myId && item.id !== myId)
              const secondary = [
                displayHandle(item.username),
                item.bio ?? '',
              ].filter(Boolean).join(' · ')
              return (
                <View style={s.row}>
                  <TouchableOpacity
                    style={s.profileHit}
                    onPress={() => handleUserPress(item)}
                    activeOpacity={0.68}
                    accessibilityRole="button"
                    accessibilityLabel={secondary ? `${item.name}, ${secondary}` : item.name}
                  >
                    <AvatarImage uri={item.avatar} name={item.name} size={48} />
                    <View style={s.info}>
                      <Text style={s.name} numberOfLines={1}>{item.name}</Text>
                      {secondary ? <Text style={s.secondary} numberOfLines={1}>{secondary}</Text> : null}
                    </View>
                  </TouchableOpacity>
                  {showFollowButton ? (
                    <View style={s.followSlot}>
                      <FollowSplitButton
                        following={following}
                        loading={pendingIds.has(item.id) || !followingLoaded}
                        onFollow={(duration) => { void handleFollow(item, duration) }}
                        followBack={ownProfile && activeMode === 'followers' && !following}
                        variant="list"
                      />
                    </View>
                  ) : null}
                </View>
              )
            }}
          />
        )}
      </SafeAreaView>
    </Modal>
  )
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.white },
  handle: {
    width: 34,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: 7,
    marginBottom: 5,
    backgroundColor: colors.gray300,
  },
  header: {
    height: 50,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerSide: { width: 40, height: 40 },
  title: { fontSize: 17, fontFamily: fonts.bold, color: colors.dark, letterSpacing: -0.25 },
  closeButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  tabs: {
    height: 49,
    flexDirection: 'row',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.gray200,
  },
  tab: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  tabLabelRow: { flexDirection: 'row', alignItems: 'baseline', gap: 6 },
  tabText: { fontSize: 14, fontFamily: fonts.medium, color: colors.gray500 },
  tabTextActive: { fontFamily: fonts.bold, color: colors.dark },
  tabCount: { fontSize: 12, fontFamily: fonts.medium, color: colors.gray400 },
  tabCountActive: { color: colors.gray600 },
  tabIndicator: {
    position: 'absolute',
    bottom: -StyleSheet.hairlineWidth,
    width: 42,
    height: 2,
    borderRadius: 1,
    backgroundColor: colors.primary,
  },
  searchField: {
    height: 44,
    marginHorizontal: 16,
    marginTop: 14,
    marginBottom: 6,
    paddingHorizontal: 13,
    borderRadius: 14,
    backgroundColor: colors.gray100,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
  },
  searchInput: {
    flex: 1,
    height: '100%',
    paddingVertical: 0,
    fontSize: 14,
    fontFamily: fonts.regular,
    color: colors.gray800,
  },
  clearButton: { width: 28, height: 36, alignItems: 'center', justifyContent: 'center' },
  listContent: { paddingTop: 4, paddingBottom: 24 },
  listContentEmpty: { flexGrow: 1 },
  row: {
    minHeight: 76,
    paddingLeft: 16,
    paddingRight: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  profileHit: {
    minWidth: 0,
    flex: 1,
    minHeight: 76,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  info: { minWidth: 0, flex: 1, justifyContent: 'center' },
  name: {
    fontSize: 15,
    lineHeight: 20,
    fontFamily: fonts.semiBold,
    color: colors.gray800,
    letterSpacing: -0.15,
  },
  secondary: {
    marginTop: 2,
    fontSize: 12.5,
    lineHeight: 17,
    fontFamily: fonts.regular,
    color: colors.gray500,
  },
  followSlot: { width: 120, flexShrink: 0, alignItems: 'flex-end', justifyContent: 'center' },
  separator: {
    height: StyleSheet.hairlineWidth,
    marginLeft: 76,
    backgroundColor: colors.gray100,
  },
  staleNotice: {
    minHeight: 38,
    marginHorizontal: 16,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.gray200,
  },
  staleText: { flex: 1, fontSize: 11.5, lineHeight: 16, fontFamily: fonts.regular, color: colors.gray500 },
  staleAction: { fontSize: 11.5, fontFamily: fonts.semiBold, color: colors.primary },
  emptyState: {
    flex: 1,
    minHeight: 250,
    paddingHorizontal: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: {
    marginTop: 12,
    textAlign: 'center',
    fontSize: 14,
    lineHeight: 20,
    fontFamily: fonts.semiBold,
    color: colors.gray600,
  },
  emptyBody: {
    marginTop: 4,
    textAlign: 'center',
    fontSize: 12.5,
    lineHeight: 18,
    fontFamily: fonts.regular,
    color: colors.gray400,
  },
  retryButton: { minHeight: 40, marginTop: 8, paddingHorizontal: 12, alignItems: 'center', justifyContent: 'center' },
  retryText: { fontSize: 13, fontFamily: fonts.semiBold, color: colors.primary },
  skeletonList: { paddingTop: 5 },
  skeletonRow: {
    height: 76,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  skeletonAvatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: colors.gray200 },
  skeletonCopy: { flex: 1, gap: 8 },
  skeletonLine: { height: 10, borderRadius: 5, backgroundColor: colors.gray200 },
  skeletonLineSmall: { height: 8, backgroundColor: colors.gray100 },
  skeletonButton: { width: 74, height: 34, borderRadius: 17, backgroundColor: colors.gray100 },
})
