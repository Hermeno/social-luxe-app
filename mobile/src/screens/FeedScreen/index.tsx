import React, { useState, useMemo, useCallback, useRef, useEffect, useLayoutEffect } from 'react'
import {
  View, Text, ActivityIndicator, FlatList, StyleSheet, Dimensions, Keyboard, TouchableOpacity,
  type LayoutChangeEvent, type ViewToken,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import FeedIcon from '../../components/FeedIcon'
import Icon from '../../components/Icon'
import { setStatusBarStyle } from 'expo-status-bar'
import { useNavigation, useFocusEffect } from '@react-navigation/native'
import { StackNavigationProp } from '@react-navigation/stack'
import { Post, type RepostResult } from '../../types'
import { useFeed } from '../../hooks/useFeed'
import { useFeedStore } from '../../store/feed.store'
import { useNotificationStore } from '../../store/notification.store'
import { AppStackParams } from '../../navigation/AppNavigator'
import { markPostViewed, getViewedPostIds, getCache, setCache } from '../../db/database'
import * as postService from '../../services/post.service'
import { useT } from '../../i18n'
import { prefetchMedia } from '../../db/mediaCache'
import { colors, fonts } from '../../theme'
import { API_BASE } from '../../config'
import FeedHeader, { FeedUserGroup as UserGroup } from './FeedHeader'
import Wordmark from '../../components/Wordmark'
import FeedItem from './FeedItem'
import CommentSheet from '../../components/CommentSheet'
import useReducedMotionPreference from '../../hooks/useReducedMotionPreference'
import { BLOCKED_USER_IDS_CACHE_KEY, getBlockedUsers } from '../../services/block.service'
import { MUTED_USER_IDS_CACHE_KEY, getMutedUsers } from '../../services/mute.service'

const { height: SCREEN_H } = Dimensions.get('window')
const TOP_ACTION_ICON_SIZE = 27

type Nav = StackNavigationProp<AppStackParams>

function resolveMedia(url: string | null | undefined): string {
  if (!url) return ''
  return url.startsWith('http') ? url : `${API_BASE}${url}`
}

function postReferencesAuthor(post: Post, userId: string): boolean {
  return post.user.id === userId || post.repostOriginalAuthorId === userId
}

function postReferencesAnyAuthor(post: Post, userIds: Set<string>): boolean {
  return userIds.has(post.user.id)
    || (!!post.repostOriginalAuthorId && userIds.has(post.repostOriginalAuthorId))
}

// ─── Feed ──────────────────────────────────────────────────────────────────
// Pager vertical: uma FlatList paginada onde cada célula é um post em ecrã
// inteiro (FeedItem). A célula é dona do seu vídeo — aqui só se gere o estado
// partilhado (likes, vistas), o agrupamento do topo e a folha de
// comentários. O deslize suave vem da própria FlatList.
export default function FeedScreen() {
  const {
    posts, loading, refresh, loadMore, prependPost, removePost, updatePost,
    incrementView, updatePostCounts, updateRepostState,
  } = useFeed()
  const t   = useT()
  const nav = useNavigation<Nav>()
  const reduceMotion = useReducedMotionPreference()

  const setNewPostsCount = useFeedStore((s) => s.setNewPostsCount)
  const pendingPost      = useFeedStore((s) => s.pendingPost)
  const setPendingPost   = useFeedStore((s) => s.setPendingPost)
  const focusedPost      = useFeedStore((s) => s.focusedPost)
  const focusedPostRequest = useFeedStore((s) => s.focusedPostRequest)
  const clearFocusedPost = useFeedStore((s) => s.clearFocusedPost)
  const openSearch       = useFeedStore((s) => s.openSearch)
  const setOpenSearch    = useFeedStore((s) => s.setOpenSearch)
  const homeTap          = useFeedStore((s) => s.homeTap)
  const setActiveCommentTarget = useFeedStore((s) => s.setActiveCommentTarget)
  const requestedCommentPostId = useFeedStore((s) => s.requestedCommentPostId)
  const clearCommentRequest    = useFeedStore((s) => s.clearCommentRequest)
  const circleInvite           = useNotificationStore((s) => s.circleInvite)

  const [currentPostId, setCurrentPostId] = useState<string | null>(null)
  const [commentPost,   setCommentPost]   = useState<Post | null>(null)
  const [viewedIds,     setViewedIds]     = useState<Set<string>>(new Set())
  const [searchMode,    setSearchMode]    = useState(false)
  const [searchQuery,   setSearchQuery]   = useState('')
  const [commentDeltas, setCommentDeltas] = useState<Record<string, number>>({})
  const [likedPostIds,  setLikedPostIds]  = useState<Set<string>>(new Set())
  const [blockedAuthorIds, setBlockedAuthorIds] = useState<Set<string>>(new Set())
  const [mutedAuthorIds, setMutedAuthorIds] = useState<Set<string>>(new Set())
  const moderationRevisionRef = useRef(0)

  const listRef = useRef<FlatList<Post>>(null)
  const { top: safeTop } = useSafeAreaInsets()
  // Altura real da área da lista (medida). O pager usa-a para a célula, o snap
  // e o layout — assim toda a gente fica alinhada (Dimensions.window no arranque
  // podia não bater certo e desalinhava os posts a partir do 2.º).
  const [listH, setListH] = useState(SCREEN_H)
  const listHRef = useRef(SCREEN_H)
  const measuredViewportRef = useRef<{ width: number; height: number } | null>(null)
  const currentPostIdRef = useRef(currentPostId)
  currentPostIdRef.current = currentPostId
  const searchModeRef = useRef(searchMode)
  searchModeRef.current = searchMode
  const searchAnchorPostIdRef = useRef<string | null>(null)
  const searchRealignPendingRef = useRef(false)

  // Um post aberto pela pesquisa/perfil vive apenas nesta composição. Nunca é
  // enviado a `prependPost`, portanto não entra no cache offline da feed.
  const displayedPosts = useMemo(() => {
    const base = focusedPost
      ? [focusedPost, ...posts.filter((post) => post.id !== focusedPost.id)]
      : posts
    return base.filter((post) => (
      !postReferencesAnyAuthor(post, blockedAuthorIds)
      && !postReferencesAnyAuthor(post, mutedAuthorIds)
    ))
  }, [blockedAuthorIds, focusedPost, mutedAuthorIds, posts])

  // ── Dados: autores para o cabeçalho; ordem original para o pager ───────────
  const userGroups = useMemo<UserGroup[]>(() => {
    const map = new Map<string, UserGroup>()
    displayedPosts.forEach((p) => {
      if (!map.has(p.user.id)) map.set(p.user.id, { user: p.user, posts: [] })
      map.get(p.user.id)!.posts.push(p)
    })
    return Array.from(map.values())
  }, [displayedPosts])

  const filteredGroups = useMemo(() => {
    const base = searchQuery.trim()
      ? userGroups.filter((g) => g.user.name.toLowerCase().includes(searchQuery.toLowerCase()))
      : userGroups
    return [...base].sort((a, b) => {
      const aSeen = a.posts.every((p) => viewedIds.has(p.id))
      const bSeen = b.posts.every((p) => viewedIds.has(p.id))
      return aSeen === bSeen ? 0 : aSeen ? 1 : -1
    })
  }, [userGroups, searchQuery, viewedIds])

  const flatPosts = useMemo(() => {
    const seen = new Set<string>()
    return displayedPosts.filter((post) => (seen.has(post.id) ? false : (seen.add(post.id), true)))
  }, [displayedPosts])

  const flatPostsRef = useRef(flatPosts)
  flatPostsRef.current = flatPosts

  // Inserir ou remover a cópia de um repost muda os índices da FlatList: tudo
  // o que estava abaixo desliza uma célula e o viewport passa a mostrar outro
  // post. Guardamos aqui quem estava a ser visto e repomos o offset em
  // `useLayoutEffect` — mesmo commit da inserção, antes de pintar. Com
  // `requestAnimationFrame` chegavam a desenhar-se frames com a lista já
  // deslocada, e era isso que se via a piscar.
  const pendingRepostAnchorRef = useRef<string[] | null>(null)

  useLayoutEffect(() => {
    const candidates = pendingRepostAnchorRef.current
    if (!candidates) return
    pendingRepostAnchorRef.current = null

    const source = flatPostsRef.current
    if (source.length === 0) return

    const index = candidates.reduce(
      (found, id) => (found >= 0 ? found : source.findIndex((post) => post.id === id)),
      -1,
    )
    const target = source[index >= 0 ? index : 0]
    listRef.current?.scrollToOffset({
      offset: (index >= 0 ? index : 0) * listHRef.current,
      animated: false,
    })
    if (target && target.id !== currentPostIdRef.current) setCurrentPostId(target.id)
  }, [flatPosts])

  const currentIndex = useMemo(() => {
    if (!currentPostId) return 0
    const i = flatPosts.findIndex((p) => p.id === currentPostId)
    return i >= 0 ? i : 0
  }, [currentPostId, flatPosts])

  const activePost = flatPosts[currentIndex]

  // Repõe um post exactamente no início do viewport. O teclado pode conservar
  // um contentOffset em píxeis enquanto a janela muda; sem este snap defensivo,
  // o offset deixa de ser múltiplo da altura da célula e mostra dois posts.
  const alignPagerToPost = useCallback((postId: string | null, height = listHRef.current) => {
    const source = flatPostsRef.current
    if (source.length === 0) return
    const found = postId ? source.findIndex((post) => post.id === postId) : 0
    const index = found >= 0 ? found : 0
    requestAnimationFrame(() => {
      listRef.current?.scrollToOffset({ offset: index * height, animated: false })
    })
  }, [])

  // Só a primeira medição normal (ou uma mudança real de largura) redefine a
  // geometria. Uma redução com a mesma largura é o teclado, não um novo ecrã.
  // A app está bloqueada em retrato, por isso manter esta altura é também o que
  // garante que cellHeight, getItemLayout e snapToInterval nunca divergem.
  const handleFeedLayout = useCallback((event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout
    if (width <= 0 || height <= 0) return

    const previous = measuredViewportRef.current
    if (!previous) {
      if (searchModeRef.current || Keyboard.isVisible()) return
      measuredViewportRef.current = { width, height }
      const heightChanged = Math.abs(height - listHRef.current) > 0.5
      listHRef.current = height
      if (heightChanged) setListH(height)
      return
    }

    const widthChanged = Math.abs(width - previous.width) > 1
    const keyboardSized = !widthChanged && height < previous.height - 1
    if (searchModeRef.current || Keyboard.isVisible() || keyboardSized) return
    if (!widthChanged && Math.abs(height - previous.height) <= 1) return

    measuredViewportRef.current = { width, height }
    listHRef.current = height
    setListH(height)
    alignPagerToPost(currentPostIdRef.current, height)
  }, [alignPagerToPost])

  const openComments = useCallback((post: Post) => {
    if (searchModeRef.current) searchRealignPendingRef.current = Keyboard.isVisible()
    Keyboard.dismiss()
    setSearchMode(false)
    setSearchQuery('')
    setCommentPost(post)
  }, [])

  // A TabBar mostra o alvo do post visível, sem guardar o Post inteiro fora da
  // feed. Ao desmontar, limpamos a ponte para não deixar uma referência antiga.
  useEffect(() => {
    setActiveCommentTarget(activePost ? {
      postId: activePost.id,
      authorId: activePost.user.id,
      authorName: activePost.user.name,
    } : null)
  }, [activePost?.id, activePost?.user.id, activePost?.user.name, setActiveCommentTarget])

  useEffect(() => () => {
    useFeedStore.getState().setActiveCommentTarget(null)
    useFeedStore.getState().clearCommentRequest()
  }, [])

  // Tocar no campo da navegação continua a abrir a folha que pertence à feed.
  useEffect(() => {
    if (!requestedCommentPostId) return
    const requestedPost = flatPosts.find((post) => post.id === requestedCommentPostId)
    clearCommentRequest()
    if (requestedPost) openComments(requestedPost)
  }, [requestedCommentPostId, flatPosts, clearCommentRequest, openComments])

  // Primeiro post assim que a feed carrega
  const initedRef = useRef(false)
  useEffect(() => {
    if (!initedRef.current && flatPosts.length > 0) {
      initedRef.current = true
      setCurrentPostId(flatPosts[0].id)
    }
  }, [flatPosts.length])

  const scrollToIndex = useCallback((idx: number) => {
    const fp = flatPostsRef.current
    const clamped = Math.max(0, Math.min(idx, fp.length - 1))
    if (fp[clamped]) listRef.current?.scrollToIndex({ index: clamped, animated: true })
  }, [])

  // ── Célula visível → post ativo (é o que decide qual vídeo toca) ───────────
  const onViewableItemsChanged = useRef(({ viewableItems }: { viewableItems: ViewToken[] }) => {
    const first = viewableItems.find((v) => v.isViewable)
    if (first?.item) setCurrentPostId((first.item as Post).id)
  }).current
  const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 80 }).current

  // ── Vistas: marca o post ativo como visto ──────────────────────────────────
  useEffect(() => {
    if (!activePost || viewedIds.has(activePost.id)) return
    markPostViewed(activePost.id).catch(() => {})
    postService.addView(activePost.id).catch(() => {})
    incrementView(activePost.id)
    setViewedIds((prev) => new Set(prev).add(activePost.id))
  }, [activePost?.id])

  const newPostsCount = useMemo(
    () => posts.filter((post) => (
      !postReferencesAnyAuthor(post, blockedAuthorIds)
      && !postReferencesAnyAuthor(post, mutedAuthorIds)
      && !viewedIds.has(post.id)
    )).length,
    [blockedAuthorIds, mutedAuthorIds, posts, viewedIds],
  )
  useEffect(() => { setNewPostsCount(newPostsCount) }, [newPostsCount])

  // Post publicado → prepend e sobe ao topo
  useEffect(() => {
    if (!pendingPost) return
    clearFocusedPost()
    prependPost(pendingPost)
    setPendingPost(null)
    requestAnimationFrame(() => listRef.current?.scrollToOffset({ offset: 0, animated: false }))
  }, [pendingPost, clearFocusedPost, prependPost, setPendingPost])

  // Um pedido novo leva o pager ao alvo uma única vez. O post continua no topo
  // depois disso, para que o utilizador possa deslizar normalmente pela feed.
  const handledFocusedPostRequest = useRef(0)
  useEffect(() => {
    if (!focusedPost || flatPosts.length === 0) return
    if (handledFocusedPostRequest.current === focusedPostRequest) return
    const idx = flatPosts.findIndex((post) => post.id === focusedPost.id)
    if (idx < 0) return
    handledFocusedPostRequest.current = focusedPostRequest
    setCurrentPostId(focusedPost.id)
    requestAnimationFrame(() => scrollToIndex(idx))
  }, [focusedPost, focusedPostRequest, flatPosts, scrollToIndex])

  // Prefetch dos próximos vídeos para o armazenamento
  useEffect(() => {
    const urls = flatPosts.slice(currentIndex + 1, currentIndex + 3)
      .filter((p) => p.mediaType === 'VIDEO')
      .map((p) => resolveMedia(p.mediaUrl))
    if (urls.length > 0) prefetchMedia(urls)
  }, [currentIndex])

  // ── Persistência dos likes ─────────────────────────────────────────────────
  const likedLoadedRef = useRef(false)
  const likedSeededRef = useRef(false)
  useEffect(() => {
    getCache<string[]>('liked_post_ids')
      .then((ids) => { likedLoadedRef.current = true; if (ids?.length) setLikedPostIds(new Set(ids)) })
      .catch(() => { likedLoadedRef.current = true })
  }, [])
  useEffect(() => {
    if (likedLoadedRef.current) setCache('liked_post_ids', Array.from(likedPostIds)).catch(() => {})
  }, [likedPostIds])
  useEffect(() => {
    if (likedSeededRef.current || posts.length === 0) return
    likedSeededRef.current = true
    const server = posts.filter((p) => p.userLiked).map((p) => p.id)
    if (server.length) setLikedPostIds((prev) => { const n = new Set(prev); server.forEach((id) => n.add(id)); return n })
  }, [posts])

  // Vistas persistidas
  useEffect(() => { getViewedPostIds().then(setViewedIds).catch(() => {}) }, [])

  const handleLikeChange = useCallback((postId: string, liked: boolean) => {
    setLikedPostIds((prev) => { const n = new Set(prev); liked ? n.add(postId) : n.delete(postId); return n })
    const base = flatPostsRef.current.find((p) => p.id === postId)?._count?.likes ?? 0
    updatePostCounts(postId, { likes: Math.max(0, base + (liked ? 1 : -1)) })
  }, [updatePostCounts])

  const handleRepostChange = useCallback((result: RepostResult) => {
    if (result.removedPostId && useFeedStore.getState().focusedPost?.id === result.removedPostId) {
      clearFocusedPost()
    }

    // A âncora fica marcada ANTES do setState: o `useLayoutEffect` acima corre
    // no commit dessa alteração e já a encontra. Ao desfazer a própria cópia,
    // o original é a segunda escolha.
    if (result.repostedPost || result.removedPostId) {
      const anchor = currentPostIdRef.current
      pendingRepostAnchorRef.current = anchor && anchor !== result.removedPostId
        ? [anchor, result.postId]
        : [result.postId]
    }

    updateRepostState(result)
  }, [clearFocusedPost, updateRepostState])

  const handlePostDeleted = useCallback((postId: string) => {
    if (useFeedStore.getState().focusedPost?.id === postId) clearFocusedPost()
    removePost(postId)
  }, [clearFocusedPost, removePost])

  const handlePostExpired = useCallback((postId: string) => {
    const wasFocused = useFeedStore.getState().focusedPost?.id === postId
    if (wasFocused) clearFocusedPost()
    // Um alvo externo não pertence necessariamente à feed/cache. Nesse caso,
    // basta removê-lo da ponte; os posts normais mantêm o fluxo já existente.
    if (!wasFocused || posts.some((post) => post.id === postId)) removePost(postId)
  }, [clearFocusedPost, posts, removePost])

  const handleProfileBlocked = useCallback((userId: string) => {
    moderationRevisionRef.current += 1
    const remaining = flatPostsRef.current.filter((post) => !postReferencesAuthor(post, userId))
    setBlockedAuthorIds((current) => {
      if (current.has(userId)) return current
      const next = new Set(current)
      next.add(userId)
      setCache(BLOCKED_USER_IDS_CACHE_KEY, Array.from(next)).catch(() => {})
      return next
    })
    const focused = useFeedStore.getState().focusedPost
    if (focused && postReferencesAuthor(focused, userId)) clearFocusedPost()
    setCurrentPostId(remaining[0]?.id ?? null)
    requestAnimationFrame(() => listRef.current?.scrollToOffset({ offset: 0, animated: false }))
    refresh().catch(() => {})
  }, [clearFocusedPost, refresh])

  const handleAuthorMuted = useCallback((userId: string) => {
    moderationRevisionRef.current += 1
    const remaining = flatPostsRef.current.filter((post) => !postReferencesAuthor(post, userId))
    setMutedAuthorIds((current) => {
      if (current.has(userId)) return current
      const next = new Set(current)
      next.add(userId)
      setCache(MUTED_USER_IDS_CACHE_KEY, Array.from(next)).catch(() => {})
      return next
    })
    if (useFeedStore.getState().focusedPost
      && postReferencesAuthor(useFeedStore.getState().focusedPost!, userId)) {
      clearFocusedPost()
    }
    setCurrentPostId(remaining[0]?.id ?? null)
    requestAnimationFrame(() => listRef.current?.scrollToOffset({ offset: 0, animated: false }))
    refresh().catch(() => {})
  }, [clearFocusedPost, refresh])

  // ── Pesquisa / topo ─────────────────────────────────────────────────────────
  const openSearchPanel = useCallback(() => {
    const anchor = currentPostIdRef.current ?? flatPostsRef.current[0]?.id ?? null
    searchAnchorPostIdRef.current = anchor
    alignPagerToPost(anchor)
    setSearchMode(true)
  }, [alignPagerToPost])

  useFocusEffect(useCallback(() => {
    if (openSearch) { openSearchPanel(); setOpenSearch(false) }
  }, [openSearch, openSearchPanel, setOpenSearch]))

  const handleSearchOpen   = openSearchPanel
  const handleSearchClose  = useCallback(() => {
    searchRealignPendingRef.current = Keyboard.isVisible()
    Keyboard.dismiss()
    setSearchMode(false)
    setSearchQuery('')
    alignPagerToPost(searchAnchorPostIdRef.current ?? currentPostIdRef.current)
  }, [alignPagerToPost])
  const handleSearchChange = useCallback((q: string) => setSearchQuery(q), [])
  const handleBubblePress  = useCallback((group: UserGroup) => {
    const idx = flatPostsRef.current.findIndex((p) => p.user.id === group.user.id)
    if (idx >= 0) {
      const targetId = flatPostsRef.current[idx].id
      searchAnchorPostIdRef.current = targetId
      setCurrentPostId(targetId)
      alignPagerToPost(targetId)
    }
    searchRealignPendingRef.current = Keyboard.isVisible()
    Keyboard.dismiss()
    setSearchMode(false)
    setSearchQuery('')
  }, [alignPagerToPost])
  const handleCreatePress  = useCallback(() => nav.navigate('Tabs', { screen: 'Create' }), [nav])
  const handleCirclePress  = useCallback(() => nav.navigate('Tabs', { screen: 'Circle' }), [nav])

  // Também cobre o gesto de esconder o teclado sem carregar em Cancelar. A
  // pesquisa continua aberta, mas a célula volta já ao seu snap exacto.
  useEffect(() => {
    const sub = Keyboard.addListener('keyboardDidHide', () => {
      if (!searchModeRef.current && !searchRealignPendingRef.current) return
      searchRealignPendingRef.current = false
      alignPagerToPost(searchAnchorPostIdRef.current ?? currentPostIdRef.current)
    })
    return () => sub.remove()
  }, [alignPagerToPost])

  // ── Foco: a status bar fica fora da mídia, sobre o papel claro da Feed ──────
  const refreshRef = useRef(refresh)
  refreshRef.current = refresh
  useFocusEffect(useCallback(() => {
    let active = true
    const revisionAtStart = moderationRevisionRef.current

    // O cache impede que autores já ocultados reapareçam no arranque offline.
    // A resposta do servidor substitui o Set inteiro ao recuperar foco, por isso
    // um "voltar a ver" feito no ecrã de gestão não exige reiniciar a app.
    ;(async () => {
      const [cachedBlocked, cachedMuted] = await Promise.all([
        getCache<string[]>(BLOCKED_USER_IDS_CACHE_KEY).catch(() => null),
        getCache<string[]>(MUTED_USER_IDS_CACHE_KEY).catch(() => null),
      ])
      if (!active || moderationRevisionRef.current !== revisionAtStart) return
      if (cachedBlocked) setBlockedAuthorIds(new Set(cachedBlocked))
      if (cachedMuted) setMutedAuthorIds(new Set(cachedMuted))

      const [blocked, muted] = await Promise.all([
        getBlockedUsers().catch(() => null),
        getMutedUsers().catch(() => null),
      ])
      if (!active || moderationRevisionRef.current !== revisionAtStart) return
      if (blocked) {
        const ids = blocked.map((user) => user.id)
        setBlockedAuthorIds(new Set(ids))
        setCache(BLOCKED_USER_IDS_CACHE_KEY, ids).catch(() => {})
      }
      if (muted) {
        const ids = muted.map((user) => user.id)
        setMutedAuthorIds(new Set(ids))
        setCache(MUTED_USER_IDS_CACHE_KEY, ids).catch(() => {})
      }
    })()

    return () => { active = false }
  }, []))

  useFocusEffect(useCallback(() => {
    setStatusBarStyle('dark')
    refreshRef.current()
    return () => setStatusBarStyle('dark')
  }, []))

  // ── Tocar em Home (já no feed) → volta ao topo e refresca ───────────────────
  const firstHomeTap = useRef(true)
  useEffect(() => {
    if (firstHomeTap.current) { firstHomeTap.current = false; return }
    clearFocusedPost()
    listRef.current?.scrollToOffset({ offset: 0, animated: true })
    refreshRef.current()
  }, [homeTap, clearFocusedPost])

  // ── Render de cada célula ───────────────────────────────────────────────────
  const renderItem = useCallback(({ item }: { item: Post }) => (
    <FeedItem
      post={item}
      reduceMotion={reduceMotion}
      isActive={item.id === currentPostId}
      cellHeight={listH}
      liked={likedPostIds.has(item.id)}
      commentCount={(item._count?.comments ?? 0) + (commentDeltas[item.id] ?? 0)}
      onCommentPress={openComments}
      onLikeChange={(liked) => handleLikeChange(item.id, liked)}
      onRepostChange={handleRepostChange}
      onDeleted={handlePostDeleted}
      onEdited={(id, caption) => updatePost(id, caption)}
      onProfileBlocked={handleProfileBlocked}
      onAuthorMuted={handleAuthorMuted}
      onExpired={handlePostExpired}
      onBlockingChange={() => {}}
    />
  ), [currentPostId, listH, likedPostIds, commentDeltas, openComments, handleLikeChange, handleRepostChange, handlePostDeleted, handlePostExpired, handleProfileBlocked, handleAuthorMuted, updatePost, reduceMotion])

  const getItemLayout = useCallback((_: unknown, index: number) => (
    { length: listH, offset: listH * index, index }
  ), [listH])

  return (
    <View
      style={s.container}
      onLayout={handleFeedLayout}
    >
      {flatPosts.length > 0 ? (
        <FlatList
          ref={listRef}
          style={s.pager}
          data={flatPosts}
          keyExtractor={(p) => p.id}
          renderItem={renderItem}
          getItemLayout={getItemLayout}
          scrollEnabled={!searchMode}
          showsVerticalScrollIndicator={false}
          snapToInterval={listH}
          snapToAlignment="start"
          decelerationRate="fast"
          disableIntervalMomentum
          bounces={false}
          alwaysBounceVertical={false}
          overScrollMode="never"
          contentInsetAdjustmentBehavior="never"
          onViewableItemsChanged={onViewableItemsChanged}
          viewabilityConfig={viewabilityConfig}
          onEndReached={loadMore}
          onEndReachedThreshold={0.6}
          windowSize={3}
          maxToRenderPerBatch={2}
          initialNumToRender={2}
          onScrollToIndexFailed={({ index }) => {
            listRef.current?.scrollToOffset({ offset: listH * index, animated: false })
          }}
        />
      ) : (
        <View style={s.empty}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={s.emptyTxt}>{t.msg_loading}</Text>
        </View>
      )}

      {/* Cabeçalho leve: marca à esquerda, ações livres à direita. */}
      {searchMode ? (
        <FeedHeader
          filteredGroups={filteredGroups}
          activeUserId={activePost?.user.id}
          searchMode
          searchQuery={searchQuery}
          onSearchClose={handleSearchClose}
          onSearchChange={handleSearchChange}
          onSearchPress={handleSearchOpen}
          onBubblePress={handleBubblePress}
          onCreatePress={handleCreatePress}
        />
      ) : (
        <>
          <View style={[s.topBar, { top: safeTop + 2 }]} pointerEvents="box-none">
            <View style={s.brandLockup}>
              <Wordmark height={26} color="#FFFFFF" />
            </View>

            <View style={s.topRightActions}>
              <TouchableOpacity
                style={s.topIconBtn}
                onPress={handleSearchOpen}
                activeOpacity={0.65}
                accessibilityRole="button"
                accessibilityLabel={t.feed_search_ph}
              >
                <FeedIcon name="search" size={TOP_ACTION_ICON_SIZE} color="#fff" weight="medium" />
              </TouchableOpacity>

              <TouchableOpacity
                style={s.topIconBtn}
                onPress={handleCirclePress}
                activeOpacity={0.65}
                accessibilityRole="button"
                accessibilityLabel={circleInvite ? `${t.circle_errTitle}, ${t.pending}` : t.circle_errTitle}
              >
                {circleInvite && (
                  <View style={s.circleInviteBadge}>
                    {/* Não veio `camera` no pacote — fica o ícone da Luxee. */}
                    <Icon name="camera" size={9} strokeWidth={2.5} color="#fff" />
                  </View>
                )}
                <FeedIcon name="circle" size={TOP_ACTION_ICON_SIZE} color="#fff" weight="medium" />
              </TouchableOpacity>

              <TouchableOpacity
                style={s.topIconBtn}
                onPress={handleCreatePress}
                activeOpacity={0.65}
                accessibilityRole="button"
                accessibilityLabel={t.feed_create}
              >
                <FeedIcon name="baseline-plus" size={TOP_ACTION_ICON_SIZE} color="#fff" />
              </TouchableOpacity>
            </View>
          </View>

        </>
      )}

      {commentPost && (
        <CommentSheet
          post={commentPost}
          onClose={() => setCommentPost(null)}
          onCommentAdded={() => setCommentDeltas((d) => ({ ...d, [commentPost.id]: (d[commentPost.id] ?? 0) + 1 }))}
        />
      )}
    </View>
  )
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.feedSurface },
  pager: { flex: 1, backgroundColor: colors.feedSurface },
  topBar: {
    position: 'absolute',
    left: 16,
    right: 8,
    zIndex: 30,
    height: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  brandLockup: { flexDirection: 'row', alignItems: 'flex-end' },
  topRightActions: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  topIconBtn: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'visible',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.46, shadowRadius: 2
  },
  circleInviteBadge: {
    position: 'absolute',
    top: 4,
    right: 4,
    zIndex: 2,
    width: 17,
    height: 17,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(10,10,12,0.9)',
    backgroundColor: colors.primary,
  },
  empty:     { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14, backgroundColor: colors.feedSurface },
  emptyTxt:  { fontFamily: fonts.medium, fontSize: 14, color: colors.gray600 }
})
