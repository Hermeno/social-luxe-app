import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  View, Text, StyleSheet, Dimensions, Pressable, TouchableOpacity, Animated,
  ActivityIndicator, PanResponder,
} from 'react-native'
import type { TextLayoutEvent } from 'react-native'
import { useVideoPlayer, VideoView, VideoPlayerStatus } from 'expo-video'
import { Image } from 'expo-image'
import { LinearGradient } from 'expo-linear-gradient'
import { Ionicons } from '@expo/vector-icons'
import { useIsFocused, useNavigation } from '@react-navigation/native'
import { StackNavigationProp } from '@react-navigation/stack'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { Post, type RepostResult } from '../../types'
import { colors, fonts } from '../../theme'
import { parsePostFontKey, postFontStyle } from '../../theme/postFonts'
import { usePostFontsReady } from '../../store/postFonts.store'
import { API_BASE } from '../../config'
import * as postService from '../../services/post.service'
import type { TasteSignal } from '../../services/post.service'
import AvatarImage from '../../components/AvatarImage'
import ActionBar from './ActionBar'
import TasteCard from './TasteCard'
import PostAlbumCarousel from './PostAlbumCarousel'
import CommenterStack from './CommenterStack'
import FeedIcon from '../../components/FeedIcon'
import { useAuthStore } from '../../store/auth.store'
import { useFollowStore } from '../../store/follow.store'
import { tabBarOccupiedHeight } from '../../components/TabBar/layout'
import { AppStackParams } from '../../navigation/AppNavigator'
import { useT } from '../../i18n'

const { width } = Dimensions.get('window')
const DESCRIPTION_MAX_LINES = 2
type Nav = StackNavigationProp<AppStackParams>

function resolveUrl(url: string | null | undefined): string {
  if (!url) return ''
  if (url.startsWith('http') || url.startsWith('file://')) return url
  return `${API_BASE}${url}`
}

interface Props {
  post: Post
  reduceMotion: boolean
  /** Só a célula visível toca o vídeo e corre a contagem de vida. */
  isActive: boolean
  /** Altura real da lista (medida no FeedScreen) — todas as células iguais. */
  cellHeight: number
  liked: boolean
  commentCount: number
  onCommentPress: (post: Post) => void
  onLikeChange: (postId: string, liked: boolean) => void
  onRepostChange: (result: RepostResult) => void
  onDeleted: (id: string) => void
  onEdited: (id: string, caption: string) => void
  onProfileBlocked: (userId: string) => void
  onAuthorMuted: (userId: string) => void
  onExpired: (id: string) => void
  onBlockingChange: (open: boolean) => void
  /** A feed já decidiu que esta publicação está na amostra do cartão de gosto
   *  e que ainda não foi respondida. As regras de conteúdo (é meu, é anúncio)
   *  ficam aqui, na célula, que é quem as conhece. */
  tasteEligible: boolean
  onTasteSignal: (postId: string, signal: TasteSignal, dwellMs: number) => void
}

// O cartão não nasce com o post: só depois de a pessoa lá ter estado o tempo
// suficiente para ter uma opinião. Perguntar ao primeiro segundo é perguntar
// antes de haver resposta — e a resposta que vier assim não vale nada.
const TASTE_DELAY_MS = 4200

// ─── Uma célula do pager: um momento por ecrã ───────────────────────────────
// Pilha: status bar livre · mídia · scrubber · navegação. O campo de comentário
// vive dentro da TabBar e fica ligado a este post pelo store.
// A célula é a única dona do seu leitor — a FlatList monta/desmonta, sem player
// partilhado.
function FeedItem({
  post, reduceMotion, isActive, cellHeight, liked, commentCount,
  onCommentPress, onLikeChange, onRepostChange, onDeleted, onEdited, onProfileBlocked, onAuthorMuted, onExpired, onBlockingChange,
  tasteEligible, onTasteSignal,
}: Props) {
  const isFocused = useIsFocused()
  const nav = useNavigation<Nav>()
  const t = useT()
  const { top: safeTop, bottom: safeBottom } = useSafeAreaInsets()

  const myId     = useAuthStore((s) => s.user?.id)
  const following = useFollowStore((s) => s.followingIds.has(post.user.id))
  const isSelf    = myId === post.user.id

  const isVideo = post.mediaType === 'VIDEO'
  const isText  = post.mediaType === 'TEXT'
  // `mediaUrls` identifica um post criado pelo fluxo de álbum/Círculo. O
  // Círculo pode ter só uma foto; nesse caso ainda precisamos do carrossel para
  // desenhar `albumOverlays` (antes o emoji era guardado mas sumia na feed).
  const isAlbum = !isVideo && !isText && !!post.mediaUrls && post.mediaUrls.length > 0
  const uri     = resolveUrl(post.mediaUrl)

  // ── Geometria da pilha ──────────────────────────────────────────────────────
  // A mídia respeita a status bar. Em baixo, o scrubber tem uma faixa própria
  // entre o fim do post e o início da navegação.
  const TRACK_H    = 3
  const GAP        = 8
  const navTop        = tabBarOccupiedHeight(safeBottom)
  const trackBottom   = navTop + GAP                         // traço, acima da navegação
  const videoBottom   = trackBottom + TRACK_H + GAP          // post termina antes do traço
  const overlayBottom = videoBottom + 14                     // autor/ações dentro do post
  const videoFrame = { top: safeTop, bottom: videoBottom }
  const trackWidth = width - 28                             // left/right 14

  // ── Enquadramento da imagem ────────────────────────────────────────────────
  // A largura é sempre a do ecrã; a altura é que vem da proporção da imagem.
  // Por isso a moldura da foto NÃO é a `videoFrame` (que estica de cima a baixo):
  // é calculada a partir do que a imagem mede, e centrada no espaço disponível.
  const mediaSpace = Math.max(0, cellHeight - safeTop - videoBottom)

  // A altura vem SEMPRE da proporção da imagem. Nunca da altura disponível —
  // encher o ecrã na vertical é o que não se quer, nem sequer como estado
  // temporário enquanto a foto carrega.
  //
  // Duas fontes para a proporção, por esta ordem:
  //   1. o servidor, que a guarda no upload → certo já no primeiro desenho
  //   2. o `onLoad`, para posts anteriores à migração
  //
  // No caso 2 a foto carrega INVISÍVEL e só se revela quando a proporção chega.
  // Assim nunca se vê o tamanho errado — vê-se o fundo e depois a foto certa,
  // em vez de uma foto esticada que encolhe.
  const serverAspect = post.mediaWidth && post.mediaHeight
    ? post.mediaWidth / post.mediaHeight
    : null
  const [loadedAspect, setLoadedAspect] = useState<number | null>(null)
  useEffect(() => { setLoadedAspect(null) }, [post.id])

  const aspect = serverAspect ?? loadedAspect
  const photoHeight = aspect ? Math.min(width / aspect, mediaSpace) : mediaSpace
  const photoFrame  = {
    top: safeTop + (mediaSpace - photoHeight) / 2,
    height: photoHeight,
    opacity: aspect ? 1 : 0,
  }

  // Conteúdo do post entra depois do cartão assentar; o avatar mantém um pulso
  // lento enquanto o post for o único ativo.
  const metaEntry = useRef(new Animated.Value(0)).current
  const ambient   = useRef(new Animated.Value(0)).current
  const [clockNow, setClockNow] = useState(Date.now)

  useEffect(() => {
    metaEntry.stopAnimation()
    if (!isActive || reduceMotion) {
      metaEntry.setValue(isActive ? 1 : 0)
      return
    }
    metaEntry.setValue(0)
    Animated.sequence([
      Animated.delay(70),
      Animated.timing(metaEntry, { toValue: 1, duration: 240, useNativeDriver: true }),
    ]).start()
  }, [isActive, reduceMotion, metaEntry])

  useEffect(() => {
    ambient.stopAnimation()
    if (!isActive || reduceMotion) {
      ambient.setValue(0)
      return
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(ambient, { toValue: 1, duration: 1900, useNativeDriver: true }),
        Animated.timing(ambient, { toValue: 0, duration: 1900, useNativeDriver: true }),
      ]),
    )
    loop.start()
    return () => loop.stop()
  }, [isActive, reduceMotion, ambient])

  // Só o momento visível atualiza o relógio. O traço não é decorativo: mostra
  // quanta vida ainda resta à publicação e torna a efemeridade uma assinatura.
  useEffect(() => {
    if (!isActive || post.isAnnouncement) return
    setClockNow(Date.now())
    const id = setInterval(() => setClockNow(Date.now()), 60_000)
    return () => clearInterval(id)
  }, [isActive, post.id, post.isAnnouncement])

  const momentState = useMemo(() => {
    if (post.isAnnouncement) {
      return { label: t.feed_official, time: '', progress: 1 }
    }

    const startsAt = new Date(post.createdAt).getTime()
    const endsAt = new Date(post.expiresAt).getTime()
    const lifetime = Math.max(1, endsAt - startsAt)
    const remaining = Math.max(0, endsAt - clockNow)
    const progress = Math.max(0, Math.min(1, remaining / lifetime))
    const hours = Math.floor(remaining / 3_600_000)
    const minutes = Math.max(1, Math.floor(remaining / 60_000))

    return {
      label: post.extended ? t.feed_moment_extended : t.feed_moment,
      time: hours > 0 ? `${hours}h` : `${minutes}m`,
      progress
    }
  }, [clockNow, post.createdAt, post.expiresAt, post.extended, post.isAnnouncement, t.feed_moment, t.feed_moment_extended, t.feed_official])

  const lifeWidth = `${Math.round(momentState.progress * 100)}%` as `${number}%`
  const authorContext = post.user.statusLabel
    ?? (post.user.showDevice ? post.deviceModel : null)

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
  const wasPlayingBeforeMenu = useRef(false)
  const menuBlocking = useRef(false)
  const heartOpacity = useRef(new Animated.Value(0)).current
  const heartScale   = useRef(new Animated.Value(0.3)).current
  const heartHalo    = useRef(new Animated.Value(0)).current
  useEffect(() => () => { if (tapTimer.current) clearTimeout(tapTimer.current) }, [])

  function togglePlay() {
    if (!isVideo) return
    try {
      if (player.playing) { player.pause(); setPaused(true) }
      else                { player.play();  setPaused(false) }
    } catch {}
  }

  function handleMenuBlocking(open: boolean) {
    if (menuBlocking.current === open) return
    menuBlocking.current = open
    onBlockingChange(open)
    if (!isVideo) return
    try {
      if (open) {
        wasPlayingBeforeMenu.current = player.playing
        player.pause()
        setPaused(true)
      } else if (wasPlayingBeforeMenu.current && isActive && isFocused) {
        player.play()
        setPaused(false)
      }
    } catch {}
  }

  // ── Cartão de gosto ────────────────────────────────────────────────────────
  // Nunca no meu próprio post nem num anúncio: perguntar se quero ver mais do
  // que eu próprio publiquei não ensina nada a ninguém.
  const tasteAsks = tasteEligible && !isSelf && !post.isAnnouncement
  const [tasteVisible, setTasteVisible] = useState(false)
  const tasteAnsweredRef = useRef(false)
  const activeSinceRef = useRef(0)

  useEffect(() => {
    if (tasteAnsweredRef.current) return
    if (!tasteAsks || !isActive || !isFocused) { setTasteVisible(false); return }
    activeSinceRef.current = Date.now()
    const id = setTimeout(() => setTasteVisible(true), TASTE_DELAY_MS)
    return () => clearTimeout(id)
  }, [tasteAsks, isActive, isFocused])

  const handleTasteAnswer = useCallback((signal: TasteSignal) => {
    tasteAnsweredRef.current = true
    // O tempo até responder distingue o "não" imediato do "não" depois de ver
    // tudo — duas respostas iguais que não valem o mesmo.
    const dwellMs = activeSinceRef.current ? Date.now() - activeSinceRef.current : 0
    onTasteSignal(post.id, signal, dwellMs)
  }, [onTasteSignal, post.id])

  // A feed dá-nos um handler estável (o mesmo para todas as células); a rail
  // continua a falar só em "gostei/não gostei". A ponte é memoizada para não
  // quebrar o `React.memo` da rail a cada render desta célula.
  const emitLikeChange = useCallback(
    (next: boolean) => onLikeChange(post.id, next),
    [onLikeChange, post.id],
  )

  function handleTapMedia() {
    const now = Date.now()
    if (now - lastTap.current < 280) {
      // Duplo toque → gostar. Cancela o pause do toque simples.
      if (tapTimer.current) { clearTimeout(tapTimer.current); tapTimer.current = null }
      burstHeart()
      if (!liked) { onLikeChange(post.id, true); postService.likePost(post.id).catch(() => {}) }
    } else {
      // Toque simples → pausar/retomar, após a janela do duplo toque.
      tapTimer.current = setTimeout(() => { togglePlay(); tapTimer.current = null }, 280)
    }
    lastTap.current = now
  }
  function burstHeart() {
    if (reduceMotion) {
      heartOpacity.setValue(0)
      return
    }
    heartOpacity.setValue(1); heartScale.setValue(0.3); heartHalo.setValue(0)
    Animated.parallel([
      Animated.sequence([
        Animated.spring(heartScale, { toValue: 1.16, useNativeDriver: true, speed: 24, bounciness: 16 }),
        Animated.spring(heartScale, { toValue: 1, useNativeDriver: true, speed: 22, bounciness: 5 }),
      ]),
      Animated.timing(heartHalo, { toValue: 1, duration: 520, useNativeDriver: true }),
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

  // Enquanto o ficheiro da cursiva não chegou, o texto sai na fonte de sempre
  // e volta a desenhar sozinho quando o store ficar pronto.
  const postFontsReady = usePostFontsReady()
  const textStyle = useMemo(
    () => postFontStyle(parsePostFontKey(post.fontKey), 26, 34, postFontsReady),
    [post.fontKey, postFontsReady],
  )

  const textGradient = useMemo<[string, string]>(() => {
    const parts = post.bgColor?.split('|') ?? []
    return parts.length === 2 ? [parts[0], parts[1]] : ['#FF6B35', '#E63946']
  }, [post.bgColor])

  // A legenda mantém as duas linhas compactas do feed. Medimos uma cópia
  // invisível sem corte para que o toque só exista quando há texto por revelar.
  const [descriptionExpanded, setDescriptionExpanded] = useState(false)
  const [descriptionExpandable, setDescriptionExpandable] = useState(false)

  useEffect(() => {
    setDescriptionExpanded(false)
    setDescriptionExpandable(false)
  }, [post.id, post.caption])

  function measureDescription(event: TextLayoutEvent) {
    const expandable = event.nativeEvent.lines.length > DESCRIPTION_MAX_LINES
    setDescriptionExpandable((current) => current === expandable ? current : expandable)
    if (!expandable) setDescriptionExpanded(false)
  }

  return (
    <View
      style={[
        s.cell,
        { height: cellHeight },
      ]}
    >
      {/* ── Mídia: começa depois da status bar e termina antes do scrubber.
             Permanece filha direta da célula para o leitor nativo assentar. ── */}
      {isText ? (
        <LinearGradient colors={textGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[s.media, videoFrame]}>
          <View style={s.textWrap}><Text style={[s.textContent, textStyle]}>{post.caption}</Text></View>
        </LinearGradient>
      ) : isAlbum ? (
        <View style={[s.media, videoFrame]}>
          <PostAlbumCarousel
            urls={post.mediaUrls ?? []}
            sizes={post.mediaSizes}
            overlays={post.albumOverlays}
            dotsBottom={(overlayBottom - videoBottom) + 46 + (post.caption ? 38 : 0)}
          />
        </View>
      ) : isVideo ? (
        <VideoView player={player} style={[s.media, videoFrame]} contentFit="cover" nativeControls={false} />
      ) : (
        // `cover` numa moldura que já tem a proporção da imagem não corta nada —
        // a largura é sempre cheia e a altura veio da própria foto. Só recorta
        // no caso extremo de uma imagem tão alta que não caberia no ecrã.
        <Image
          source={{ uri }}
          style={[s.media, photoFrame]}
          contentFit="cover"
          cachePolicy="disk"
          recyclingKey={post.id}
          transition={150}
          onLoad={(e) => {
            // Só serve os posts sem dimensões no servidor. Nos outros já se
            // sabia a proporção antes de a foto sequer começar a descarregar.
            if (serverAspect) return
            const { width: w, height: h } = e.source ?? {}
            if (w && h) setLoadedAspect(w / h)
          }}
        />
      )}

      {/* Camada de toque — duplo toque para gostar.
             Nos álbuns não a pomos: bloquearia o deslize do carrossel. */}
      {!isAlbum && (
        <Pressable style={[s.tapLayer, videoFrame]} onPress={handleTapMedia} />
      )}

      {buffering && (
        <ActivityIndicator style={s.spinner} size="large" color={colors.primary} pointerEvents="none" />
      )}

      <Animated.View
        style={[
          s.heartHalo,
          {
            opacity: heartHalo.interpolate({ inputRange: [0, 0.22, 1], outputRange: [0, 0.68, 0] }),
            transform: [{ scale: heartHalo.interpolate({ inputRange: [0, 1], outputRange: [0.55, 1.65] }) }]
          },
        ]}
        pointerEvents="none"
      />
      <Animated.View
        style={[
          s.bigHeart,
          {
            opacity: heartOpacity,
            transform: [
              { scale: heartScale },
              { rotate: heartScale.interpolate({ inputRange: [0.3, 1.16], outputRange: ['-11deg', '0deg'] }) },
            ]
          },
        ]}
        pointerEvents="none"
      >
        <FeedIcon name="heart-solid" size={104} color="rgba(255,255,255,0.94)" />
      </Animated.View>

      {isVideo && paused && (
        <View style={s.playOverlay} pointerEvents="none">
          <Ionicons name="play" size={62} color="rgba(255,255,255,0.92)" />
        </View>
      )}

      {/* ── Identidade do momento — contexto temporal, autor e conversa ── */}
      <Animated.View
        style={[
          s.meta,
          { bottom: overlayBottom },
          !reduceMotion && {
            opacity: metaEntry,
            transform: [{ translateY: metaEntry.interpolate({ inputRange: [0, 1], outputRange: [14, 0] }) }]
          },
        ]}
        pointerEvents="box-none"
      >
        {tasteVisible && (
          <TasteCard
            reduceMotion={reduceMotion}
            onAnswer={handleTasteAnswer}
            onDone={() => setTasteVisible(false)}
          />
        )}

        <View style={s.momentRow}>
          <View style={s.momentIdentity}>
            <View style={s.liveNode} />
            <Text style={s.momentLabel}>{momentState.label}</Text>
          </View>
          {!post.isAnnouncement && (
            <>
              <View style={s.lifeTrack}>
                <View style={[s.lifeFill, { width: lifeWidth }]} />
              </View>
              <Text style={s.momentTime}>{momentState.time}</Text>
            </>
          )}
        </View>

        <View style={s.authorRow}>
          <TouchableOpacity
            onPress={() => nav.navigate('Profile', { userId: post.user.id })}
            activeOpacity={0.82}
            accessibilityRole="button"
            accessibilityLabel={post.user.name}
          >
            <Animated.View
              style={{ transform: [{ scale: ambient.interpolate({ inputRange: [0, 1], outputRange: [1, 1.018] }) }] }}
            >
              <View style={s.avatarRing}>
                <View style={s.avatarInner}>
                  <AvatarImage uri={resolveUrl(post.user.avatar)} name={post.user.name} size={34} />
                </View>
              </View>
            </Animated.View>
          </TouchableOpacity>

          <TouchableOpacity
            style={s.authorText}
            onPress={() => nav.navigate('Profile', { userId: post.user.id })}
            activeOpacity={0.78}
          >
            <Text style={s.authorName} numberOfLines={1}>
              {post.user.username ? `@${post.user.username}` : post.user.name}
            </Text>
            {!!authorContext && (
              <Text style={s.authorContext} numberOfLines={1}>{authorContext}</Text>
            )}
          </TouchableOpacity>

          {!isSelf && (
            <TouchableOpacity
              onPress={handleFollow}
              style={[s.followBtn, following && s.followingBtn]}
              hitSlop={8}
              activeOpacity={0.7}
            >
              <View style={[s.followNode, following && s.followNodeOn]} />
              <Text style={[s.followTxt, following && s.followingTxt]}>
                {following ? t.following : t.follow}
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {/* O toque vive numa Pressable à volta de tudo, e nunca depende da
            medição. Antes o `onPress` só era ligado se o medidor tivesse
            corrido — se ele falhasse, a legenda ficava sem handler nenhum e
            tocar nela não fazia rigorosamente nada. */}
        {!isText && !!post.caption && (
          <Pressable
            style={s.descriptionWrap}
            onPress={() => setDescriptionExpanded((expanded) => !expanded)}
            hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}
            accessibilityRole="button"
            accessibilityState={{ expanded: descriptionExpanded }}
            accessibilityLabel={post.caption}
          >
            <Text
              style={s.description}
              numberOfLines={descriptionExpanded ? undefined : DESCRIPTION_MAX_LINES}
              ellipsizeMode="tail"
              suppressHighlighting
            >
              {post.caption}
            </Text>

            {/* Pista de que há mais texto. Se a medição falhar, só se perde a
                pista — o toque continua a funcionar. */}
            {descriptionExpandable && (
              <Text style={s.descriptionMore}>
                {descriptionExpanded ? t.see_less : t.see_more}
              </Text>
            )}
            {/* Medidor: rende a legenda inteira, invisível, só para contar linhas.
                Tem de estar dentro de uma <View> com pointerEvents="none" — em
                <Text> essa prop não é respeitada, e era o medidor que comia o
                toque, deixando a legenda sem reagir. */}
            <View style={s.descriptionMeasure} pointerEvents="none">
              <Text
                style={s.description}
                onTextLayout={measureDescription}
                accessible={false}
                accessibilityElementsHidden
                importantForAccessibility="no-hide-descendants"
              >
                {post.caption}
              </Text>
            </View>
          </Pressable>
        )}

        {commentCount > 0 && (
          <View style={s.socialRow}>
            {!!post.recentCommenters?.length && (
              <CommenterStack
                commenters={post.recentCommenters}
                onPress={() => onCommentPress(post)}
                accessibilityLabel={`${commentCount} ${commentCount === 1 ? t.comment_one : t.comment_many}`}
              />
            )}
            <TouchableOpacity
              style={s.commentsLink}
              onPress={() => onCommentPress(post)}
              activeOpacity={0.72}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel={`${commentCount} ${commentCount === 1 ? t.comment_one : t.comment_many}`}
            >
              <Text style={s.commentsText} numberOfLines={1}>
                {commentCount === 1
                  ? t.feed_view_comment
                  : `${t.feed_view_comments} ${commentCount} ${t.comment_many}`}
              </Text>
              <FeedIcon name="chevron-right" size={13} color="rgba(255,255,255,0.56)" />
            </TouchableOpacity>
          </View>
        )}
      </Animated.View>

      {/* ── Ações — coluna direita sobre o vídeo, com contadores ── */}
      <ActionBar
        post={post}
        liked={liked}
        onLikeChange={emitLikeChange}
        onRepostChange={onRepostChange}
        commentCount={commentCount}
        onCommentPress={() => onCommentPress(post)}
        onDeleted={isSelf ? onDeleted : undefined}
        onEdited={isSelf ? onEdited : undefined}
        onProfileBlocked={onProfileBlocked}
        onAuthorMuted={onAuthorMuted}
        onOptionsBlockingChange={handleMenuBlocking}
        bottomOffset={overlayBottom}
        isActive={isActive}
        reduceMotion={reduceMotion}
        iconSize={30}
        iconWeight="medium"
      />

      {/* ── Traço do tempo — scrubber: tocar/arrastar salta no vídeo ── */}
      {isVideo && (
        <View style={[s.trackRow, { bottom: trackBottom - 9 }]} {...scrub.panHandlers}>
          <View style={[s.track, { height: TRACK_H }]}>
            <View style={[s.trackFill, { width: `${Math.round(progress * 100)}%` }]} />
          </View>
        </View>
      )}

    </View>
  )
}

export default React.memo(FeedItem)

const s = StyleSheet.create({
  cell:  { width, backgroundColor: colors.feedSurface },
  // As faixas acima/abaixo de media que não enche a altura mostram esta cor.
  media: { position: 'absolute', left: 0, right: 0, backgroundColor: colors.feedSurface },
  tapLayer: { position: 'absolute', left: 0, right: 0 },
  spinner: { position: 'absolute', left: 0, right: 0, top: '42%' },
  bigHeart: { position: 'absolute', left: 0, right: 0, alignItems: 'center', top: '34%' },
  heartHalo: {
    position: 'absolute', alignSelf: 'center', top: '34%',
    width: 108, height: 108, borderRadius: 54,
    borderWidth: 2, borderColor: 'rgba(255,255,255,0.78)'
  },
  textWrap:    { flex: 1, alignItems: 'center', justifyContent: 'center' },
  textContent: { color: '#fff', fontFamily: fonts.bold, fontSize: 26, lineHeight: 34, textAlign: 'center', paddingHorizontal: 36 },

  // Autor + descrição
  meta:       { position: 'absolute', left: 16, right: 78, gap: 9 },
  momentRow: {
    height: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8
  },
  momentIdentity: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  liveNode: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: colors.primary,
    shadowColor: colors.primary,
    shadowOpacity: 0.75,
    shadowRadius: 4
  },
  momentLabel: {
    color: 'rgba(255,255,255,0.76)',
    fontFamily: fonts.bold,
    fontSize: 9.5,
    lineHeight: 12,
    letterSpacing: 1.35
  },
  lifeTrack: {
    width: 38,
    height: 2,
    borderRadius: 1,
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.22)'
  },
  lifeFill: { height: 2, borderRadius: 1, backgroundColor: colors.primary },
  momentTime: {
    color: 'rgba(255,255,255,0.58)',
    fontFamily: fonts.semiBold,
    fontSize: 10,
    lineHeight: 12,
    fontVariant: ['tabular-nums']
  },
  authorRow:  { minHeight: 43, flexDirection: 'row', alignItems: 'center', gap: 9 },
  // Anel do autor — moldura fixa, nunca gira. Um fio claro a emoldurar a cara,
  // com uma folga escura por dentro para o rosto não colar ao traço e uma
  // sombra curta que o descola de media claro. A vida do post lê-se no traço
  // de tempo acima; à volta da cara basta um desenho limpo e quieto.
  avatarRing: {
    padding: 2.5,
    borderRadius: 999,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.92)',
    backgroundColor: 'rgba(0,0,0,0.34)',
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 3,
  },
  // Corta a foto num círculo exato dentro da folga — sem isto, um avatar
  // quadrado encostava aos cantos e o anel deixava de parecer desenhado.
  avatarInner: { borderRadius: 999, overflow: 'hidden' },
  authorText: { flex: 1, minWidth: 0, justifyContent: 'center' },
  authorName: {
    color: '#fff', fontFamily: fonts.bold, fontSize: 15.5, lineHeight: 19, letterSpacing: -0.28
  },
  authorContext: {
    color: 'rgba(255,255,255,0.56)', fontFamily: fonts.medium, fontSize: 11.5, lineHeight: 15
  },
  followBtn: {
    minHeight: 32,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingLeft: 11,
    borderLeftWidth: StyleSheet.hairlineWidth,
    borderLeftColor: 'rgba(255,255,255,0.28)'
  },
  followNode: { width: 4, height: 4, borderRadius: 2, backgroundColor: colors.primary },
  followNodeOn: { backgroundColor: 'rgba(255,255,255,0.42)' },
  followTxt: { color: '#fff', fontFamily: fonts.bold, fontSize: 11.5, letterSpacing: 0.1 },
  followingBtn: { borderLeftColor: 'rgba(255,255,255,0.18)' },
  followingTxt: { color: 'rgba(255,255,255,0.62)' },
  descriptionWrap: { position: 'relative' },
  description: {
    color: 'rgba(255,255,255,0.9)', fontFamily: fonts.medium, fontSize: 13.5, lineHeight: 18.5
  },
  descriptionMore: {
    color: 'rgba(255,255,255,0.6)',
    fontFamily: fonts.semiBold,
    fontSize: 12.5,
    marginTop: 2,
  },
  descriptionMeasure: {
    position: 'absolute',
    left: 0,
    right: 0,
    opacity: 0
  },
  socialRow: { minHeight: 26, flexDirection: 'row', alignItems: 'center', gap: 9 },
  commentsLink: { flex: 1, minHeight: 26, flexDirection: 'row', alignItems: 'center', gap: 3 },
  commentsText: {
    flexShrink: 1,
    color: 'rgba(255,255,255,0.6)',
    fontFamily: fonts.medium,
    fontSize: 11.5,
    lineHeight: 15
  },

  // Traço do tempo do vídeo — scrubber (área de toque de 22px, linha ao centro)
  trackRow:  { position: 'absolute', left: 14, right: 14, height: 22, justifyContent: 'center' },
  // Branco porque assenta sobre a feed escura. O sulco fica a 22% para se ler
  // como calha sem competir com o preenchimento.
  track:     { borderRadius: 2, overflow: 'hidden', backgroundColor: 'rgba(255,255,255,0.22)' },
  trackFill: { height: '100%', borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.92)' },
  playOverlay: { position: 'absolute', left: 0, right: 0, top: '40%', alignItems: 'center' }
})
