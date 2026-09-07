import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  type AccessibilityActionEvent,
  type LayoutChangeEvent,
} from 'react-native'
import { Image } from 'expo-image'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'
import Animated, {
  Extrapolation,
  ReduceMotion,
  cancelAnimation,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  type SharedValue,
} from 'react-native-reanimated'

import AvatarImage from '../../components/AvatarImage'
import AuthorAvatar from '../../components/AuthorAvatar'
import FeedIcon from '../../components/FeedIcon'
import { API_BASE } from '../../config'
import { useT } from '../../i18n'
import { useAuthStore } from '../../store/auth.store'
import { colors, radius, spacing } from '../../theme'
import { feedInk, feedLine, feedType } from './tokens'
import type {
  CollectiveMomentCapture,
  CollectiveMomentParticipant,
} from '../../types'

const VIRTUAL_RADIUS = 2
const EMOJI_SIZE_FRACTION = 0.14
// Moldura de fotografia menos “bolha” e com curva contínua no iOS.
const CARD_CORNER_RADIUS = radius.xl
// Um anel fino + uma pequena folga escura preservam o rosto mesmo sobre uma
// fotografia clara. O antigo traço de 3.6pt dominava o avatar.
const RING_STROKE = 2
const RING_GAP = 2
// Fila de quem esteve no momento. As proporções são as da pilha de comentadores
// (`CommenterStack`), mas com um pequeno “moat” entre foto e contorno para os
// círculos não se fundirem quando se sobrepõem.
const GROUP_OVERLAP_RATIO = 0.27
const GROUP_RING_STROKE = 1
const GROUP_RING_GAP = 1
const GROUP_MAX = 5
// A base do cartão fica onde o desenho a punha antes de a foto crescer: é aí
// que a identidade do post e a coluna de acções flutuam sobre a mídia, e essa
// relação não se mexe. A altura que a foto ganhou vem toda de CIMA.
const CARD_BOTTOM_GAP = 0.12
// O ar em cima é o que sobra para a fotografia crescer: a base não se mexe, por
// isso é daqui que sai a altura.
const CARD_TOP_GAP = 0.03
// Faixa de baixo intocável. A identidade do post é mais alta do que o palco
// reserva, por isso a fila do grupo tem um chão próprio, calculado à parte do
// cartão: nenhum avatar pode chegar ao avatar do postador.
const GROUP_SAFE_BOTTOM = 80

const SPRING = {
  damping: 19,
  stiffness: 220,
  mass: 0.72,
  restDisplacementThreshold: 0.001,
  restSpeedThreshold: 0.001,
  reduceMotion: ReduceMotion.Never,
} as const

export interface CollectiveMomentCarouselProps {
  captures: CollectiveMomentCapture[]
  participants: CollectiveMomentParticipant[]
  /** URLs optimizadas, na mesma ordem de `captures`. */
  urls: string[]
  /** Dimensões das imagens optimizadas, também paralelas a `captures`. */
  sizes?: Array<{ w: number | null; h: number | null }>
  reduceMotion: boolean
  /** Só a célula visível guarda uma fotografia aberta em grande. */
  isActive?: boolean
  /** Leva ao separador Círculo. Sem isto o cartão de convite não entra no anel. */
  onCreateCircle?: () => void
  /** Área inferior ocupada pelos metadados e acções do post. */
  contentBottom?: number
}

interface CardProps {
  capture: CollectiveMomentCapture
  participant: CollectiveMomentParticipant | undefined
  uri: string
  mediaSize: { w: number | null; h: number | null } | undefined
  logicalIndex: number
  count: number
  virtualPosition: number
  settledVirtual: number
  tapsLocked: boolean
  position: SharedValue<number>
  cardWidth: number
  cardHeight: number
  cardTop: number
  avatarSize: number
  reduceMotion: boolean
  onOpen: (index: number) => void
  onCenter: (virtualPosition: number) => void
  onPrevious: () => void
  onNext: () => void
}

type CardModel =
  | { kind: 'photo'; logicalIndex: number; virtualPosition: number; key: string }
  | { kind: 'cta'; virtualPosition: number; key: string }

function modulo(value: number, length: number) {
  return ((value % length) + length) % length
}

function clamp01(value: number) {
  return Math.max(0, Math.min(1, value))
}

function resolveMediaUrl(url: string) {
  if (!url) return ''
  if (/^(?:https?:|file:|content:|ph:|data:|blob:)/i.test(url)) return url
  return `${API_BASE}${url}`
}

function participantLabel(participant: CollectiveMomentParticipant | undefined) {
  return participant?.name?.trim() || participant?.username?.trim() || 'Participante'
}

// A posição de um cartão na pilha — usada tanto pelas fotografias como pelo
// cartão de convite, para os dois viverem no mesmo anel sem se desalinharem.
function useCardTransform(
  virtualPosition: number,
  position: SharedValue<number>,
  cardWidth: number,
  cardHeight: number,
  reduceMotion: boolean,
) {
  return useAnimatedStyle(() => {
    // Cada cartão tem um lugar fixo no anel virtual e só a `position` se move.
    // Nenhum cartão muda de bordo nem se apaga a meio do gesto — quem trata da
    // volta circular é o anel, com uma cópia por posição.
    const relative = virtualPosition - position.value

    const absolute = Math.abs(relative)
    const sideX = cardWidth * 0.56
    const farX = cardWidth * 0.84

    const translateX = interpolate(
      relative,
      [-2, -1, 0, 1, 2],
      [-farX, -sideX, 0, sideX, farX],
      Extrapolation.CLAMP,
    )
    const translateY = reduceMotion
      ? interpolate(
        absolute,
        [0, 1, 2],
        [0, cardHeight * 0.03, cardHeight * 0.065],
        Extrapolation.CLAMP,
      )
      : interpolate(
        relative,
        [-2, -1, 0, 1, 2],
        [cardHeight * 0.08, cardHeight * 0.035, 0, cardHeight * 0.045, cardHeight * 0.09],
        Extrapolation.CLAMP,
      )
    // Mesmo sem movimento, centro e laterais precisam continuar legíveis como
    // níveis diferentes da pilha. O que se remove é a rotação/spring, não a
    // hierarquia estática de escala e profundidade.
    const scale = interpolate(
      absolute,
      [0, 1, 2],
      reduceMotion ? [1, 0.9, 0.8] : [1, 0.86, 0.75],
      Extrapolation.CLAMP,
    )
    const rotation = reduceMotion
      ? 0
      : interpolate(relative, [-2, -1, 0, 1, 2], [-10, -7, 0, 7, 10], Extrapolation.CLAMP)

    const opacity = interpolate(
      absolute,
      [0, 1, 1.72, 2],
      [1, 0.96, 0.18, 0],
      Extrapolation.CLAMP,
    )

    return {
      opacity,
      // Um zIndex fraccionário reordena as subviews nativas a cada frame, o que
      // por si só já pisca. Em degraus, a pilha só se reorganiza quando o cartão
      // mais próximo do centro muda mesmo.
      zIndex: Math.max(0, 100 - Math.round(absolute) * 24),
      transform: [
        { translateX },
        { translateY },
        { scale },
        { rotate: `${rotation}deg` },
      ],
    }
  }, [cardHeight, cardWidth, reduceMotion, virtualPosition])
}

// A moldura ocupa sempre o mesmo lugar; só a transformação a move.
function cardLayer(cardTop: number, cardWidth: number, cardHeight: number) {
  return {
    left: '50%' as const,
    top: cardTop,
    width: cardWidth,
    height: cardHeight,
    marginLeft: -cardWidth / 2,
  }
}

const CarouselCard = memo(function CarouselCard({
  capture,
  participant,
  uri,
  mediaSize,
  logicalIndex,
  count,
  virtualPosition,
  settledVirtual,
  position,
  tapsLocked,
  cardWidth,
  cardHeight,
  cardTop,
  avatarSize,
  reduceMotion,
  onOpen,
  onCenter,
  onPrevious,
  onNext,
}: CardProps) {
  const [imageFailed, setImageFailed] = useState(false)
  const [loadedSize, setLoadedSize] = useState<{ w: number; h: number } | null>(null)
  const stableOffset = virtualPosition - settledVirtual

  useEffect(() => {
    setImageFailed(false)
    setLoadedSize(null)
  }, [uri])

  const animatedStyle = useCardTransform(virtualPosition, position, cardWidth, cardHeight, reduceMotion)

  const isCenter = stableOffset === 0
  const isInteractive = !tapsLocked && Math.abs(stableOffset) <= 1
  const name = participantLabel(participant)
  const cardLabel = `Foto de ${name}, ${logicalIndex + 1} de ${count}`

  const handlePress = useCallback(() => {
    if (isCenter) onOpen(logicalIndex)
    else onCenter(virtualPosition)
  }, [isCenter, logicalIndex, onCenter, onOpen, virtualPosition])

  const handleAccessibilityAction = useCallback((event: AccessibilityActionEvent) => {
    if (!isCenter) return
    switch (event.nativeEvent.actionName) {
      case 'activate':
        onOpen(logicalIndex)
        break
      case 'increment':
        onNext()
        break
      case 'decrement':
        onPrevious()
        break
    }
  }, [isCenter, logicalIndex, onNext, onOpen, onPrevious])

  const ringOuter = avatarSize + (RING_GAP + RING_STROKE) * 2
  const avatarInset = Math.max(10, cardWidth * 0.05)

  const hasMediaSize = (mediaSize?.w ?? 0) > 0 && (mediaSize?.h ?? 0) > 0
  const sourceWidth = hasMediaSize ? mediaSize!.w! : loadedSize?.w
  const sourceHeight = hasMediaSize ? mediaSize!.h! : loadedSize?.h
  const coverScale = sourceWidth && sourceHeight
    ? Math.max(cardWidth / sourceWidth, cardHeight / sourceHeight)
    : 1
  const renderedImageWidth = sourceWidth ? sourceWidth * coverScale : cardWidth
  const renderedImageHeight = sourceHeight ? sourceHeight * coverScale : cardHeight
  const imageOffsetX = (cardWidth - renderedImageWidth) / 2
  const imageOffsetY = (cardHeight - renderedImageHeight) / 2
  // A ferramenta de captura define o tamanho em função da largura real da
  // imagem depois do `cover`, que pode ser maior que o cartão e ficar cortada.
  const emojiSize = renderedImageWidth * EMOJI_SIZE_FRACTION

  return (
    <Animated.View
      pointerEvents={isInteractive ? 'auto' : 'none'}
      style={[s.cardLayer, cardLayer(cardTop, cardWidth, cardHeight), animatedStyle]}
    >
      <Pressable
        style={s.pressTarget}
        onPress={handlePress}
        accessible={isInteractive}
        accessibilityElementsHidden={!isInteractive}
        importantForAccessibility={isInteractive ? 'yes' : 'no-hide-descendants'}
        accessibilityRole={isCenter ? 'adjustable' : 'button'}
        accessibilityLabel={cardLabel}
        accessibilityHint={isCenter ? 'Toque para abrir. Deslize para mudar de perspectiva.' : 'Toque para trazer esta perspectiva ao centro.'}
        accessibilityValue={isCenter ? {
          min: 1,
          max: count,
          now: logicalIndex + 1,
          text: `${logicalIndex + 1} de ${count}`,
        } : undefined}
        accessibilityActions={isCenter ? [
          { name: 'activate', label: 'Abrir fotografia' },
          { name: 'increment', label: 'Próxima fotografia' },
          { name: 'decrement', label: 'Fotografia anterior' },
        ] : undefined}
        onAccessibilityAction={handleAccessibilityAction}
      >
        <View style={s.cardShadow}>
          <View style={s.cardFrame}>
            {!imageFailed && !!uri ? (
              <Image
                source={{ uri }}
                style={StyleSheet.absoluteFill}
                contentFit="cover"
                cachePolicy="disk"
                recyclingKey={`${capture.id}:${uri}`}
                transition={reduceMotion ? 0 : 110}
                onError={() => setImageFailed(true)}
                onLoad={(event) => {
                  if (hasMediaSize) return
                  const { width, height } = event.source ?? {}
                  if (!width || !height) return
                  setLoadedSize((current) => (
                    current?.w === width && current.h === height
                      ? current
                      : { w: width, h: height }
                  ))
                }}
                accessibilityIgnoresInvertColors
              />
            ) : (
              <View style={s.imageFallback}>
                <Text style={s.fallbackMark}>!</Text>
                <Text style={s.fallbackText}>Foto indisponível</Text>
              </View>
            )}

            {!imageFailed && !!uri && !!sourceWidth && !!sourceHeight && (
              <View style={StyleSheet.absoluteFill} pointerEvents="none">
                {(Array.isArray(capture.overlays) ? capture.overlays : []).map((overlay, index) => {
                  if (!overlay?.emoji) return null
                  const x = Number.isFinite(overlay.x) ? clamp01(overlay.x) : 0.5
                  const y = Number.isFinite(overlay.y) ? clamp01(overlay.y) : 0.5
                  return (
                    <Text
                      key={`${capture.id}:overlay:${index}`}
                      style={[
                        s.emoji,
                        {
                          left: imageOffsetX + x * renderedImageWidth - emojiSize / 2,
                          top: imageOffsetY + y * renderedImageHeight - emojiSize / 2,
                          fontSize: emojiSize,
                          lineHeight: emojiSize * 1.14,
                        },
                      ]}
                    >
                      {overlay.emoji}
                    </Text>
                  )
                })}
              </View>
            )}

            {/* Dentro da mesma superfície elevada da fotografia: no Android,
                dois irmãos com elevations diferentes podiam esconder o anel. */}
            <AuthorAvatar
              uri={participant?.avatar}
              name={name}
              avatarSize={avatarSize}
              ringWidth={RING_STROKE}
              gap={RING_GAP}
              wellColor="rgba(11,20,26,0.84)"
              elevated
              style={[
                s.avatarRing,
                {
                  top: avatarInset,
                  left: avatarInset,
                },
              ]}
            />
          </View>
        </View>
      </Pressable>
    </Animated.View>
  )
})

interface CreateCircleCardProps {
  virtualPosition: number
  settledVirtual: number
  tapsLocked: boolean
  position: SharedValue<number>
  cardWidth: number
  cardHeight: number
  cardTop: number
  reduceMotion: boolean
  onCreate: () => void
  onCenter: (virtualPosition: number) => void
}

// O convite fecha o anel: passadas as fotografias do momento, aparece o cartão
// que leva ao Círculo. Mesma moldura das fotografias — muda o que está dentro.
const CreateCircleCard = memo(function CreateCircleCard({
  virtualPosition,
  settledVirtual,
  tapsLocked,
  position,
  cardWidth,
  cardHeight,
  cardTop,
  reduceMotion,
  onCreate,
  onCenter,
}: CreateCircleCardProps) {
  const t = useT()
  const animatedStyle = useCardTransform(virtualPosition, position, cardWidth, cardHeight, reduceMotion)

  const stableOffset = virtualPosition - settledVirtual
  const isCenter = stableOffset === 0
  const isInteractive = !tapsLocked && Math.abs(stableOffset) <= 1

  // Quem vê o cartão vê-se a si próprio — é o convite a dizer que falta ele.
  const me = useAuthStore((state) => state.user)
  const faceSize = Math.max(52, Math.min(78, cardWidth * 0.26))
  const faceRingOuter = faceSize + (RING_GAP + RING_STROKE) * 2
  const inset = Math.max(10, cardWidth * 0.05)
  // O emblema assenta sobre o anel, na diagonal de baixo — o `+` das acções da
  // Luxee, com a borda da cor do cartão para se destacar do anel.
  const badgeSize = Math.max(20, Math.round(faceSize * 0.34))
  const badgeOffset = faceRingOuter / 2 + faceRingOuter * 0.354 - badgeSize / 2

  const handlePress = useCallback(() => {
    if (isCenter) onCreate()
    else onCenter(virtualPosition)
  }, [isCenter, onCenter, onCreate, virtualPosition])

  return (
    <Animated.View
      pointerEvents={isInteractive ? 'auto' : 'none'}
      style={[s.cardLayer, cardLayer(cardTop, cardWidth, cardHeight), animatedStyle]}
    >
      <Pressable
        style={s.pressTarget}
        onPress={handlePress}
        accessible={isInteractive}
        accessibilityElementsHidden={!isInteractive}
        importantForAccessibility={isInteractive ? 'yes' : 'no-hide-descendants'}
        accessibilityRole="button"
        accessibilityLabel={t.circle_feedCtaTitle}
        accessibilityHint={isCenter ? t.circle_feedCtaSub : 'Toque para trazer este cartão ao centro.'}
      >
        <View style={s.cardShadow}>
          <View style={s.cardFrame}>
            <View style={[StyleSheet.absoluteFill, s.ctaSurface]} />
            {/* O rosto fica em cima, à altura dos rostos dos cartões ao lado;
                os textos assentam em baixo, onde vive a legenda de um post. */}
            <View style={[s.ctaBody, { paddingTop: inset, paddingBottom: inset + 6 }]}>
              <View style={[s.ctaRing, { width: faceRingOuter, height: faceRingOuter, borderRadius: radius.full }]}>
                <AuthorAvatar
                  uri={me?.avatar}
                  name={me?.name}
                  avatarSize={faceSize}
                  ringWidth={RING_STROKE}
                  gap={RING_GAP}
                  wellColor={colors.circleInvite}
                  elevated
                />
                <View
                  style={[
                    s.ctaBadge,
                    {
                      width: badgeSize,
                      height: badgeSize,
                      borderRadius: radius.full,
                      left: badgeOffset,
                      top: badgeOffset,
                    },
                  ]}
                >
                  <FeedIcon name="baseline-plus" size={badgeSize * 0.62} color={colors.white} />
                </View>
              </View>

              <View style={s.ctaWords}>
                <Text style={s.ctaTitle} numberOfLines={2}>{t.circle_feedCtaTitle}</Text>
                <Text style={s.ctaSub} numberOfLines={3}>{t.circle_feedCtaSub}</Text>
              </View>
            </View>
          </View>
        </View>
      </Pressable>
    </Animated.View>
  )
})

interface ParticipantStackProps {
  participants: CollectiveMomentParticipant[]
  size: number
}

// Quem esteve no momento, logo abaixo das fotografias: a leitura do grupo
// inteiro sem ter de rodar o carrossel até ao fim.
const ParticipantStack = memo(function ParticipantStack({
  participants,
  size,
}: ParticipantStackProps) {
  const shown = participants.slice(0, GROUP_MAX)
  const rest = participants.length - shown.length
  const overlap = Math.round(size * GROUP_OVERLAP_RATIO)
  const avatarSize = Math.max(1, size - (GROUP_RING_STROKE + GROUP_RING_GAP) * 2)

  return (
    <View style={s.groupRow}>
      {shown.map((participant, index) => (
        <View
          key={participant.id}
          style={[
            s.groupSlot,
            {
              width: size,
              height: size,
              borderRadius: size / 2,
              zIndex: shown.length - index,
            },
            index > 0 && { marginLeft: -overlap },
          ]}
        >
          <AvatarImage
            uri={participant.avatar}
            name={participantLabel(participant)}
            size={avatarSize}
            borderWidth={0}
            borderColor="transparent"
          />
        </View>
      ))}

      {rest > 0 && (
        <View
          style={[
            s.groupSlot,
            s.groupMore,
            { width: size, height: size, borderRadius: size / 2, marginLeft: -overlap },
          ]}
        >
          <Text style={[s.groupMoreText, { fontSize: Math.round(size * 0.36) }]}>+{rest}</Text>
        </View>
      )}
    </View>
  )
})

interface ZoomedCaptureProps {
  capture: CollectiveMomentCapture
  uri: string
  mediaSize: { w: number | null; h: number | null } | undefined
  boxWidth: number
  boxHeight: number
}

// A fotografia aberta, à altura toda da mídia e SEM cortar: aqui o objectivo é
// ver, não compor. Por isso `contain` — e a matemática dos emojis é a mesma do
// cartão, trocando o `max` do `cover` pelo `min`.
const ZoomedCapture = memo(function ZoomedCapture({
  capture,
  uri,
  mediaSize,
  boxWidth,
  boxHeight,
}: ZoomedCaptureProps) {
  const [loadedSize, setLoadedSize] = useState<{ w: number; h: number } | null>(null)
  useEffect(() => { setLoadedSize(null) }, [uri])

  const hasMediaSize = (mediaSize?.w ?? 0) > 0 && (mediaSize?.h ?? 0) > 0
  const sourceWidth = hasMediaSize ? mediaSize!.w! : loadedSize?.w
  const sourceHeight = hasMediaSize ? mediaSize!.h! : loadedSize?.h
  const fitScale = sourceWidth && sourceHeight
    ? Math.min(boxWidth / sourceWidth, boxHeight / sourceHeight)
    : 1
  const renderedWidth = sourceWidth ? sourceWidth * fitScale : boxWidth
  const renderedHeight = sourceHeight ? sourceHeight * fitScale : boxHeight
  const offsetX = (boxWidth - renderedWidth) / 2
  const offsetY = (boxHeight - renderedHeight) / 2
  const emojiSize = renderedWidth * EMOJI_SIZE_FRACTION

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Image
        source={{ uri }}
        style={StyleSheet.absoluteFill}
        contentFit="contain"
        cachePolicy="disk"
        recyclingKey={`${capture.id}:zoom`}
        transition={0}
        onLoad={(event) => {
          if (hasMediaSize) return
          const { width, height } = event.source ?? {}
          if (!width || !height) return
          setLoadedSize((current) => (
            current?.w === width && current.h === height ? current : { w: width, h: height }
          ))
        }}
        accessibilityIgnoresInvertColors
      />

      {!!sourceWidth && !!sourceHeight && (Array.isArray(capture.overlays) ? capture.overlays : []).map((overlay, index) => {
        if (!overlay?.emoji) return null
        const x = Number.isFinite(overlay.x) ? clamp01(overlay.x) : 0.5
        const y = Number.isFinite(overlay.y) ? clamp01(overlay.y) : 0.5
        return (
          <Text
            key={`${capture.id}:zoom:overlay:${index}`}
            style={[
              s.emoji,
              {
                left: offsetX + x * renderedWidth - emojiSize / 2,
                top: offsetY + y * renderedHeight - emojiSize / 2,
                fontSize: emojiSize,
                lineHeight: emojiSize * 1.14,
              },
            ]}
          >
            {overlay.emoji}
          </Text>
        )
      })}
    </View>
  )
})

function CarouselContent({
  captures,
  participants,
  urls,
  sizes,
  reduceMotion,
  isActive = true,
  onCreateCircle,
  contentBottom = 0,
}: CollectiveMomentCarouselProps) {
  const [layout, setLayout] = useState({ width: 0, height: 0 })
  const [settledVirtual, setSettledVirtual] = useState(0)
  const [tapsLocked, setTapsLocked] = useState(false)
  const tapsLockedRef = useRef(false)
  const position = useSharedValue(0)
  const settledPosition = useSharedValue(0)
  const dragOrigin = useSharedValue(0)
  const dragTranslationOrigin = useSharedValue(0)
  const panActivated = useSharedValue(false)
  const count = captures.length
  // O convite é mais um lugar no anel, a seguir à última fotografia.
  const slots = count + (onCreateCircle ? 1 : 0)

  const captureSignature = useMemo(
    () => captures.map((capture) => capture.id).join('|'),
    [captures],
  )

  useEffect(() => {
    cancelAnimation(position)
    position.value = 0
    settledPosition.value = 0
    dragOrigin.value = 0
    dragTranslationOrigin.value = 0
    panActivated.value = false
    tapsLockedRef.current = false
    setSettledVirtual(0)
    setTapsLocked(false)
  }, [captureSignature, dragOrigin, dragTranslationOrigin, panActivated, position, settledPosition])

  const participantById = useMemo(() => {
    const result = new Map<string, CollectiveMomentParticipant>()
    participants.forEach((participant) => result.set(participant.id, participant))
    return result
  }, [participants])

  const stageHeight = Math.max(0, layout.height - Math.max(0, contentBottom))

  // Larga, mas nunca de bordo a bordo: fica uma margem de 10% de cada lado, que
  // é o que mantém o cartão a ler-se como cartão e deixa ver as laterais da
  // pilha. Bordo a bordo é o que acontece ao tocar — aí sim, ecrã inteiro.
  const cardWidth = Math.min(
    layout.width * 0.80,
    Math.max(180, stageHeight * 0.62),
  )
  // Mais alta do que era: com o avatar dentro da fotografia, o topo do palco
  // deixou de ter de guardar espaço para o anel que saía por cima da moldura.
  // Mas cresce só para cima — a base não invade o que está em baixo.
  const cardBottomLine = stageHeight * (1 - CARD_BOTTOM_GAP)
  const cardHeight = Math.min(
    stageHeight * (1 - CARD_BOTTOM_GAP - CARD_TOP_GAP),
    cardWidth * 1.62,
  )
  const avatarSize = Math.max(34, Math.min(50, cardWidth * 0.17))
  const cardTop = Math.max(0, cardBottomLine - cardHeight)

  // A fila do grupo assenta POR CIMA da fotografia, encostada ao fundo do
  // cartão. Não ocupa altura nenhuma do palco: a foto fica com o tamanho todo e
  // nada do resto do post se mexe.
  const showGroup = participants.length > 1
  const groupSize = Math.round(Math.max(24, Math.min(30, layout.width * 0.072)))
  const groupInset = Math.max(10, cardWidth * 0.05)
  const groupTop = Math.min(
    cardTop + cardHeight - groupSize - groupInset,
    stageHeight - GROUP_SAFE_BOTTOM - groupSize,
  )
  const gestureStep = Math.max(1, cardWidth * 0.56)

  const lockInteractions = useCallback(() => {
    tapsLockedRef.current = true
    setTapsLocked(true)
  }, [])

  const finishSettled = useCallback((target: number) => {
    setSettledVirtual(target)
    tapsLockedRef.current = false
    setTapsLocked(false)
  }, [])

  const centerVirtual = useCallback((target: number) => {
    if (tapsLockedRef.current) return

    cancelAnimation(position)
    if (reduceMotion) {
      position.value = target
      settledPosition.value = target
      dragOrigin.value = target
      finishSettled(target)
      return
    }

    lockInteractions()
    position.value = withSpring(target, SPRING, (finished) => {
      if (!finished) return
      settledPosition.value = target
      dragOrigin.value = target
      runOnJS(finishSettled)(target)
    })
  }, [dragOrigin, finishSettled, lockInteractions, position, reduceMotion, settledPosition])

  // ── Ver de perto, sem sair da feed ─────────────────────────────────────────
  // Tocar na fotografia do centro abre-a aqui mesmo, à altura toda da mídia. O
  // resto do post — autor, acções, legenda — continua no ecrã por baixo.
  const [zoomIndex, setZoomIndex] = useState<number | null>(null)
  const zoomProgress = useSharedValue(0)

  const openCapture = useCallback((index: number) => {
    if (tapsLockedRef.current) return
    setZoomIndex(index)
  }, [])

  const closeZoom = useCallback(() => setZoomIndex(null), [])

  useEffect(() => {
    if (zoomIndex === null) {
      cancelAnimation(zoomProgress)
      zoomProgress.value = reduceMotion ? 0 : withSpring(0, SPRING)
      return
    }
    cancelAnimation(zoomProgress)
    zoomProgress.value = reduceMotion ? 1 : withSpring(1, SPRING)
  }, [zoomIndex, reduceMotion, zoomProgress])

  // Rolar a feed para outro post fecha o que estava aberto: uma fotografia em
  // grande não pode ficar pendurada sobre um momento que já não se vê.
  useEffect(() => {
    if (!isActive) setZoomIndex(null)
  }, [isActive])

  useEffect(() => {
    setZoomIndex(null)
  }, [captureSignature])

  const previous = useCallback(() => centerVirtual(settledVirtual - 1), [centerVirtual, settledVirtual])
  const next = useCallback(() => centerVirtual(settledVirtual + 1), [centerVirtual, settledVirtual])

  const pan = useMemo(() => Gesture.Pan()
    // O gesto só vence quando a intenção horizontal é inequívoca. Um arrasto
    // vertical falha cedo e continua no pager do feed sem o prender.
    .activeOffsetX([-11, 11])
    .failOffsetY([-9, 9])
    .maxPointers(1)
    .onBegin(() => {
      // BEGAN acontece no primeiro toque, mesmo quando a intenção acaba por ser
      // vertical. Aqui não se interrompe a spring que já está em curso.
      panActivated.value = false
    })
    .onStart((event) => {
      panActivated.value = true
      cancelAnimation(position)
      dragOrigin.value = position.value
      // `translationX` já contém os pontos usados para activar o recognizer.
      // Guardar a base evita que o cartão dê um salto de 11 px ao activar.
      dragTranslationOrigin.value = event.translationX
      runOnJS(lockInteractions)()
    })
    .onUpdate((event) => {
      const translation = event.translationX - dragTranslationOrigin.value
      const nextPosition = dragOrigin.value - translation / gestureStep
      position.value = Math.max(
        settledPosition.value - 1.08,
        Math.min(settledPosition.value + 1.08, nextPosition),
      )
    })
    .onEnd((event, success) => {
      // CANCELLED também dispara onEnd depois de ACTIVE. O snap seguro fica no
      // onFinalize; um cancelamento nunca deve ser interpretado como navegação.
      if (!success) return
      const distance = position.value - settledPosition.value
      const velocity = -event.velocityX / gestureStep
      const projected = distance + velocity * 0.16
      const shouldAdvance = Math.abs(distance) > 0.27 || Math.abs(velocity) > 0.5
      const direction = shouldAdvance ? (projected >= 0 ? 1 : -1) : 0
      const target = settledPosition.value + direction

      if (reduceMotion) {
        position.value = target
        settledPosition.value = target
        dragOrigin.value = target
        runOnJS(finishSettled)(target)
        return
      }

      position.value = withSpring(target, SPRING, (finished) => {
        if (!finished) return
        settledPosition.value = target
        dragOrigin.value = target
        runOnJS(finishSettled)(target)
      })
    })
    .onFinalize((_event, success) => {
      const wasActivated = panActivated.value
      panActivated.value = false
      // Um Pan que apenas BEGAN e depois falhou (por ser vertical/tap) nunca
      // tocou na animação existente, logo também não deve fazer snap nela.
      if (success || !wasActivated) return

      const target = settledPosition.value
      if (reduceMotion) {
        position.value = target
        dragOrigin.value = target
        runOnJS(finishSettled)(target)
        return
      }

      position.value = withSpring(target, SPRING, (finished) => {
        if (!finished) return
        dragOrigin.value = target
        runOnJS(finishSettled)(target)
      })
    }), [
      dragOrigin,
      dragTranslationOrigin,
      finishSettled,
      gestureStep,
      lockInteractions,
      panActivated,
      position,
      reduceMotion,
      settledPosition,
    ])

  // Cresce a partir do cartão: escala uniforme (nunca deforma a foto) e um
  // deslize vertical do centro do cartão para o centro do palco.
  const zoomStyle = useAnimatedStyle(() => ({
    opacity: zoomProgress.value,
    transform: [
      {
        translateY: interpolate(
          zoomProgress.value,
          [0, 1],
          [cardTop + cardHeight / 2 - stageHeight / 2, 0],
          Extrapolation.CLAMP,
        ),
      },
      {
        scale: interpolate(
          zoomProgress.value,
          [0, 1],
          [layout.width > 0 ? cardWidth / layout.width : 0.9, 1],
          Extrapolation.CLAMP,
        ),
      },
    ],
  }), [cardHeight, cardTop, cardWidth, layout.width, stageHeight])

  const onLayout = useCallback((event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout
    setLayout((current) => (
      Math.abs(current.width - width) < 0.5 && Math.abs(current.height - height) < 0.5
        ? current
        : { width, height }
    ))
  }, [])

  const cardModels = useMemo<CardModel[]>(() => {
    if (slots === 1) {
      return [{
        kind: 'photo',
        logicalIndex: 0,
        virtualPosition: settledVirtual,
        key: `${captures[0].id}:single`,
      }]
    }
    // Cada posição do anel tem a sua própria cópia. Com poucas fotografias a
    // mesma imagem aparece em mais do que um lugar — uma cópia a mais (o mesmo
    // URI, já em cache) é mais barata do que fazer um cartão saltar de bordo a
    // meio do gesto.
    return Array.from(
      { length: VIRTUAL_RADIUS * 2 + 1 },
      (_, index) => {
        const virtualPosition = settledVirtual + index - VIRTUAL_RADIUS
        const slot = modulo(virtualPosition, slots)
        if (slot === count) {
          return { kind: 'cta', virtualPosition, key: `cta:virtual:${virtualPosition}` }
        }
        return {
          kind: 'photo',
          logicalIndex: slot,
          virtualPosition,
          key: `${captures[slot].id}:virtual:${virtualPosition}`,
        }
      },
    )
  }, [captures, count, settledVirtual, slots])

  const zoomCapture = zoomIndex !== null ? captures[zoomIndex] : undefined

  const cards = layout.width > 0 && stageHeight > 0 && cardWidth > 0 && cardHeight > 0 ? (
    <View style={[s.stage, { height: stageHeight }]} collapsable={false}>
      {cardModels.map((model) => {
        const { key, virtualPosition } = model
        if (model.kind === 'cta') {
          if (!onCreateCircle) return null
          return (
            <CreateCircleCard
              key={key}
              virtualPosition={virtualPosition}
              settledVirtual={settledVirtual}
              tapsLocked={tapsLocked}
              position={position}
              cardWidth={cardWidth}
              cardHeight={cardHeight}
              cardTop={cardTop}
              reduceMotion={reduceMotion}
              onCreate={onCreateCircle}
              onCenter={centerVirtual}
            />
          )
        }
        const { logicalIndex } = model
        const capture = captures[logicalIndex]
        const participant = participantById.get(capture.userId)
        const uri = resolveMediaUrl(urls[logicalIndex] || capture.mediaUrl)

        return (
          <CarouselCard
            key={key}
            capture={capture}
            participant={participant}
            uri={uri}
            mediaSize={sizes?.[logicalIndex]}
            logicalIndex={logicalIndex}
            count={count}
            virtualPosition={virtualPosition}
            settledVirtual={settledVirtual}
            position={position}
            tapsLocked={tapsLocked}
            cardWidth={cardWidth}
            cardHeight={cardHeight}
            cardTop={cardTop}
            avatarSize={avatarSize}
            reduceMotion={reduceMotion}
            onOpen={openCapture}
            onCenter={centerVirtual}
            onPrevious={previous}
            onNext={next}
          />
        )
      })}

      {showGroup && zoomIndex === null && (
        <View
          style={[s.groupOverlay, { top: groupTop, height: groupSize }]}
          pointerEvents="none"
        >
          <ParticipantStack participants={participants} size={groupSize} />
        </View>
      )}

      {/* ── A fotografia aberta, aqui mesmo ── */}
      {!!zoomCapture && stageHeight > 0 && (
        <Animated.View style={[s.zoomLayer, { height: stageHeight }, zoomStyle]}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={closeZoom}
            accessibilityRole="button"
            accessibilityLabel="Fotografia aberta"
            accessibilityHint="Toque para fechar."
          >
            <ZoomedCapture
              capture={zoomCapture}
              uri={resolveMediaUrl(urls[zoomIndex!] || zoomCapture.mediaUrl)}
              mediaSize={sizes?.[zoomIndex!]}
              boxWidth={layout.width}
              boxHeight={stageHeight}
            />
          </Pressable>
        </Animated.View>
      )}
    </View>
  ) : null

  return (
    <View style={s.root} onLayout={onLayout} pointerEvents="box-none">
      {/* Com uma fotografia aberta o gesto do carrossel sai de cena: deslizar
          por baixo dela mudaria o centro sem se ver o que se está a fazer. */}
      {zoomIndex === null && slots > 1 && cards
        ? <GestureDetector gesture={pan}>{cards}</GestureDetector>
        : cards}
    </View>
  )
}

function CollectiveMomentCarousel(props: CollectiveMomentCarouselProps) {
  if (props.captures.length === 0) return null
  return <CarouselContent {...props} />
}

export default memo(CollectiveMomentCarousel)

const s = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFillObject,
  },
  stage: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
  },
  cardLayer: {
    position: 'absolute',
  },
  pressTarget: {
    width: '100%',
    height: '100%',
  },
  cardShadow: {
    flex: 1,
    borderRadius: CARD_CORNER_RADIUS,
    borderCurve: 'continuous',
    backgroundColor: colors.feedSurfaceSlate,
    shadowColor: colors.black,
    shadowOpacity: 0.27,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 7,
  },
  cardFrame: {
    flex: 1,
    overflow: 'hidden',
    borderRadius: CARD_CORNER_RADIUS,
    borderCurve: 'continuous',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: feedLine.subtle,
    backgroundColor: colors.feedSurfaceSlate,
  },
  imageFallback: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.feedSurfaceSlate,
  },
  fallbackMark: {
    width: 26,
    height: 26,
    borderRadius: radius.full,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: feedLine.strong,
    color: feedInk.muted,
    ...feedType.primary,
    textAlign: 'center',
  },
  fallbackText: {
    ...feedType.copy,
    color: feedInk.muted,
    textAlign: 'center',
  },
  emoji: {
    position: 'absolute',
    textAlign: 'center',
    textShadowColor: 'rgba(0,0,0,0.2)',
    textShadowRadius: 2,
    textShadowOffset: { width: 0, height: 1 },
  },
  // Posição do anel sobre a mídia; a superfície e a sombra são partilhadas com
  // o avatar do cartão de convite.
  avatarRing: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaSurface: {
    backgroundColor: colors.circleInvite,
  },
  // Ocupa o palco, não o post inteiro: autor, acções e legenda continuam a
  // ler-se por baixo, que é o que faz isto ser a feed e não outro ecrã.
  zoomLayer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 300,
    backgroundColor: colors.feedSurface,
  },
  groupOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    justifyContent: 'center',
    // Acima de qualquer cartão: o do centro chega a 100 e passaria à frente.
    zIndex: 200,
  },
  groupRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  // A sombra é o que separa os anéis brancos quando a fila cai sobre uma zona
  // clara — o mesmo cuidado da pilha de comentadores.
  groupSlot: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: GROUP_RING_STROKE,
    borderColor: feedLine.bright,
    backgroundColor: 'rgba(7,8,10,0.56)',
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.22,
    shadowRadius: 2,
    elevation: 2,
  },
  groupMore: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.feedSurfaceSlate,
  },
  groupMoreText: {
    color: colors.white,
    fontFamily: feedType.primary.fontFamily,
  },
  ctaBody: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md2,
  },
  ctaRing: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaBadge: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    borderWidth: 1.5,
    borderColor: colors.circleInvite,
  },
  ctaWords: {
    alignItems: 'center',
    gap: spacing.xs2,
  },
  ctaTitle: {
    ...feedType.title,
    color: colors.white,
    textAlign: 'center',
  },
  ctaSub: {
    ...feedType.copy,
    color: feedInk.muted,
    textAlign: 'center',
  },
})
