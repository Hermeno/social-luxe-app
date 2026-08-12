import React, { useCallback, useEffect, useState } from 'react'
import {
  View, Text, StyleSheet, TouchableOpacity, FlatList, ActivityIndicator,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native'
import type { StackNavigationProp } from '@react-navigation/stack'

import AvatarImage from '../../components/AvatarImage'
import FollowSplitButton from '../../components/FollowSplitButton'
import * as followService from '../../services/follow.service'
import { getCache, setCache } from '../../db/database'
import { isConnected } from '../../services/netinfo.service'
import { useAuthStore } from '../../store/auth.store'
import { useFollowStore } from '../../store/follow.store'
import type { AppStackParams } from '../../navigation/AppNavigator'
import { colors, fonts } from '../../theme'
import { useT } from '../../i18n'

type Tab = 'followers' | 'following'
type Nav = StackNavigationProp<AppStackParams>
type Rt = RouteProp<AppStackParams, 'Followers'>

// ─── Uma conta na lista ───────────────────────────────────────────────────────
function UserRow({ user, onOpen }: { user: followService.FollowUser; onOpen: () => void }) {
  const myId      = useAuthStore((s) => s.user?.id)
  const following = useFollowStore((s) => s.followingIds.has(user.id))
  const [loading, setLoading] = useState(false)

  async function handleFollow(duration: followService.FollowDuration) {
    if (loading) return
    setLoading(true)
    try {
      await useFollowStore.getState().toggle(user.id, duration, { name: user.name, avatar: user.avatar })
    } catch {}
    setLoading(false)
  }

  return (
    <View style={s.row}>
      <TouchableOpacity
        style={s.rowProfile}
        onPress={onOpen}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityLabel={user.name}
      >
        <AvatarImage uri={user.avatar} name={user.name} size={46} />
        <View style={s.rowInfo}>
          <Text style={s.rowName} numberOfLines={1}>{user.name}</Text>
          {!!(user.username || user.bio) && (
            <Text style={s.rowSub} numberOfLines={1}>
              {user.username ? `@${user.username}` : user.bio}
            </Text>
          )}
        </View>
      </TouchableOpacity>

      {/* Não faz sentido seguires-te a ti próprio. */}
      {user.id !== myId && (
        <FollowSplitButton
          following={following}
          loading={loading}
          onFollow={handleFollow}
          theme="light"
          variant="list"
        />
      )}
    </View>
  )
}

// ─── Página ───────────────────────────────────────────────────────────────────
export default function FollowersScreen() {
  const nav   = useNavigation<Nav>()
  const route = useRoute<Rt>()
  const t     = useT()
  const { top, bottom } = useSafeAreaInsets()

  const myId    = useAuthStore((s) => s.user?.id)
  const userId  = route.params?.userId ?? myId
  const isOwn   = !route.params?.userId || route.params.userId === myId

  const [tab, setTab] = useState<Tab>(route.params?.mode ?? 'followers')
  const [followers, setFollowers] = useState<followService.FollowUser[]>([])
  const [following, setFollowing] = useState<followService.FollowUser[]>([])
  const [loading, setLoading]     = useState(true)

  // As mesmas chaves que o ProfileScreen já escreve — sem inventar cache nova.
  const cacheKeys = isOwn
    ? { followers: 'my_followers', following: 'my_following' }
    : { followers: `followers:${userId}`, following: `following:${userId}` }

  const load = useCallback(async () => {
    if (!userId) return

    // Primeiro o que já está no disco: a lista aparece sem rede nenhuma.
    const [cachedFol, cachedFng] = await Promise.all([
      getCache<followService.FollowUser[]>(cacheKeys.followers).catch(() => null),
      getCache<followService.FollowUser[]>(cacheKeys.following).catch(() => null),
    ])
    if (cachedFol) setFollowers(cachedFol)
    if (cachedFng) setFollowing(cachedFng)
    if (cachedFol || cachedFng) setLoading(false)

    if (!isConnected()) {
      setLoading(false)
      return
    }

    // Depois a rede, para atualizar. As duas listas de uma vez: alternar
    // separador passa a ser instantâneo, em vez de disparar um pedido novo.
    const [fol, fng] = await Promise.allSettled(
      isOwn
        ? [followService.getMyFollowers(), followService.getMyFollowing()]
        : [followService.getUserFollowers(userId), followService.getUserFollowing(userId)],
    )
    if (fol.status === 'fulfilled') {
      setFollowers(fol.value)
      setCache(cacheKeys.followers, fol.value).catch(() => {})
    }
    if (fng.status === 'fulfilled') {
      setFollowing(fng.value)
      setCache(cacheKeys.following, fng.value).catch(() => {})
    }
    setLoading(false)
  }, [cacheKeys.followers, cacheKeys.following, isOwn, userId])

  useEffect(() => { load() }, [load])

  const data  = tab === 'followers' ? followers : following
  const title = route.params?.name ?? (isOwn ? t.nav_my_network : t.profile_followers)

  const emptyText = tab === 'followers'
    ? t.friends_no_followers
    : t.friends_no_following

  return (
    <View style={s.screen}>
      <View style={[s.header, { paddingTop: top + 8 }]}>
        <TouchableOpacity
          onPress={() => nav.goBack()}
          style={s.back}
          hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}
          accessibilityRole="button"
          accessibilityLabel={t.back}
        >
          <Ionicons name="chevron-back" size={20} color={colors.gray800} />
        </TouchableOpacity>
        <Text style={s.headerTitle} numberOfLines={1}>{title}</Text>
      </View>

      {/* Separadores — a contagem fica no rótulo para se ver sem trocar de aba. */}
      <View style={s.tabs}>
        {(['followers', 'following'] as Tab[]).map((key) => {
          const active = tab === key
          const count  = key === 'followers' ? followers.length : following.length
          const label  = key === 'followers' ? t.profile_followers : t.profile_following
          return (
            <TouchableOpacity
              key={key}
              style={s.tab}
              onPress={() => setTab(key)}
              activeOpacity={0.75}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
              accessibilityLabel={`${label}, ${count}`}
            >
              <Text style={[s.tabLabel, active && s.tabLabelOn]}>
                {label}{!loading && ` · ${count}`}
              </Text>
              <View style={[s.tabRule, active && s.tabRuleOn]} />
            </TouchableOpacity>
          )
        })}
      </View>

      {loading ? (
        <ActivityIndicator color={colors.primary} style={{ marginTop: 56 }} />
      ) : (
        <FlatList
          data={data}
          keyExtractor={(u) => u.id}
          renderItem={({ item }) => (
            <UserRow user={item} onOpen={() => nav.push('Profile', { userId: item.id })} />
          )}
          contentContainerStyle={[s.list, { paddingBottom: bottom + 24 }]}
          showsVerticalScrollIndicator={false}
          ItemSeparatorComponent={() => <View style={s.sep} />}
          ListEmptyComponent={<Text style={s.empty}>{emptyText}</Text>}
        />
      )}
    </View>
  )
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.white },

  header: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 12, paddingBottom: 10,
  },
  back: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center' },
  headerTitle: {
    flex: 1,
    fontSize: 17, fontFamily: fonts.bold, color: colors.gray800, letterSpacing: -0.3,
  },

  tabs: {
    flexDirection: 'row',
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.gray200,
  },
  tab: { flex: 1, alignItems: 'center', paddingTop: 6, gap: 8 },
  tabLabel: {
    fontSize: 14, fontFamily: fonts.semiBold, color: colors.gray400, letterSpacing: -0.2,
  },
  tabLabelOn: { color: colors.gray800 },
  tabRule: { height: 2, width: '100%', backgroundColor: 'transparent' },
  tabRuleOn: { backgroundColor: colors.gray800 },

  list: { paddingHorizontal: 18, paddingTop: 6 },
  sep:  { height: 1, backgroundColor: '#F4F4F6', marginLeft: 60 },

  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 11 },
  rowProfile: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 12 },
  rowInfo: { flex: 1, minWidth: 0 },
  rowName: { fontSize: 15, fontFamily: fonts.semiBold, color: colors.gray800, letterSpacing: -0.2 },
  rowSub:  { fontSize: 12.5, fontFamily: fonts.regular, color: colors.gray400, marginTop: 1 },

  empty: {
    textAlign: 'center', marginTop: 48,
    fontSize: 14, fontFamily: fonts.regular, color: colors.gray400,
  },
})
