import React, { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useIsFocused, useNavigation } from '@react-navigation/native'
import { StackNavigationProp } from '@react-navigation/stack'

import CommentSheet from '../../components/CommentSheet'
import SharePostSheet from '../../components/SharePostSheet'
import { useT } from '../../i18n'
import { useFeed } from '../../hooks/useFeed'
import { useAuthStore } from '../../store/auth.store'
import { useFeedStore } from '../../store/feed.store'
import { AppStackParams } from '../../navigation/AppNavigator'
import { getActiveCircles, type ActiveCircle } from '../../services/circle.service'
import * as postService from '../../services/post.service'
import { isConnected } from '../../services/netinfo.service'
import { queueLike, updateCachedPost } from '../../db/database'
import { tabBarOccupiedHeight } from '../../components/TabBar/layout'
import type { Post } from '../../types'
import { colors, fonts, spacing, typography } from '../../theme'
import HomeCirclesRow from './HomeCirclesRow'
import HomeHeader from './HomeHeader'
import HomeFeedItem from './HomeFeedItem'

type Nav = StackNavigationProp<AppStackParams>

/**
 * A Home da Luxey.
 *
 * Página branca, scroll vertical, sem cartões. O que a distingue de qualquer
 * outra rede não é o cromado — é o que ocupa o meio da página: a composição
 * circular de um Círculo, várias pessoas no mesmo momento, desenhada como uma só
 * figura em vez de uma grelha de fotografias.
 *
 * O cabeçalho fica fixo e a fila de Círculos rola com o conteúdo. É deliberado:
 * a assinatura e as duas acções têm de estar sempre à mão, mas a fila é a
 * primeira coisa da página, não uma barra permanente — mantê-la colada ao topo
 * roubava altura ao conteúdo em todo o scroll para servir uma decisão que se
 * toma no início.
 *
 * Os dados são os que já existiam: `useFeed` para as publicações, `getActiveCircles`
 * para a fila. Comentários, partilha e opções reutilizam as folhas que a Feed
 * imersiva já usava — nada disto é lógica nova.
 */
export default function HomeScreen() {
  const t = useT()
  const nav = useNavigation<Nav>()
  const isFocused = useIsFocused()
  const { width } = useWindowDimensions()
  const { top, bottom } = useSafeAreaInsets()

  const { posts, loading, refresh, loadMore, updatePostCounts, removePost, updatePost } = useFeed()
  const me = useAuthStore((state) => state.user)
  const showPostInFeed = useFeedStore((state) => state.showPostInFeed)

  const [circles, setCircles] = useState<ActiveCircle[]>([])
  const [refreshing, setRefreshing] = useState(false)
  const [likedIds, setLikedIds] = useState<Set<string>>(new Set())
  const [commentPost, setCommentPost] = useState<Post | null>(null)
  const [sharePost, setSharePost] = useState<Post | null>(null)

  // ── Fila de Círculos ───────────────────────────────────────────────────────
  // Só enquanto a Home está à frente. Uma sessão dura no máximo duas horas, mas
  // "a acontecer agora" tem de ser verdade — daí a releitura de minuto a minuto.
  useEffect(() => {
    if (!isFocused) return
    let alive = true
    const load = async () => {
      if (!isConnected()) return
      try {
        const list = await getActiveCircles()
        if (alive) setCircles(list)
      } catch {}
    }
    load()
    const timer = setInterval(load, 60_000)
    return () => { alive = false; clearInterval(timer) }
  }, [isFocused])

  const handleRefresh = useCallback(async () => {
    setRefreshing(true)
    try { await refresh() } finally { setRefreshing(false) }
  }, [refresh])

  // ── Acções ────────────────────────────────────────────────────────────────
  const openAuthor = useCallback((post: Post) => {
    nav.navigate('Profile', { userId: post.user.id })
  }, [nav])

  /**
   * Um vídeo abre em ecrã inteiro, nunca dentro da lista.
   *
   * A publicação entra na Feed imersiva pelo mesmo `showPostInFeed` que o perfil,
   * a pesquisa e as mensagens já usam — é ele que a põe em primeiro e faz o pager
   * aterrar nela sem animação nem salto.
   */
  const openMedia = useCallback((post: Post) => {
    showPostInFeed(post)
    nav.navigate('Immersive')
  }, [nav, showPostInFeed])

  const toggleLike = useCallback((post: Post) => {
    const was = likedIds.has(post.id)
    setLikedIds((prev) => {
      const next = new Set(prev)
      if (was) next.delete(post.id); else next.add(post.id)
      return next
    })
    const likes = (post._count?.likes ?? 0) + (was ? -1 : 1)
    updatePostCounts?.(post.id, { likes })
    updateCachedPost(post.id, { _count: { ...post._count, likes } }).catch(() => {})

    // Sem rede o gosto fica na fila e o estado optimista mantém-se — desfazê-lo
    // à frente da pessoa por não haver rede é perder a intenção dela.
    if (!isConnected()) { queueLike(post.id, !was).catch(() => {}); return }
    postService.likePost(post.id).catch(() => {})
  }, [likedIds, updatePostCounts])

  const renderItem = useCallback(({ item }: { item: Post }) => (
    <HomeFeedItem
      post={item}
      width={width}
      liked={likedIds.has(item.id)}
      commentCount={item._count?.comments ?? 0}
      onOpenAuthor={openAuthor}
      onOpenMedia={openMedia}
      onLike={toggleLike}
      onComment={setCommentPost}
      onShare={setSharePost}
      onDeleted={removePost}
      onEdited={updatePost}
    />
  ), [likedIds, openAuthor, openMedia, removePost, toggleLike, updatePost, width])

  const listHeader = useMemo(() => (
    <View style={s.circlesSlot}>
      <HomeCirclesRow
        circles={circles}
        me={me ? { name: me.name, avatar: me.avatar } : null}
        onCreate={() => nav.navigate('Tabs', { screen: 'Circle' })}
        onOpen={() => nav.navigate('Tabs', { screen: 'Circle' })}
        onOpenMine={() => nav.navigate('Tabs', { screen: 'Circle' })}
      />
    </View>
  ), [circles, me, nav])

  return (
    <View style={[s.screen, { paddingTop: top }]}>
      <HomeHeader
        onSearch={() => nav.navigate('Tabs', { screen: 'Search' })}
        onCreate={() => nav.navigate('Tabs', { screen: 'Create' })}
      />

      {posts.length === 0 && loading ? (
        <View style={s.state}>
          <ActivityIndicator color={colors.gray400} />
        </View>
      ) : posts.length === 0 ? (
        <View style={s.state}>
          <Text style={s.stateTitle}>{t.feed_empty_title}</Text>
        </View>
      ) : (
        <FlatList
          data={posts}
          keyExtractor={(post) => post.id}
          renderItem={renderItem}
          ListHeaderComponent={listHeader}
          contentContainerStyle={{ paddingBottom: tabBarOccupiedHeight(bottom) + spacing.xl }}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.gray400} />
          }
          onEndReached={loadMore}
          onEndReachedThreshold={0.6}
          // Alturas variáveis (a composição de um Círculo depende de quantos são),
          // por isso não há `getItemLayout`. O que segura a performance é a janela
          // curta e o recorte do que sai do ecrã.
          removeClippedSubviews
          initialNumToRender={3}
          maxToRenderPerBatch={3}
          windowSize={5}
        />
      )}

      {commentPost && (
        <CommentSheet post={commentPost} onClose={() => setCommentPost(null)} />
      )}
      {sharePost && (
        <SharePostSheet post={sharePost} onClose={() => setSharePost(null)} />
      )}
    </View>
  )
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.white },
  circlesSlot: { paddingTop: spacing.xs2, paddingBottom: spacing.lg },
  state: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.sm },
  stateTitle: {
    color: colors.gray500,
    fontFamily: fonts.medium,
    fontSize: typography.body,
    textAlign: 'center',
  },
})
