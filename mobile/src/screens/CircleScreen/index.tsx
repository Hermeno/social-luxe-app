import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react'
import { useIsFocused } from '@react-navigation/native'
import SuggestionsSheet from '../../components/SuggestionsSheet'
import { useMessagesStore } from '../../store/messages.store'
import {
  View, Text, StyleSheet, Pressable, ScrollView,
  ActivityIndicator, Alert, Animated, PanResponder, Modal, Easing, Vibration,
  type StyleProp, type ViewStyle,
} from 'react-native'
import { Image } from 'expo-image'
import { CameraView, useCameraPermissions } from 'expo-camera'
import * as Location from 'expo-location'
import { setStatusBarStyle } from 'expo-status-bar'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useFocusEffect, useNavigation } from '@react-navigation/native'
import { Ionicons } from '@expo/vector-icons'
import { colors, fonts, radius, spacing } from '../../theme'
import AvatarImage from '../../components/AvatarImage'
import * as circle from '../../services/circle.service'
import { setCircleScreenActive } from './presence'
import {
  CircleMember,
  CircleRound,
  CircleSession,
  CircleUser,
  EmojiOverlay,
} from '../../services/circle.service'
import { getMyFollowing, getMyFollowers } from '../../services/follow.service'
import { useFollowStore } from '../../store/follow.store'
import { useAuthStore } from '../../store/auth.store'
import { useFeedStore } from '../../store/feed.store'
import { useNotificationStore } from '../../store/notification.store'
import { getSocket } from '../../socket'
import { useT } from '../../i18n'
import { toast } from '../../utils/toast'
import { API_BASE } from '../../config'

const SHUTTER_OUTER = 78
// Recurso para o primeiro render, antes de o servidor responder. Quem manda na
// janela é o servidor (publishWindowMs) — é ele que a aplica ao publicar.
const PUBLISH_WINDOW_FALLBACK_MS = 60 * 1000
const SHUTTER_INNER = 62
const INVITE_TTL_MS = 2 * 60 * 1000   // convite expira em 2 min (igual ao backend)
const MAX_CAPTURES_PER_ROUND = 2

type IoniconName = React.ComponentProps<typeof Ionicons>['name']
type ButtonTone = 'primary' | 'glass' | 'soft' | 'danger'

function resolveMediaUrl(url: string) {
  if (!url) return ''
  return /^(?:https?:|file:|content:|ph:)/i.test(url) ? url : `${API_BASE}${url}`
}

function CircleButton({
  label,
  icon,
  onPress,
  tone = 'glass',
  loading = false,
  disabled = false,
  compact = false,
  style,
  accessibilityLabel,
}: {
  label: string
  icon?: IoniconName
  onPress: () => void
  tone?: ButtonTone
  loading?: boolean
  disabled?: boolean
  compact?: boolean
  style?: StyleProp<ViewStyle>
  accessibilityLabel?: string
}) {
  const inactive = disabled || loading
  return (
    <Pressable
      onPress={onPress}
      disabled={inactive}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled: inactive, busy: loading }}
      hitSlop={compact ? 4 : 2}
      style={({ pressed }) => [
        s.controlButton,
        compact && s.controlButtonCompact,
        tone === 'primary' && s.controlButtonPrimary,
        tone === 'soft' && s.controlButtonSoft,
        tone === 'danger' && s.controlButtonDanger,
        inactive && s.controlButtonDisabled,
        pressed && !inactive && s.controlButtonPressed,
        style,
      ]}
    >
      {loading
        ? <ActivityIndicator size="small" color="#fff" />
        : icon ? <Ionicons name={icon} size={compact ? 15 : 18} color="#fff" /> : null}
      {!loading && <Text style={[s.controlButtonText, compact && s.controlButtonTextCompact]}>{label}</Text>}
    </Pressable>
  )
}

function CircleIconButton({
  icon,
  label,
  onPress,
  tone = 'glass',
  disabled = false,
  loading = false,
  style,
}: {
  icon: IoniconName
  label: string
  onPress: () => void
  tone?: ButtonTone
  disabled?: boolean
  loading?: boolean
  style?: StyleProp<ViewStyle>
}) {
  const inactive = disabled || loading
  return (
    <Pressable
      onPress={onPress}
      disabled={inactive}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: inactive, busy: loading }}
      hitSlop={6}
      style={({ pressed }) => [
        s.iconButton,
        tone === 'primary' && s.iconButtonPrimary,
        tone === 'soft' && s.iconButtonSoft,
        tone === 'danger' && s.iconButtonDanger,
        inactive && s.controlButtonDisabled,
        pressed && !inactive && s.controlButtonPressed,
        style,
      ]}
    >
      {loading
        ? <ActivityIndicator size="small" color="#fff" />
        : <Ionicons name={icon} size={20} color="#fff" />}
    </Pressable>
  )
}

// Três pontos a pulsar em sequência — dá vida ao estado "à procura"
function SearchingDots({ color = '#fff' }: { color?: string }) {
  const dots = [useRef(new Animated.Value(0.3)).current, useRef(new Animated.Value(0.3)).current, useRef(new Animated.Value(0.3)).current]
  useEffect(() => {
    const loops = dots.map((d, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(i * 180),
          Animated.timing(d, { toValue: 1, duration: 420, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
          Animated.timing(d, { toValue: 0.3, duration: 420, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        ]),
      ),
    )
    loops.forEach((l) => l.start())
    return () => loops.forEach((l) => l.stop())
  }, [])
  return (
    <View style={{ flexDirection: 'row', gap: 4, alignItems: 'center' }}>
      {dots.map((d, i) => (
        <Animated.View key={i} style={{ width: 5, height: 5, borderRadius: 2.5, backgroundColor: color, opacity: d }} />
      ))}
    </View>
  )
}

const EMOJI_SET  = ['❤️', '🔥', '😂', '😍', '⭐️', '💯', '🙌', '👀', '✨', '😎', '🎯', '🌸', '👑', '🕶️']
const EMOJI_FRAC = 0.14
const MAX_EMOJI_OVERLAYS = 16
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))

type Placed = { id: string; emoji: string; x: number; y: number }
type ImageRect = { left: number; top: number; width: number; height: number }
type PendingCapture = {
  uri: string
  size: { w: number; h: number } | null
  roundId: string | null
  slot: 1 | 2
}

// As primeiras posições ficam perto do centro, mas não exactamente umas sobre
// as outras. Antes, cada toque colocava o novo emoji no mesmo ponto e parecia
// que o segundo/terceiro toque não tinha feito nada.
const EMOJI_START_OFFSETS = [
  { x: 0, y: 0 },
  { x: 0.10, y: 0.08 },
  { x: -0.10, y: 0.08 },
  { x: 0.10, y: -0.08 },
  { x: -0.10, y: -0.08 },
] as const

// Emoji arrastável sobre a pré-visualização
function PlacedEmoji({
  item, imageRect, onCommit, onRemove, removeLabel,
}: {
  item: Placed
  imageRect: ImageRect
  onCommit: (id: string, x: number, y: number) => void
  onRemove: (id: string) => void
  removeLabel: string
}) {
  // x/y são fracções da FOTO original. A preview usa `cover`, por isso a foto
  // pode ser maior do que o ecrã e ficar cortada nas bordas. Converter através
  // de imageRect mantém a posição escolhida quando o post chega à feed.
  const size      = imageRect.width * EMOJI_FRAC
  const startLeft = imageRect.left + item.x * imageRect.width - size / 2
  const startTop  = imageRect.top + item.y * imageRect.height - size / 2
  const pan       = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current

  const resetPan = () => pan.setValue({ x: 0, y: 0 })

  const responder = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => false,
    onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > 3 || Math.abs(g.dy) > 3,
    onPanResponderMove: (_, g) => pan.setValue({ x: g.dx, y: g.dy }),
    onPanResponderRelease: (_, g) => {
      const cx = clamp((startLeft + g.dx + size / 2 - imageRect.left) / imageRect.width, 0.06, 0.94)
      const cy = clamp((startTop + g.dy + size / 2 - imageRect.top) / imageRect.height, 0.06, 0.94)
      resetPan()
      onCommit(item.id, cx, cy)
    },
    onPanResponderTerminate: resetPan,
  }), [startLeft, startTop, size, imageRect.left, imageRect.top, imageRect.width, imageRect.height])

  return (
    <Animated.View
      style={[em.placed, { left: startLeft, top: startTop, transform: pan.getTranslateTransform() }]}
      {...responder.panHandlers}
    >
      <Text style={{ fontSize: size }}>{item.emoji}</Text>
      <Pressable
        style={({ pressed }) => [em.del, pressed && s.controlButtonPressed]}
        onPress={() => onRemove(item.id)}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel={`${removeLabel} ${item.emoji}`}
      >
        <Ionicons name="close" size={11} color="#fff" />
      </Pressable>
    </Animated.View>
  )
}

export default function CircleScreen() {
  const isFocused = useIsFocused()

  // A TabBar pede a folha de sugestões; renderiza-se aqui em vez de saltar
  // para o Chat, para não tirar a pessoa de onde está.
  const suggestionsRequested = useMessagesStore((st) => st.suggestionsRequested)
  const consumedSuggestionsRef = useRef(0)
  const [showSuggestions, setShowSuggestions] = useState(false)
  useEffect(() => {
    if (!isFocused || suggestionsRequested <= consumedSuggestionsRef.current) return
    consumedSuggestionsRef.current = suggestionsRequested
    setShowSuggestions(true)
  }, [isFocused, suggestionsRequested])

  const { top, bottom } = useSafeAreaInsets()
  const nav  = useNavigation<any>()
  const user = useAuthStore((s) => s.user)
  const t    = useT()
  const setPendingPost = useFeedStore((s) => s.setPendingPost)
  // Fonte única de quem sigo. Ler daqui faz o deixar de seguir (em qualquer
  // ecrã) tirar a pessoa da lista de convite na hora — chamar quem já não é
  // mútuo dava erro no servidor.
  const followingIds = useFollowStore((s) => s.followingIds)

  const [permission, requestPermission] = useCameraPermissions()
  const [requestingPermission, setRequestingPermission] = useState(false)
  const camRef = useRef<CameraView>(null)

  const [session,    setSession]    = useState<CircleSession | null>(null)
  const [members,    setMembers]    = useState<CircleMember[]>([])
  const [currentRound, setCurrentRound] = useState<CircleRound | null>(null)
  const [nearby,     setNearby]     = useState<CircleUser[]>([])
  const [calling,    setCalling]    = useState<Set<string>>(new Set())
  const [incoming,   setIncoming]   = useState<{ sessionId: string; hostName: string; hostAvatar: string | null } | null>(null)
  const [focused,    setFocused]    = useState(false)
  const [facing,     setFacing]     = useState<'back' | 'front'>('back')
  const [cameraReady, setCameraReady] = useState(false)
  const [preview, setPreview] = useState<PendingCapture | null>(null)
  const [placed,     setPlaced]     = useState<Placed[]>([])
  const [previewBox, setPreviewBox] = useState({ w: 0, h: 0 })
  const [initDone,   setInitDone]   = useState(false)
  const [initError,  setInitError]  = useState(false)
  const [shooting,   setShooting]   = useState(false)
  const [startingCountdown, setStartingCountdown] = useState(false)
  const [countdown,  setCountdown]  = useState<number | null>(null)
  // Altura real da barra de baixo. O painel "chamar mais" assenta em cima dela,
  // e ela cresce quando aparece o botão de publicar — daí ser medida, não fixa.
  const [bottomBarH, setBottomBarH] = useState(0)
  const countdownTimer = useRef<ReturnType<typeof setInterval> | null>(null)
  const lastCountdownRoundRef = useRef<string | null>(null)
  // Quantos envios estão em fundo. Já não bloqueia nada — serve para o dock
  // poder dizer que a fotografia ainda está a caminho do servidor.
  const [saving, setSaving] = useState(0)
  const uploadChainRef = useRef<Promise<unknown>>(Promise.resolve())
  const [publishing, setPublishing] = useState(false)
  const [published,  setPublished]  = useState(false)
  const [joining, setJoining] = useState(false)
  const [leaving, setLeaving] = useState(false)
  const [friendsSheet,  setFriendsSheet]  = useState(false)
  const [friends,       setFriends]       = useState<CircleUser[]>([])
  const [loadingFriends, setLoadingFriends] = useState(false)
  const [publishWindowMs, setPublishWindowMs] = useState(PUBLISH_WINDOW_FALLBACK_MS)
  const [withdrawingCaptureId, setWithdrawingCaptureId] = useState<string | null>(null)

  const sessionRef = useRef<CircleSession | null>(null)
  sessionRef.current = session
  const currentRoundRef = useRef<CircleRound | null>(null)
  currentRoundRef.current = currentRound
  const previewRef = useRef<PendingCapture | null>(null)
  previewRef.current = preview
  const shootingRef = useRef(false)
  shootingRef.current = shooting
  const startingCountdownRef = useRef(false)
  startingCountdownRef.current = startingCountdown
  const callTimers = useRef<ReturnType<typeof setTimeout>[]>([])

  const shutterPress = useRef(new Animated.Value(1)).current

  const myId       = user?.id
  const isHost     = !!session && session.hostId === myId
  const others     = members.filter((m) => m.user.id !== myId && m.status === 'JOINED')
  const memberIds  = new Set(members.map((m) => m.user.id))
  // Só quem eu ainda sigo. O servidor só devolve mútuos ao abrir, mas se eu
  // deixar de seguir depois, o store atualiza e a pessoa sai daqui na hora.
  const showable   = nearby.filter((u) => !memberIds.has(u.id) && followingIds.has(u.id))
  // A lista do sheet "chamar amigos" fica em cache; filtrá-la pelo store faz o
  // deixar de seguir tirar a pessoa daqui sem ter de fechar e reabrir.
  const visibleFriends = friends.filter((f) => followingIds.has(f.id))
  const joinedMembers = members.filter((m) => m.status === 'JOINED')
  const joinedCount = joinedMembers.length
  const activeRoundId = currentRound?.id ?? null
  const roundCaptures = activeRoundId
    ? joinedMembers.flatMap((member) => (
        Array.isArray(member.captures)
          ? member.captures.filter((capture) => capture.roundId === activeRoundId)
          : []
      ))
    : []
  const myMember = joinedMembers.find((member) => member.user.id === myId)
  const myRoundCaptures = activeRoundId
    ? (myMember?.captures ?? [])
        .filter((capture) => capture.roundId === activeRoundId)
        .sort((a, b) => a.slot - b.slot)
    : []
  const contributorsInRound = new Set(roundCaptures.map((capture) => capture.userId)).size


  // Caixa real ocupada pela foto em `contentFit="cover"`. Pode ultrapassar o
  // ecrã nos lados ou em cima/baixo; os emojis usam esta geometria para guardar
  // coordenadas relativas ao ficheiro, não relativas ao recorte da preview.
  const previewImageRect = useMemo<ImageRect>(() => {
    if (previewBox.w <= 0 || previewBox.h <= 0) {
      return { left: 0, top: 0, width: 0, height: 0 }
    }
    if (!preview?.size?.w || !preview.size.h) {
      return { left: 0, top: 0, width: previewBox.w, height: previewBox.h }
    }
    const scale = Math.max(previewBox.w / preview.size.w, previewBox.h / preview.size.h)
    const renderedW = preview.size.w * scale
    const renderedH = preview.size.h * scale
    return {
      left: (previewBox.w - renderedW) / 2,
      top: (previewBox.h - renderedH) / 2,
      width: renderedW,
      height: renderedH,
    }
  }, [preview?.size?.h, preview?.size?.w, previewBox.h, previewBox.w])

  // ── Janela para publicar ────────────────────────────────────────────────────
  // A janela pertence à ronda, não à última fotografia de uma pessoa. Assim os
  // contadores, slots e o snapshot publicado falam sempre do mesmo momento.
  const roundExpiresAt = currentRound?.expiresAt
    ?? (currentRound?.shotAt
      ? new Date(new Date(currentRound.shotAt).getTime() + publishWindowMs).toISOString()
      : null)
  const [nowTs, setNowTs] = useState(() => Date.now())
  useEffect(() => {
    if (!roundExpiresAt) return
    const end = new Date(roundExpiresAt).getTime()
    if (!Number.isFinite(end)) return
    setNowTs(Date.now())
    if (Date.now() >= end) { setNowTs(Date.now()); return }   // janela já fechada
    const id = setInterval(() => {
      const t = Date.now()
      setNowTs(t)
      if (t >= end) clearInterval(id)   // fechou: não vale a pena continuar a acordar
    }, 500)
    return () => clearInterval(id)
  }, [roundExpiresAt])

  const publishLeftMs = roundExpiresAt
    ? Math.max(0, new Date(roundExpiresAt).getTime() - nowTs)
    : 0
  const roundIsActive = !!activeRoundId && publishLeftMs > 0
  const roundAcceptsMyCapture = roundIsActive
    && (!currentRound?.isSolo || currentRound.ownerUserId === myId)

  // ── Alguém já disparou e eu ainda não ──────────────────────────────────────
  // A ronda dura um minuto. Quem está a enquadrar não repara num número pequeno
  // a aparecer num avatar de 34pt, por isso o aviso é uma faixa com o relógio a
  // esvaziar. Sai sozinha assim que eu capturo ou a ronda fecha.
  const firstOtherCapture = roundCaptures
    .filter((capture) => capture.userId !== myId)
    .sort((a, b) => (a.createdAt ?? '').localeCompare(b.createdAt ?? ''))[0]
  const firstShooter = firstOtherCapture
    ? joinedMembers.find((member) => member.user.id === firstOtherCapture.userId)?.user
    : undefined
  const waitingOnMe = roundIsActive
    && !!firstShooter
    && myRoundCaptures.length === 0
    && !preview
    && countdown === null
  // Fracção que falta da janela da ronda, para a barra esvaziar com o tempo.
  const roundLeftFraction = (() => {
    if (!currentRound?.shotAt || !currentRound.expiresAt) return 0
    const total = new Date(currentRound.expiresAt).getTime() - new Date(currentRound.shotAt).getTime()
    if (total <= 0) return 0
    return Math.max(0, Math.min(1, publishLeftMs / total))
  })()

  // Uma vibração por ronda: é para dar por ela, não para incomodar.
  const buzzedRoundRef = useRef<string | null>(null)
  useEffect(() => {
    if (!waitingOnMe || !activeRoundId) return
    if (buzzedRoundRef.current === activeRoundId) return
    buzzedRoundRef.current = activeRoundId
    Vibration.vibrate(40)
  }, [waitingOnMe, activeRoundId])
  const visibleMyRoundCaptures = roundIsActive ? myRoundCaptures : []
  const nextCaptureSlot: 1 | 2 = roundAcceptsMyCapture && visibleMyRoundCaptures.some((capture) => capture.slot === 1) ? 2 : 1
  const captureLimitReached = roundAcceptsMyCapture && visibleMyRoundCaptures.length >= MAX_CAPTURES_PER_ROUND
  const canPublish = roundIsActive && roundCaptures.length >= 1 && !published

  // Uma nova ronda, uma captura adicionada ou uma remoção tornam o snapshot
  // anterior obsoleto e reabrem a ação de publicar.
  const captureSignature = `${activeRoundId ?? ''}:${roundCaptures.map((capture) => capture.id).sort().join('|')}`
  const previousCaptureSignatureRef = useRef(captureSignature)
  useEffect(() => {
    if (previousCaptureSignatureRef.current !== captureSignature) setPublished(false)
    previousCaptureSignatureRef.current = captureSignature
  }, [captureSignature])

  async function handleWithdraw(captureId: string) {
    const sid = sessionRef.current?.id
    if (!sid || withdrawingCaptureId) return
    setWithdrawingCaptureId(captureId)
    try {
      await circle.withdrawMyPhoto(sid, captureId)
      setMembers((prev) => prev.map((member) => member.user.id === myId
        ? { ...member, captures: member.captures.filter((capture) => capture.id !== captureId) }
        : member))
      setPublished(false)
    } catch (err: any) {
      Alert.alert(t.circle_errTitle, err?.response?.data?.message || t.circle_photoFail)
    } finally {
      setWithdrawingCaptureId(null)
    }
  }

  // ── Localização ─────────────────────────────────────────────────────────────
  // Pedimos de facto em vez de só verificar: sem coordenadas o servidor deixa
  // de filtrar por distância e o "vizinhos a 3 km" passava a ser todos os
  // mútuos, sem ninguém dar por isso. Quem recusar continua a poder usar o
  // Círculo — só deixa de ser por proximidade.
  async function getLoc(): Promise<{ lat?: number; lng?: number }> {
    try {
      let { status } = await Location.getForegroundPermissionsAsync()
      if (status !== 'granted') {
        ;({ status } = await Location.requestForegroundPermissionsAsync())
      }
      if (status === 'granted') {
        const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced })
        return { lat: loc.coords.latitude, lng: loc.coords.longitude }
      }
    } catch {}
    return {}
  }

  const applyCircleState = useCallback((state: {
    session: CircleSession
    members: CircleMember[]
    currentRound: CircleRound | null
    nearby?: CircleUser[]
    publishWindowMs?: number
  }) => {
    sessionRef.current = state.session
    currentRoundRef.current = state.currentRound
    setSession(state.session)
    setMembers(state.members)
    setCurrentRound(state.currentRound)
    if (state.nearby) setNearby(state.nearby)
    if (state.publishWindowMs) setPublishWindowMs(state.publishWindowMs)
  }, [])

  // ── Garante uma sessão: junta-se a chamada pendente OU abre a minha ──────────
  // Devolve a sessão (ou null) e é chamada tanto na entrada como antes de qualquer ação.
  const ensureSession = useCallback(async (refreshExisting = false): Promise<CircleSession | null> => {
    if (sessionRef.current && !refreshExisting) {
      setInitDone(true)
      return sessionRef.current
    }
    if (sessionRef.current && refreshExisting) {
      try {
        const state = await circle.getCircleSession(sessionRef.current.id)
        applyCircleState(state)
        setInitError(false)
        setInitDone(true)
        return state.session
      } catch (err: any) {
        const status = err?.response?.status
        if (status !== 400 && status !== 404 && status !== 410) {
          // Offline ou timeout: o snapshot local ainda é melhor do que trocar a
          // pessoa de sessão por causa de uma falha transitória.
          setInitDone(true)
          return sessionRef.current
        }
        // A sessão fechou enquanto esta tab estava sem foco; só neste caso o id
        // é descartado e uma sessão nova é aberta abaixo.
        sessionRef.current = null
        currentRoundRef.current = null
        setSession(null)
        setMembers([])
        setCurrentRound(null)
      }
    }
    const { lat, lng } = await getLoc()
    // Convite pendente? mostra o banner aceitar/recusar por cima da câmara
    // (não junta automaticamente — o utilizador decide).
    try {
      const inc = await circle.getIncoming()
      if (inc.call) {
        setIncoming({ sessionId: inc.call.sessionId, hostName: inc.call.host.name, hostAvatar: inc.call.host.avatar })
      }
    } catch {}
    // Abre sempre a minha sessão para a câmara ficar funcional (se recusar, fico com a minha)
    try {
      const st = await circle.openCircle(lat, lng)
      applyCircleState(st)
      setInitError(false); setInitDone(true)
      return st.session
    } catch {
      setInitError(true); setInitDone(true)
      return null
    }
  }, [applyCircleState])

  useFocusEffect(useCallback(() => {
    setFocused(true)
    setCircleScreenActive(true)
    setStatusBarStyle('light')
    useNotificationStore.getState().setCircleInvite(false)   // viu o convite → limpa badge
    setInitDone(false); setInitError(false)
    ensureSession(true)

    const socket = getSocket()
    const onUpdate = ({
      sessionId,
      members: nextMembers,
      currentRound: nextRound,
    }: {
      sessionId: string
      members: CircleMember[]
      currentRound?: CircleRound | null
    }) => {
      if (sessionRef.current?.id !== sessionId) return
      setMembers(nextMembers.map((member) => ({
        ...member,
        captures: Array.isArray(member.captures) ? member.captures : [],
      })))
      if (nextRound !== undefined) {
        currentRoundRef.current = nextRound
        setCurrentRound(nextRound)
      }
    }
    const onCalled = (p: { sessionId: string; hostName: string; hostAvatar: string | null }) => {
      if (sessionRef.current?.id !== p.sessionId) {
        setIncoming(p)
        // o convite recebido expira em 2 min → o banner desaparece sozinho
        const timer = setTimeout(() => {
          setIncoming((cur) => (cur?.sessionId === p.sessionId ? null : cur))
        }, INVITE_TTL_MS)
        callTimers.current.push(timer)
      }
    }
    const onPublished = ({ sessionId }: { sessionId: string }) => {
      if (sessionRef.current?.id === sessionId) nav.navigate('Feed')
    }
    // Fui removido pelo anfitrião → volto à minha própria sessão
    const onRemoved = ({ sessionId }: { sessionId: string }) => {
      if (sessionRef.current?.id === sessionId) {
        sessionRef.current = null
        setSession(null); setMembers([]); setCurrentRound(null)
        ensureSession()
      }
    }
    // Contagem decrescente: chega a TODOS no círculo, incluindo a quem carregou.
    // Ninguém dispara pelo seu próprio botão — todos disparam por este evento.
    const onCountdown = ({
      sessionId,
      roundId,
      inMs,
      shotAt,
      expiresAt,
    }: {
      sessionId: string
      roundId: string
      inMs: number
      shotAt: string
      expiresAt: string
    }) => {
      if (sessionRef.current?.id !== sessionId) return
      const round: CircleRound = {
        id: roundId,
        sessionId,
        shotAt,
        expiresAt,
        isSolo: false,
        ownerUserId: null,
      }
      currentRoundRef.current = round
      setCurrentRound(round)
      // A ronda nova não pode mudar a identidade de uma foto que já está a ser
      // revista/enviada, nem iniciar uma segunda captura concorrente.
      if (previewRef.current || shootingRef.current) return
      beginCountdown(inMs, roundId)
    }

    socket?.on('circle:update', onUpdate)
    socket?.on('circle:called', onCalled)
    socket?.on('circle:published', onPublished)
    socket?.on('circle:removed', onRemoved)
    socket?.on('circle:countdown', onCountdown)

    return () => {
      setFocused(false)
      setCircleScreenActive(false)
      setCameraReady(false)
      setStatusBarStyle('dark')
      setPreview(null)
      lastCountdownRoundRef.current = null
      callTimers.current.forEach(clearTimeout)
      callTimers.current = []
      socket?.off('circle:update', onUpdate)
      socket?.off('circle:called', onCalled)
      socket?.off('circle:published', onPublished)
      socket?.off('circle:removed', onRemoved)
      socket?.off('circle:countdown', onCountdown)
      if (countdownTimer.current) clearInterval(countdownTimer.current)
      countdownTimer.current = null
      setCountdown(null)
      shootingRef.current = false
    }
  }, [ensureSession]))

  // ── Chamar alguém (vizinho ou amigo) ────────────────────────────────────────
  async function handleCall(u: CircleUser) {
    if (calling.has(u.id)) return
    const sess = sessionRef.current ?? await ensureSession()
    if (!sess) { Alert.alert(t.circle_errTitle, t.circle_callFail); return }
    setCalling((prev) => new Set(prev).add(u.id))
    try {
      await circle.callToCircle(sess.id, u.id)
      // Convite expira em 2 min → repõe o botão e liberta-o de `members` (estava
      // como INVITED), senão continuaria escondido da lista "chamar mais pessoas".
      const timer = setTimeout(() => {
        setCalling((prev) => { const n = new Set(prev); n.delete(u.id); return n })
        setMembers((prev) => prev.filter((m) => !(m.user.id === u.id && m.status === 'INVITED')))
      }, INVITE_TTL_MS)
      callTimers.current.push(timer)
    } catch (err: any) {
      setCalling((prev) => { const n = new Set(prev); n.delete(u.id); return n })
      // O servidor recusa se já não houver seguimento mútuo (ex.: a pessoa
      // deixou de me seguir depois de a lista carregar). Diz porquê e tira-a da
      // lista, para não se tentar chamá-la outra vez.
      const msg = err?.response?.data?.message
      if (err?.response?.status === 400 && msg) {
        setNearby((prev) => prev.filter((n) => n.id !== u.id))
        setFriends((prev) => prev.filter((f) => f.id !== u.id))
      }
      Alert.alert(t.circle_errTitle, msg || t.circle_callFail)
    }
  }

  // ── Convidar amigos (só seguimento MÚTUO) ───────────────────────────────────
  // Chamar exige mútuo — o servidor recusa o resto. Antes mostrávamos toda a
  // gente que sigo, e chamar quem não me segue de volta dava erro. Cruzamos
  // quem sigo com quem me segue e mostramos só a interseção.
  async function openFriends() {
    setFriendsSheet(true)
    ensureSession()   // garante que dá para chamar
    if (friends.length === 0) {
      setLoadingFriends(true)
      try {
        const [following, followers] = await Promise.all([getMyFollowing(), getMyFollowers()])
        const followerIds = new Set(followers.map((f) => f.id))
        const mutual = following.filter((f) => followerIds.has(f.id))
        setFriends(mutual.map((f) => ({ id: f.id, name: f.name, avatar: f.avatar })))
      } catch {}
      setLoadingFriends(false)
    }
  }

  // ── Entrar numa chamada recebida ────────────────────────────────────────────
  async function acceptIncoming() {
    if (!incoming || joining) return
    setJoining(true)
    try {
      const st = await circle.joinCircle(incoming.sessionId)
      applyCircleState(st)
      setNearby([])
      setIncoming(null)
    } catch {
      Alert.alert(t.circle_errTitle, t.circle_sessionGone)
      setIncoming(null)
    } finally {
      setJoining(false)
    }
  }

  function declineIncoming() {
    setIncoming(null)   // recusa → fica com a minha própria sessão
  }

  // Anfitrião remove um membro (para voltar a ficar sozinho)
  function handleRemoveMember(target: CircleMember) {
    if (!session || target.user.id === myId) return
    Alert.alert(
      t.circle_removeConfirm,
      target.user.name.split(' ')[0],
      [
        { text: t.cancel, style: 'cancel' },
        {
          text: t.circle_remove, style: 'destructive',
          onPress: async () => {
            const sess = sessionRef.current
            if (!sess) return
            const targetId = target.user.id
            setMembers((prev) => prev.filter((m) => m.user.id !== targetId))   // otimista
            // deixa de estar "Chamado" → volta a ser chamável
            setCalling((prev) => { const n = new Set(prev); n.delete(targetId); return n })
            try {
              await circle.removeFromCircle(sess.id, targetId)
              // Refresca vizinhos: o backend tira os membros de `nearby`, por isso é
              // preciso voltar a pedir para o removido reaparecer em "chamar mais".
              const { lat, lng } = await getLoc()
              const st = await circle.openCircle(lat, lng)
              applyCircleState(st)
            } catch {}
          },
        },
      ],
    )
  }

  // Desfazer o "aceitar": sai do círculo do anfitrião e volta à minha sessão
  async function handleLeave() {
    const sess = sessionRef.current
    if (!sess || leaving) return
    setLeaving(true)
    try {
      await circle.leaveCircle(sess.id)
    } catch (err: any) {
      Alert.alert(t.circle_errTitle, err?.response?.data?.message || t.circle_sessionGone)
      setLeaving(false)
      return
    }
    sessionRef.current = null
    setSession(null); setMembers([]); setCurrentRound(null)
    const { lat, lng } = await getLoc()
    try {
      const st = await circle.openCircle(lat, lng)
      applyCircleState(st)
    } catch {
      setInitError(true)
    } finally {
      setLeaving(false)
    }
  }

  // ── Disparo ─────────────────────────────────────────────────────────────────
  // roundId e slot entram no mesmo objeto que a URI. Mesmo que outra contagem
  // chegue durante a edição, a prévia nunca muda de ronda por acidente.
  async function capture(roundId: string | null, slot: 1 | 2) {
    if (!camRef.current || shootingRef.current || previewRef.current) return
    shootingRef.current = true
    setShooting(true)
    try {
      const pic = await camRef.current.takePictureAsync({ quality: 0.8 })
      if (pic?.uri) {
        const nextPreview: PendingCapture = {
          uri: pic.uri,
          size: pic.width && pic.height ? { w: pic.width, h: pic.height } : null,
          roundId,
          slot,
        }
        previewRef.current = nextPreview
        setPreview(nextPreview)
        setPlaced([])
      }
    } catch {
      Alert.alert(t.circle_errTitle, t.circle_captureFail)
    } finally {
      shootingRef.current = false
      setShooting(false)
    }
  }

  // Arranca a contagem local. Usa a DURAÇÃO vinda do servidor, não um instante
  // absoluto: os relógios dos telemóveis não estão sincronizados entre si.
  function beginCountdown(inMs: number, roundId: string) {
    if (!roundId || !Number.isFinite(inMs)) return
    if (previewRef.current || shootingRef.current) return
    // O pedido HTTP e o socket podem entregar a mesma ronda quase juntos.
    // Identidade do servidor evita reiniciar a animação ou disparar duas vezes.
    if (lastCountdownRoundRef.current === roundId) return
    lastCountdownRoundRef.current = roundId
    if (countdownTimer.current) clearInterval(countdownTimer.current)
    const safeInMs = Math.max(0, inMs)
    const deadline = Date.now() + safeInMs
    setCountdown(Math.max(0, Math.ceil(safeInMs / 1000)))

    if (safeInMs === 0) {
      setCountdown(null)
      capture(roundId, 1)
      return
    }

    countdownTimer.current = setInterval(() => {
      const left = deadline - Date.now()
      if (left <= 0) {
        if (countdownTimer.current) clearInterval(countdownTimer.current)
        countdownTimer.current = null
        setCountdown(null)
        capture(roundId, 1)
      } else {
        setCountdown(Math.ceil(left / 1000))
      }
    }, 100)   // 100ms: o número muda no segundo certo, sem esperar por um tick largo
  }

  async function handleShutter() {
    if (
      shootingRef.current
      || startingCountdownRef.current
      || countdown !== null
      || previewRef.current
      || !camRef.current
      || !cameraReady
      || captureLimitReached
      || !sessionRef.current
    ) return
    Animated.sequence([
      Animated.timing(shutterPress, { toValue: 0.86, duration: 90, useNativeDriver: true }),
      Animated.spring(shutterPress, { toValue: 1, tension: 200, friction: 6, useNativeDriver: true }),
    ]).start()

    const sess = sessionRef.current
    const otherCount = members.filter((m) => m.status === 'JOINED' && m.user.id !== user?.id).length

    // A ronda continua aberta depois do disparo sincronizado: é aqui que entra
    // a segunda perspetiva, sem obrigar todo o círculo a contar novamente.
    if (roundAcceptsMyCapture && activeRoundId) {
      capture(activeRoundId, nextCaptureSlot)
      return
    }

    // Sozinho no círculo não faz sentido contar — dispara já
    if (!sess) return
    if (otherCount === 0) {
      capture(null, 1)
      return
    }

    startingCountdownRef.current = true
    setStartingCountdown(true)
    try {
      // Não disparamos aqui: o servidor avisa toda a gente, inclusive a nós, e
      // é esse evento que faz a captura. Assim ninguém sai adiantado.
      const result = await circle.startCountdown(sess.id)
      // Normalmente o socket chegou primeiro. Isto é o fallback para uma
      // ligação momentaneamente sem eventos ao vivo.
      const round: CircleRound = {
        id: result.roundId,
        sessionId: sess.id,
        shotAt: result.shotAt,
        expiresAt: result.expiresAt,
        isSolo: false,
        ownerUserId: null,
      }
      currentRoundRef.current = round
      setCurrentRound(round)
      beginCountdown(result.inMs, result.roundId)
    } catch (err: any) {
      // Falha HTTP é ambígua: o servidor pode ter iniciado a ronda. Nunca tirar
      // uma foto solo aqui, pois o socket ainda pode chegar e duplicar a captura.
      Alert.alert(t.circle_errTitle, err?.response?.data?.message || t.circle_countdownFail)
    } finally {
      startingCountdownRef.current = false
      setStartingCountdown(false)
    }
  }

  function addEmoji(emoji: string) {
    setPlaced((current) => {
      if (current.length >= MAX_EMOJI_OVERLAYS) return current
      const offset = EMOJI_START_OFFSETS[current.length % EMOJI_START_OFFSETS.length]
      const ring = Math.floor(current.length / EMOJI_START_OFFSETS.length)
      return [...current, {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        emoji,
        x: clamp(0.5 + offset.x + ring * 0.025, 0.08, 0.92),
        y: clamp(0.4 + offset.y + ring * 0.025, 0.08, 0.92),
      }]
    })
  }
  function commitEmoji(id: string, x: number, y: number) {
    setPlaced((p) => p.map((it) => (it.id === id ? { ...it, x, y } : it)))
  }
  function removeEmoji(id: string) {
    setPlaced((p) => p.filter((it) => it.id !== id))
  }

  // Confirmar já não é esperar. A prévia fecha na hora e o envio segue em
  // segundo plano — a câmara volta pronta para a segunda fotografia. Antes
  // esperava-se pelo servidor com o ecrã bloqueado e, no fim, a câmara ainda
  // tinha de arrancar de novo: era esse somatório que fazia o ciclo parecer
  // eterno.
  //
  // Os envios vão em cadeia, nunca em paralelo: é a primeira fotografia que
  // cria a ronda, e a segunda tem de sair com o id dela. A par, abriam-se duas
  // rondas solo para o mesmo momento.
  async function sendCapture(pending: PendingCapture, overlays: EmojiOverlay[], retry = true): Promise<void> {
    const sess = sessionRef.current ?? await ensureSession()
    if (!sess) { Alert.alert(t.circle_errTitle, t.circle_photoFail); return }
    // Resolvido no envio, não no disparo: se a fotografia anterior criou a
    // ronda entretanto, esta entra nessa em vez de abrir outra.
    const roundId = pending.roundId ?? currentRoundRef.current?.id ?? null
    try {
      const result = await circle.addCirclePhoto(sess.id, pending.uri, overlays, roundId, pending.slot)
      if (!result?.capture?.id || !result.roundId) throw new Error(t.circle_photoFail)

      // Se uma nova contagem chegou enquanto esta prévia estava aberta, o upload
      // antigo continua válido, mas não volta a UI para trás. Só uma ronda solo
      // recém-criada, ou a ronda que ainda está ativa, assume o dock.
      const shouldAdoptRound = roundId === null
        || !currentRoundRef.current
        || currentRoundRef.current.id === result.roundId
      if (shouldAdoptRound) {
        const capturedRoundChanged = currentRoundRef.current?.id !== result.roundId
        const nextRound: CircleRound = capturedRoundChanged
          ? {
              id: result.roundId,
              sessionId: sess.id,
              shotAt: result.capture.createdAt,
              expiresAt: new Date(new Date(result.capture.createdAt).getTime() + publishWindowMs).toISOString(),
              isSolo: roundId === null,
              ownerUserId: roundId === null ? myId ?? null : null,
            }
          : currentRoundRef.current!
        currentRoundRef.current = nextRound
        setCurrentRound(nextRound)
        setMembers((previous) => previous.map((member) => {
          const baseCaptures = capturedRoundChanged
            ? []
            : (Array.isArray(member.captures) ? member.captures : [])
          if (member.user.id !== myId) return { ...member, captures: baseCaptures }
          return {
            ...member,
            captures: [
              ...baseCaptures.filter((capture) => capture.id !== result.capture.id && capture.slot !== result.capture.slot),
              result.capture,
            ].sort((a, b) => a.slot - b.slot),
          }
        }))
        setPublished(false)
      }
      // É aqui que a foto fica guardada no círculo. Sem este aviso a
      // pré-visualização desaparecia e nada dizia que tinha acontecido.
      toast.success(t.circle_savedTitle, t.circle_savedSub)
    } catch (err: any) {
      // A prévia já fechou, portanto uma falha de rede perdia a fotografia.
      // Uma segunda tentativa cobre a falha passageira; só depois é que se
      // avisa, e aí a fotografia perdeu-se mesmo.
      if (retry) return sendCapture(pending, overlays, false)
      Alert.alert(t.circle_errTitle, err?.response?.data?.message || err?.message || t.circle_photoFail)
    }
  }

  function confirmPhoto() {
    const pending = previewRef.current
    if (!pending) return
    const overlays: EmojiOverlay[] = placed.map(({ emoji, x, y }) => ({ emoji, x, y }))

    previewRef.current = null
    setPreview(null)
    setPlaced([])
    setSaving((count) => count + 1)

    uploadChainRef.current = uploadChainRef.current
      .catch(() => {})
      .then(() => sendCapture(pending, overlays))
      .then(() => setSaving((count) => Math.max(0, count - 1)))
  }

  async function handlePublish() {
    if (!session || !activeRoundId || publishing || published) return
    setPublishing(true)
    try {
      const post = await circle.publishCircle(session.id, activeRoundId)
      setPublished(true)
      setPendingPost(post)
      nav.navigate('Feed')
    } catch (err: any) {
      Alert.alert(t.circle_errTitle, err?.response?.data?.message || err?.message || t.circle_publishFail)
    } finally {
      setPublishing(false)
    }
  }

  async function handleRequestPermission() {
    if (requestingPermission) return
    setRequestingPermission(true)
    try {
      await requestPermission()
    } finally {
      setRequestingPermission(false)
    }
  }

  // ── Permissão da câmara ─────────────────────────────────────────────────────
  if (!permission?.granted) {
    return (
      <View style={[s.permScreen, { paddingTop: top }]}>
        <View style={s.permRing}><Text style={s.permEmoji}>⭕</Text></View>
        <Text style={s.permTitle}>{t.circle_permTitle}</Text>
        <Text style={s.permSub}>
          {t.circle_permSub}
        </Text>
        <CircleButton
          label={t.circle_permBtn}
          icon="camera-outline"
          tone="primary"
          loading={requestingPermission}
          onPress={handleRequestPermission}
          style={s.permissionAction}
        />
      </View>
    )
  }

  return (
    <View style={s.screen}>
      {/* ── Câmara ao vivo (fundo, sempre a filmar) ──
             Fica montada TAMBÉM enquanto a prévia está aberta. A prévia é opaca
             e tapa-a na mesma; o que se ganha é não haver desmontagem e novo
             arranque da câmara entre a primeira e a segunda fotografia. */}
      {focused && (
        <CameraView
          ref={camRef}
          style={StyleSheet.absoluteFill}
          facing={facing}
          onCameraReady={() => setCameraReady(true)}
          onMountError={() => setCameraReady(false)}
        />
      )}

      {/* Contagem sincronizada — todos veem o mesmo número ao mesmo tempo */}
      {countdown !== null && !preview && (
        <View style={s.countdownWrap} pointerEvents="none">
          <View style={s.countdownRing}>
            <Text style={s.countdownNum}>{countdown}</Text>
          </View>
          <Text style={s.countdownHint}>{t.circle_countdown_hint}</Text>
        </View>
      )}
      {preview && (
        <View
          style={StyleSheet.absoluteFill}
          onLayout={(ev) => setPreviewBox({ w: ev.nativeEvent.layout.width, h: ev.nativeEvent.layout.height })}
        >
          <Image source={{ uri: preview.uri }} style={StyleSheet.absoluteFill} contentFit="cover" pointerEvents="none" />
          {previewImageRect.width > 0 && placed.map((it) => (
            <PlacedEmoji
              key={it.id}
              item={it}
              imageRect={previewImageRect}
              onCommit={commitEmoji}
              onRemove={removeEmoji}
              removeLabel={t.circle_removeEmoji}
            />
          ))}
        </View>
      )}

      {/* ── Topo: quem está no círculo (chips) + virar câmara ── */}
      <View style={[s.top, { paddingTop: top + 10 }]} pointerEvents="box-none">
        <View style={s.memberRow}>
          {joinedMembers.map((m) => {
            const canRemove = isHost && m.user.id !== myId
            const memberCaptureCount = activeRoundId
              ? (m.captures ?? []).filter((capture) => capture.roundId === activeRoundId).length
              : 0
            return (
              <Pressable
                key={m.user.id}
                style={({ pressed }) => [s.memberChip, pressed && canRemove && s.memberChipPressed]}
                disabled={!canRemove}
                onPress={() => handleRemoveMember(m)}
                accessibilityRole={canRemove ? 'button' : 'image'}
                accessibilityLabel={canRemove
                  ? `${t.circle_remove} ${m.user.name}`
                  : `${m.user.name}, ${memberCaptureCount} de ${MAX_CAPTURES_PER_ROUND}`}
              >
                <AvatarImage uri={m.user.avatar} name={m.user.name} size={34} borderWidth={0} borderColor="transparent" />
                {memberCaptureCount > 0 && (
                  <View style={s.memberCaptureCount}>
                    <Text style={s.memberCaptureCountText}>{memberCaptureCount}</Text>
                  </View>
                )}
                {canRemove && (
                  <View style={s.memberRemove}><Ionicons name="close" size={9} color="#fff" /></View>
                )}
              </Pressable>
            )
          })}
          {joinedCount > 0 && (
            <Text style={s.memberCount}>
              {others.length > 0 ? `${joinedCount} ${t.circle_inCircle}` : t.circle_onlyYou}
            </Text>
          )}
        </View>

        {!preview && (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            {/* Sair — desfazer o aceitar (só quando estou no círculo de outra pessoa) */}
            {session && !isHost && (
              <CircleButton
                label={t.circle_leave}
                icon="exit-outline"
                tone="glass"
                compact
                loading={leaving}
                onPress={handleLeave}
              />
            )}
            <CircleIconButton
              icon="camera-reverse-outline"
              label={t.circle_flipCamera}
              onPress={() => {
                setCameraReady(false)
                setFacing((value) => (value === 'back' ? 'front' : 'back'))
              }}
              disabled={shooting || countdown !== null}
            />
          </View>
        )}
      </View>

      {/* ── Alguém do círculo já disparou e eu ainda não ── */}
      {!incoming && waitingOnMe && (
        <View style={[s.shotAlert, { top: top + 70 }]} pointerEvents="none">
          <View style={s.shotAlertRow}>
            <View style={s.shotAlertAvatar}>
              <AvatarImage
                uri={firstShooter!.avatar}
                name={firstShooter!.name}
                size={34}
                borderWidth={0}
                borderColor="transparent"
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.shotAlertName} numberOfLines={1}>
                {firstShooter!.name.split(' ')[0]} {t.circle_alreadyShot}
              </Text>
              <Text style={s.shotAlertSub} numberOfLines={1}>{t.circle_shootTogether}</Text>
            </View>
            <Text style={s.shotAlertClock}>{Math.ceil(publishLeftMs / 1000)}s</Text>
          </View>
          {/* O tempo lê-se sem contar segundos: a barra esvazia com a ronda. */}
          <View style={s.shotAlertTrack}>
            <View style={[s.shotAlertFill, { width: `${roundLeftFraction * 100}%` }]} />
          </View>
        </View>
      )}

      {/* ── Chamada recebida (banner flutuante) ── */}
      {incoming && (
        <View style={[s.incoming, { top: top + 70 }]}>
          <View style={s.incomingAvatar}>
            <AvatarImage uri={incoming.hostAvatar} name={incoming.hostName} size={38} borderWidth={0} borderColor="transparent" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.incomingName} numberOfLines={1}>{incoming.hostName.split(' ')[0]} {t.circle_calledYou}</Text>
            <Text style={s.incomingSub}>{t.circle_calledSub}</Text>
          </View>
          <CircleButton
            label={t.decline}
            icon="close"
            tone="soft"
            compact
            style={s.incomingAction}
            disabled={joining}
            onPress={declineIncoming}
          />
          <CircleButton
            label={t.circle_join}
            icon="enter-outline"
            tone="primary"
            compact
            style={s.incomingAction}
            loading={joining}
            onPress={acceptIncoming}
          />
        </View>
      )}

      {/* ── Painel flutuante: quem chamar (cards) — só o anfitrião, sobre a câmara ── */}
      {!preview && isHost && showable.length > 0 && !initError && (
        <View style={[s.nearbyPanel, { bottom: (bottomBarH || 200) + 14 }]} pointerEvents="box-none">
          <Text style={s.nearbyHeading}>{t.circle_callMore}</Text>
          {others.length === 0 && (
            <Text style={s.nearbySub}>{t.circle_nobodySub}</Text>
          )}
          <ScrollView
            horizontal={false}
            style={s.nearbyScroll}
            contentContainerStyle={s.nearbyWrap}
            showsVerticalScrollIndicator={false}
          >
            {showable.map((u) => {
              const called = calling.has(u.id)
              return (
                <View key={u.id} style={s.card}>
                  <View style={s.cardAvatar}>
                    <AvatarImage uri={u.avatar} name={u.name} size={46} borderWidth={0} borderColor="transparent" />
                  </View>
                  <Text style={s.cardName} numberOfLines={1}>{u.name.split(' ')[0]}</Text>
                  <CircleButton
                    style={s.cardAction}
                    label={called ? t.circle_called : t.circle_call}
                    icon={called ? 'checkmark' : 'radio-outline'}
                    tone={called ? 'soft' : 'primary'}
                    onPress={() => handleCall(u)}
                    disabled={called}
                    compact
                    accessibilityLabel={`${called ? t.circle_called : t.circle_call} ${u.name}`}
                  />
                </View>
              )
            })}
          </ScrollView>
          <CircleButton
            label={t.circle_inviteFriends}
            icon="person-add-outline"
            tone="glass"
            compact
            onPress={openFriends}
            style={s.panelInvite}
          />
        </View>
      )}

      {/* ── À procura de pessoas / ninguém por perto — sempre visível quando sozinho ── */}
      {!preview && others.length === 0 && !incoming && showable.length === 0 && !initError && (
        <View style={s.searching} pointerEvents="box-none">
          <View style={s.searchingCard}>
            <View style={s.searchingRow}>
              <Ionicons name={initDone ? 'people-outline' : 'scan-outline'} size={16} color="#fff" />
              <Text style={s.searchingTxt}>{initDone ? t.circle_nobody : t.circle_searching}</Text>
              {!initDone && <SearchingDots />}
            </View>
            <Text style={s.searchingSub}>{t.circle_searchingSub}</Text>
            <CircleButton
              label={t.circle_inviteFriends}
              icon="person-add"
              tone="primary"
              onPress={openFriends}
              style={s.searchInviteAction}
            />
          </View>
        </View>
      )}

      {/* chip compacto durante a pré-visualização — continua a procurar */}
      {preview && others.length === 0 && (
        <View style={[s.searchChip, { top: top + 54 }]} pointerEvents="none">
          <Text style={s.searchChipTxt}>{initDone ? t.circle_nobody : t.circle_searching}</Text>
          {!initDone && <SearchingDots />}
        </View>
      )}

      {!preview && initError && (
        <View style={s.retryCard} accessibilityRole="alert">
          <View style={s.retryIcon}>
            <Ionicons name="cloud-offline-outline" size={24} color="#fff" />
          </View>
          <Text style={s.retryTitle}>{t.circle_connectTitle}</Text>
          <Text style={s.retryText}>{t.circle_connectSub}</Text>
          <CircleButton
            label={t.msg_try_again}
            icon="refresh"
            tone="primary"
            onPress={() => {
              setInitDone(false)
              setInitError(false)
              ensureSession(true)
            }}
            style={s.retryAction}
          />
        </View>
      )}

      {/* ── Dock da ronda: duas capturas, obturador e publicação ── */}
      {!preview ? (
        <View
          style={[s.bottomDock, { paddingBottom: bottom + 74 }]}
          onLayout={(e) => setBottomBarH(e.nativeEvent.layout.height)}
        >
          <View style={s.dockHeader}>
            <View>
              <Text style={s.dockEyebrow}>{t.circle_yourCaptures}</Text>
              <Text style={s.dockStatus}>
                {saving > 0
                  ? t.circle_saving
                  : roundIsActive
                  ? `${roundCaptures.length} ${roundCaptures.length === 1 ? t.circle_perspective : t.circle_perspectives} · ${contributorsInRound}/${joinedCount}`
                  : t.circle_newMoment}
              </Text>
            </View>
            {roundIsActive && (
              <View
                style={s.roundTimer}
                accessible
                accessibilityLabel={`${Math.ceil(publishLeftMs / 1000)} ${t.circle_secondsLeft}`}
              >
                <Ionicons name="time-outline" size={14} color="#fff" />
                <Text style={s.roundTimerText}>{Math.ceil(publishLeftMs / 1000)}s</Text>
              </View>
            )}
          </View>

          <View style={s.dockMainRow}>
            <View style={s.captureSlots}>
              {([1, 2] as const).map((slot) => {
                const capture = visibleMyRoundCaptures.find((item) => item.slot === slot)
                const removing = capture?.id === withdrawingCaptureId
                return (
                  <View
                    key={slot}
                    style={[s.captureSlot, capture && s.captureSlotFilled]}
                    accessible={!capture}
                    accessibilityLabel={capture
                      ? `${t.circle_captureSlot} ${slot}, ${t.circle_filled}`
                      : `${t.circle_captureSlot} ${slot}, ${t.circle_empty}`}
                  >
                    {capture ? (
                      <>
                        <Image
                          source={{ uri: resolveMediaUrl(capture.mediaUrl) }}
                          style={StyleSheet.absoluteFill}
                          contentFit="cover"
                          cachePolicy="disk"
                          recyclingKey={`circle-slot-${capture.id}`}
                        />
                        <View style={s.slotNumber}><Text style={s.slotNumberText}>{slot}</Text></View>
                        <Pressable
                          onPress={() => handleWithdraw(capture.id)}
                          disabled={!!withdrawingCaptureId}
                          accessibilityRole="button"
                          accessibilityLabel={`${t.circle_removeCapture} ${slot}`}
                          accessibilityState={{ disabled: !!withdrawingCaptureId, busy: removing }}
                          hitSlop={7}
                          style={({ pressed }) => [s.slotRemove, pressed && s.controlButtonPressed]}
                        >
                          {removing
                            ? <ActivityIndicator size="small" color="#fff" />
                            : <Ionicons name="close" size={13} color="#fff" />}
                        </Pressable>
                      </>
                    ) : (
                      <>
                        <Ionicons name="image-outline" size={18} color="rgba(255,255,255,0.62)" />
                        <Text style={s.emptySlotText}>{slot}</Text>
                      </>
                    )}
                  </View>
                )
              })}
            </View>

            <View style={s.shutterColumn}>
              <Pressable
                onPress={handleShutter}
                disabled={shooting || startingCountdown || countdown !== null || !cameraReady || captureLimitReached || initError || !session || !initDone}
                accessibilityRole="button"
                accessibilityLabel={captureLimitReached
                  ? t.circle_limitReached
                  : visibleMyRoundCaptures.length === 1 && roundAcceptsMyCapture
                    ? t.circle_takeSecond
                    : t.circle_takePhoto}
                accessibilityState={{
                  disabled: shooting || startingCountdown || countdown !== null || !cameraReady || captureLimitReached || initError || !session || !initDone,
                  busy: shooting || startingCountdown,
                }}
              >
                <Animated.View
                  style={[
                    s.shutterOuter,
                    (captureLimitReached || initError) && s.shutterOuterDisabled,
                    { transform: [{ scale: shutterPress }] },
                  ]}
                >
                  <View style={[s.shutterInner, visibleMyRoundCaptures.length > 0 && roundAcceptsMyCapture && s.shutterInnerActive]}>
                    {shooting || startingCountdown
                      ? <ActivityIndicator color="#fff" />
                      : <Ionicons
                          name={captureLimitReached ? 'checkmark' : visibleMyRoundCaptures.length === 1 && roundAcceptsMyCapture ? 'add' : 'camera'}
                          size={captureLimitReached ? 27 : 23}
                          color="#fff"
                        />}
                  </View>
                </Animated.View>
              </Pressable>
              <Text style={s.shutterHint} numberOfLines={2}>
                {captureLimitReached
                  ? t.circle_limitReached
                  : visibleMyRoundCaptures.length === 1 && roundAcceptsMyCapture
                    ? t.circle_takeSecond
                    : t.circle_takePhoto}
              </Text>
            </View>

            <View style={s.roundSummary}>
              <Text style={s.roundSummaryValue}>{visibleMyRoundCaptures.length}/2</Text>
              <Text style={s.roundSummaryLabel}>{t.circle_yours}</Text>
              {joinedCount > 1 && (
                <View style={s.peopleSummary}>
                  <Ionicons name="people" size={13} color="rgba(255,255,255,0.76)" />
                  <Text style={s.peopleSummaryText}>{contributorsInRound}/{joinedCount}</Text>
                </View>
              )}
            </View>
          </View>

          {canPublish ? (
            <CircleButton
              label={`${t.circle_publishMy} · ${roundCaptures.length}`}
              icon="arrow-up-circle-outline"
              tone="primary"
              loading={publishing}
              onPress={handlePublish}
              style={s.publishAction}
            />
          ) : published && roundIsActive ? (
            <View style={s.publishedPill} accessibilityRole="text">
              <Ionicons name="checkmark-circle" size={17} color="#fff" />
              <Text style={s.publishedPillText}>{t.circle_published}</Text>
            </View>
          ) : null}
        </View>
      ) : (
        <View style={[s.previewBottom, { paddingBottom: bottom + 62 }]}> 
          <View style={s.previewBadge}>
            <Ionicons name="camera" size={14} color="#fff" />
            <Text style={s.previewBadgeText}>{t.circle_captureSlot} {preview.slot}/2</Text>
          </View>
          {/* Barra de emojis — toca para adicionar, arrasta na foto para posicionar */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={s.emojiBar}
            contentContainerStyle={s.emojiBarContent}
            keyboardShouldPersistTaps="handled"
          >
            {EMOJI_SET.map((emo) => (
              <Pressable
                key={emo}
                onPress={() => addEmoji(emo)}
                disabled={placed.length >= MAX_EMOJI_OVERLAYS}
                accessibilityRole="button"
                accessibilityLabel={emo}
                accessibilityState={{ disabled: placed.length >= MAX_EMOJI_OVERLAYS }}
                style={({ pressed }) => [
                  s.emojiChip,
                  placed.length >= MAX_EMOJI_OVERLAYS && s.emojiChipDisabled,
                  pressed && s.controlButtonPressed,
                ]}
              >
                <Text style={s.emojiChipTxt}>{emo}</Text>
              </Pressable>
            ))}
          </ScrollView>

          <View style={s.previewActions}>
            <CircleButton
              label={t.circle_retake}
              icon="refresh"
              tone="glass"
              onPress={() => {
                previewRef.current = null
                setPreview(null)
                setPlaced([])
              }}
              style={s.previewAction}
            />
            <CircleButton
              label={t.circle_addToCircle}
              icon="checkmark"
              tone="primary"
              onPress={confirmPhoto}
              style={s.previewAction}
            />
          </View>
        </View>
      )}

      {/* ── Sheet: convidar amigos para o círculo ── */}
      <Modal visible={friendsSheet} transparent animationType="slide" onRequestClose={() => setFriendsSheet(false)}>
        <View style={s.fsRoot}>
          <Pressable
            style={s.fsBackdrop}
            onPress={() => setFriendsSheet(false)}
            accessible={false}
          />
          <View style={[s.fsSheet, { paddingBottom: bottom + 20 }]}>
            <View style={s.fsHandle} />
            <View style={s.fsHeader}>
              <View>
                <Text style={s.fsTitle}>{t.circle_friendsTitle}</Text>
                <Text style={s.fsSub}>{t.circle_friendsSub}</Text>
              </View>
              <CircleIconButton
                icon="close"
                label={t.circle_close}
                tone="soft"
                onPress={() => setFriendsSheet(false)}
                style={s.sheetClose}
              />
            </View>

            {loadingFriends ? (
              <ActivityIndicator color="#fff" style={{ marginVertical: 30 }} />
            ) : visibleFriends.length === 0 ? (
              <Text style={s.fsEmpty}>{t.circle_noFriends}</Text>
            ) : (
              <ScrollView style={{ maxHeight: 360 }} showsVerticalScrollIndicator={false}>
                {visibleFriends.map((f) => {
                  const called = calling.has(f.id) || memberIds.has(f.id)
                  return (
                    <View key={f.id} style={s.fsRow}>
                      <View style={s.fsAvatar}>
                        <AvatarImage uri={f.avatar} name={f.name} size={44} borderWidth={0} borderColor="transparent" />
                      </View>
                      <Text style={s.fsName} numberOfLines={1}>{f.name}</Text>
                      <CircleButton
                        label={called ? t.circle_called : t.circle_call}
                        icon={called ? 'checkmark' : 'radio-outline'}
                        tone={called ? 'soft' : 'primary'}
                        style={s.sheetCallAction}
                        onPress={() => handleCall(f)}
                        disabled={called}
                        compact
                        accessibilityLabel={`${called ? t.circle_called : t.circle_call} ${f.name}`}
                      />
                    </View>
                  )
                })}
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>

      {showSuggestions && <SuggestionsSheet onClose={() => setShowSuggestions(false)} />}
    </View>
  )
}

const em = StyleSheet.create({
  placed: { position: 'absolute', zIndex: 2, elevation: 2 },
  del: {
    position: 'absolute', top: -8, right: -8,
    width: 24, height: 24, borderRadius: radius.full,
    backgroundColor: 'rgba(11,20,26,0.9)', alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.42)',
  },
})

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.black },

  // ── Linguagem única de controlos ───────────────────────────────────────────
  controlButton: {
    minHeight: 44,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    backgroundColor: 'rgba(11,20,26,0.72)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
  },
  controlButtonCompact: { minHeight: 36, paddingHorizontal: 12, paddingVertical: 7 },
  controlButtonPrimary: {
    backgroundColor: colors.primary,
    borderColor: 'rgba(255,177,115,0.72)',
  },
  controlButtonSoft: { backgroundColor: 'rgba(255,255,255,0.14)' },
  controlButtonDanger: {
    backgroundColor: 'rgba(255,59,48,0.2)',
    borderColor: 'rgba(255,91,82,0.58)',
  },
  controlButtonDisabled: { opacity: 0.44 },
  controlButtonPressed: { opacity: 0.76, transform: [{ scale: 0.98 }] },
  controlButtonText: { color: colors.white, fontFamily: fonts.bold, fontSize: 14, letterSpacing: -0.15 },
  controlButtonTextCompact: { fontSize: 12.5 },
  iconButton: {
    width: 44,
    height: 44,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    backgroundColor: 'rgba(11,20,26,0.72)',
  },
  iconButtonPrimary: { backgroundColor: colors.primary, borderColor: colors.primaryLight },
  iconButtonSoft: { backgroundColor: 'rgba(255,255,255,0.14)' },
  iconButtonDanger: { backgroundColor: 'rgba(255,59,48,0.24)', borderColor: 'rgba(255,91,82,0.58)' },

  // ── Contagem decrescente ──
  countdownWrap: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center', justifyContent: 'center', gap: 16,
    zIndex: 8,
  },
  countdownRing: {
    width: 128, height: 128, borderRadius: 64,
    borderWidth: 3, borderColor: 'rgba(255,255,255,0.9)',
    backgroundColor: 'rgba(11,20,26,0.58)',
    alignItems: 'center', justifyContent: 'center',
    shadowColor: colors.black, shadowOpacity: 0.45, shadowRadius: 18,
  },
  countdownNum: {
    color: '#fff', fontFamily: fonts.bold, fontSize: 64,
    lineHeight: 74, textAlign: 'center',
  },
  countdownHint: {
    color: 'rgba(255,255,255,0.9)', fontFamily: fonts.semiBold, fontSize: 14,
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 3,
  },

  /* ── Topo ── */
  top: {
    position: 'absolute', top: 0, left: 0, right: 0,
    flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between',
    paddingHorizontal: 14, zIndex: 18,
  },
  memberRow: { flex: 1, flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6 },
  memberChip: {
    width: 38, height: 38, borderRadius: radius.full,
    padding: 2,
    backgroundColor: 'rgba(11,20,26,0.72)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.26)',
  },
  memberChipPressed: { opacity: 0.72, transform: [{ scale: 0.96 }] },
  memberCaptureCount: {
    position: 'absolute', bottom: -3, left: -3,
    minWidth: 17, height: 17, paddingHorizontal: 4, borderRadius: radius.full,
    backgroundColor: colors.primary,
    alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: colors.feedSurface,
  },
  memberCaptureCountText: { color: '#fff', fontFamily: fonts.bold, fontSize: 9 },
  memberRemove: {
    position: 'absolute', top: -3, right: -3,
    width: 17, height: 17, borderRadius: radius.full, backgroundColor: colors.error,
    alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: colors.feedSurface,
  },
  memberCount: {
    marginLeft: 4, color: '#fff', fontSize: 12, fontFamily: fonts.semiBold,
    textShadowColor: 'rgba(0,0,0,0.4)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 3,
  },

  /* ── Chamada recebida ── */
  incoming: {
    position: 'absolute', left: 14, right: 14, zIndex: 20,
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: 'rgba(11,20,26,0.92)',
    borderRadius: radius.xl, padding: 10,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)',
    shadowColor: colors.black, shadowOpacity: 0.32, shadowRadius: 18, elevation: 8,
  },
  incomingAvatar: { width: 38, height: 38, borderRadius: 19, overflow: 'hidden' },
  incomingName: { color: '#fff', fontSize: 14, fontFamily: fonts.bold, letterSpacing: -0.2 },
  incomingSub: { color: 'rgba(255,255,255,0.7)', fontSize: 12, fontFamily: fonts.regular, marginTop: 1 },
  incomingAction: { minWidth: 70 },

  /* ── Aviso: alguém já disparou nesta ronda ── */
  shotAlert: {
    position: 'absolute', left: 14, right: 14, zIndex: 20,
    backgroundColor: 'rgba(11,20,26,0.92)',
    borderRadius: radius.xl, padding: 10, gap: 8,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)',
    shadowColor: colors.black, shadowOpacity: 0.32, shadowRadius: 18, elevation: 8,
  },
  shotAlertRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  shotAlertAvatar: { width: 34, height: 34, borderRadius: 17, overflow: 'hidden' },
  shotAlertName: { color: '#fff', fontSize: 14, fontFamily: fonts.bold, letterSpacing: -0.2 },
  shotAlertSub: { color: 'rgba(255,255,255,0.7)', fontSize: 12, fontFamily: fonts.regular, marginTop: 1 },
  shotAlertClock: {
    color: '#fff', fontSize: 15, fontFamily: fonts.bold,
    fontVariant: ['tabular-nums'], letterSpacing: -0.2,
  },
  shotAlertTrack: {
    height: 3, borderRadius: 2, overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.16)',
  },
  shotAlertFill: { height: '100%', borderRadius: 2, backgroundColor: colors.primary },

  /* ── Pessoas e convites ── */
  // `bottom` vem do onLayout da barra de baixo — aqui fica só o valor de recurso
  // para o primeiro render, antes da medição chegar.
  nearbyPanel: {
    position: 'absolute', left: 12, right: 12, zIndex: 15,
    paddingVertical: 10, paddingHorizontal: 10,
    borderRadius: radius.xl,
    backgroundColor: 'rgba(11,20,26,0.66)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)',
  },
  nearbyHeading: {
    color: '#fff', fontSize: 15, fontFamily: fonts.bold, letterSpacing: -0.3, textAlign: 'center',
    textShadowColor: 'rgba(0,0,0,0.55)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 4,
  },
  nearbySub: {
    color: 'rgba(255,255,255,0.85)', fontSize: 12.5, fontFamily: fonts.regular, textAlign: 'center', marginTop: 3, marginBottom: 4,
    textShadowColor: 'rgba(0,0,0,0.5)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 4,
  },
  nearbyScroll: { maxHeight: 196, marginTop: 6 },
  nearbyWrap: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 10 },
  card: {
    width: 98, alignItems: 'center', gap: 7,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: radius.lg, paddingVertical: 11, paddingHorizontal: 8,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)',
  },
  cardAvatar: { width: 46, height: 46, borderRadius: 23, overflow: 'hidden' },
  cardName: { color: '#fff', fontSize: 12, fontFamily: fonts.semiBold, maxWidth: 80 },
  cardAction: { width: '100%', marginTop: 1, minHeight: 34, paddingHorizontal: 7 },

  /* ── À procura de pessoas (só o layout, sem fundo) ── */
  searching: { position: 'absolute', left: 0, right: 0, top: '38%', alignItems: 'center', zIndex: 5, paddingHorizontal: 24 },
  searchingCard: {
    alignItems: 'center', gap: 7,
    maxWidth: 330,
    paddingHorizontal: 22, paddingVertical: 18,
    borderRadius: radius.xl,
    backgroundColor: 'rgba(11,20,26,0.64)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)',
  },
  searchingRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  searchingTxt: {
    color: '#fff', fontSize: 15, fontFamily: fonts.bold, letterSpacing: -0.2,
    textShadowColor: 'rgba(0,0,0,0.55)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 4,
  },
  searchingSub: {
    color: 'rgba(255,255,255,0.85)', fontSize: 12.5, fontFamily: fonts.regular, textAlign: 'center',
    textShadowColor: 'rgba(0,0,0,0.5)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 4,
  },
  searchInviteAction: { marginTop: 6 },

  searchChip: {
    position: 'absolute', alignSelf: 'center', zIndex: 15,
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: 'rgba(11,20,26,0.78)', borderRadius: radius.full, paddingHorizontal: 14, paddingVertical: 8,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)',
  },
  searchChipTxt: { color: '#fff', fontSize: 12.5, fontFamily: fonts.semiBold },

  panelInvite: {
    alignSelf: 'center', marginTop: 10,
  },

  retryCard: {
    position: 'absolute', left: 28, right: 28, top: '34%', zIndex: 16,
    alignItems: 'center', padding: 20, gap: 7,
    borderRadius: radius.xl,
    backgroundColor: 'rgba(11,20,26,0.92)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.17)',
  },
  retryIcon: {
    width: 48, height: 48, borderRadius: radius.full,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.12)', marginBottom: 3,
  },
  retryTitle: { color: '#fff', fontFamily: fonts.bold, fontSize: 17, letterSpacing: -0.25 },
  retryText: { color: 'rgba(255,255,255,0.68)', fontFamily: fonts.regular, fontSize: 13, textAlign: 'center', lineHeight: 19 },
  retryAction: { marginTop: 7, minWidth: 150 },

  /* ── Sheet de amigos ── */
  fsRoot:     { flex: 1, justifyContent: 'flex-end' },
  fsBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.4)' },
  fsSheet: {
    backgroundColor: colors.feedSurface,
    borderTopLeftRadius: 28, borderTopRightRadius: 28,
    paddingHorizontal: 20, paddingTop: 10,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
  },
  fsHandle: { width: 38, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.2)', alignSelf: 'center', marginBottom: 16 },
  fsHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  fsTitle: { color: '#fff', fontSize: 18, fontFamily: fonts.bold, letterSpacing: -0.3 },
  fsSub: { color: 'rgba(255,255,255,0.6)', fontSize: 12.5, fontFamily: fonts.regular, marginTop: 2 },
  fsEmpty: { color: 'rgba(255,255,255,0.6)', fontSize: 14, fontFamily: fonts.regular, textAlign: 'center', marginVertical: 30 },
  fsRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 9, borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.09)',
  },
  fsAvatar: { width: 44, height: 44, borderRadius: 22, overflow: 'hidden' },
  fsName: { flex: 1, color: '#fff', fontSize: 15, fontFamily: fonts.semiBold },
  sheetClose: { width: 38, height: 38 },
  sheetCallAction: { minWidth: 92 },

  /* ── Dock da ronda ── */
  bottomDock: {
    position: 'absolute', left: 8, right: 8, bottom: 0, zIndex: 18,
    paddingTop: 12, paddingHorizontal: 14, gap: 10,
    borderTopLeftRadius: 28, borderTopRightRadius: 28,
    backgroundColor: 'rgba(11,20,26,0.9)',
    borderWidth: 1, borderBottomWidth: 0, borderColor: 'rgba(255,255,255,0.16)',
    shadowColor: colors.black, shadowOpacity: 0.38, shadowRadius: 22,
  },
  dockHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  dockEyebrow: { color: 'rgba(255,255,255,0.58)', fontFamily: fonts.semiBold, fontSize: 10.5, textTransform: 'uppercase', letterSpacing: 0.8 },
  dockStatus: { marginTop: 2, color: '#fff', fontFamily: fonts.bold, fontSize: 13.5, letterSpacing: -0.2 },
  roundTimer: {
    height: 30, paddingHorizontal: 10, borderRadius: radius.full,
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: 'rgba(255,122,28,0.2)',
    borderWidth: 1, borderColor: 'rgba(255,177,115,0.38)',
  },
  roundTimerText: { color: '#fff', fontFamily: fonts.bold, fontSize: 12 },
  dockMainRow: { flexDirection: 'row', alignItems: 'center', minHeight: 92 },
  captureSlots: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 7 },
  captureSlot: {
    width: 50, height: 64, borderRadius: radius.md,
    alignItems: 'center', justifyContent: 'center', gap: 3,
    borderWidth: 1.2, borderStyle: 'dashed', borderColor: 'rgba(255,255,255,0.28)',
    backgroundColor: 'rgba(255,255,255,0.07)', overflow: 'visible',
  },
  captureSlotFilled: { borderStyle: 'solid', borderColor: 'rgba(255,255,255,0.62)', overflow: 'hidden' },
  emptySlotText: { color: 'rgba(255,255,255,0.58)', fontFamily: fonts.bold, fontSize: 10 },
  slotNumber: {
    position: 'absolute', left: 4, bottom: 4, width: 17, height: 17,
    borderRadius: radius.full, alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(11,20,26,0.82)',
  },
  slotNumberText: { color: '#fff', fontFamily: fonts.bold, fontSize: 9 },
  slotRemove: {
    position: 'absolute', top: 3, right: 3, width: 25, height: 25,
    borderRadius: radius.full, alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(11,20,26,0.84)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.34)',
  },
  shutterColumn: { width: 104, alignItems: 'center', justifyContent: 'center' },
  shutterOuter: {
    width: SHUTTER_OUTER, height: SHUTTER_OUTER, borderRadius: SHUTTER_OUTER / 2,
    borderWidth: 4, borderColor: 'rgba(255,255,255,0.95)', alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(11,20,26,0.25)',
  },
  shutterOuterDisabled: { opacity: 0.48 },
  shutterInner: {
    width: SHUTTER_INNER, height: SHUTTER_INNER, borderRadius: SHUTTER_INNER / 2,
    backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center',
  },
  shutterInnerActive: { backgroundColor: colors.primary },
  shutterHint: { marginTop: 4, minHeight: 26, color: '#fff', fontSize: 10.5, lineHeight: 13, fontFamily: fonts.semiBold, textAlign: 'center' },
  roundSummary: { flex: 1, alignItems: 'flex-end', justifyContent: 'center', paddingRight: 3 },
  roundSummaryValue: { color: '#fff', fontFamily: fonts.extraBold, fontSize: 20, letterSpacing: -0.6 },
  roundSummaryLabel: { color: 'rgba(255,255,255,0.58)', fontFamily: fonts.medium, fontSize: 10.5 },
  peopleSummary: {
    marginTop: 7, height: 25, paddingHorizontal: 8, borderRadius: radius.full,
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: 'rgba(255,255,255,0.09)',
  },
  peopleSummaryText: { color: 'rgba(255,255,255,0.78)', fontFamily: fonts.bold, fontSize: 10.5 },
  publishAction: {
    width: '100%', shadowColor: colors.primary, shadowOpacity: 0.22,
    shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 5,
  },
  publishedPill: {
    minHeight: 42, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7,
    borderRadius: radius.full, backgroundColor: 'rgba(34,197,94,0.18)',
    borderWidth: 1, borderColor: 'rgba(34,197,94,0.4)',
  },
  publishedPillText: { color: '#fff', fontFamily: fonts.bold, fontSize: 13 },

  /* ── Pré-visualização ── */
  previewBottom: {
    position: 'absolute', bottom: 0, left: 8, right: 8, gap: 12, zIndex: 18,
    paddingTop: 12, borderTopLeftRadius: 28, borderTopRightRadius: 28,
    backgroundColor: 'rgba(11,20,26,0.88)',
    borderWidth: 1, borderBottomWidth: 0, borderColor: 'rgba(255,255,255,0.15)',
  },
  previewBadge: {
    alignSelf: 'center', height: 30, paddingHorizontal: 12, borderRadius: radius.full,
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: 'rgba(255,122,28,0.22)', borderWidth: 1, borderColor: 'rgba(255,177,115,0.42)',
  },
  previewBadgeText: { color: '#fff', fontFamily: fonts.bold, fontSize: 11.5 },
  emojiBar: { maxHeight: 52 },
  emojiBarContent: { paddingHorizontal: 14, gap: 8, alignItems: 'center' },
  emojiChip: {
    width: 42, height: 42, borderRadius: 21,
    backgroundColor: 'rgba(255,255,255,0.11)', alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.13)',
  },
  emojiChipDisabled: { opacity: 0.38 },
  emojiChipTxt: { fontSize: 22 },
  previewActions: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, paddingHorizontal: 14,
  },
  previewAction: { flex: 1 },

  /* ── Permissão ── */
  permScreen: { flex: 1, backgroundColor: colors.black, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40, gap: 10 },
  permRing: { width: 84, height: 84, borderRadius: 42, borderWidth: 1.6, borderColor: colors.primary, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  permEmoji: { fontSize: 34 },
  permTitle: { fontSize: 20, fontFamily: fonts.bold, color: '#fff', letterSpacing: -0.4 },
  permSub: { fontSize: 13.5, fontFamily: fonts.regular, color: 'rgba(255,255,255,0.7)', textAlign: 'center', lineHeight: 20 },
  permissionAction: { marginTop: 14, minWidth: 190 },
})
