import React, { useEffect, useMemo, useRef, useState } from 'react'
import {
  View, StyleSheet, Dimensions, Pressable, Animated, ActivityIndicator, Text,
} from 'react-native'
import { useVideoPlayer, VideoView, VideoPlayerStatus } from 'expo-video'
import { Image } from 'expo-image'
import { LinearGradient } from 'expo-linear-gradient'
import { Ionicons } from '@expo/vector-icons'
import { useNavigation } from '@react-navigation/native'
import { StackNavigationProp } from '@react-navigation/stack'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Post } from '../../types'
import { colors, fonts } from '../../theme'
import { AppStackParams } from '../../navigation/AppNavigator'
import { API_BASE } from '../../config'
import * as postService from '../../services/post.service'
import ActionBar from './ActionBar'
import PostInfo from './PostInfo'
import PostAlbumGrid from './PostAlbumGrid'

const { width, height } = Dimensions.get('window')

type Nav = StackNavigationProp<AppStackParams>

function resolveMedia(url: string | null | undefined): string {
  if (!url) return ''
  return url.startsWith('http') ? url : `${API_BASE}${url}`
}

interface Props {
  post: Post
  /** Só a célula visível toca o vídeo e corre a contagem de vida. */
  isActive: boolean
  /** Opacidade do autor no fundo: 0 no topo (cartão mostra o autor em cima),
   *  1 quando se arrasta para o imersivo. Cruza-se com a faixa branca. */
  authorOpacity?: Animated.AnimatedInterpolation<number>
  liked: boolean
  reposted: boolean
  commentCount: number
  onCommentPress: (post: Post) => void
  onLikeChange: (liked: boolean) => void
  onRepost: () => void
  onDeleted: (id: string) => void
  onEdited: (id: string, caption: string) => void
  onExpired: (id: string) => void
  onBlockingChange: (open: boolean) => void
}

// Uma célula do pager vertical: um post em ecrã inteiro. É a única dona do seu
// leitor de vídeo — a virtualização da FlatList monta/desmonta as células, por
// isso não há um player partilhado a tocar o vídeo errado.
function FeedItem({
  post, isActive, authorOpacity, liked, reposted, commentCount,
  onCommentPress, onLikeChange, onRepost, onDeleted, onEdited, onExpired, onBlockingChange,
}: Props) {
  const nav = useNavigation<Nav>()
  const { top: safeTop, bottom: safeBottom } = useSafeAreaInsets()

  const isVideo = post.mediaType === 'VIDEO'
  const isText  = post.mediaType === 'TEXT'
  const isAlbum = !isVideo && !isText && !!post.mediaUrls && post.mediaUrls.length > 1
  const uri     = resolveMedia(post.mediaUrl)

  // Memoizado: um `{ uri }` inline mudava de referência a cada render (ex.: ao
  // gostar) e o expo-video criava um player novo que nunca recebia play().
  const source = useMemo(() => (isVideo ? { uri } : null), [isVideo, uri])
  const player = useVideoPlayer(source, (p) => { p.loop = true; p.muted = false })

  const [status, setStatus] = useState<VideoPlayerStatus>('idle')
  useEffect(() => {
    if (!isVideo) return
    const sub = player.addListener('statusChange', ({ status: s }) => setStatus(s))
    return () => sub.remove()
  }, [player, isVideo])
  const buffering = isVideo && isActive && status === 'loading'

  // Só a célula ativa toca; ao sair de vista, pausa e rebobina.
  useEffect(() => {
    if (!isVideo) return
    if (isActive) {
      try { player.currentTime = 0; player.play() } catch {}
    } else {
      try { player.pause() } catch {}
    }
  }, [isActive, player, isVideo])

  // ── Duplo toque para gostar ──────────────────────────────────────────────
  const lastTap    = useRef(0)
  const heartOpacity = useRef(new Animated.Value(0)).current
  const heartScale   = useRef(new Animated.Value(0.3)).current

  function handleTap() {
    const now = Date.now()
    if (now - lastTap.current < 300) {
      burstHeart()
      if (!liked) {
        onLikeChange(true)
        postService.likePost(post.id).catch(() => {})
      }
    }
    lastTap.current = now
  }

  function burstHeart() {
    heartOpacity.setValue(1)
    heartScale.setValue(0.3)
    Animated.parallel([
      Animated.spring(heartScale, { toValue: 1, useNativeDriver: true, speed: 18, bounciness: 16 }),
      Animated.sequence([
        Animated.delay(500),
        Animated.timing(heartOpacity, { toValue: 0, duration: 350, useNativeDriver: true }),
      ]),
    ]).start()
  }

  const textGradient = useMemo<[string, string]>(() => {
    const parts = post.bgColor?.split('|') ?? []
    return parts.length === 2 ? [parts[0], parts[1]] : ['#FF6B35', '#E63946']
  }, [post.bgColor])

  return (
    <Pressable onPress={handleTap} style={s.container}>
      {/* ── Média: começa abaixo da status bar; enche até ao fundo
             (a navegação flutua por cima) ── */}
      <View style={[s.mediaBox, { top: safeTop }]}>
        {isText ? (
          <LinearGradient colors={textGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.media}>
            <Text style={s.textContent}>{post.caption}</Text>
          </LinearGradient>
        ) : isAlbum ? (
          <PostAlbumGrid
            urls={post.mediaUrls ?? []}
            overlays={post.albumOverlays}
            onOpen={() => nav.navigate('PostViewer', { posts: [post], startIndex: 0 })}
          />
        ) : isVideo ? (
          <VideoView player={player} style={s.media} contentFit="cover" nativeControls={false} />
        ) : (
          <Image source={{ uri }} style={s.media} contentFit="cover" cachePolicy="disk" recyclingKey={post.id} transition={150} />
        )}

        {/* Véu de fundo — só para o texto ler sobre a média */}
        {!isText && (
          <LinearGradient colors={['transparent', 'rgba(0,0,0,0.55)']} style={s.bottomScrim} pointerEvents="none" />
        )}

        {buffering && (
          <View style={s.center} pointerEvents="none">
            <ActivityIndicator size="large" color="rgba(255,255,255,0.85)" />
          </View>
        )}
      </View>

      {/* Coração do duplo toque */}
      <Animated.View style={[s.bigHeart, { opacity: heartOpacity, transform: [{ scale: heartScale }] }]} pointerEvents="none">
        <Ionicons name="heart" size={104} color="rgba(255,255,255,0.92)" />
      </Animated.View>

      {/* Autor (imersivo, sem legenda). Cruza com a faixa branca do topo. */}
      <Animated.View style={authorOpacity ? { opacity: authorOpacity } : undefined} pointerEvents="box-none">
        <PostInfo
          post={post}
          isActive={isActive}
          hideCaption
          commentCount={commentCount}
          onExpired={() => onExpired(post.id)}
          onDeleted={onDeleted}
          onEdited={onEdited}
          onBlockingChange={onBlockingChange}
        />
      </Animated.View>

      {/* Descrição — sempre em baixo à esquerda, sobre a média */}
      {!isText && !!post.caption && (
        <Text style={[s.description, { bottom: safeBottom + 96 }]} numberOfLines={2}>
          {post.caption}
        </Text>
      )}

      <ActionBar
        post={post}
        onCommentPress={() => onCommentPress(post)}
        liked={liked}
        onLikeChange={onLikeChange}
        reposted={reposted}
        onRepost={onRepost}
        commentCount={commentCount}
      />
    </Pressable>
  )
}

export default React.memo(FeedItem)

const s = StyleSheet.create({
  container:   { width, height, backgroundColor: colors.black },
  mediaBox:    { position: 'absolute', left: 0, right: 0, bottom: 0, overflow: 'hidden', backgroundColor: colors.black },
  media:       { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  bottomScrim: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 300 },
  description: {
    position: 'absolute', left: 16, right: 84,
    color: '#fff', fontFamily: fonts.medium, fontSize: 14, lineHeight: 19,
    textShadowColor: 'rgba(0,0,0,0.6)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 4,
  },
  center:      { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  bigHeart:    { position: 'absolute', alignSelf: 'center', top: '38%' },
  textContent: {
    color: '#fff', fontFamily: fonts.bold, fontSize: 26, lineHeight: 36,
    textAlign: 'center', paddingHorizontal: 36,
  },
})
