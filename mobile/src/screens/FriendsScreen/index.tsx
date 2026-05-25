import React, { useEffect, useState, useCallback } from 'react'
import {
  View, Text, FlatList, StyleSheet, TextInput,
  TouchableOpacity, LayoutAnimation, Platform,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useFocusEffect, useNavigation } from '@react-navigation/native'
import { StackNavigationProp } from '@react-navigation/stack'
import { Ionicons } from '@expo/vector-icons'
import { colors, spacing, radius, fonts } from '../../theme'
import { useFriendsStore } from '../../store/friends.store'
import { getMyFollowers, getMyFollowing, toggleFollow, FollowUser } from '../../services/follow.service'
import { getAllUsers } from '../../services/user.service'
import AvatarImage from '../../components/AvatarImage'
import { AppStackParams } from '../../navigation/AppNavigator'

type Nav = StackNavigationProp<AppStackParams>
type Tab = 'discover' | 'following' | 'followers'

interface UserSummary { id: string; name: string; avatar: string | null; bio: string | null }

function UserRow({
  user,
  rightSlot,
}: {
  user: { id: string; name: string; avatar: string | null; bio?: string | null }
  rightSlot: React.ReactNode
}) {
  const nav = useNavigation<Nav>()
  return (
    <TouchableOpacity
      style={s.row}
      activeOpacity={0.75}
      onPress={() => nav.navigate('Profile', { userId: user.id })}
    >
      <AvatarImage uri={user.avatar} size={50} />
      <View style={s.info}>
        <Text style={s.name}>{user.name}</Text>
        {user.bio ? <Text style={s.bio} numberOfLines={1}>{user.bio}</Text> : null}
      </View>
      {rightSlot}
    </TouchableOpacity>
  )
}

function FollowButton({ userId, initialFollowing }: { userId: string; initialFollowing: boolean }) {
  const [following, setFollowing] = useState(initialFollowing)
  const [loading, setLoading]     = useState(false)

  async function toggle() {
    if (loading) return
    const prev = following
    setFollowing(!prev)
    setLoading(true)
    try {
      const res = await toggleFollow(userId)
      setFollowing(res.following)
    } catch {
      setFollowing(prev)
    } finally {
      setLoading(false)
    }
  }

  return (
    <TouchableOpacity
      style={[s.followBtn, following && s.followingBtn]}
      onPress={toggle}
      activeOpacity={0.75}
      disabled={loading}
    >
      <Text style={[s.followTxt, following && s.followingTxt]}>
        {following ? 'Seguindo' : 'Seguir'}
      </Text>
    </TouchableOpacity>
  )
}

export default function FriendsScreen() {
  const { top }  = useSafeAreaInsets()
  const nav      = useNavigation<Nav>()
  const { setFollowerCount, clearBadge } = useFriendsStore()

  const [tab, setTab]               = useState<Tab>('discover')
  const [query, setQuery]           = useState('')
  const [allUsers, setAllUsers]     = useState<UserSummary[]>([])
  const [followers, setFollowers]   = useState<FollowUser[]>([])
  const [following, setFollowing]   = useState<FollowUser[]>([])
  const [followingIds, setFollowingIds] = useState<Set<string>>(new Set())

  async function loadAll() {
    try {
      const [users, fwers, fwing] = await Promise.all([
        getAllUsers(),
        getMyFollowers(),
        getMyFollowing(),
      ])
      setAllUsers(users)
      setFollowers(fwers)
      setFollowing(fwing)
      setFollowingIds(new Set(fwing.map((u) => u.id)))
      setFollowerCount(fwers.length)
    } catch {}
  }

  useFocusEffect(useCallback(() => {
    loadAll()
    clearBadge()
  }, []))

  function switchTab(t: Tab) {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut)
    setTab(t)
    if (t === 'followers') clearBadge()
  }

  const filtered = allUsers.filter(
    (u) => u.name.toLowerCase().includes(query.toLowerCase()),
  )

  return (
    <View style={[s.container, { paddingTop: top }]}>
      <View style={s.headerRow}>
        <TouchableOpacity onPress={() => nav.goBack()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Ionicons name="chevron-back" size={28} color={colors.gray800} />
        </TouchableOpacity>
        <Text style={s.title}>Pessoas</Text>
      </View>

      {/* ── Tabs ── */}
      <View style={s.tabs}>
        {([
          { key: 'discover',  label: 'Descobrir' },
          { key: 'following', label: `Seguindo (${following.length})` },
          { key: 'followers', label: `Seguidores (${followers.length})` },
        ] as { key: Tab; label: string }[]).map(({ key, label }) => (
          <TouchableOpacity
            key={key}
            style={[s.tabBtn, tab === key && s.tabActive]}
            onPress={() => switchTab(key)}
          >
            <Text style={[s.tabTxt, tab === key && s.tabTxtActive]}>{label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {tab === 'discover' && (
        <TextInput
          style={s.search}
          placeholder="Buscar pessoas..."
          placeholderTextColor={colors.gray400}
          value={query}
          onChangeText={setQuery}
        />
      )}

      {tab === 'discover' && (
        <FlatList
          data={filtered}
          keyExtractor={(u) => u.id}
          showsVerticalScrollIndicator={false}
          ItemSeparatorComponent={() => <View style={s.sep} />}
          renderItem={({ item }) => (
            <UserRow
              user={item}
              rightSlot={<FollowButton userId={item.id} initialFollowing={followingIds.has(item.id)} />}
            />
          )}
          ListEmptyComponent={<Text style={s.empty}>Nenhum usuário encontrado</Text>}
        />
      )}

      {tab === 'following' && (
        <FlatList
          data={following}
          keyExtractor={(u) => u.id}
          showsVerticalScrollIndicator={false}
          ItemSeparatorComponent={() => <View style={s.sep} />}
          renderItem={({ item }) => (
            <UserRow
              user={item}
              rightSlot={<FollowButton userId={item.id} initialFollowing />}
            />
          )}
          ListEmptyComponent={
            <View style={s.emptyWrap}>
              <Ionicons name="person-add-outline" size={44} color={colors.gray200} />
              <Text style={s.empty}>Você ainda não segue ninguém</Text>
            </View>
          }
        />
      )}

      {tab === 'followers' && (
        <FlatList
          data={followers}
          keyExtractor={(u) => u.id}
          showsVerticalScrollIndicator={false}
          ItemSeparatorComponent={() => <View style={s.sep} />}
          renderItem={({ item }) => (
            <UserRow
              user={item}
              rightSlot={
                <FollowButton
                  userId={item.id}
                  initialFollowing={followingIds.has(item.id)}
                />
              }
            />
          )}
          ListEmptyComponent={
            <View style={s.emptyWrap}>
              <Ionicons name="people-outline" size={44} color={colors.gray200} />
              <Text style={s.empty}>Nenhum seguidor ainda</Text>
            </View>
          }
        />
      )}
    </View>
  )
}

const s = StyleSheet.create({
  container:  { flex: 1, backgroundColor: colors.white },
  headerRow:  { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: spacing.md, paddingTop: spacing.md, paddingBottom: spacing.sm, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: colors.gray200 },
  title:      { fontSize: 22, fontFamily: fonts.bold, color: colors.gray800 },

  tabs:        { flexDirection: 'row', paddingHorizontal: spacing.md, gap: 6, marginBottom: spacing.sm, flexWrap: 'wrap' },
  tabBtn:      { paddingHorizontal: 12, paddingVertical: 7, borderRadius: radius.full, borderWidth: 1, borderColor: colors.gray200 },
  tabActive:   { backgroundColor: colors.primary, borderColor: colors.primary },
  tabTxt:      { fontSize: 12, fontFamily: fonts.semiBold, color: colors.gray600 },
  tabTxtActive:{ color: colors.white },

  search: {
    marginHorizontal: spacing.md, marginBottom: spacing.sm,
    backgroundColor: colors.gray100, borderRadius: radius.md,
    paddingHorizontal: spacing.md, paddingVertical: 10,
    fontSize: 14, color: colors.gray800,
  },

  row:  { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.md, paddingVertical: 10, gap: spacing.sm },
  info: { flex: 1 },
  name: { fontSize: 15, fontFamily: fonts.semiBold, color: colors.gray800 },
  bio:  { fontSize: 12, fontFamily: fonts.regular, color: colors.gray400, marginTop: 2 },
  sep:  { height: StyleSheet.hairlineWidth, backgroundColor: colors.gray100, marginLeft: 50 + spacing.md * 2 },

  followBtn: {
    borderWidth: 1.5, borderColor: colors.primary,
    borderRadius: radius.full,
    paddingHorizontal: 14, paddingVertical: 7,
  },
  followingBtn: { borderColor: colors.gray200, backgroundColor: colors.gray100 },
  followTxt:    { fontFamily: fonts.semiBold, fontSize: 13, color: colors.primary },
  followingTxt: { color: colors.gray400 },

  emptyWrap: { alignItems: 'center', paddingTop: 60, gap: 10 },
  empty:     { fontSize: 14, fontFamily: fonts.regular, color: colors.gray400, textAlign: 'center', marginTop: 48 },
})
