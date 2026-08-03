import React, { useEffect, useMemo, useRef, useState } from 'react'
import {
  View, Text, StyleSheet, Dimensions, Pressable, TouchableOpacity, Animated,
  ActivityIndicator, PanResponder,
} from 'react-native'
import { useVideoPlayer, VideoView, VideoPlayerStatus } from 'expo-video'
import { Image } from 'expo-image'
import { LinearGradient } from 'expo-linear-gradient'
import { Ionicons } from '@expo/vector-icons'
import { useIsFocused } from '@react-navigation/native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { Post } from '../../types'
import { colors, fonts } from '../../theme'
import { API_BASE } from '../../config'
import * as postService from '../../services/post.service'
import AvatarImage from '../../components/AvatarImage'
import ActionBar from './ActionBar'
import PostAlbumCarousel from './PostAlbumCarousel'
import { useAuthStore } from '../../store/auth.store'
import { useFollowStore } from '../../store/follow.store'

const { width } = Dimensions.get('window')

function resolveUrl(url: string | null | undefined): string {
  if (!url) return ''
  if (url.startsWith('http') || url.startsWith('file://')) return url
  return `${API_BASE}${url}`
}

interface Props {
  post: Post
  /** Só a célula visível toca o vídeo e corre a contagem de vida. */
  isActive: boolean
  /** Altura real da lista (medida no FeedScreen) — todas as células iguais. */
  cellHeight: number
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

// ─── Uma célula do pager: um momento por ecrã ───────────────────────────────
// Pilha: status bar (livre) · vídeo · campo de comentário · navegação (livre).
// O vídeo é uma janela entre a status bar e o campo. O autor e as ações
// flutuam sobre o vídeo; comentar vive no campo por baixo. A célula é a única
// dona do seu leitor — a FlatList monta/desmonta, sem player partilhado.
function FeedItem({
  post, isActive, cellHeight, liked, reposted, commentCount,
  onCommentPress, onLikeChange, onRepost, onExpired,
}: Props) {
  const isFocused = useIsFocused()
  const { top: safeTop, bottom: safeBottom } = useSafeAreaInsets()

  const myAvatar = useAuthStore((s) => s.user?.avatar ?? null)
  const myName   = useAuthStore((s) => s.user?.name ?? '')
  const myId     = useAuthStore((s) => s.user?.id)
  const following = useFollowStore((s) => s.followingIds.has(post.user.id))
  const isSelf    = myId === post.user.id

  const isVideo = post.mediaType === 'VIDEO'
  const isText  = post.mediaType === 'TEXT'
  const isAlbum = !isVideo && !isText && !!post.mediaUrls && post.mediaUrls.length > 1
  const uri     = resolveUrl(post.mediaUrl)

  // ── Geometria da pilha ──────────────────────────────────────────────────────
  // De baixo para cima, com folga entre cada peça: navegação · campo · traço do
  // tempo · vídeo. Valor estável (não useBottomTabBarHeight, que salta).
  const DOCK_H     = 50
  const TRACK_H    = 3
  const GAP        = 8
  const dockBottom    = Math.max(safeBottom, 8) + 32        // campo, pouco acima da nav
  const trackBottom   = dockBottom + DOCK_H + GAP           // traço, com folga do campo
  const videoBottom   = trackBottom + TRACK_H + GAP         // vídeo, com folga do traço
  const overlayBottom = videoBottom + 14                    // autor/ações no vídeo
  const videoFrame = { top: safeTop, bottom: videoBottom }
  const trackWidth = width - 28                             // left/right 14

  // ── Leitor de vídeo ─────────────────────────────────────────────────────────
  // Memoizado: um `{ uri }` inline mudava de referência a cada render e o
  // expo-video criava um player novo que nunca recebia play().
  const source = useMemo(() => (isVideo ? { uri } : null), [isVideo, uri])
  const player = useVideoPlayer(source, (p) => { p.loop = true; p.muted = false })

  const [status, setStatus] = useState<VideoPlayerStatus>('idle')
  useEffect(() => {
    if (!isVideo) return
    const sub = player.addListener('statusChange', ({ status: s }) => setStatus(s))
    return () => sub.remove()
  }, [player, isVideo])
  const buffering = isVideo && isActive && status === 'loading'

  // Toca só a célula ativa e só com o feed em foco. Ao entrar noutra página o
  // feed perde foco e o vídeo pausa; ao voltar, retoma.
  useEffect(() => {
    if (!isVideo) return
    if (isActive && isFocused) { try { player.play() } catch {}; setPaused(false) }
    else                       { try { player.pause() } catch {} }
  }, [isActive, isFocused, player, isVideo])

  // ── Traço do tempo do vídeo + scrubber ──────────────────────────────────────
  const [progress, setProgress] = useState(0)
  useEffect(() => {
    if (!isVideo || !isActive || !isFocused) return
    const id = setInterval(() => {
      try {
        const d = player.duration
        if (d > 0) setProgress(Math.min(1, player.currentTime / d))
      } catch {}
    }, 250)
    return () => clearInterval(id)
  }, [isVideo, isActive, isFocused, player])

  // Tocar/arrastar na linha salta no vídeo (voltar ao início ou correr).
  const scrub = useMemo(() => {
    const seekTo = (x: number) => {
      const frac = Math.max(0, Math.min(1, x / trackWidth))
      try {
        const d = player.duration
        if (d > 0) { player.currentTime = frac * d; setProgress(frac) }
      } catch {}
    }
    return PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder:  () => true,
      onPanResponderGrant: (e) => seekTo(e.nativeEvent.locationX),
      onPanResponderMove:  (e) => seekTo(e.nativeEvent.locationX),
    })
  }, [player, trackWidth])

  // ── Vida do momento (efémero) — desaparece quando expira ────────────────────
  useEffect(() => {
    if (!post.expiresAt) return
    const ms = new Date(post.expiresAt).getTime() - Date.now()
    if (ms <= 0) { onExpired(post.id); return }
    const id = setTimeout(() => onExpired(post.id), ms)
    return () => clearTimeout(id)
  }, [post.id])

  // ── Toque: simples pausa/retoma, duplo gosta ────────────────────────────────
  const [paused, setPaused] = useState(false)
  const lastTap      = useRef(0)
  const tapTimer     = useRef<ReturnType<typeof setTimeout> | null>(null)
  const heartOpacity = useRef(new Animated.Value(0)).current
  const heartScale   = useRef(new Animated.Value(0.3)).current
  useEffect(() => () => { if (tapTimer.current) clearTimeout(tapTimer.current) }, [])

  function togglePlay() {
    if (!isVideo) return
    try {
      if (player.playing) { player.pause(); setPaused(true) }
      else                { player.play();  setPaused(false) }
    } catch {}
  }
  function handleTapMedia() {
    const now = Date.now()
    if (now - lastTap.current < 280) {
      // Duplo toque → gostar. Cancela o pause do toque simples.
      if (tapTimer.current) { clearTimeout(tapTimer.current); tapTimer.current = null }
      burstHeart()
      if (!liked) { onLikeChange(true); postService.likePost(post.id).catch(() => {}) }
    } else {
      // Toque simples → pausar/retomar, após a janela do duplo toque.
      tapTimer.current = setTimeout(() => { togglePlay(); tapTimer.current = null }, 280)
    }
    lastTap.current = now
  }
  function burstHeart() {
    heartOpacity.setValue(1); heartScale.setValue(0.3)
    Animated.parallel([
      Animated.spring(heartScale, { toValue: 1, useNativeDriver: true, speed: 18, bounciness: 16 }),
      Animated.sequence([
        Animated.delay(480),
        Animated.timing(heartOpacity, { toValue: 0, duration: 340, useNativeDriver: true }),
      ]),
    ]).start()
  }

  function handleFollow() {
    useFollowStore.getState()
      .toggle(post.user.id, 'forever', { name: post.user.name, avatar: post.user.avatar ?? null })
      .catch(() => {})
  }

  const textGradient = useMemo<[string, string]>(() => {
    const parts = post.bgColor?.split('|') ?? []
    return parts.length === 2 ? [parts[0], parts[1]] : ['#FF6B35', '#E63946']
  }, [post.bgColor])

  return (
    <View style={[s.cell, { height: cellHeight }]}>
      {/* ── Vídeo: janela entre a status bar e o campo de comentário.
             Média sempre filha direta da célula (não a envolver) para o
             leitor nativo assentar e renderizar. ── */}
      {isText ? (
        <LinearGradient colors={textGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[s.media, videoFrame]}>
          <View style={s.textWrap}><Text style={s.textContent}>{post.caption}</Text></View>
        </LinearGradient>
      ) : isAlbum ? (
        <View style={[s.media, videoFrame]}>
          <PostAlbumCarousel
            urls={post.mediaUrls ?? []}
            overlays={post.albumOverlays}
            dotsBottom={(overlayBottom - videoBottom) + 46 + (post.caption ? 38 : 0)}
          />
        </View>
      ) : isVideo ? (
        <VideoView player={player} style={[s.media, videoFrame]} contentFit="cover" nativeControls={false} />
      ) : (
        <Image source={{ uri }} style={[s.media, videoFrame]} contentFit="cover" cachePolicy="disk" recyclingKey={post.id} transition={150} />
      )}

      {/* Véu — legibilidade do autor/descrição sobre o vídeo */}
      {!isText && (
        <LinearGradient colors={['transparent', 'rgba(0,0,0,0.55)']} style={[s.scrim, { bottom: videoBottom }]} pointerEvents="none" />
      )}

      {/* Camada de toque — duplo toque para gostar.
             Nos álbuns não a pomos: bloquearia o deslize do carrossel. */}
      {!isAlbum && (
        <Pressable style={[s.tapLayer, videoFrame]} onPress={handleTapMedia} />
      )}

      {buffering && (
        <ActivityIndicator style={s.spinner} size="large" color="rgba(255,255,255,0.85)" pointerEvents="none" />
      )}

      <Animated.View style={[s.bigHeart, { opacity: heartOpacity, transform: [{ scale: heartScale }] }]} pointerEvents="none">
        <Ionicons name="heart" size={104} color="rgba(255,255,255,0.92)" />
      </Animated.View>

      {isVideo && paused && (
        <View style={s.playOverlay} pointerEvents="none">
          <Ionicons name="play" size={62} color="rgba(255,255,255,0.92)" />
        </View>
      )}

      {/* ── Autor + descrição — sobre o vídeo, canto inferior esquerdo ── */}
      <View style={[s.meta, { bottom: overlayBottom }]} pointerEvents="box-none">
        <View style={s.authorRow}>
          <View style={s.avatarRing}>
            <AvatarImage uri={resolveUrl(post.user.avatar)} name={post.user.name} size={34} />
          </View>
          <View style={s.authorText}>
            <Text style={s.authorName} numberOfLines={1}>
              {post.user.username ? `@${post.user.username}` : post.user.name}
            </Text>
          </View>
          {!isSelf && (
            <TouchableOpacity
              onPress={handleFollow}
              style={[s.followBtn, following && s.followingBtn]}
              hitSlop={8}
              activeOpacity={0.7}
            >
              <Text style={[s.followTxt, following && s.followingTxt]}>
                {following ? 'Seguindo' : 'Seguir'}
              </Text>
            </TouchableOpacity>
          )}
        </View>
        {!isText && !!post.caption && (
          <Text style={s.description} numberOfLines={2}>{post.caption}</Text>
        )}
      </View>

      {/* ── Ações — coluna direita sobre o vídeo, com contadores ── */}
      <ActionBar
        post={post}
        liked={liked}
        onLikeChange={onLikeChange}
        reposted={reposted}
        onRepost={onRepost}
        commentCount={commentCount}
        onCommentPress={() => onCommentPress(post)}
        bottomOffset={overlayBottom}
      />

      {/* ── Traço do tempo — scrubber: tocar/arrastar salta no vídeo ── */}
      {isVideo && (
        <View style={[s.trackRow, { bottom: trackBottom - 9 }]} {...scrub.panHandlers}>
          <View style={[s.track, { height: TRACK_H }]}>
            <View style={[s.trackFill, { width: `${Math.round(progress * 100)}%` }]} />
          </View>
        </View>
      )}

      {/* ── Campo de comentário — por baixo do vídeo, acima da navegação.
             Convida a responder à pessoa, não a um vazio. ── */}
      <Pressable
        style={[s.dock, { bottom: dockBottom, height: DOCK_H }]}
        onPress={() => onCommentPress(post)}
      >
        <AvatarImage uri={resolveUrl(myAvatar)} name={myName} size={28} borderWidth={0} borderColor="transparent" />
        <Text style={s.dockText}>
          {isSelf ? 'Escrever um comentário…' : `Responder a ${post.user.name.split(' ')[0]}…`}
        </Text>
      </Pressable>
    </View>
  )
}

export default React.memo(FeedItem)

const s = StyleSheet.create({
  cell:  { width, backgroundColor: '#000' },
  media: { position: 'absolute', left: 0, right: 0, backgroundColor: '#000' },
  scrim: { position: 'absolute', left: 0, right: 0, height: 190 },
  tapLayer: { position: 'absolute', left: 0, right: 0 },
  spinner: { position: 'absolute', left: 0, right: 0, top: '42%' },
  bigHeart: { position: 'absolute', left: 0, right: 0, alignItems: 'center', top: '34%' },
  textWrap:    { flex: 1, alignItems: 'center', justifyContent: 'center' },
  textContent: { color: '#fff', fontFamily: fonts.bold, fontSize: 26, lineHeight: 34, textAlign: 'center', paddingHorizontal: 36 },

  // Autor + descrição
  meta:       { position: 'absolute', left: 16, right: 84, gap: 8 },
  authorRow:  { flexDirection: 'row', alignItems: 'center', gap: 9 },
  // Anel laranja à volta do avatar, com folga (não colado ao avatar)
  avatarRing: {
    padding: 2.5,
    borderRadius: 999,
    borderWidth: 2,
    borderColor: colors.primary,
    backgroundColor: 'transparent',
  },
  authorText: { flexShrink: 1 },
  authorName: {
    color: '#fff', fontFamily: fonts.semiBold, fontSize: 15, letterSpacing: -0.2,
    textShadowColor: 'rgba(0,0,0,0.5)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 4,
  },
  authorHandle: {
    color: 'rgba(255,255,255,0.62)', fontFamily: fonts.medium, fontSize: 12.5, marginTop: 1,
    textShadowColor: 'rgba(0,0,0,0.5)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 4,
  },
  // No feed (sobre o vídeo) o Seguir é transparente — só contorno branco.
  followBtn: {
    paddingHorizontal: 14, paddingVertical: 6, borderRadius: 14,
    backgroundColor: 'transparent', borderWidth: 1.4, borderColor: 'rgba(255,255,255,0.9)',
  },
  followTxt: { color: '#fff', fontFamily: fonts.semiBold, fontSize: 12.5 },
  followingBtn: { borderColor: 'rgba(255,255,255,0.5)' },
  followingTxt: { color: 'rgba(255,255,255,0.85)' },
  description: {
    color: 'rgba(255,255,255,0.92)', fontFamily: fonts.medium, fontSize: 14, lineHeight: 19,
    textShadowColor: 'rgba(0,0,0,0.5)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 4,
  },

  // Traço do tempo do vídeo — scrubber (área de toque de 22px, linha ao centro)
  trackRow:  { position: 'absolute', left: 14, right: 14, height: 22, justifyContent: 'center' },
  track:     { borderRadius: 2, overflow: 'hidden', backgroundColor: 'rgba(255,255,255,0.18)' },
  trackFill: { height: '100%', borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.95)' },
  playOverlay: { position: 'absolute', left: 0, right: 0, top: '40%', alignItems: 'center' },

  // Campo de comentário — azul-escuro, pill (radius = metade da altura), sem border
  dock: {
    position: 'absolute', left: 14, right: 14,
    flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12,
    borderRadius: 25, backgroundColor: colors.commentField,
  },
  dockText: { color: 'rgba(255,255,255,0.85)', fontFamily: fonts.medium, fontSize: 14.5 },
})
