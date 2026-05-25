import React, { useState, useEffect, useRef, useCallback } from 'react'
import {
  View,
  Text,
  TextInput,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useNavigation } from '@react-navigation/native'
import { StackNavigationProp } from '@react-navigation/stack'
import { Ionicons } from '@expo/vector-icons'
import { api } from '../../services/api'
import { ApiResponse } from '../../types'
import { AppStackParams } from '../../navigation/AppNavigator'
import { colors, fonts, spacing, radius } from '../../theme'
import AvatarImage from '../../components/AvatarImage'

type Nav = StackNavigationProp<AppStackParams>

interface UserResult {
  id: string
  name: string
  avatar: string | null
  bio: string | null
}

export default function SearchScreen() {
  const nav = useNavigation<Nav>()
  const { top } = useSafeAreaInsets()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<UserResult[]>([])
  const [loading, setLoading] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const search = useCallback(async (q: string) => {
    if (!q.trim()) {
      setResults([])
      return
    }
    setLoading(true)
    try {
      const res = await api.get<ApiResponse<UserResult[]>>(`/users/search?q=${encodeURIComponent(q)}`)
      setResults(res.data.data)
    } catch {
      setResults([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => search(query), 300)
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [query, search])

  return (
    <View style={[s.container, { paddingTop: top }]}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => nav.goBack()} style={s.backBtn}>
          <Ionicons name="chevron-back" size={26} color={colors.gray800} />
        </TouchableOpacity>
        <View style={s.inputWrap}>
          <Ionicons name="search-outline" size={18} color={colors.gray400} />
          <TextInput
            style={s.input}
            placeholder="Buscar pessoas..."
            placeholderTextColor={colors.gray400}
            value={query}
            onChangeText={setQuery}
            autoFocus
            autoCapitalize="none"
          />
          {query.length > 0 && (
            <TouchableOpacity onPress={() => setQuery('')}>
              <Ionicons name="close-circle" size={18} color={colors.gray400} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {loading && (
        <View style={s.loadingWrap}>
          <ActivityIndicator color={colors.primary} />
        </View>
      )}

      {!loading && query.length === 0 && (
        <View style={s.center}>
          <Ionicons name="search-outline" size={56} color={colors.gray200} />
          <Text style={s.hintText}>Busque por nome ou telefone</Text>
        </View>
      )}

      {!loading && query.length > 0 && results.length === 0 && (
        <View style={s.center}>
          <Text style={s.emptyText}>Nenhum usuário encontrado</Text>
        </View>
      )}

      <FlatList
        data={results}
        keyExtractor={(u) => u.id}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={s.list}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={s.userRow}
            onPress={() => nav.navigate('Profile', { userId: item.id })}
            activeOpacity={0.8}
          >
            <AvatarImage uri={item.avatar} size={48} />
            <View style={s.userInfo}>
              <Text style={s.userName}>{item.name}</Text>
              {item.bio ? (
                <Text style={s.userBio} numberOfLines={1}>{item.bio}</Text>
              ) : null}
            </View>
            <TouchableOpacity style={s.addBtn} activeOpacity={0.8}>
              <Text style={s.addBtnText}>Adicionar</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        )}
      />
    </View>
  )
}

const s = StyleSheet.create({
  container:   { flex: 1, backgroundColor: colors.white },
  header:      {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm, gap: spacing.sm,
  },
  backBtn:     { width: 36 },
  inputWrap:   {
    flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: colors.gray100,
    borderRadius: radius.full, paddingHorizontal: spacing.md, paddingVertical: 10,
  },
  input:       { flex: 1, color: colors.gray800, fontFamily: fonts.regular, fontSize: 15, padding: 0 },
  loadingWrap: { paddingVertical: spacing.lg, alignItems: 'center' },
  center:      { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md },
  hintText:    { color: colors.gray400, fontFamily: fonts.regular, fontSize: 14 },
  emptyText:   { color: colors.gray600, fontFamily: fonts.medium, fontSize: 15 },
  list:        { paddingHorizontal: spacing.md, paddingTop: spacing.sm },
  userRow:     {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: spacing.sm, gap: spacing.md,
  },
  userInfo:    { flex: 1, gap: 2 },
  userName:    { color: colors.gray800, fontFamily: fonts.semiBold, fontSize: 15 },
  userBio:     { color: colors.gray400, fontFamily: fonts.regular, fontSize: 12 },
  addBtn:      {
    backgroundColor: colors.primary, borderRadius: radius.full,
    paddingHorizontal: 16, paddingVertical: 7,
  },
  addBtnText:  { color: colors.white, fontFamily: fonts.semiBold, fontSize: 13 },
})
