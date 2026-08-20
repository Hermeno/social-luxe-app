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
import { API_BASE } from '../../config'
import { colors, fonts, radius } from '../../theme'
import type {
  CollectiveMomentCapture,
  CollectiveMomentParticipant,
} from '../../types'

const VIRTUAL_RADIUS = 2
const EMOJI_SIZE_FRACTION = 0.14

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
  onOpen: (index: number) => void
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
  twoItemSide: -1 | 1
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
  twoItemSide,
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
  const twoItem = count === 2

  useEffect(() => {
    setImageFailed(false)
    setLoadedSize(null)
  }, [uri])

  const animatedStyle = useAnimatedStyle(() => {
    let relative = virtualPosition - position.value
    let continuityOpacity = 1

    if (twoItem) {
      const travel = position.value - settledVirtual
      const progress = Math.min(1, Math.abs(travel))
      const direction = travel > 0 ? 1 : travel < 0 ? -1 : twoItemSide

      if (stableOffset === 0) {
        // O cartão que sai acompanha o dedo até à lateral oposta. Depois passa
        // por trás (opacidade zero), muda de lado e reaparece como a única
        // lateral do novo centro. É a volta circular com só duas Image views.
        if (progress <= 0.62) {
          relative = -direction * interpolate(progress, [0, 0.62], [0, 1], Extrapolation.CLAMP)
        } else if (progress < 0.76) {
          relative = interpolate(progress, [0.62, 0.76], [-direction, direction], Extrapolation.CLAMP)
        } else {
          relative = direction
        }
        continuityOpacity = interpolate(
          progress,
          [0, 0.5, 0.63, 0.75, 0.9, 1],
          [1, 1, 0, 0, 1, 1],
          Extrapolation.CLAMP,
        )
      } else if (direction === twoItemSide) {
        relative = direction * (1 - progress)
      } else {
        // Se o utilizador inverte o sentido, a única lateral troca de bordo
        // apenas no intervalo em que está invisível.
        if (progress <= 0.11) {
          relative = twoItemSide
        } else if (progress < 0.17) {
          relative = interpolate(
            progress,
            [0.11, 0.17],
            [twoItemSide, direction * (1 - progress)],
            Extrapolation.CLAMP,
          )
        } else {
          relative = direction * (1 - progress)
        }
        continuityOpacity = interpolate(
          progress,
          [0, 0.08, 0.13, 0.19, 0.28, 1],
          [1, 1, 0, 0, 1, 1],
          Extrapolation.CLAMP,
        )
      }
    }

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

    const opacity = continuityOpacity * interpolate(
      absolute,
      [0, 1, 1.72, 2],
      [1, 0.96, 0.18, 0],
      Extrapolation.CLAMP,
    )

    return {
      opacity,
      zIndex: Math.max(0, 100 - absolute * 24),
      transform: [
        { translateX },
        { translateY },
        { scale },
        { rotate: `${rotation}deg` },
      ],
    }
  }, [cardHeight, cardWidth, reduceMotion, settledVirtual, stableOffset, twoItem, twoItemSide, virtualPosition])

  const isCenter = stableOffset === 0
  const isInteractive = !tapsLocked && (twoItem
    ? stableOffset === 0 || stableOffset === twoItemSide
    : Math.abs(stableOffset) <= 1)
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
      style={[
        s.cardLayer,
        {
          left: '50%',
          top: cardTop,
          width: cardWidth,
          height: cardHeight,
          marginLeft: -cardWidth / 2,
        },
        animatedStyle,
      ]}
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
          </View>
        </View>

        <View
          style={[
            s.avatarRing,
            {
              width: avatarSize + 6,
              height: avatarSize + 6,
              borderRadius: radius.full,
              top: -(avatarSize + 6) / 2,
              left: (cardWidth - avatarSize - 6) / 2,
            },
          ]}
          pointerEvents="none"
        >
          <AvatarImage
            uri={participant?.avatar}
            name={name}
            size={avatarSize}
            borderColor="transparent"
            borderWidth={0}
          />
        </View>
      </Pressable>
    </Animated.View>
  )
})

function CarouselContent({
  captures,
  participants,
  urls,
  sizes,
  reduceMotion,
  onOpen,
  contentBottom = 0,
}: CollectiveMomentCarouselProps) {
  const [layout, setLayout] = useState({ width: 0, height: 0 })
  const [settledVirtual, setSettledVirtual] = useState(0)
  const [twoItemSide, setTwoItemSide] = useState<-1 | 1>(1)
  const [tapsLocked, setTapsLocked] = useState(false)
  const tapsLockedRef = useRef(false)
  const position = useSharedValue(0)
  const settledPosition = useSharedValue(0)
  const dragOrigin = useSharedValue(0)
  const dragTranslationOrigin = useSharedValue(0)
  const panActivated = useSharedValue(false)
  const count = captures.length

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
    setTwoItemSide(1)
    setTapsLocked(false)
  }, [captureSignature, dragOrigin, dragTranslationOrigin, panActivated, position, settledPosition])

  const participantById = useMemo(() => {
    const result = new Map<string, CollectiveMomentParticipant>()
    participants.forEach((participant) => result.set(participant.id, participant))
    return result
  }, [participants])

  const stageHeight = Math.max(0, layout.height - Math.max(0, contentBottom))
  const cardWidth = Math.min(
    layout.width * 0.72,
    Math.max(180, stageHeight * 0.58),
  )
  const cardHeight = Math.min(
    stageHeight * 0.76,
    cardWidth * 1.38,
  )
  const avatarSize = Math.max(40, Math.min(58, cardWidth * 0.19))
  const cardTop = Math.max(
    avatarSize * 0.58,
    (stageHeight - cardHeight) / 2 + avatarSize * 0.12,
  )
  const gestureStep = Math.max(1, cardWidth * 0.56)

  const lockInteractions = useCallback(() => {
    tapsLockedRef.current = true
    setTapsLocked(true)
  }, [])

  const finishSettled = useCallback((target: number, nextTwoItemSide: number) => {
    setSettledVirtual(target)
    if (nextTwoItemSide === -1 || nextTwoItemSide === 1) {
      setTwoItemSide(nextTwoItemSide)
    }
    tapsLockedRef.current = false
    setTapsLocked(false)
  }, [])

  const centerVirtual = useCallback((target: number) => {
    if (tapsLockedRef.current) return
    const direction = target > settledVirtual ? 1 : target < settledVirtual ? -1 : 0
    const nextTwoItemSide: -1 | 1 = direction === 0 ? twoItemSide : direction

    cancelAnimation(position)
    if (reduceMotion) {
      position.value = target
      settledPosition.value = target
      dragOrigin.value = target
      finishSettled(target, nextTwoItemSide)
      return
    }

    lockInteractions()
    position.value = withSpring(target, SPRING, (finished) => {
      if (!finished) return
      settledPosition.value = target
      dragOrigin.value = target
      runOnJS(finishSettled)(target, nextTwoItemSide)
    })
  }, [dragOrigin, finishSettled, lockInteractions, position, reduceMotion, settledPosition, settledVirtual, twoItemSide])

  const openCapture = useCallback((index: number) => {
    if (tapsLockedRef.current) return
    onOpen(index)
  }, [onOpen])

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
      const nextTwoItemSide = direction === 0 ? twoItemSide : direction

      if (reduceMotion) {
        position.value = target
        settledPosition.value = target
        dragOrigin.value = target
        runOnJS(finishSettled)(target, nextTwoItemSide)
        return
      }

      position.value = withSpring(target, SPRING, (finished) => {
        if (!finished) return
        settledPosition.value = target
        dragOrigin.value = target
        runOnJS(finishSettled)(target, nextTwoItemSide)
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
        runOnJS(finishSettled)(target, twoItemSide)
        return
      }

      position.value = withSpring(target, SPRING, (finished) => {
        if (!finished) return
        dragOrigin.value = target
        runOnJS(finishSettled)(target, twoItemSide)
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
      twoItemSide,
    ])

  const onLayout = useCallback((event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout
    setLayout((current) => (
      Math.abs(current.width - width) < 0.5 && Math.abs(current.height - height) < 0.5
        ? current
        : { width, height }
    ))
  }, [])

  const cardModels = useMemo(() => {
    if (count === 1) {
      return [{ logicalIndex: 0, virtualPosition: settledVirtual, key: `${captures[0].id}:single` }]
    }
    if (count === 2) {
      const currentLogical = modulo(settledVirtual, count)
      return captures.map((capture, logicalIndex) => ({
        logicalIndex,
        virtualPosition: logicalIndex === currentLogical
          ? settledVirtual
          : settledVirtual + twoItemSide,
        // A identidade nativa acompanha a fotografia ao trocar centro/lateral.
        key: `${capture.id}:two-item`,
      }))
    }
    return Array.from(
      { length: VIRTUAL_RADIUS * 2 + 1 },
      (_, index) => {
        const virtualPosition = settledVirtual + index - VIRTUAL_RADIUS
        const logicalIndex = modulo(virtualPosition, count)
        return {
          logicalIndex,
          virtualPosition,
          key: `${captures[logicalIndex].id}:virtual:${virtualPosition}`,
        }
      },
    )
  }, [captures, count, settledVirtual, twoItemSide])

  const cards = layout.width > 0 && stageHeight > 0 && cardWidth > 0 && cardHeight > 0 ? (
    <View style={[s.stage, { height: stageHeight }]} collapsable={false}>
      {cardModels.map(({ key, logicalIndex, virtualPosition }) => {
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
            twoItemSide={twoItemSide}
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
    </View>
  ) : null

  return (
    <View style={s.root} onLayout={onLayout} pointerEvents="box-none">
      {count > 1 && cards ? <GestureDetector gesture={pan}>{cards}</GestureDetector> : cards}
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
    shadowColor: colors.black,
    shadowOpacity: 0.34,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 5 },
    elevation: 8,
  },
  pressTarget: {
    width: '100%',
    height: '100%',
  },
  cardShadow: {
    flex: 1,
    borderRadius: radius.xl,
    backgroundColor: colors.feedSurfaceSlate,
  },
  cardFrame: {
    flex: 1,
    overflow: 'hidden',
    borderRadius: radius.xl,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.36)',
    backgroundColor: colors.feedSurfaceSlate,
  },
  imageFallback: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    paddingHorizontal: 16,
    backgroundColor: colors.feedSurfaceSlate,
  },
  fallbackMark: {
    width: 26,
    height: 26,
    borderRadius: radius.full,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.58)',
    color: 'rgba(255,255,255,0.78)',
    fontFamily: fonts.bold,
    fontSize: 15,
    lineHeight: 24,
    textAlign: 'center',
  },
  fallbackText: {
    color: 'rgba(255,255,255,0.7)',
    fontFamily: fonts.medium,
    fontSize: 12,
    textAlign: 'center',
  },
  emoji: {
    position: 'absolute',
    textAlign: 'center',
    textShadowColor: 'rgba(0,0,0,0.2)',
    textShadowRadius: 2,
    textShadowOffset: { width: 0, height: 1 },
  },
  avatarRing: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderWidth: 2.5,
    borderColor: colors.white,
    backgroundColor: colors.feedSurface,
    shadowColor: colors.black,
    shadowOpacity: 0.35,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 2 },
    elevation: 10,
  },
})
