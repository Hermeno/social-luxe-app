import React, { useEffect, useMemo, useRef, useState } from 'react'
import {
  View, Text, StyleSheet, Dimensions, Pressable, TouchableOpacity, Animated,
  ActivityIndicator, Share,
} from 'react-native'
import { useVideoPlayer, VideoView, VideoPlayerStatus } from 'expo-video'
import { Image } from 'expo-image'
import { LinearGradient } from 'expo-linear-gradient'
import { Ionicons } from '@expo/vector-icons'
import { Heart, Forward, Bookmark } from 'lucide-react-native'
import { useNavigation, useIsFocused } from '@react-navigation/native'
import { StackNavigationProp } from '@react-navigation/stack'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { Post } from '../../types'
import { colors, fonts } from '../../theme'
import { AppStackParams } from '../../navigation/AppNavigator'
import { API_BASE } from '../../config'
import * as postService from '../../services/post.service'
import AvatarImage from '../../components/AvatarImage'
import PostAlbumGrid from './PostAlbumGrid'
import { useAuthStore } from '../../store/auth.store'
import { useFollowStore } from '../../store/follow.store'

const { width, height } = Dimensions.get('window')

type Nav = StackNavigationProp<AppStackParams>

function resolveUrl(url: string | null | undefined): string {
  if (!url) return ''
  if (url.startsWith('http') || url.startsWith('file://')) return url
  return `${API_BASE}${url}`
}

interface Props {
  post: Post
  /** Só a célula visível toca o vídeo e corre a contagem de vida. */
  isActive: boolean
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
function FeedItem({ post, isActive, liked, onCommentPress, onLikeChange, onExpired }: Props) {
  const nav = useNavigation<Nav>()
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

  // ── Geometria da pilha ─────────────────────────────────────────────────────
  // A fila de ícones da nav fica a safeBottom + 32 (paddingBottom + ícone). O
  // campo assenta logo por cima dela — colado, sem o vão que sobrava. Valor
  // estável (não useBottomTabBarHeight, que salta em transições).
  const DOCK_H     = 44
  const dockBottom = Math.max(safeBottom, 8) + 34
  const videoBottom   = dockBottom + DOCK_H + 12             // fundo do vídeo
  const overlayBottom = videoBottom + 14                     // autor/ações no vídeo
  const videoFrame = { top: safeTop, bottom: videoBottom }

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
    if (isActive && isFocused) { try { player.play() } catch {} }
    else                       { try { player.pause() } catch {} }
  }, [isActive, isFocused, player, isVideo])

  // ── Vida do momento (efémero) — desaparece quando expira ────────────────────
  useEffect(() => {
    if (!post.expiresAt) return
    const ms = new Date(post.expiresAt).getTime() - Date.now()
    if (ms <= 0) { onExpired(post.id); return }
    const id = setTimeout(() => onExpired(post.id), ms)
    return () => clearTimeout(id)
  }, [post.id])

  // ── Gostar (ícone e duplo toque no vídeo) ───────────────────────────────────
  const [saved, setSaved] = useState(false)
  const lastTap      = useRef(0)
  const heartOpacity = useRef(new Animated.Value(0)).current
  const heartScale   = useRef(new Animated.Value(0.3)).current

  async function like(next: boolean) {
    onLikeChange(next)
    if (next) burstHeart()
    try { const res = await postService.likePost(post.id); onLikeChange(res.liked) }
    catch { onLikeChange(!next) }
  }
  function handleLike() { like(!liked) }
  function handleTapMedia() {
    const now = Date.now()
    if (now - lastTap.current < 280) { if (!liked) like(true); else burstHeart() }
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

  async function handleShare() {
    try { await Share.share({ message: post.caption ? `"${post.caption}"` : 'Luxe' }) } catch {}
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
    <View style={s.cell}>
      {/* ── Vídeo: janela entre a status bar e o campo de comentário.
             Média sempre filha direta da célula (não a envolver) para o
             leitor nativo assentar e renderizar. ── */}
      {isText ? (
        <LinearGradient colors={textGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[s.media, videoFrame]}>
          <View style={s.textWrap}><Text style={s.textContent}>{post.caption}</Text></View>
        </LinearGradient>
      ) : isAlbum ? (
        <View style={[s.media, videoFrame]}>
          <PostAlbumGrid
            urls={post.mediaUrls ?? []}
            overlays={post.albumOverlays}
            onOpen={() => nav.navigate('PostViewer', { posts: [post], startIndex: 0 })}
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

      {/* Camada de toque — duplo toque para gostar */}
      <Pressable style={[s.tapLayer, videoFrame]} onPress={handleTapMedia} />

      {buffering && (
        <ActivityIndicator style={s.spinner} size="large" color="rgba(255,255,255,0.85)" pointerEvents="none" />
      )}

      <Animated.View style={[s.bigHeart, { opacity: heartOpacity, transform: [{ scale: heartScale }] }]} pointerEvents="none">
        <Ionicons name="heart" size={104} color="rgba(255,255,255,0.92)" />
      </Animated.View>

      {/* ── Autor + descrição — sobre o vídeo, canto inferior esquerdo ── */}
      <View style={[s.meta, { bottom: overlayBottom }]} pointerEvents="box-none">
        <View style={s.authorRow}>
          <AvatarImage uri={resolveUrl(post.user.avatar)} name={post.user.name} size={36} borderWidth={0} borderColor="transparent" />
          <Text style={s.authorName} numberOfLines={1}>{post.user.name}</Text>
          {!isSelf && !following && (
            <TouchableOpacity onPress={handleFollow} style={s.followBtn} hitSlop={8} activeOpacity={0.7}>
              <Text style={s.followTxt}>Seguir</Text>
            </TouchableOpacity>
          )}
        </View>
        {!isText && !!post.caption && (
          <Text style={s.description} numberOfLines={2}>{post.caption}</Text>
        )}
      </View>

      {/* ── Ações — sobre o vídeo, direita (sem contadores) ── */}
      <View style={[s.actions, { bottom: overlayBottom }]}>
        <TouchableOpacity onPress={handleLike} style={s.actionBtn} activeOpacity={0.7} hitSlop={6}>
          <Heart size={30} strokeWidth={1.9} color={liked ? colors.primary : '#fff'} fill={liked ? colors.primary : 'transparent'} />
        </TouchableOpacity>
        <TouchableOpacity onPress={handleShare} style={s.actionBtn} activeOpacity={0.7} hitSlop={6}>
          <Forward size={28} strokeWidth={1.9} color="#fff" />
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setSaved((v) => !v)} style={s.actionBtn} activeOpacity={0.7} hitSlop={6}>
          <Bookmark size={27} strokeWidth={1.9} color="#fff" fill={saved ? '#fff' : 'transparent'} />
        </TouchableOpacity>
      </View>

      {/* ── Campo de comentário — por baixo do vídeo, acima da navegação ── */}
      <Pressable
        style={[s.dock, { bottom: dockBottom, height: DOCK_H }]}
        onPress={() => onCommentPress(post)}
      >
        <AvatarImage uri={resolveUrl(myAvatar)} name={myName} size={26} borderWidth={0} borderColor="transparent" />
        <Text style={s.dockText}>Escrever um comentário…</Text>
      </Pressable>
    </View>
  )
}

export default React.memo(FeedItem)

const s = StyleSheet.create({
  cell:  { width, height, backgroundColor: '#000' },
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
  authorName: {
    color: '#fff', fontFamily: fonts.semiBold, fontSize: 15, letterSpacing: -0.2, flexShrink: 1,
    textShadowColor: 'rgba(0,0,0,0.5)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 4,
  },
  followBtn: { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.65)' },
  followTxt: { color: '#fff', fontFamily: fonts.semiBold, fontSize: 12.5 },
  description: {
    color: 'rgba(255,255,255,0.92)', fontFamily: fonts.medium, fontSize: 14, lineHeight: 19,
    textShadowColor: 'rgba(0,0,0,0.5)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 4,
  },

  // Ações
  actions:   { position: 'absolute', right: 10, alignItems: 'center', gap: 24 },
  actionBtn: { alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.35, shadowRadius: 5 },

  // Campo de comentário
  dock: {
    position: 'absolute', left: 14, right: 14,
    flexDirection: 'row', alignItems: 'center', gap: 9, paddingHorizontal: 9,
    borderRadius: 22, borderWidth: 1, borderColor: 'rgba(255,255,255,0.16)', backgroundColor: 'rgba(255,255,255,0.05)',
  },
  dockText: { color: 'rgba(255,255,255,0.5)', fontFamily: fonts.medium, fontSize: 14 },
})
