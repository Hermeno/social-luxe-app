import React, { useState, useEffect, useRef, useCallback } from 'react'
import {
  View, Text, TextInput, FlatList, TouchableOpacity,
  StyleSheet, ActivityIndicator, ListRenderItemInfo, Dimensions,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useNavigation } from '@react-navigation/native'
import { StackNavigationProp } from '@react-navigation/stack'
import Toast from 'react-native-toast-message'
import { Image } from 'expo-image'
import { api } from '../../services/api'
import { searchPosts } from '../../services/post.service'
import { Post } from '../../types'
import { AppStackParams } from '../../navigation/AppNavigator'
import { colors, fonts, radius, typography } from '../../theme'
import Icon from '../../components/Icon'
import { tabBarOccupiedHeight } from '../../components/TabBar/layout'
import { FollowDuration } from '../../services/follow.service'
import { getCache, setCache } from '../../db/database'
import { useFollowStore } from '../../store/follow.store'
import { isConnected } from '../../services/netinfo.service'
import AvatarImage from '../../components/AvatarImage'
import FollowSplitButton from '../../components/FollowSplitButton'
import { useT } from '../../i18n'
import { displayHandle } from '../../utils/handle'

type Nav = StackNavigationProp<AppStackParams>

interface UserResult {
  id: string
  name: string
  username?: string | null
  avatar: string | null
  bio: string | null
  _count?: { followers: number }
}

function fmtCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000)     return `${(n / 1_000).toFixed(1)}K`
  return String(n)
}

// ── Célula da grelha de publicações ───────────────────────────────────────────
const GRID_GAP = 2
const CELL = (Dimensions.get('window').width - GRID_GAP * 2) / 3

function PostCell({ post, onPress }: { post: Post; onPress: () => void }) {
  const uri = post.mediaUrls?.[0] ?? post.mediaUrl
  return (
    <TouchableOpacity
      style={s.cell}
      onPress={onPress}
      activeOpacity={0.86}
      accessibilityRole="button"
      accessibilityLabel={post.caption?.slice(0, 60) || post.user?.name}
    >
      {uri ? (
        <Image source={{ uri }} style={s.cellImage} contentFit="cover" transition={140} />
      ) : (
        // Post só de texto: a legenda é a própria miniatura.
        <View style={s.cellText}>
          <Text style={s.cellTextBody} numberOfLines={4}>{post.caption}</Text>
        </View>
      )}
      {(post.mediaUrls?.length ?? 0) > 1 && <View style={s.cellAlbum} />}
    </TouchableOpacity>
  )
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
          <Text style={s.rowName} numberOfLines={1}>{user.username ? displayHandle(user.username) : user.name}</Text>
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
  const { top, bottom } = useSafeAreaInsets()
  const t       = useT()

  // Dois âmbitos na mesma pesquisa: quem publica e o que foi publicado.
  const [scope,         setScope]         = useState<'people' | 'posts'>('people')
  const [posts,         setPosts]         = useState<Post[]>([])
  const [loadingPosts,  setLoadingPosts]  = useState(false)
  const [query,         setQuery]         = useState('')
  const [results,       setResults]       = useState<UserResult[]>([])
  const [suggested,     setSuggested]     = useState<UserResult[]>([])
  const [loadingSug,    setLoadingSug]    = useState(true)
  const [loadingSearch, setLoadingSearch] = useState(false)
  const followingIds    = useFollowStore((s) => s.followingIds)
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

  const runPostSearch = useCallback(async (q: string) => {
    if (!q.trim()) { setPosts([]); return }
    setLoadingPosts(true)
    try {
      setPosts(await searchPosts(q))
    } catch {
      setPosts([])
    } finally {
      setLoadingPosts(false)
    }
  }, [])

  // Um só temporizador para os dois âmbitos: escrever dispara a busca do âmbito
  // aberto, e trocar de âmbito com texto já escrito dispara a que falta. Assim
  // nunca há duas chamadas por tecla nem um separador vazio à espera de toque.
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      if (scope === 'people') search(query)
      else runPostSearch(query)
    }, 300)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [query, scope])

  const handleFollow = useCallback(async (userId: string, duration: FollowDuration = 'forever') => {
    if (followPending.has(userId)) return
    setFollowPending((prev) => new Set([...prev, userId]))
    try {
      const u = displayList.find((x) => x.id === userId)
      await useFollowStore.getState().toggle(userId, duration,
        u ? { name: u.name, avatar: u.avatar } : undefined
      )
    } catch {
      Toast.show({ type: 'error', text1: t.search_no_network, text2: t.search_follow_err, visibilityTime: 2500 })
    } finally {
      setFollowPending((prev) => {
        const next = new Set(prev)
        next.delete(userId)
        return next
      })
    }
  }, [followPending])

  const isSearching = query.trim().length > 0
  const onPeople    = scope === 'people'
  const displayList = isSearching ? results : suggested
  const isLoading   = onPeople ? (isSearching ? loadingSearch : loadingSug) : loadingPosts

  const renderItem = useCallback(({ item }: ListRenderItemInfo<UserResult>) => (
    <UserRow
      user={item}
      followed={followingIds.has(item.id)}
      loadingFollow={followPending.has(item.id)}
      onFollow={(duration) => handleFollow(item.id, duration)}
      onPress={() => nav.navigate('Profile', { userId: item.id })}
    />
  ), [followingIds, followPending, handleFollow, nav])

  return (
    <View style={[s.screen, { paddingTop: top }]}>

      {/* ── Cabeçalho ──────────────────────────────────────────────────────
          Sem botão de voltar: isto passou a ser um separador da navegação e
          não um ecrã empilhado — não há para onde recuar. O título ocupa o
          lugar que o botão tinha. */}
      <Text style={s.pageTitle}>{t.feed_top_search}</Text>

      <View style={s.header}>
        <View style={s.searchBar}>
          <Icon name="search" size={17} color={colors.gray500} strokeWidth={1.9} />
          <TextInput
            ref={inputRef}
            style={s.searchInput}
            placeholder={t.search_ph}
            placeholderTextColor={colors.gray400}
            value={query}
            onChangeText={setQuery}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="search"
          />
          {query.length > 0 && (
            <TouchableOpacity
              onPress={() => { setQuery(''); inputRef.current?.focus() }}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Icon name="close-circle" size={17} color={colors.gray400} strokeWidth={1.9} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* ── Âmbito ─────────────────────────────────────────────────────────
          Dois separadores e não uma lista misturada: pessoas e publicações
          pedem formas diferentes — uma lista com botão de seguir, uma grelha de
          miniaturas — e misturá-las obrigaria a inventar uma terceira forma que
          não serve bem nenhuma das duas. */}
      <View style={s.scopeRow}>
        {(['people', 'posts'] as const).map((k) => {
          const on = scope === k
          return (
            <TouchableOpacity
              key={k}
              style={[s.scopeTab, on && s.scopeTabOn]}
              onPress={() => setScope(k)}
              activeOpacity={0.75}
              accessibilityRole="tab"
              accessibilityState={{ selected: on }}
              accessibilityLabel={k === 'people' ? t.search_tab_people : t.search_tab_posts}
            >
              <Text style={[s.scopeTxt, on && s.scopeTxtOn]}>
                {k === 'people' ? t.search_tab_people : t.search_tab_posts}
              </Text>
            </TouchableOpacity>
          )
        })}
      </View>

      {/* ── Rótulo da secção ───────────────────────────────────────────────
          Nas publicações só existe enquanto há pesquisa: sem texto escrito não
          há nada para rotular, e "Sugeridos para ti" pertence às pessoas. */}
      {(onPeople || isSearching) && (
        <View style={s.sectionRow}>
          <Text style={s.sectionLabel}>
            {isSearching ? t.search_results : t.search_suggested}
          </Text>
          {isSearching && !isLoading && (
            <Text style={s.sectionCount}>
              {onPeople ? results.length : posts.length}
            </Text>
          )}
        </View>
      )}

      {/* ── Skeleton only when no cached data yet ──────────────────────────── */}
      {onPeople && isLoading && !isSearching && suggested.length === 0 && (
        <View>
          {[0, 1, 2, 3, 4].map((i) => <SkeletonRow key={i} />)}
        </View>
      )}

      {/* ── Search spinner ──────────────────────────────────────────────────── */}
      {isLoading && isSearching && (
        <View style={s.spinnerWrap}>
          <ActivityIndicator color={colors.gray400} />
        </View>
      )}

      {/* ── Empty state ─────────────────────────────────────────────────────── */}
      {onPeople && !isLoading && isSearching && results.length === 0 && (
        <View style={s.emptyWrap}>
          <View style={s.emptyIcon}>
            <Icon name="search" size={26} color={colors.gray500} strokeWidth={1.6} />
          </View>
          <Text style={s.emptyTitle}>{t.search_no_results}</Text>
          <Text style={s.emptySub}>{t.search_no_results_sub}</Text>
        </View>
      )}

      {onPeople && !isLoading && !isSearching && suggested.length === 0 && (
        <View style={s.emptyWrap}>
          <View style={s.emptyIcon}>
            <Icon name="users" size={26} color={colors.gray500} strokeWidth={1.6} />
          </View>
          <Text style={s.emptyTitle}>{t.search_no_suggestions}</Text>
          <Text style={s.emptySub}>{t.search_no_suggestions_sub}</Text>
        </View>
      )}

      {/* ── List — show even while loading if cache exists ──────────────────── */}
      {onPeople && displayList.length > 0 && (
        <FlatList
          data={displayList}
          keyExtractor={(u) => u.id}
          renderItem={renderItem}
          showsVerticalScrollIndicator={false}
          // A navegação flutua por cima: sem esta reserva, a última pessoa da
          // lista fica escondida atrás dela.
          contentContainerStyle={[s.listContent, { paddingBottom: tabBarOccupiedHeight(bottom) + 12 }]}
          keyboardShouldPersistTaps="handled"
          ItemSeparatorComponent={() => <View style={s.separator} />}
        />
      )}

      {/* ── Publicações ────────────────────────────────────────────────────── */}
      {!onPeople && !isSearching && (
        <View style={s.emptyWrap}>
          <View style={s.emptyIcon}>
            <Icon name="image" size={26} color={colors.gray500} strokeWidth={1.6} />
          </View>
          <Text style={s.emptyTitle}>{t.search_start}</Text>
          <Text style={s.emptySub}>{t.search_start_sub}</Text>
        </View>
      )}

      {!onPeople && !isLoading && isSearching && posts.length === 0 && (
        <View style={s.emptyWrap}>
          <View style={s.emptyIcon}>
            <Icon name="image" size={26} color={colors.gray500} strokeWidth={1.6} />
          </View>
          <Text style={s.emptyTitle}>{t.search_no_posts}</Text>
          <Text style={s.emptySub}>{t.search_no_posts_sub}</Text>
        </View>
      )}

      {!onPeople && posts.length > 0 && (
        <FlatList
          data={posts}
          key="grid"
          numColumns={3}
          keyExtractor={(p) => p.id}
          renderItem={({ item, index }) => (
            <PostCell
              post={item}
              onPress={() => nav.navigate('PostViewer', { posts, startIndex: index })}
            />
          )}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          columnWrapperStyle={s.gridRow}
          contentContainerStyle={{ paddingBottom: tabBarOccupiedHeight(bottom) + 12 }}
        />
      )}
    </View>
  )
}

// ── Styles ─────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.white },

  // ── Cabeçalho ────────────────────────────────────────────────────────────
  pageTitle: {
    fontSize: typography.screen,
    fontFamily: fonts.bold,
    color: colors.gray800,
    letterSpacing: -0.6,
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 14,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 16,
    gap: 10,
  },
  // Um fio em vez de uma caixa cinzenta: sobre papel branco, o contorno define
  // o campo sem lhe dar peso de bloco. É o mesmo fio dos separadores da lista,
  // por isso a página inteira assenta numa espessura só.
  searchBar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 44,
    backgroundColor: colors.white,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.gray300,
    borderRadius: radius.md,
    paddingHorizontal: 13,
    gap: 9,
  },
  searchInput: {
    flex: 1,
    fontSize: typography.body,
    fontFamily: fonts.regular,
    color: colors.gray800,
    letterSpacing: -0.2,
    padding: 0,
  },

  // ── Âmbito ───────────────────────────────────────────────────────────────
  // Sublinhado e não pastilha: o traço marca o separador activo sem introduzir
  // uma forma nova na página, e é a mesma espessura dos outros fios.
  scopeRow: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.gray200,
  },
  scopeTab: {
    paddingVertical: 11,
    marginRight: 24,
    borderBottomWidth: 1.5,
    borderBottomColor: 'transparent',
  },
  scopeTabOn: { borderBottomColor: colors.gray800 },
  scopeTxt: {
    fontSize: typography.secondary,
    fontFamily: fonts.medium,
    color: colors.gray500,
    letterSpacing: -0.1,
  },
  scopeTxtOn: { color: colors.gray800, fontFamily: fonts.semiBold },

  // ── Grelha de publicações ────────────────────────────────────────────────
  gridRow: { gap: GRID_GAP, marginBottom: GRID_GAP },
  cell: {
    width: CELL,
    height: CELL,
    backgroundColor: colors.gray100,
    overflow: 'hidden',
  },
  cellImage: { width: '100%', height: '100%' },
  cellText: {
    flex: 1,
    padding: 10,
    justifyContent: 'center',
    backgroundColor: colors.gray100,
  },
  cellTextBody: {
    fontSize: typography.meta,
    fontFamily: fonts.medium,
    color: colors.gray800,
    lineHeight: 15,
  },
  // Marca de álbum: um quadrado branco no canto, sem número nem ícone. Diz que
  // há mais por baixo e não rouba nada à miniatura.
  cellAlbum: {
    position: 'absolute',
    top: 7, right: 7,
    width: 9, height: 9,
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
    borderRadius: 2,
  },

  // ── Secção ───────────────────────────────────────────────────────────────
  sectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 10,
    gap: 8,
  },
  sectionLabel: {
    fontSize: typography.meta,
    fontFamily: fonts.semiBold,
    color: colors.gray500,
    letterSpacing: 0.9,
    textTransform: 'uppercase',
  },
  // Preto sobre branco, sem pastilha de cor. O número é informação, não um
  // aviso — a marca fica para onde tem função.
  sectionCount: {
    fontSize: typography.meta,
    fontFamily: fonts.semiBold,
    color: colors.gray800,
    fontVariant: ['tabular-nums'],
  },

  // ── Lista ────────────────────────────────────────────────────────────────
  listContent: { paddingBottom: 24 },
  // Alinhado com o texto, não com o avatar: o fio corta debaixo do nome e deixa
  // a coluna dos rostos livre, que é o que faz a lista respirar.
  separator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.gray200,
    marginLeft: 78,
  },

  // ── Linha ────────────────────────────────────────────────────────────────
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
    fontSize: typography.body,
    fontFamily: fonts.semiBold,
    color: colors.gray800,
    letterSpacing: -0.25,
  },
  rowSub: {
    fontSize: typography.secondary,
    fontFamily: fonts.regular,
    color: colors.gray500,
    marginTop: 1,
  },

  // ── Esqueleto ────────────────────────────────────────────────────────────
  skeletonAvatar: { width: 46, height: 46, borderRadius: 23, backgroundColor: colors.gray200 },
  skeletonInfo:   { flex: 1, gap: 7 },
  skeletonName:   { width: '52%', height: 13, borderRadius: 2, backgroundColor: colors.gray200 },
  skeletonSub:    { width: '32%', height: 11, borderRadius: 2, backgroundColor: colors.gray100 },
  skeletonBtn:    { width: 84, height: 34, borderRadius: radius.md, backgroundColor: colors.gray200 },

  // ── Estados ──────────────────────────────────────────────────────────────
  spinnerWrap: { flex: 1, alignItems: 'center', paddingTop: 56 },
  emptyWrap:   { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8, paddingBottom: 90 },
  // Um fio a desenhar o círculo, em vez de um disco cinzento: o estado vazio
  // não precisa de uma mancha para se anunciar.
  emptyIcon: {
    width: 60, height: 60, borderRadius: 30,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.gray300,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 6,
  },
  emptyTitle: {
    fontSize: typography.section,
    fontFamily: fonts.semiBold,
    color: colors.gray800,
    letterSpacing: -0.3,
  },
  emptySub: {
    fontSize: typography.secondary,
    fontFamily: fonts.regular,
    color: colors.gray500,
    textAlign: 'center',
    lineHeight: 19,
    paddingHorizontal: 44,
  },
})
