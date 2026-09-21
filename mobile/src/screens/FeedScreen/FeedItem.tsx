import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  View, Text, StyleSheet, Dimensions, Pressable, TouchableOpacity, Animated,
  ActivityIndicator, Easing, PanResponder,
} from 'react-native'
import type { TextLayoutEvent } from 'react-native'
import { useVideoPlayer, VideoView, VideoPlayerStatus } from 'expo-video'
import { Image } from 'expo-image'
import { LinearGradient } from 'expo-linear-gradient'
import { useIsFocused, useNavigation } from '@react-navigation/native'
import { StackNavigationProp } from '@react-navigation/stack'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { Post, type RepostResult } from '../../types'
import { colors, fonts, leading, postGradientColors, radius, spacing, typography } from '../../theme'
import { parsePostFontKey, postFontStyle } from '../../theme/postFonts'
import Icon from '../../components/Icon'
import { actionInkRest, RAIL_CLEARANCE, feedFill, feedIcon, feedInk, feedLine, feedRailHeight, feedRailTailInset, feedTextShadow, feedType } from './tokens'
import { usePostFontsReady } from '../../store/postFonts.store'
import * as postService from '../../services/post.service'
import type { TasteSignal } from '../../services/post.service'
import AuthorAvatar from '../../components/AuthorAvatar'
import FeedIcon from '../../components/FeedIcon'
import VerifiedBadge from '../../components/VerifiedBadge'
import ActionBar, { CIRCLE_RAIL_ITEMS } from './ActionBar'
import { FEED_CHROME_HEIGHT, FEED_CHROME_ROW } from './FeedHeader'
import TasteCard from './TasteCard'
import {
  shouldAskTaste, tasteDwellMs, noteTasteShown, noteTasteAnswered, noteTasteIgnored,
  type TasteKind,
} from './tastePolicy'
import PostAlbumCarousel from './PostAlbumCarousel'
import CircleMomentStage from './CircleMomentStage'
import { useAuthStore } from '../../store/auth.store'
import { useFollowStore } from '../../store/follow.store'
import { tabBarOccupiedHeight } from '../../components/TabBar/layout'
import { AppStackParams } from '../../navigation/AppNavigator'
import { useT } from '../../i18n'
import { displayHandle } from '../../utils/handle'
import { resolveMediaUrl as resolveUrl } from '../../utils/media'
import { configureVideoPlayer, videoSource as buildVideoSource, videoPosterUrl } from '../../utils/video'

const { width } = Dimensions.get('window')
// Uma linha, com reticências e o "ver mais" a abrir o resto.
//
// Duas linhas mais o "ver mais" davam três linhas de texto no bloco do autor —
// o mesmo espaço que a fotografia perdia. A legenda serve para decidir se vale
// a pena abrir, e para isso a primeira linha chega.
/**
 * O que o anel do autor rouba à esquerda: `ringWidth` 2 + `gap` 2.
 *
 * O `AuthorAvatar` desenha o anel por fora da fotografia, e a caixa reserva esse
 * espaço mesmo quando o anel está apagado — de propósito, para o avatar não mudar
 * de tamanho quando ele acende. O efeito colateral era a fotografia começar 4px
 * mais à direita que a legenda e que os avatares de quem comentou, que não têm
 * anel nenhum: três coisas na mesma coluna, alinhadas por duas réguas.
 *
 * O desconto devolve a fotografia à margem do ecrã. Quando o anel acende, é ele
 * que passa a sair 4px para fora — que é o que se quer: o anel é um estado
 * passageiro e não pode ser ele a definir onde começa a coluna.
 */
const AUTHOR_RING_INSET = 4

const DESCRIPTION_MAX_LINES = 1
// Quanto tempo uma célula de vídeo tem de ficar parada no ecrã antes de valer a
// pena gastar dados com ela. Curto para quem pára não notar, longo para quem
// está a rolar não pagar nada.
const VIDEO_ARM_DELAY = 260
/**
 * O que a figura do Círculo deixa livre em baixo: a coluna de acções inteira e
 * um degrau de ar. Num Círculo é a coluna que sobe mais alto — três acções
 * chegam aos 174, enquanto o autor e a legenda ficam pelos 110.
 */
const CIRCLE_BOTTOM_CLEARANCE = feedRailHeight(CIRCLE_RAIL_ITEMS) + spacing.lg
type Nav = StackNavigationProp<AppStackParams>

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
  onTasteSignal: (postId: string, signal: TasteSignal, dwellMs: number) => void
  /** Pesquisa/comentários cobrem a publicação; não gastar uma impressão atrás deles. */
  tasteBlocked?: boolean
}

// ─── Uma célula do pager: um momento por ecrã ───────────────────────────────
// Pilha: status bar livre · mídia · scrubber · navegação. O campo de comentário
// vive dentro da TabBar e fica ligado a este post pelo store.
// A célula é a única dona do seu leitor — a FlatList monta/desmonta, sem player
// partilhado.
function FeedItem({
  post, reduceMotion, isActive, cellHeight, liked, commentCount,
  onCommentPress, onLikeChange, onRepostChange, onDeleted, onEdited, onProfileBlocked, onAuthorMuted, onExpired, onBlockingChange,
  onTasteSignal, tasteBlocked = false,
}: Props) {
  const isFocused = useIsFocused()
  const nav = useNavigation<Nav>()
  const t = useT()
  const { top: safeTop, bottom: safeBottom } = useSafeAreaInsets()

  const myId     = useAuthStore((s) => s.user?.id)
  const following = useFollowStore((s) => s.followingIds.has(post.user.id))
  const followLoaded = useFollowStore((s) => s.loaded)
  const isSelf    = myId === post.user.id

  const isVideo = post.mediaType === 'VIDEO'
  const isText  = post.mediaType === 'TEXT'
  const collectiveCaptures = Array.isArray(post.collectiveMoment?.captures)
    ? post.collectiveMoment.captures
    : []
  const isCollective = !isVideo && !isText && collectiveCaptures.length > 0
  // `mediaUrls` também identifica álbuns normais. O discriminador coletivo é
  // explícito para não mudar o desenho desses posts antigos.
  const isAlbum = !isVideo && !isText && !!post.mediaUrls && post.mediaUrls.length > 0
  const uri     = resolveUrl(post.mediaUrl)

  // O convite por baixo da figura do Círculo abre o separador Círculo, o mesmo
  // destino do ícone no topo da feed.
  const openCircle = useCallback(() => {
    nav.navigate('Tabs', { screen: 'Circle' })
  }, [nav])

  // ── Geometria da pilha ──────────────────────────────────────────────────────
  // A mídia respeita a status bar. Em baixo, o scrubber tem uma faixa própria
  // entre o fim do post e o início da navegação.
  const TRACK_H    = 3
  // A faixa que apanha o toque do scrubber. O traço fica centrado nela, e é por
  // isso que a caixa desce metade da diferença: sem a conta, a linha assentava
  // 2pt acima do sítio onde a pilha a manda estar.
  const SCRUB_HIT  = 22
  // O traço do tempo precisa de respirar, não de uma faixa: com 8 de cada lado
  // sobravam 19pt de vazio entre o fim do vídeo e o topo da navegação, e era
  // essa faixa — não a altura da barra — que afastava um do outro.
  const GAP        = 5
  const navTop        = tabBarOccupiedHeight(safeBottom)
  const trackBottom   = navTop + GAP                         // traço, acima da navegação
  const videoBottom   = trackBottom + TRACK_H + GAP          // post termina antes do traço
  // A linha onde as duas colunas de baixo acabam — a tinta, não a caixa.
  //
  // A coluna de acções fica ancorada em `videoBottom`, encostada ao palco do post
  // sem invadir o traço do tempo. Mas o último ícone dela não está no fundo da
  // sua caixa: como todos os itens da coluna, reserva por baixo o espaço do
  // contador, e a tinta acaba `feedRailTailInset` acima. À esquerda não há nada
  // disso — a última linha de texto acaba onde a caixa acaba.
  //
  // Por isso é o bloco do autor que sobe até à coluna, e não o contrário: descer
  // a coluna esses 22pt punha o alvo do último ícone dentro da faixa do scrubber,
  // que atravessa a largura toda e ficaria a disputar o mesmo toque.
  const overlayBottom = videoBottom + feedRailTailInset
  const videoFrame = { top: safeTop, bottom: videoBottom }
  // A largura útil do traço — a mesma margem que o resto da coluna esquerda usa.
  // Esteve escrita à mão como `width - 28` enquanto o estilo abria 16 de cada
  // lado: o dedo aterrava 4pt à frente do sítio onde a imagem saltava, e o erro
  // crescia até ao fim do vídeo. Agora sai da margem, e não de um número solto.
  const trackWidth = width - spacing.md * 2

  // ── Enquadramento da imagem ────────────────────────────────────────────────
  // A largura é sempre a do ecrã; a altura é que vem da proporção da imagem.
  // Por isso a moldura da foto NÃO é a `videoFrame` (que estica de cima a baixo):
  // é calculada a partir do que a imagem mede, e centrada no espaço disponível.
  const mediaSpace = Math.max(0, cellHeight - safeTop - videoBottom)

  // A imagem deve continuar visível enquanto as dimensões chegam. Medidas
  // carregadas pertencem ao URI; callbacks do cache não disputam um reset em efeito.
  const serverAspect = post.mediaWidth && post.mediaHeight
    ? post.mediaWidth / post.mediaHeight
    : null
  const [loadedMedia, setLoadedMedia] = useState<{ uri: string; aspect: number } | null>(null)
  const measuredAspect = loadedMedia?.uri === uri ? loadedMedia.aspect : null
  const aspect = measuredAspect
    ?? (serverAspect && Number.isFinite(serverAspect) && serverAspect > 0 ? serverAspect : null)
  const photoHeight = aspect ? Math.min(width / aspect, mediaSpace) : mediaSpace
  const photoFrame = {
    top: safeTop + (mediaSpace - photoHeight) / 2,
    height: photoHeight,
  }

  // Conteúdo do post entra depois do cartão assentar; o avatar mantém um pulso
  // lento enquanto o post for o único ativo.
  const metaEntry = useRef(new Animated.Value(0)).current
  const [clockNow, setClockNow] = useState(Date.now)

  /**
   * O anel do autor só se acende em publicações das últimas 24 horas.
   *
   * Um anel em toda a gente não distingue ninguém — vira moldura. Aceso só no
   * que é recente, passa a dizer alguma coisa: esta pessoa publicou agora.
   *
   * Depende do `clockNow`, que anda de minuto a minuto, por isso apaga-se
   * sozinho quando a publicação passa a marca sem ser preciso recarregar nada.
   */
  const isFresh = useMemo(() => {
    const at = new Date(post.createdAt).getTime()
    return Number.isFinite(at) && clockNow - at < 24 * 3_600_000
  }, [clockNow, post.createdAt])

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

  // Só o momento visível atualiza o relógio. Já não há traço de tempo a mover-se
  // — o que depende disto agora é o anel do autor, que se apaga sozinho quando a
  // publicação passa as 24 horas.
  useEffect(() => {
    if (!isActive || post.isAnnouncement) return
    setClockNow(Date.now())
    const id = setInterval(() => setClockNow(Date.now()), 60_000)
    return () => clearInterval(id)
  }, [isActive, post.id, post.isAnnouncement])

  const authorContext = post.user.statusLabel
    ?? (post.user.showDevice ? post.deviceModel : null)

  // ── Leitor de vídeo ─────────────────────────────────────────────────────────
  // O vídeo só recebe fonte depois de a célula ficar MESMO parada no ecrã. A
  // FlatList monta as células vizinhas antes de se chegar lá; se elas nascessem
  // com fonte, o leitor começava a encher o buffer de vídeos que o utilizador
  // ainda não viu — e pagava-os na íntegra ao passar à frente. Passar por cima
  // a rolar não gasta um byte de vídeo.
  //
  // Uma vez armada, a fonte fica: voltar atrás um post não recomeça a descarga.
  const [videoArmed, setVideoArmed] = useState(false)
  useEffect(() => {
    if (!isVideo || videoArmed || !isActive || !isFocused) return
    const id = setTimeout(() => setVideoArmed(true), VIDEO_ARM_DELAY)
    return () => clearTimeout(id)
  }, [isVideo, videoArmed, isActive, isFocused])

  // Memoizado: um `{ uri }` inline mudava de referência a cada render e o
  // expo-video criava um player novo que nunca recebia play().
  const source = useMemo(
    () => (isVideo && videoArmed ? buildVideoSource(post.mediaUrl) : null),
    [isVideo, videoArmed, post.mediaUrl],
  )
  const player = useVideoPlayer(source, (p) => {
    configureVideoPlayer(p)
    p.loop = true
    p.muted = false
  })

  const [status, setStatus] = useState<VideoPlayerStatus>(player.status)
  useEffect(() => {
    if (!isVideo) return
    const sub = player.addListener('statusChange', ({ status: next }) => setStatus(next))
    // Fontes em cache podem estar prontas antes de o listener ser instalado.
    setStatus(player.status)
    return () => sub.remove()
  }, [player, isVideo])

  const videoPoster = useMemo(
    () => (isVideo ? videoPosterUrl(post.mediaUrl, post.thumbnailUrl, 1080) : ''),
    [isVideo, post.mediaUrl, post.thumbnailUrl],
  )
  // readyToPlay indica buffer, não pixels. No Android o evento de primeiro
  // frame é emitido uma vez por item; conservar a confirmação ao voltar à célula.
  const [paintedPlayer, setPaintedPlayer] = useState<typeof player | null>(null)
  const videoPainted = paintedPlayer === player
  const videoSurface = isVideo && videoArmed && isActive && isFocused
  const buffering = videoSurface && (status === 'loading' || (!videoPainted && status !== 'error'))

  // Toca só a célula ativa e só com o feed em foco. Ao entrar noutra página o
  // feed perde foco e o vídeo pausa; ao voltar, retoma.
  useEffect(() => {
    if (!isVideo) return
    if (isActive && isFocused) { try { player.play() } catch {}; setPaused(false) }
    else                       { try { player.pause() } catch {} }
  }, [isActive, isFocused, player, isVideo])

  // ── Traço do tempo do vídeo + scrubber ──────────────────────────────────────
  // O player entrega amostras a cada 100ms; entre elas, a escala é interpolada
  // no driver nativo. Assim o traço corre continuamente sem renderizar a célula
  // inteira nem saltar de percentagem inteira em percentagem inteira.
  const videoProgress = useRef(new Animated.Value(0)).current
  const videoProgressTarget = useRef(0)
  const scrubbing = useRef(false)

  useEffect(() => {
    scrubbing.current = false
    videoProgress.stopAnimation()
    videoProgress.setValue(0)
    videoProgressTarget.current = 0
  }, [post.id, videoProgress])

  useEffect(() => {
    if (!isVideo || !isActive || !isFocused) {
      try { player.timeUpdateEventInterval = 0 } catch {}
      videoProgress.stopAnimation()
      return
    }

    // Alinha imediatamente ao ponto preservado pelo player ao voltar ao post.
    try {
      const duration = player.duration
      if (duration > 0) {
        const initial = Math.max(0, Math.min(1, player.currentTime / duration))
        videoProgressTarget.current = initial
        videoProgress.setValue(initial)
      }
    } catch {}

    const sub = player.addListener('timeUpdate', ({ currentTime }) => {
      if (scrubbing.current) return
      try {
        const duration = player.duration
        if (!(duration > 0)) return
        const next = Math.max(0, Math.min(1, currentTime / duration))
        const looped = next + 0.08 < videoProgressTarget.current
        videoProgressTarget.current = next

        if (looped) {
          videoProgress.stopAnimation()
          videoProgress.setValue(next)
          return
        }

        // O traço continua preciso, mas respeita a preferência do sistema sem
        // introduzir uma animação que o utilizador pediu para reduzir.
        if (reduceMotion) {
          videoProgress.stopAnimation()
          videoProgress.setValue(next)
          return
        }

        Animated.timing(videoProgress, {
          toValue: next,
          duration: 120,
          easing: Easing.linear,
          useNativeDriver: true,
        }).start()
      } catch {}
    })

    // No Android o relógio de `timeUpdate` continua ativo mesmo em pausa. Liga
    // a amostragem fina apenas durante playback e desliga-a em pausa/modal.
    const setSampling = (isPlaying: boolean) => {
      try { player.timeUpdateEventInterval = isPlaying ? (reduceMotion ? 0.25 : 0.1) : 0 } catch {}
      if (!isPlaying) {
        videoProgress.stopAnimation()
        // A última amostra pode estar alguns milissegundos atrás da pausa.
        // Fecha a barra na posição real antes de desligar o relógio.
        try {
          const duration = player.duration
          if (duration > 0) {
            const pausedAt = Math.max(0, Math.min(1, player.currentTime / duration))
            videoProgressTarget.current = pausedAt
            videoProgress.setValue(pausedAt)
          }
        } catch {}
      }
    }
    const playingSub = player.addListener('playingChange', ({ isPlaying }) => {
      setSampling(isPlaying)
    })
    setSampling(player.playing)

    return () => {
      sub.remove()
      playingSub.remove()
      try { player.timeUpdateEventInterval = 0 } catch {}
      scrubbing.current = false
      videoProgress.stopAnimation()
    }
  }, [isVideo, isActive, isFocused, player, reduceMotion, videoProgress])

  // Tocar/arrastar na linha salta no vídeo (voltar ao início ou correr).
  const scrub = useMemo(() => {
    const seekTo = (x: number) => {
      const frac = Math.max(0, Math.min(1, x / trackWidth))
      try {
        const d = player.duration
        if (d > 0) {
          player.currentTime = frac * d
          videoProgress.stopAnimation()
          videoProgressTarget.current = frac
          videoProgress.setValue(frac)
        }
      } catch {}
    }
    return PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder:  () => true,
      onPanResponderGrant: (e) => {
        scrubbing.current = true
        seekTo(e.nativeEvent.locationX)
      },
      onPanResponderMove:  (e) => seekTo(e.nativeEvent.locationX),
      onPanResponderRelease: () => { scrubbing.current = false },
      onPanResponderTerminate: () => { scrubbing.current = false },
    })
  }, [player, trackWidth, videoProgress])

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
  // Quem decide SE se pergunta é a política (tastePolicy.ts); a célula só sabe
  // QUANDO — no momento em que a pessoa já esteve aqui tempo suficiente para
  // ter opinião. A decisão é tomada nessa altura, e não antes: só então se
  // sabe que ela ficou, que é a informação que torna a pergunta útil.
  const tasteKind: TasteKind = isVideo ? 'VIDEO' : isText ? 'TEXT' : 'IMAGE'
  const [tasteVisible, setTasteVisible] = useState(false)
  const tasteAnsweredRef = useRef(false)
  const tasteShownRef = useRef(false)
  const activeSinceRef = useRef(0)

  useEffect(() => {
    if (tasteAnsweredRef.current) return

    if (!isActive) {
      // Apareceu e a pessoa deslizou para outro post: também é resposta, e a
      // política usa-a para se calar durante umas horas.
      if (tasteShownRef.current) {
        tasteShownRef.current = false
        noteTasteIgnored(post.id)
      }
      setTasteVisible(false)
      return
    }
    if (!isFocused) return
    // Já está no ecrã: um re-render (um gosto, um contador) não pode voltar a
    // decidir nem a gastar outra vez o orçamento da sessão.
    if (tasteShownRef.current) return

    activeSinceRef.current = Date.now()
    const id = setTimeout(() => {
      if (tasteBlocked || menuBlocking.current) return
      if (!shouldAskTaste({
        postId: post.id,
        kind: tasteKind,
        isSelf,
        isAnnouncement: post.isAnnouncement ?? false,
        // Gostar ou repostar já é uma resposta dada com os dedos.
        engaged: liked || !!post.userReposted,
        followingAuthor: following,
      })) return
      noteTasteShown(post.id)
      tasteShownRef.current = true
      setTasteVisible(true)
    }, tasteDwellMs(tasteKind))
    return () => clearTimeout(id)
  }, [isActive, isFocused, post.id, tasteKind, isSelf, post.isAnnouncement, liked, post.userReposted, following, tasteBlocked])

  const handleTasteAnswer = useCallback((signal: TasteSignal) => {
    tasteAnsweredRef.current = true
    tasteShownRef.current = false
    noteTasteAnswered(post.id, tasteKind)
    // O tempo até responder distingue o "não" imediato do "não" depois de ver
    // tudo — duas respostas iguais que não valem o mesmo.
    const dwellMs = activeSinceRef.current ? Date.now() - activeSinceRef.current : 0
    onTasteSignal(post.id, signal, dwellMs)
  }, [onTasteSignal, post.id, tasteKind])

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
    if (!useFollowStore.getState().loaded) return
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

  const textGradient = useMemo(
    () => postGradientColors(post.bgColor),
    [post.bgColor],
  )

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
      ) : isCollective ? (
        <View style={[s.media, videoFrame]}>
          {/* O cromado e a coluna flutuam por cima da mídia sem lhe roubar
              altura; a figura desconta-os para não ficar por baixo de nenhum. */}
          <CircleMomentStage
            post={post}
            reduceMotion={reduceMotion}
            isActive={isActive}
            topInset={FEED_CHROME_HEIGHT}
            bottomInset={CIRCLE_BOTTOM_CLEARANCE}
            chromeRow={FEED_CHROME_ROW}
            onCreateCircle={openCircle}
          />
        </View>
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
        <View style={[s.media, videoFrame]}>
          {/* Ver `videoSurface`: a vista só existe com fonte armada e com a
              célula à vista. Montá-la antes de haver fonte deixava-a presa a
              pintar preto, e montá-la em três células ao mesmo tempo partia-a. */}
          {videoSurface && (
            <VideoView
              player={player}
              style={StyleSheet.absoluteFill}
              contentFit="cover"
              nativeControls={false}
              // Composta com a árvore como qualquer outra vista. Custa mais
              // bateria que a `SurfaceView`, mas numa lista que arrasta vídeos
              // uns por cima dos outros é a única que desenha o que deve.
              surfaceType="textureView"
              onFirstFrameRender={() => setPaintedPlayer(player)}
            />
          )}
          {/* O cartaz — o frame zero em JPEG — é o que se vê sempre que não há
              superfície: antes de a fonte armar, fora da célula à vista, e ainda
              por cima dela até o leitor ter mesmo imagem para dar. */}
          {(!videoSurface || !videoPainted) && !!videoPoster && (
            <Image
              source={{ uri: videoPoster }}
              style={StyleSheet.absoluteFill}
              contentFit="cover"
              cachePolicy="disk"
              recyclingKey={`${post.id}:poster`}
              pointerEvents="none"
            />
          )}
        </View>
      ) : (
        // Contain mantém a foto inteira mesmo antes de conhecermos a proporção.
        <Image
          source={{ uri }}
          style={[s.media, photoFrame]}
          contentFit="contain"
          cachePolicy="disk"
          recyclingKey={`${post.id}:${uri}`}
          transition={0}
          onLoad={(e) => {
            const { width: w, height: h } = e.source ?? {}
            if (w && h && Number.isFinite(w / h) && w / h > 0) {
              setLoadedMedia({ uri, aspect: w / h })
            }
          }}
        />
      )}

      {/* Camada de toque — duplo toque para gostar.
             Não a pomos no álbum, que bloquearia o gesto horizontal, nem no
             Círculo, onde cada disco é um toque próprio. */}
      {!isAlbum && !isCollective && (
        <Pressable style={[s.tapLayer, videoFrame]} onPress={handleTapMedia} accessible={false} />
      )}

      {buffering && (
        <ActivityIndicator style={s.spinner} size="large" color={feedInk.primary} pointerEvents="none" />
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
        <FeedIcon name="heart-solid" size={feedIcon.burst} color={feedInk.secondary} />
      </Animated.View>

      {isVideo && paused && (
        <View style={s.playOverlay} pointerEvents="none">
          <Icon name="play" size={feedIcon.overlay} color={actionInkRest.media} />
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

        <View style={s.authorRow}>
          <TouchableOpacity
            style={s.authorAvatarHit}
            onPress={() => nav.navigate('Profile', { userId: post.user.id })}
            activeOpacity={0.82}
            accessibilityRole="button"
            accessibilityLabel={post.user.name}
          >
            <AuthorAvatar
              uri={resolveUrl(post.user.avatar)}
              name={post.user.name}
              avatarSize={34}
              ringWidth={2}
              gap={2}
              ringVisible={isFresh}
              wellColor="rgba(11,20,26,0.84)"
              elevated
            />
          </TouchableOpacity>

          <TouchableOpacity
            style={s.authorText}
            onPress={() => nav.navigate('Profile', { userId: post.user.id })}
            activeOpacity={0.78}
            accessibilityRole="button"
            accessibilityLabel={post.user.name}
          >
            <View style={s.authorNameLine}>
              <Text style={s.authorName} numberOfLines={1}>
                {post.user.username ? displayHandle(post.user.username) : post.user.name}
              </Text>
              {post.user.isVerified && (
                <View style={s.authorVerified}>
                  <VerifiedBadge color={feedInk.primary} />
                </View>
              )}
            </View>
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
              disabled={!followLoaded}
              accessibilityRole="button"
              accessibilityLabel={`${following ? t.following : t.follow} ${post.user.name}`}
              accessibilityState={{ disabled: !followLoaded, selected: following }}
            >
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
        // A coluna termina no palco do post e não invade o scrubber. Quem se
        // alinha por ela é o bloco do autor, via `feedRailTailInset`.
        bottomOffset={videoBottom}
        isActive={isActive}
        isCircle={isCollective}
        reduceMotion={reduceMotion}
        iconSize={feedIcon.action}
      />

      {/* ── Traço do tempo — scrubber: tocar/arrastar salta no vídeo ── */}
      {isVideo && (
        <View
          style={[s.trackRow, { height: SCRUB_HIT, bottom: trackBottom - (SCRUB_HIT - TRACK_H) / 2 }]}
          {...scrub.panHandlers}
        >
          <View style={[s.track, { height: TRACK_H }]}>
            <Animated.View style={[s.trackFill, { transform: [{ scaleX: videoProgress }] }]} />
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
    width: 108, height: 108, borderRadius: radius.full,
    borderWidth: 2, borderColor: feedLine.bright
  },
  textWrap:    { flex: 1, alignItems: 'center', justifyContent: 'center' },
  textContent: {
    color: feedInk.primary, fontFamily: fonts.regular,
    fontSize: typography.display, lineHeight: leading.display,
    textAlign: 'center', paddingHorizontal: spacing.xl,
  },

  // Autor + descrição
  meta:       { position: 'absolute', left: spacing.md, right: RAIL_CLEARANCE, gap: spacing.xs2 },
  authorAvatarHit: { marginLeft: -AUTHOR_RING_INSET },
  authorRow:  { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  // `flexShrink` e não `flex: 1`: com `flex: 1` o bloco do nome esticava para
  // toda a largura livre e empurrava o botão de seguir para a borda oposta.
  // A encolher, ocupa só o que o nome mede — o botão fica logo ao lado — e um
  // nome comprido continua a cortar com reticências em vez de o expulsar.
  authorText: { flexShrink: 1, minWidth: 0, justifyContent: 'center' },
  // O selo ao lado do nome, não por baixo: `flexShrink` no texto para um nome
  // comprido cortar com reticências em vez de empurrar o selo para fora.
  authorNameLine: { flexDirection: 'row', alignItems: 'center', gap: spacing.xxs },
  authorVerified: {
    width: 16,
    height: feedType.author.lineHeight,
    flexShrink: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  authorName: {
    flexShrink: 1,
    ...feedTextShadow,
    ...feedType.author,
    color: feedInk.primary,
  },
  authorContext: {
    ...feedTextShadow,
    ...feedType.meta,
    color: feedInk.muted,
  },
  followBtn: {
    minHeight: 32,
    minWidth: 72,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.sm2,
    borderWidth: 1,
    // O contorno de um botão sobre a mídia — o mesmo 46% que o cromado do topo
    // pratica. Estava em `bright`, que é a tinta de um anel de identidade: um
    // convite a seguir não pede o traço mais forte do ecrã.
    borderColor: feedLine.strong,
    borderRadius: radius.md,
  },
  followTxt: {
    ...feedTextShadow,
    ...feedType.primary,
    color: feedInk.primary,
  },
  // Já sigo: os dois estados eram desenhados exactamente iguais — mesmo traço,
  // mesma tinta — e só o rótulo mudava, o que obriga a ler o texto para saber em
  // que estado se está. O que já está feito recolhe um degrau: traço mais fraco
  // e texto no nível do contexto. Continua a poder desfazer-se — e continua a
  // ver-se sobre uma fotografia clara, que é onde um traço a 18% desaparecia.
  followingBtn: { borderColor: feedLine.medium },
  followingTxt: { color: feedInk.muted },
  descriptionWrap: { position: 'relative' },
  description: {
    ...feedTextShadow,
    ...feedType.content,
    color: feedInk.secondary,
  },
  // Pista, não texto: fica no degrau do contexto para a legenda continuar a ser
  // a única coisa que se lê a cheio naquele bloco.
  descriptionMore: {
    ...feedTextShadow,
    ...feedType.content,
    color: feedInk.muted,
    marginTop: spacing.xxs,
  },
  descriptionMeasure: {
    position: 'absolute',
    left: 0,
    right: 0,
    opacity: 0
  },
  socialRow: { minHeight: feedType.copy.lineHeight, flexDirection: 'row', alignItems: 'center' },
  commentsLink: { flex: 1, minHeight: feedType.copy.lineHeight, justifyContent: 'center' },
  commentsText: {
    ...feedTextShadow,
    ...feedType.copy,
    flexShrink: 1,
    color: feedInk.muted,
  },

  // Traço do tempo do vídeo — scrubber. A altura da área de toque vem da célula
  // (`SCRUB_HIT`), que é também quem posiciona a caixa: um número, um sítio.
  trackRow:  { position: 'absolute', left: spacing.md, right: spacing.md, justifyContent: 'center' },
  // Branco porque assenta sobre a feed escura. O sulco fica a 22% para se ler
  // como calha sem competir com o preenchimento.
  track:     { borderRadius: radius.full, overflow: 'hidden', backgroundColor: feedFill.track },
  trackFill: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    width: '100%',
    transformOrigin: 'left center',
    borderRadius: radius.full,
    backgroundColor: feedFill.solid,
  },
  playOverlay: { position: 'absolute', left: 0, right: 0, top: '40%', alignItems: 'center' }
})
