import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react'
import {
  View, Text, ActivityIndicator, FlatList, StyleSheet, Dimensions, Keyboard,
  type ViewToken,
} from 'react-native'
import { setStatusBarStyle } from 'expo-status-bar'
import { useNavigation, useFocusEffect } from '@react-navigation/native'
import { StackNavigationProp } from '@react-navigation/stack'
import { Post } from '../../types'
import { useFeed } from '../../hooks/useFeed'
import { useFeedStore } from '../../store/feed.store'
import { useAuthStore } from '../../store/auth.store'
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

  const [currentPostId, setCurrentPostId] = useState<string | null>(null)
  const [commentPost,   setCommentPost]   = useState<Post | null>(null)
  const [viewedIds,     setViewedIds]     = useState<Set<string>>(new Set())
  const [searchMode,    setSearchMode]    = useState(false)
  const [searchQuery,   setSearchQuery]   = useState('')
  const [commentDeltas, setCommentDeltas] = useState<Record<string, number>>({})
  const [likedPostIds,  setLikedPostIds]  = useState<Set<string>>(new Set())
  const [repostedIds,   setRepostedIds]   = useState<Set<string>>(new Set())

  const listRef = useRef<FlatList<Post>>(null)

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

  // ── Foco: refresca e mete a barra de estado clara (média escura no topo) ────
  const refreshRef = useRef(refresh)
  refreshRef.current = refresh
  useFocusEffect(useCallback(() => {
    setStatusBarStyle('light')
    refreshRef.current()
    return () => setStatusBarStyle('dark')
  }, []))

  // ── Render de cada célula ───────────────────────────────────────────────────
  const renderItem = useCallback(({ item }: { item: Post }) => (
    <FeedItem
      post={item}
      isActive={item.id === currentPostId}
      liked={likedPostIds.has(item.id)}
      reposted={repostedIds.has(item.id)}
      commentCount={(item._count?.comments ?? 0) + (commentDeltas[item.id] ?? 0)}
      onCommentPress={(p) => {
        if (searchMode) { Keyboard.dismiss(); setSearchMode(false); setSearchQuery('') }
        setCommentPost(p)
      }}
      onLikeChange={(liked) => handleLikeChange(item.id, liked)}
      onRepost={() => handleRepost(item.id)}
      onDeleted={(id) => removePost(id)}
      onEdited={(id, caption) => updatePost(id, caption)}
      onExpired={(id) => removePost(id)}
      onBlockingChange={() => {}}
    />
  ), [currentPostId, likedPostIds, repostedIds, commentDeltas, searchMode, handleLikeChange, handleRepost, removePost, updatePost])

  const getItemLayout = useCallback((_: unknown, index: number) => (
    { length: SCREEN_H, offset: SCREEN_H * index, index }
  ), [])

  return (
    <View style={s.container}>
      {flatPosts.length > 0 ? (
        <FlatList
          ref={listRef}
          data={flatPosts}
          keyExtractor={(p) => p.id}
          renderItem={renderItem}
          getItemLayout={getItemLayout}
          showsVerticalScrollIndicator={false}
          snapToInterval={SCREEN_H}
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
            listRef.current?.scrollToOffset({ offset: SCREEN_H * index, animated: false })
          }}
        />
      ) : (
        <View style={s.empty}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={s.emptyTxt}>{t.msg_loading}</Text>
        </View>
      )}

      {/* Topo — barra de avatares, overlay fixo sobre o feed */}
      <FeedHeader
        filteredGroups={filteredGroups}
        activeUserId={activePost?.user.id}
        searchMode={searchMode}
        searchQuery={searchQuery}
        onSearchClose={handleSearchClose}
        onSearchChange={handleSearchChange}
        onSearchPress={handleSearchOpen}
        onBubblePress={handleBubblePress}
        onCreatePress={handleCreatePress}
      />

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
  empty:     { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14, backgroundColor: colors.black },
  emptyTxt:  { fontFamily: fonts.medium, fontSize: 14, color: 'rgba(255,255,255,0.7)' },
})
