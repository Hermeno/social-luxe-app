import React, { useEffect, useState } from 'react'
import { View, Text, FlatList, StyleSheet, Alert, TextInput, TouchableOpacity, LayoutAnimation } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Friendship } from '../../types'
import * as friendService from '../../services/friendship.service'
import type { UserSummary } from '../../services/friendship.service'
import { colors, spacing, radius } from '../../theme'
import { useFriendsStore } from '../../store/friends.store'
import FriendRow from './FriendRow'
import UserCard from './UserCard'

type Tab = 'discover' | 'friends'

export default function FriendsScreen() {
  const { top } = useSafeAreaInsets()
  const { setBadge, clearBadge } = useFriendsStore()
  const [tab, setTab]         = useState<Tab>('discover')
  const [query, setQuery]     = useState('')
  const [users, setUsers]     = useState<UserSummary[]>([])
  const [friends, setFriends] = useState<Friendship[]>([])
  useEffect(() => { loadAll(); clearBadge() }, [])
  async function loadAll() {
    try { const [u, f] = await Promise.all([friendService.getAllUsers(), friendService.getFriends()]); setUsers(u); setFriends(f); setBadge(f.length) } catch {}
  }
  function switchTab(t: Tab) { LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut); setTab(t) }
  const friendIds = new Set(friends.map((f) => f.friend.id))
  const filtered  = users.filter((u) => !friendIds.has(u.id) && u.name.toLowerCase().includes(query.toLowerCase()))
  async function handleRenew(f: Friendship) { try { await friendService.renewFriendship(f.friendshipId); loadAll() } catch {} }
  function handleRemove(f: Friendship) {
    Alert.alert('Remover', `Remover amizade com ${f.friend.name}?`, [
      { text: 'Cancelar' },
      { text: 'Remover', style: 'destructive', onPress: async () => { try { await friendService.removeFriendship(f.friendshipId); loadAll() } catch {} }},
    ])
  }
  return (
    <View style={[s.container, { paddingTop: top }]}>
      <Text style={s.title}>Amigos</Text>
      <View style={s.tabs}>
        {(['discover', 'friends'] as Tab[]).map((t) => (
          <TouchableOpacity key={t} style={[s.tabBtn, tab === t && s.tabActive]} onPress={() => switchTab(t)}>
            <Text style={[s.tabTxt, tab === t && s.tabTxtActive]}>{t === 'discover' ? 'Descobrir' : `Meus Amigos (${friends.length})`}</Text>
          </TouchableOpacity>
        ))}
      </View>
      {tab === 'discover' && (
        <TextInput style={s.search} placeholder="Buscar pessoas..." placeholderTextColor={colors.gray400} value={query} onChangeText={setQuery} />
      )}
      <FlatList data={tab === 'discover' ? filtered : friends} keyExtractor={(item: any) => item.id ?? item.friendshipId}
        renderItem={({ item }: any) => tab === 'discover'
          ? <UserCard user={item} onAdded={loadAll} />
          : <FriendRow item={item} onRenew={() => handleRenew(item)} onRemove={() => handleRemove(item)} />
        }
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={<Text style={s.empty}>{tab === 'discover' ? 'Nenhum usuário encontrado' : 'Nenhum amigo ainda'}</Text>}
      />
    </View>
  )
}

const s = StyleSheet.create({
  container:    { flex: 1, backgroundColor: colors.white },
  title:        { fontSize: 22, fontWeight: '800' as const, color: colors.gray800, paddingHorizontal: spacing.md, paddingTop: spacing.md, paddingBottom: spacing.sm },
  tabs:         { flexDirection: 'row', paddingHorizontal: spacing.md, gap: spacing.sm, marginBottom: spacing.sm },
  tabBtn:       { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.full, borderWidth: 1, borderColor: colors.gray200 },
  tabActive:    { backgroundColor: colors.primary, borderColor: colors.primary },
  tabTxt:       { fontSize: 13, fontWeight: '600' as const, color: colors.gray600 },
  tabTxtActive: { color: colors.white },
  search:       { marginHorizontal: spacing.md, marginBottom: spacing.sm, backgroundColor: colors.gray100, borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, fontSize: 14, color: colors.gray800 },
  empty:        { fontSize: 14, color: colors.gray400, textAlign: 'center', marginTop: 48 },
})
