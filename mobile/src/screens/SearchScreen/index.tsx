import React, { useState, useEffect, useRef, useCallback } from 'react'
import {
  View, Text, TextInput, FlatList, TouchableOpacity,
  StyleSheet, ActivityIndicator, Dimensions, Image,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useNavigation } from '@react-navigation/native'
import { StackNavigationProp } from '@react-navigation/stack'
import { Ionicons } from '@expo/vector-icons'
import * as Haptics from 'expo-haptics'
import { api } from '../../services/api'
import { ApiResponse } from '../../types'
import { AppStackParams } from '../../navigation/AppNavigator'
import { fonts } from '../../theme'
import { toggleFollow } from '../../services/follow.service'
import { API_BASE } from '../../config'

type Nav = StackNavigationProp<AppStackParams>

const { width: W } = Dimensions.get('window')
const COLS    = 3
const PADDING = 16
const GAP     = 10
const CARD_W  = (W - PADDING * 2 - GAP * (COLS - 1)) / COLS
const PRIMARY = '#4C8CE4'

interface UserResult {
  id: string; name: string; avatar: string | null; bio: string | null
  _count?: { followers: number }
}

function avatarUri(u: UserResult): string | null {
  if (!u.avatar) return null
  return u.avatar.startsWith('http') ? u.avatar : `${API_BASE}${u.avatar}`
}

function UserCard({ user, followed, onFollow, onPress }: {
  user: UserResult; followed: boolean; onFollow: () => void; onPress: () => void
}) {
  const uri    = avatarUri(user)
  const AVATAR = CARD_W - 24
  return (
    <TouchableOpacity style={s.card} onPress={onPress} activeOpacity={0.85}>
      <View style={{ width: AVATAR, height: AVATAR, borderRadius: AVATAR / 2, overflow: 'hidden' }}>
        {uri
          ? <Image source={{ uri }} style={{ width: AVATAR, height: AVATAR }} resizeMode="cover" />
          : <View style={[s.avatarFallback, { width: AVATAR, height: AVATAR }]}>
              <Text style={s.avatarInitial}>{user.name[0]?.toUpperCase() ?? '?'}</Text>
            </View>
        }
      </View>
      <Text style={s.cardName} numberOfLines={1}>{user.name}</Text>
      <TouchableOpacity
        style={[s.followBtn, followed && s.followingBtn]}
        onPress={(e) => { e.stopPropagation(); onFollow() }}
        activeOpacity={0.8}
      >
        <Text style={[s.followBtnText, followed && s.followingBtnText]}>
          {followed ? 'A seguir' : 'Seguir'}
        </Text>
      </TouchableOpacity>
    </TouchableOpacity>
  )
}

export default function SearchScreen() {
  const nav     = useNavigation<Nav>()
  const { top } = useSafeAreaInsets()
  const [query,     setQuery]     = useState('')
  const [results,   setResults]   = useState<UserResult[]>([])
  const [suggested, setSuggested] = useState<UserResult[]>([])
  const [loading,   setLoading]   = useState(false)
  const [followed,  setFollowed]  = useState<Set<string>>(new Set())
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    api.get('/users/suggested').then((r) => setSuggested(r.data.data ?? r.data)).catch(() => {})
  }, [])

  const search = useCallback(async (q: string) => {
    if (!q.trim()) { setResults([]); return }
    setLoading(true)
    try {
      const res = await api.get<ApiResponse<UserResult[]>>(`/users/search?q=${encodeURIComponent(q)}`)
      setResults(res.data.data)
    } catch { setResults([]) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => search(query), 280)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [query])

  async function handleFollow(userId: string) {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    try {
      const res = await toggleFollow(userId)
      setFollowed((prev) => {
        const next = new Set(prev)
        res.following ? next.add(userId) : next.delete(userId)
        return next
      })
    } catch {}
  }

  const isSearching  = query.trim().length > 0
  const displayList  = isSearching ? results : suggested

  return (
    <View style={[s.screen, { paddingTop: top }]}>

      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => nav.goBack()} style={s.backBtn}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Ionicons name="chevron-back" size={26} color="#1A1A1A" />
        </TouchableOpacity>
        <View style={s.searchBar}>
          <Ionicons name="search-outline" size={17} color="#ABABAB" />
          <TextInput
            style={s.searchInput}
            placeholder="Pesquisar pessoas..."
            placeholderTextColor="#ABABAB"
            value={query}
            onChangeText={setQuery}
            autoFocus
            autoCapitalize="none"
            returnKeyType="search"
          />
          {query.length > 0 && (
            <TouchableOpacity onPress={() => setQuery('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="close-circle" size={17} color="#ABABAB" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Section label */}
      {!loading && (
        <Text style={s.sectionTitle}>
          {isSearching ? `Resultados para "${query}"` : 'Sugeridos para ti'}
        </Text>
      )}

      {loading && <View style={s.loadingWrap}><ActivityIndicator color={PRIMARY} /></View>}

      {!loading && isSearching && results.length === 0 && (
        <View style={s.emptyWrap}>
          <Ionicons name="search-outline" size={44} color="#E0E0E0" />
          <Text style={s.emptyText}>Nenhum resultado</Text>
          <Text style={s.emptySub}>Tenta outro nome</Text>
        </View>
      )}

      {!loading && (
        <FlatList
          data={displayList}
          keyExtractor={(u) => u.id}
          numColumns={COLS}
          columnWrapperStyle={s.row}
          contentContainerStyle={s.grid}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => (
            <UserCard
              user={item}
              followed={followed.has(item.id)}
              onFollow={() => handleFollow(item.id)}
              onPress={() => nav.navigate('Profile', { userId: item.id })}
            />
          )}
        />
      )}
    </View>
  )
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#fff' },

  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingBottom: 12, gap: 10,
    borderBottomWidth: 1, borderBottomColor: '#EAEAEA',
  },
  backBtn:     { padding: 2 },
  searchBar:   {
    flex: 1, flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#F5F5F7', borderRadius: 8,
    paddingHorizontal: 12, paddingVertical: 10, gap: 8,
  },
  searchInput: { flex: 1, fontSize: 15, fontFamily: fonts.regular, color: '#1A1A1A', padding: 0 },

  sectionTitle: {
    fontSize: 11, fontFamily: fonts.semiBold, color: '#ABABAB',
    letterSpacing: 0.8, textTransform: 'uppercase',
    paddingHorizontal: PADDING, paddingTop: 18, paddingBottom: 14,
  },

  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyWrap:   { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, paddingBottom: 80 },
  emptyText:   { fontSize: 16, fontFamily: fonts.semiBold, color: '#444' },
  emptySub:    { fontSize: 14, fontFamily: fonts.regular, color: '#ABABAB' },

  grid: { paddingHorizontal: PADDING, paddingBottom: 40 },
  row:  { gap: GAP, marginBottom: GAP },

  card: {
    width: CARD_W, alignItems: 'center',
    paddingTop: 16, paddingBottom: 12, paddingHorizontal: 4,
    borderWidth: 1, borderColor: '#EAEAEA', borderRadius: 8, gap: 8,
  },
  avatarFallback: { backgroundColor: '#EAEAEA', alignItems: 'center', justifyContent: 'center' },
  avatarInitial:  { fontSize: 26, fontFamily: fonts.bold, color: '#ABABAB' },
  cardName:       { fontSize: 13, fontFamily: fonts.semiBold, color: '#1A1A1A', textAlign: 'center' },

  followBtn:        { width: '88%', paddingVertical: 7, borderRadius: 6, backgroundColor: PRIMARY, alignItems: 'center' },
  followingBtn:     { backgroundColor: '#F5F5F7' },
  followBtnText:    { fontSize: 12, fontFamily: fonts.semiBold, color: '#fff' },
  followingBtnText: { color: '#888' },
})
