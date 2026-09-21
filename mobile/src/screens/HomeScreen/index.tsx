import React, { useCallback, useEffect, useRef, useState } from 'react'
import {
  FlatList,
  RefreshControl,
  StyleSheet,
  View,
  useWindowDimensions,
} from 'react-native'
import { setStatusBarStyle } from 'expo-status-bar'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useFocusEffect, useIsFocused, useNavigation } from '@react-navigation/native'
import { StackNavigationProp } from '@react-navigation/stack'

import CommentSheet from '../../components/CommentSheet'
import SharePostSheet from '../../components/SharePostSheet'
import { useFeed } from '../../hooks/useFeed'
import { useFeedStore } from '../../store/feed.store'
import { AppStackParams } from '../../navigation/AppNavigator'
import * as postService from '../../services/post.service'
import { isConnected, onConnectivityChange } from '../../services/netinfo.service'
import { queueLike, updateCachedPost } from '../../db/database'
import { tabBarOccupiedHeight } from '../../components/TabBar/layout'
import type { Post } from '../../types'
import type { ViewToken } from 'react-native'
import useReducedMotionPreference from '../../hooks/useReducedMotionPreference'
import { colors, spacing } from '../../theme'
import { actionInkRest } from '../FeedScreen/tokens'
import HomeHeader from './HomeHeader'
import HomeFeedItem from './HomeFeedItem'
import { HomeEmpty, HomeFooter, HomeOffline, HomeSkeleton } from './HomeStates'

/** Quantas publicações fingidas a página desenha enquanto a primeira não chega. */
const SKELETONS = 3

type Nav = StackNavigationProp<AppStackParams>

/**
 * A Home da Luxey.
 *
 * Página branca, scroll vertical, sem cartões. O que a distingue de qualquer
 * outra rede não é o cromado — é o que ocupa o meio da página: a composição
 * circular de um Círculo, várias pessoas no mesmo momento, desenhada como uma só
 * figura em vez de uma grelha de fotografias.
 *
 * O cabeçalho fica fixo; abaixo dele é só conteúdo.
 *
 * Os dados são os que já existiam: `useFeed` para as publicações. Comentários,
 * partilha e opções reutilizam as folhas que a Feed imersiva já usava — nada
 * disto é lógica nova.
 */
export default function HomeScreen() {
  const nav = useNavigation<Nav>()
  // Sair da Home cala o vídeo. Sem isto continuava a tocar por baixo de outro
  // separador — invisível, a gastar rede e bateria.
  const isFocused = useIsFocused()
  const { width } = useWindowDimensions()
  const { top, bottom } = useSafeAreaInsets()

  const reduceMotion = useReducedMotionPreference()
  const {
    posts, loading, paginating, pageFailed,
    refresh, loadMore, updatePostCounts, updateRepostState, removePost, updatePost,
  } = useFeed()
  const showPostInFeed = useFeedStore((state) => state.showPostInFeed)

  const homeTap = useFeedStore((state) => state.homeTap)
  const listRef = useRef<FlatList<Post>>(null)

  const [visibleId, setVisibleId] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  // A faixa de "sem ligação" acompanha a rede em tempo real; `isConnected()` é
  // uma leitura, não um estado, e sozinha nunca voltaria a desenhar a página.
  const [offline, setOffline] = useState(!isConnected())
  // Só guarda interações desta sessão. Sem override, a verdade vem do post —
  // assim um gosto que já veio do servidor não nasce visualmente desligado.
  const [likeOverrides, setLikeOverrides] = useState<Record<string, boolean>>({})
  const [repostOverrides, setRepostOverrides] = useState<Record<string, boolean>>({})
  const [commentPost, setCommentPost] = useState<Post | null>(null)
  const [sharePost, setSharePost] = useState<Post | null>(null)
  const commentPostRef = useRef(commentPost)
  const sharePostRef = useRef(sharePost)
  commentPostRef.current = commentPost
  sharePostRef.current = sharePost

  // ── Primeiro carregamento ──────────────────────────────────────────────────
  //
  // O `useFeed` não carrega ao montar — de propósito, para o mesmo estado servir
  // vários ecrãs sem cada um disparar a sua busca. Quem pede o primeiro
  // carregamento é o ecrã, ao ganhar foco, e era exactamente isto que faltava
  // aqui: a Home montava, ficava com `posts` vazio e desenhava para sempre o
  // estado de "a preparar".
  //
  // A ref evita que trocar a identidade de `refresh` volte a disparar a busca; é
  // o mesmo padrão que a Feed imersiva já usava.
  const refreshRef = useRef(refresh)
  refreshRef.current = refresh

  useFocusEffect(useCallback(() => {
    // Página branca pede ícones escuros na barra de estado. A Feed imersiva põe
    // 'light' quando abre e repõe 'dark' ao sair, por isso voltar para aqui tem
    // de reafirmar — senão fica branco sobre branco.
    setStatusBarStyle('dark')
    refreshRef.current().catch(() => {})
  }, []))

  // Tocar em Home já estando na Home: volta ao topo e relê.
  const firstHomeTap = useRef(true)
  useEffect(() => {
    if (firstHomeTap.current) { firstHomeTap.current = false; return }
    listRef.current?.scrollToOffset({ offset: 0, animated: true })
    refreshRef.current().catch(() => {})
  }, [homeTap])

  useEffect(() => onConnectivityChange((connected) => setOffline(!connected)), [])

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
   *
   * A imersiva é um separador e não um ecrã empilhado: é a barra do navegador de
   * separadores que se transforma no campo de comentário, e por cima dela esse
   * campo não existiria.
   */
  const openMedia = useCallback((post: Post) => {
    showPostInFeed(post)
    nav.navigate('Tabs', { screen: 'Immersive' })
  }, [nav, showPostInFeed])

  const toggleLike = useCallback((post: Post) => {
    const was = likeOverrides[post.id] ?? Boolean(post.userLiked)
    const intended = !was
    setLikeOverrides((prev) => ({ ...prev, [post.id]: intended }))
    const likes = Math.max(0, (post._count?.likes ?? 0) + (was ? -1 : 1))
    updatePostCounts?.(post.id, { likes })
    updateCachedPost(post.id, {
      userLiked: intended,
      _count: { ...post._count, likes },
    }).catch(() => {})

    // Sem rede o gosto fica na fila e o estado optimista mantém-se — desfazê-lo
    // à frente da pessoa por não haver rede é perder a intenção dela.
    if (!isConnected()) { queueLike(post.id, intended).catch(() => {}); return }
    postService.likePost(post.id)
      .then(({ liked }) => {
        setLikeOverrides((prev) => ({ ...prev, [post.id]: liked }))
        if (liked === intended) return
        const confirmedLikes = Math.max(0, likes + (liked ? 1 : -1))
        updatePostCounts?.(post.id, { likes: confirmedLikes })
        updateCachedPost(post.id, {
          userLiked: liked,
          _count: { ...post._count, likes: confirmedLikes },
        }).catch(() => {})
      })
      .catch(() => queueLike(post.id, intended).catch(() => {}))
  }, [likeOverrides, updatePostCounts])

  const handleCommentAdded = useCallback(() => {
    const current = commentPostRef.current
    if (!current) return
    const comments = (current._count?.comments ?? 0) + 1
    const next = { ...current, _count: { ...current._count, comments } }
    commentPostRef.current = next
    setCommentPost(next)
    updatePostCounts?.(current.id, { comments })
    updateCachedPost(current.id, { _count: next._count }).catch(() => {})
  }, [updatePostCounts])

  const handleShared = useCallback(() => {
    const current = sharePostRef.current
    if (!current) return
    const shares = (current._count?.shares ?? 0) + 1
    const next = { ...current, _count: { ...current._count, shares } }
    sharePostRef.current = next
    setSharePost(next)
    updatePostCounts?.(current.id, { shares })
    updateCachedPost(current.id, { _count: next._count }).catch(() => {})
  }, [updatePostCounts])

  /**
   * Repostar, com o mesmo desenho optimista do gosto: o ecrã muda primeiro e a
   * rede confirma depois. A verdade vem de `post.userReposted` — não há aqui um
   * conjunto local em paralelo, que seria uma segunda fonte a divergir da lista.
   */
  const toggleRepost = useCallback((post: Post) => {
    const was = repostOverrides[post.id] ?? Boolean(post.userReposted)
    const next = !was
    const before = post._count?.reposts ?? 0
    setRepostOverrides((prev) => ({ ...prev, [post.id]: next }))

    // O ecrã muda primeiro; a resposta do servidor corrige-o a seguir. Quem
    // reconcilia é o `updateRepostState` do `useFeed`, que já sabe propagar o
    // estado para o original e para todas as cópias — não é trabalho para aqui.
    updatePostCounts?.(post.id, { reposts: before + (next ? 1 : -1) })

    postService.setRepost(post.id, next)
      .then((result) => {
        setRepostOverrides((prev) => ({ ...prev, [post.id]: result.reposted }))
        updateRepostState?.(result)
      })
      .catch(() => {
        setRepostOverrides((prev) => ({ ...prev, [post.id]: was }))
        updatePostCounts?.(post.id, { reposts: before })
      })
  }, [repostOverrides, updatePostCounts, updateRepostState])

  // Medimos cobertura do viewport: uma mídia alta pode nunca mostrar 70% da
  // própria célula. Mais de metade do ecrã escolhe um único vídeo para tocar.
  const onViewableItemsChanged = useRef(({ viewableItems }: { viewableItems: ViewToken[] }) => {
    const first = viewableItems.find((entry) => entry.isViewable)
    setVisibleId((first?.item as Post | undefined)?.id ?? null)
  }).current
  const viewabilityConfig = useRef({ viewAreaCoveragePercentThreshold: 55 }).current

  const renderItem = useCallback(({ item }: { item: Post }) => (
    <HomeFeedItem
      post={item}
      width={width}
      active={isFocused && item.id === visibleId}
      liked={likeOverrides[item.id] ?? Boolean(item.userLiked)}
      likeCount={item._count?.likes ?? 0}
      reposted={repostOverrides[item.id] ?? Boolean(item.userReposted)}
      repostCount={item._count?.reposts ?? 0}
      commentCount={item._count?.comments ?? 0}
      shareCount={item._count?.shares ?? 0}
      reduceMotion={reduceMotion}
      onOpenAuthor={openAuthor}
      onOpenMedia={openMedia}
      onLike={toggleLike}
      onRepost={toggleRepost}
      onComment={setCommentPost}
      onShare={setSharePost}
      onDeleted={removePost}
      onEdited={updatePost}
    />
  ), [isFocused, visibleId, likeOverrides, openAuthor, openMedia, reduceMotion, removePost, repostOverrides, toggleLike, toggleRepost, updatePost, width])

  return (
    <View style={[s.screen, { paddingTop: top }]}>
      <HomeHeader
        onSearch={() => nav.navigate('Tabs', { screen: 'Search' })}
        onCreate={() => nav.navigate('Tabs', { screen: 'Create' })}
      />

      {offline && <HomeOffline />}

      {posts.length === 0 && loading ? (
        <View>
          {Array.from({ length: SKELETONS }, (_, index) => (
            <HomeSkeleton key={index} width={width} reduceMotion={reduceMotion} />
          ))}
        </View>
      ) : posts.length === 0 ? (
        <HomeEmpty
          onCreate={() => nav.navigate('Tabs', { screen: 'Create' })}
          onSearch={() => nav.navigate('Tabs', { screen: 'Search' })}
        />
      ) : (
        <FlatList
          ref={listRef}
          data={posts}
          keyExtractor={(post) => post.id}
          renderItem={renderItem}
          contentContainerStyle={{ paddingBottom: tabBarOccupiedHeight(bottom) + spacing.xl }}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={actionInkRest.page} />
          }
          // O refresh nunca esvazia a lista: `useFeed` troca o conteúdo por um
          // conjunto novo, e o `maintainVisibleContentPosition` do pager não se
          // aplica aqui porque a Home volta ao topo por decisão de produto.
          ListFooterComponent={
            <HomeFooter loading={paginating} failed={pageFailed} onRetry={loadMore} />
          }
          onViewableItemsChanged={onViewableItemsChanged}
          viewabilityConfig={viewabilityConfig}
          onEndReached={loadMore}
          onEndReachedThreshold={0.6}
          // Alturas variáveis (a composição de um Círculo depende de quantos são),
          // por isso não há `getItemLayout`. O que segura a performance é a janela
          // curta, e só ela.
          //
          // No Android a omissão ativa o recorte nativo. Mantemos as células
          // montadas na janela para preservar superfícies de vídeo e toques.
          removeClippedSubviews={false}
          initialNumToRender={3}
          maxToRenderPerBatch={3}
          windowSize={5}
        />
      )}

      {commentPost && (
        <CommentSheet
          post={commentPost}
          onCommentAdded={handleCommentAdded}
          onClose={() => setCommentPost(null)}
        />
      )}
      {sharePost && (
        <SharePostSheet post={sharePost} onShared={handleShared} onClose={() => setSharePost(null)} />
      )}
    </View>
  )
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.white },
})
