import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react'
import {
  View, Text, ActivityIndicator, FlatList, StyleSheet, Dimensions, Keyboard, TouchableOpacity,
  type ViewToken,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Camera, Circle, Plus, Search } from 'lucide-react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { setStatusBarStyle } from 'expo-status-bar'
import { useNavigation, useFocusEffect } from '@react-navigation/native'
import { StackNavigationProp } from '@react-navigation/stack'
import { Post } from '../../types'
import { useFeed } from '../../hooks/useFeed'
import { useFeedStore } from '../../store/feed.store'
import { useNotificationStore } from '../../store/notification.store'
import { AppStackParams } from '../../navigation/AppNavigator'
import { markPostViewed, getViewedPostIds, getCache, setCache } from '../../db/database'
import * as postService from '../../services/post.service'
import { toast } from '../../utils/toast'
import { useT } from '../../i18n'
import { prefetchMedia } from '../../db/mediaCache'
import { colors, fonts } from '../../theme'
import { API_BASE } from '../../config'
import FeedHeader, { FeedUserGroup as UserGroup } from './FeedHeader'
import FeedItem from './FeedItem'
import CommenterStack from './CommenterStack'
import CommentSheet from '../../components/CommentSheet'

const { height: SCREEN_H } = Dimensions.get('window')

type Nav = StackNavigationProp<AppStackParams>

function resolveMedia(url: string | null | undefined): string {
  if (!url) return ''
  return url.startsWith('http') ? url : `${API_BASE}${url}`
}

// ─── Feed ──────────────────────────────────────────────────────────────────
// Pager vertical: uma FlatList paginada onde cada célula é um post em ecrã
// inteiro (FeedItem). A célula é dona do seu vídeo — aqui só se gere o estado
// partilhado (likes, reposts, vistas), o agrupamento do topo e a folha de
// comentários. O deslize suave vem da própria FlatList.
export default function FeedScreen() {
  const { posts, loading, refresh, loadMore, prependPost, removePost, updatePost, incrementView, updatePostCounts } = useFeed()
  const t   = useT()
  const nav = useNavigation<Nav>()

  const setNewPostsCount = useFeedStore((s) => s.setNewPostsCount)
  const pendingPost      = useFeedStore((s) => s.pendingPost)
  const setPendingPost   = useFeedStore((s) => s.setPendingPost)
  const jumpToPostId     = useFeedStore((s) => s.jumpToPostId)
  const setJumpToPostId  = useFeedStore((s) => s.setJumpToPostId)
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
  const [repostedIds,   setRepostedIds]   = useState<Set<string>>(new Set())

  const listRef = useRef<FlatList<Post>>(null)
  const { top: safeTop } = useSafeAreaInsets()
  // Altura real da área da lista (medida). O pager usa-a para a célula, o snap
  // e o layout — assim toda a gente fica alinhada (Dimensions.window no arranque
  // podia não bater certo e desalinhava os posts a partir do 2.º).
  const [listH, setListH] = useState(SCREEN_H)

  // ── Dados: agrupar por autor (topo) e achatar (pager) ──────────────────────
  const userGroups = useMemo<UserGroup[]>(() => {
    const map = new Map<string, UserGroup>()
    posts.forEach((p) => {
      if (!map.has(p.user.id)) map.set(p.user.id, { user: p.user, posts: [] })
      map.get(p.user.id)!.posts.push(p)
    })
    return Array.from(map.values())
  }, [posts])

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
    return userGroups.flatMap((g) => g.posts).filter((p) => (seen.has(p.id) ? false : (seen.add(p.id), true)))
  }, [userGroups])

  const flatPostsRef = useRef(flatPosts)
  flatPostsRef.current = flatPosts

  const currentIndex = useMemo(() => {
    if (!currentPostId) return 0
    const i = flatPosts.findIndex((p) => p.id === currentPostId)
    return i >= 0 ? i : 0
  }, [currentPostId, flatPosts])

  const activePost = flatPosts[currentIndex]

  const openComments = useCallback((post: Post) => {
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
    () => flatPosts.filter((p) => !viewedIds.has(p.id)).length,
    [flatPosts, viewedIds],
  )
  useEffect(() => { setNewPostsCount(newPostsCount) }, [newPostsCount])

  // Post publicado/repostado → prepend e sobe ao topo
  useEffect(() => {
    if (!pendingPost) return
    prependPost(pendingPost)
    setPendingPost(null)
    requestAnimationFrame(() => listRef.current?.scrollToOffset({ offset: 0, animated: false }))
  }, [pendingPost])

  // Saltar para um post pedido de outro ecrã (grelha do perfil → feed)
  useEffect(() => {
    if (!jumpToPostId || flatPosts.length === 0) return
    const idx = flatPosts.findIndex((p) => p.id === jumpToPostId)
    if (idx >= 0) { scrollToIndex(idx); setJumpToPostId(null) }
  }, [jumpToPostId, flatPosts])

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

  // ── Repostar ────────────────────────────────────────────────────────────────
  const handleRepost = useCallback((postId: string) => {
    setRepostedIds((prev) => new Set(prev).add(postId))
    postService.repostPost(postId)
      .then((newPost) => { setPendingPost(newPost); toast.success(t.feed_reposted, t.feed_reposted_sub) })
      .catch(() => {
        setRepostedIds((prev) => { const s = new Set(prev); s.delete(postId); return s })
        toast.error(t.error, t.feed_repost_fail)
      })
  }, [t, setPendingPost])

  const handleLikeChange = useCallback((postId: string, liked: boolean) => {
    setLikedPostIds((prev) => { const n = new Set(prev); liked ? n.add(postId) : n.delete(postId); return n })
    const base = flatPostsRef.current.find((p) => p.id === postId)?._count?.likes ?? 0
    updatePostCounts(postId, { likes: Math.max(0, base + (liked ? 1 : -1)) })
  }, [updatePostCounts])

  // ── Pesquisa / topo ─────────────────────────────────────────────────────────
  useFocusEffect(useCallback(() => {
    if (openSearch) { setSearchMode(true); setOpenSearch(false) }
  }, [openSearch]))

  const handleSearchOpen   = useCallback(() => setSearchMode(true), [])
  const handleSearchClose  = useCallback(() => { Keyboard.dismiss(); setSearchMode(false); setSearchQuery('') }, [])
  const handleSearchChange = useCallback((q: string) => setSearchQuery(q), [])
  const handleBubblePress  = useCallback((group: UserGroup) => {
    const idx = flatPostsRef.current.findIndex((p) => p.user.id === group.user.id)
    if (idx >= 0) scrollToIndex(idx)
    setSearchMode(false); setSearchQuery('')
  }, [scrollToIndex])
  const handleCreatePress  = useCallback(() => nav.navigate('Tabs', { screen: 'Create' }), [nav])
  const handleCirclePress  = useCallback(() => nav.navigate('Tabs', { screen: 'Circle' }), [nav])

  // ── Foco: refresca e mete a barra de estado clara (média escura no topo) ────
  const refreshRef = useRef(refresh)
  refreshRef.current = refresh
  useFocusEffect(useCallback(() => {
    setStatusBarStyle('light')
    refreshRef.current()
    return () => setStatusBarStyle('dark')
  }, []))

  // ── Tocar em Home (já no feed) → volta ao topo e refresca ───────────────────
  const firstHomeTap = useRef(true)
  useEffect(() => {
    if (firstHomeTap.current) { firstHomeTap.current = false; return }
    listRef.current?.scrollToOffset({ offset: 0, animated: true })
    refreshRef.current()
  }, [homeTap])

  // ── Render de cada célula ───────────────────────────────────────────────────
  const renderItem = useCallback(({ item }: { item: Post }) => (
    <FeedItem
      post={item}
      isActive={item.id === currentPostId}
      cellHeight={listH}
      liked={likedPostIds.has(item.id)}
      reposted={repostedIds.has(item.id)}
      commentCount={(item._count?.comments ?? 0) + (commentDeltas[item.id] ?? 0)}
      onCommentPress={openComments}
      onLikeChange={(liked) => handleLikeChange(item.id, liked)}
      onRepost={() => handleRepost(item.id)}
      onDeleted={(id) => removePost(id)}
      onEdited={(id, caption) => updatePost(id, caption)}
      onExpired={(id) => removePost(id)}
      onBlockingChange={() => {}}
    />
  ), [currentPostId, listH, likedPostIds, repostedIds, commentDeltas, openComments, handleLikeChange, handleRepost, removePost, updatePost])

  const getItemLayout = useCallback((_: unknown, index: number) => (
    { length: listH, offset: listH * index, index }
  ), [listH])

  return (
    <View
      style={s.container}
      onLayout={(e) => {
        const h = e.nativeEvent.layout.height
        if (h > 0 && h !== listH) setListH(h)
      }}
    >
      {flatPosts.length > 0 ? (
        <FlatList
          ref={listRef}
          data={flatPosts}
          keyExtractor={(p) => p.id}
          renderItem={renderItem}
          getItemLayout={getItemLayout}
          showsVerticalScrollIndicator={false}
          snapToInterval={listH}
          snapToAlignment="start"
          decelerationRate="fast"
          disableIntervalMomentum
          onViewableItemsChanged={onViewableItemsChanged}
          viewabilityConfig={viewabilityConfig}
          onEndReached={loadMore}
          onEndReachedThreshold={0.6}
          windowSize={3}
          maxToRenderPerBatch={2}
          initialNumToRender={2}
          removeClippedSubviews
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
          <LinearGradient
            colors={['rgba(0,0,0,0.46)', 'rgba(0,0,0,0.16)', 'transparent']}
            locations={[0, 0.56, 1]}
            style={[s.topScrim, { height: safeTop + 108 }]}
            pointerEvents="none"
          />

          <View style={[s.topBar, { top: safeTop + 2 }]} pointerEvents="box-none">
            <Text style={s.wordmark} accessibilityRole="header">luxee</Text>

            <View style={s.topRightActions}>
              <TouchableOpacity
                style={s.topIconBtn}
                onPress={handleSearchOpen}
                activeOpacity={0.65}
                accessibilityRole="button"
                accessibilityLabel={t.feed_search_ph}
              >
                <Search size={24} strokeWidth={1.9} color="#fff" />
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
                    <Camera size={9} strokeWidth={2.5} color="#fff" />
                  </View>
                )}
                <Circle size={24} strokeWidth={1.9} color="#fff" />
              </TouchableOpacity>

              <TouchableOpacity
                style={s.topIconBtn}
                onPress={handleCreatePress}
                activeOpacity={0.65}
                accessibilityRole="button"
                accessibilityLabel={t.feed_create}
              >
                <Plus size={28} strokeWidth={2} color="#fff" />
              </TouchableOpacity>
            </View>
          </View>

          {/* Quem comentou o post visível — por baixo da marca, canto superior esquerdo. */}
          <View style={[s.commenters, { top: safeTop + 52 }]} pointerEvents="box-none">
            <CommenterStack
              commenters={activePost?.recentCommenters ?? []}
              onPress={activePost ? () => openComments(activePost) : undefined}
            />
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
  container: { flex: 1, backgroundColor: colors.black },
  topScrim: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 29,
  },
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
  wordmark: {
    color: '#fff',
    fontFamily: fonts.extraBold,
    fontSize: 25,
    lineHeight: 32,
    letterSpacing: -1.25,
    textShadowColor: 'rgba(0,0,0,0.45)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 5,
  },
  topRightActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  commenters: {
    position: 'absolute',
    left: 16,
    // Sem `right`: a fila mede-se pelo conteúdo e não intercepta toques à direita.
    zIndex: 30,
  },
  topIconBtn: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'visible',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.35, shadowRadius: 5,
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
  empty:     { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14, backgroundColor: colors.black },
  emptyTxt:  { fontFamily: fonts.medium, fontSize: 14, color: 'rgba(255,255,255,0.7)' },
})
