import React, { memo, useCallback, useEffect, useMemo, useState } from 'react'
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
  Easing,
  Extrapolation,
  ReduceMotion,
  cancelAnimation,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated'

import AvatarImage from '../../components/AvatarImage'
import BrandAvatarRing from '../../components/BrandAvatarRing'
import CircleMediaComposition, { circleDiscRect } from '../../components/CircleMediaComposition'
import Icon from '../../components/Icon'
import { confirm } from '../../components/confirm'
import useCircleJoinAction, { performCircleJoinAction } from '../../hooks/useCircleJoinAction'
import { useT } from '../../i18n'
import * as circle from '../../services/circle.service'
import { useAuthStore } from '../../store/auth.store'
import { useCircleJoinStore } from '../../store/circleJoin.store'
import { colors, radius, spacing } from '../../theme'
import type { Post } from '../../types'
import { toast } from '../../utils/toast'
import { CIRCLE_MAX_SLOTS, CIRCLE_STAGE_WIDTH, circleClusterLayout } from '../HomeScreen/circleCluster'
import {
  circlePerspectives, circleRelation, readPost, type CirclePerspective,
} from '../HomeScreen/homePostShape'
import { feedFill, feedIcon, feedInk, feedLine, feedType } from './tokens'

/**
 * Onde o grupo assenta no espaço livre, de cima para baixo.
 *
 * 0.5 é o centro geométrico, e num ecrã alto o centro geométrico lê-se baixo:
 * a figura parecia estar a escorregar para a coluna de acções. 0.44 sobe o
 * bastante para o olho a achar a meio, sem a encostar ao voltar.
 */
const OPTICAL_CENTRE = 0.44

/** O convite: a altura do botão e o ar entre ele e a figura. */
const INVITE_HEIGHT = 40
const INVITE_GAP = spacing.md2
/**
 * O rosto de quem vê, dentro do convite. É um disco da figura em ponto pequeno —
 * o mesmo anel, o mesmo recorte — para se ler como o lugar que falta preencher.
 */
const INVITE_FACE = 30
const INVITE_RING = 1.5
const INVITE_CUT = 2
const INVITE_BORDER = 1

/** A etiqueta de quem tirou a fotografia aberta. */
const TAG_HEIGHT = 30
const TAG_FACE = 22
/**
 * O que a etiqueta deixa livre de cada lado da fila do topo: o alvo do voltar
 * (48, a 8 da borda) e um degrau de ar. Centrada entre as duas margens, nunca
 * lhe passa por cima.
 */
const TAG_SIDE_CLEARANCE = 64

/** O tamanho de um emoji em fracção da largura da imagem — o da ferramenta de captura. */
const EMOJI_SIZE_FRACTION = 0.14

/** Arrastar para lá da primeira ou da última perspetiva cede, mas só a 30%. */
const EDGE_RESISTANCE = 0.3

/**
 * Abrir e fechar numa curva só, sem mola: a fotografia vem do disco e volta
 * para ele. Um ressalto no fim dizia "olha para mim" a uma coisa que só se
 * quer ver.
 */
const EASE = Easing.bezier(0.2, 0, 0, 1)
const OPEN = { duration: 280, easing: EASE, reduceMotion: ReduceMotion.Never }
const CLOSE = { duration: 220, easing: EASE, reduceMotion: ReduceMotion.Never }

/**
 * Trocar de perspetiva segue o dedo e assenta sem passar do sítio. A velocidade
 * do gesto entra na mola, por isso um toque rápido e um arrasto lento acabam
 * ambos com a mesma naturalidade.
 */
const PAGE_SPRING = {
  stiffness: 320,
  damping: 34,
  mass: 1,
  overshootClamping: true,
  reduceMotion: ReduceMotion.Never,
}

interface Props {
  post: Post
  reduceMotion: boolean
  /** Só a célula à vista guarda uma fotografia aberta. */
  isActive: boolean
  /** O que o cromado do topo ocupa, a partir do topo da mídia. */
  topInset: number
  /** O que a coluna de acções ocupa, a partir do fundo da mídia. */
  bottomInset: number
  /** A fila onde o cromado assenta o voltar — a etiqueta da fotografia alinha por ela. */
  chromeRow: { top: number; height: number }
  /** Leva ao separador Círculo. Sem isto não há convite por baixo da figura. */
  onCreateCircle?: () => void
}

function clamp01(value: number) {
  return Math.max(0, Math.min(1, value))
}

function firstName(name: string | null | undefined): string {
  return (name ?? '').trim().split(/\s+/)[0] ?? ''
}

// ─── O convite ───────────────────────────────────────────────────────────────

/**
 * O convite por baixo da figura.
 *
 * Vivia como o último cartão do carrossel. Sem carrossel, passa a ser o que a
 * figura deixa em aberto: um rosto num disco igual aos de cima, ao lado de uma
 * frase. Não é mais um disco dentro da figura de propósito — a figura é de quem
 * lá esteve, e acrescentar-lhe alguém mudava-lhe a forma.
 *
 * O que diz depende de quem está a ver (ver `useCircleJoinAction`):
 *
 *   · não esteve lá mas segue alguém que esteve — "Juntar-me a este círculo",
 *     com o próprio rosto no anel tracejado de quem chega depois;
 *   · já pediu — "Pedido enviado"; tocar deixa desistir;
 *   · é o anfitrião e há pedidos — quantos, com o rosto de quem pediu primeiro;
 *   · de resto — "Começa um círculo", o convite a fazer o seu.
 */
const CircleInvite = memo(function CircleInvite({
  post,
  onCreateCircle,
}: {
  post: Post
  onCreateCircle?: () => void
}) {
  const t = useT()
  const me = useAuthStore((state) => state.user)
  const action = useCircleJoinAction(post)
  const momentId = action.relation?.momentId ?? ''
  const firstRequester = useCircleJoinStore((state) => (
    action.kind === 'review'
      ? state.incoming.find((request) => request.momentId === momentId)?.requester
      : undefined
  ))
  const photo = INVITE_FACE - (INVITE_RING + INVITE_CUT) * 2

  let face: { uri: string | null | undefined; name: string | null | undefined } = { uri: me?.avatar, name: me?.name }
  let label: string
  let hint: string | undefined
  let muted = false
  let onPress: () => void = () => {
    performCircleJoinAction(action, t, (message) => toast.error(t.circle_errTitle, message)).catch(() => {})
  }

  switch (action.kind) {
    case 'review':
      face = { uri: firstRequester?.avatar, name: firstRequester?.name }
      label = action.count === 1
        ? t.circleJoin_review_one
        : t.circleJoin_review_many.replace('{count}', String(action.count))
      break
    case 'join':
      label = t.circleJoin_join
      hint = t.circleJoin_cameraHint
      break
    case 'pending':
      label = t.circleJoin_pending
      muted = true
      break
    default:
      if (!onCreateCircle) return null
      label = t.circle_feedCtaTitle
      hint = t.circle_feedCtaSub
      onPress = onCreateCircle
  }

  // O anel tracejado é o lugar de quem chega depois — é isso que se oferece,
  // pede ou decide nos três casos em que ele aparece.
  const dashed = action.kind !== 'none'

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [s.invite, pressed && s.invitePressed]}
      // 40 de altura à vista, 48 ao dedo.
      hitSlop={{ top: 4, bottom: 4 }}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={hint}
    >
      <View style={s.inviteFace}>
        <AvatarImage uri={face.uri} name={face.name} size={photo} />
        <BrandAvatarRing size={INVITE_FACE} strokeWidth={INVITE_RING} dashed={dashed} style={StyleSheet.absoluteFill} />
      </View>
      <Text style={[s.inviteText, muted && s.inviteTextMuted]} numberOfLines={1} maxFontSizeMultiplier={1.3}>
        {label}
      </Text>
    </Pressable>
  )
})

// ─── Uma perspetiva aberta ───────────────────────────────────────────────────

interface PageProps {
  perspective: CirclePerspective
  index: number
  position: SharedValue<number>
  width: number
  height: number
  failedLabel: string
}

/**
 * Uma fotografia aberta, à altura toda da mídia e sem cortar — como qualquer
 * fotografia da feed. Aqui o objectivo é ver, não compor: `contain`, e os
 * emojis assentam sobre a imagem desenhada e não sobre a caixa.
 *
 * Cada página tem um lugar fixo e só a `position` se move. Quando o índice
 * assenta, as vizinhas que entram já nascem no sítio e as que saem já estavam
 * fora do ecrã: nada salta entre o fim do gesto e o render seguinte.
 */
const PerspectivePage = memo(function PerspectivePage({
  perspective,
  index,
  position,
  width,
  height,
  failedLabel,
}: PageProps) {
  const { capture, url, size } = perspective
  // As medidas e a falha pertencem ao URL: um post que chega de novo com outra
  // fotografia não herda nem as dimensões nem o erro da anterior.
  const [loaded, setLoaded] = useState<{ url: string; w: number; h: number } | null>(null)
  const [failedUrl, setFailedUrl] = useState<string | null>(null)

  const slide = useAnimatedStyle(() => ({
    transform: [{ translateX: (index - position.value) * width }],
  }), [index, width])

  const known = (size.w ?? 0) > 0 && (size.h ?? 0) > 0
  const measured = loaded?.url === url ? loaded : null
  const sourceW = known ? size.w! : measured?.w
  const sourceH = known ? size.h! : measured?.h
  const fit = sourceW && sourceH ? Math.min(width / sourceW, height / sourceH) : 1
  const drawnW = sourceW ? sourceW * fit : width
  const drawnH = sourceH ? sourceH * fit : height
  const offsetX = (width - drawnW) / 2
  const offsetY = (height - drawnH) / 2
  const emojiSize = drawnW * EMOJI_SIZE_FRACTION
  const overlays = Array.isArray(capture.overlays) ? capture.overlays : []
  const failed = !url || failedUrl === url

  return (
    <Animated.View style={[StyleSheet.absoluteFill, slide]} pointerEvents="none">
      {failed ? (
        <View style={s.failed}>
          <Icon name="image" size={feedIcon.control} color={feedInk.muted} />
          <Text style={s.failedText}>{failedLabel}</Text>
        </View>
      ) : (
        <>
          <Image
            source={{ uri: url }}
            style={StyleSheet.absoluteFill}
            contentFit="contain"
            cachePolicy="disk"
            recyclingKey={`${capture.id}:open`}
            transition={120}
            onError={() => setFailedUrl(url)}
            onLoad={(event) => {
              if (known) return
              const { width: w, height: h } = event.source ?? {}
              if (!w || !h) return
              setLoaded((current) => (
                current?.url === url && current.w === w && current.h === h ? current : { url, w, h }
              ))
            }}
            accessibilityIgnoresInvertColors
          />
          {!!sourceW && !!sourceH && overlays.map((overlay, overlayIndex) => {
            if (!overlay?.emoji) return null
            const x = Number.isFinite(overlay.x) ? clamp01(overlay.x) : 0.5
            const y = Number.isFinite(overlay.y) ? clamp01(overlay.y) : 0.5
            return (
              <Text
                key={`${capture.id}:overlay:${overlayIndex}`}
                style={[
                  s.emoji,
                  {
                    left: offsetX + x * drawnW - emojiSize / 2,
                    top: offsetY + y * drawnH - emojiSize / 2,
                    fontSize: emojiSize,
                    lineHeight: emojiSize * 1.14,
                  },
                ]}
              >
                {overlay.emoji}
              </Text>
            )
          })}
        </>
      )}
    </Animated.View>
  )
})

// ─── O palco ─────────────────────────────────────────────────────────────────

/**
 * Um Círculo na feed imersiva: a mesma figura de discos da Home.
 *
 * Substitui o carrossel de cartões inclinados. A figura é a publicação — não
 * se roda, não se arrasta: vê-se inteira, de uma vez, como na Home. Tocar num
 * disco abre essa fotografia ali mesmo, a crescer a partir dele; com ela aberta,
 * deslizar para o lado passa às outras perspetivas do mesmo momento (é a única
 * maneira de chegar às que não cabem nos seis discos), e tocar fecha-a de volta
 * para o disco de onde está.
 *
 * Arrastar na vertical nunca é deste componente: continua a passar ao post
 * seguinte, com ou sem fotografia aberta.
 */
function CircleMomentStage({
  post,
  reduceMotion,
  isActive,
  topInset,
  bottomInset,
  chromeRow,
  onCreateCircle,
}: Props) {
  const t = useT()
  // A figura lê do mesmo sítio que a Home — é isso que a faz desenhar-se igual.
  const shape = useMemo(() => readPost(post), [post])
  const perspectives = useMemo(() => circlePerspectives(post), [post])
  const count = perspectives.length
  const last = count - 1
  const shown = Math.min(count, CIRCLE_MAX_SLOTS)

  const [box, setBox] = useState({ width: 0, height: 0 })
  const onLayout = useCallback((event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout
    setBox((current) => (
      Math.abs(current.width - width) < 0.5 && Math.abs(current.height - height) < 0.5
        ? current
        : { width, height }
    ))
  }, [])

  // ── Onde a figura assenta ───────────────────────────────────────────────────
  // A largura manda, como na Home: a figura ocupa a largura do ecrã e a altura
  // sai da composição. Só num ecrã baixo, em que ela e o convite não caberiam
  // entre o voltar e a coluna de acções, é que encolhe — inteira, pelo mesmo
  // factor, sem se reorganizar.
  const ratio = useMemo(() => (
    shown > 0 ? circleClusterLayout(shown, CIRCLE_STAGE_WIDTH).height / CIRCLE_STAGE_WIDTH : 1
  ), [shown])
  const free = Math.max(0, box.height - topInset - bottomInset)
  const inviteSpace = onCreateCircle ? INVITE_GAP + INVITE_HEIGHT : 0
  const figureWidth = Math.max(0, Math.min(box.width, (free - inviteSpace) / ratio))
  const figureHeight = figureWidth * ratio
  const groupTop = topInset + Math.max(0, free - figureHeight - inviteSpace) * OPTICAL_CENTRE
  const figureLeft = (box.width - figureWidth) / 2
  const ready = count > 0 && box.width > 0 && figureWidth > 0

  const perspectiveLabel = useCallback(
    (name: string) => t.home_perspective_of.replace('{name}', name),
    [t],
  )

  // ── A fotografia aberta ─────────────────────────────────────────────────────
  // `openIndex` é a perspetiva assente; `position` é onde o dedo a leva. Os dois
  // só diferem durante um gesto.
  const [openIndex, setOpenIndex] = useState<number | null>(null)
  const [closing, setClosing] = useState(false)
  const progress = useSharedValue(0)
  const position = useSharedValue(0)
  const settled = useSharedValue(0)
  const dragOrigin = useSharedValue(0)
  const dragStart = useSharedValue(0)

  const dismiss = useCallback(() => {
    cancelAnimation(progress)
    progress.value = 0
    setOpenIndex(null)
    setClosing(false)
  }, [progress])

  const unmount = useCallback(() => {
    setOpenIndex(null)
    setClosing(false)
  }, [])

  const open = useCallback((index: number) => {
    if (index < 0 || index > last) return
    cancelAnimation(position)
    position.value = index
    settled.value = index
    setOpenIndex(index)
    setClosing(false)
    cancelAnimation(progress)
    progress.value = reduceMotion ? 1 : withTiming(1, OPEN)
  }, [last, position, progress, reduceMotion, settled])

  const close = useCallback(() => {
    if (reduceMotion) {
      dismiss()
      return
    }
    // A camada deixa de apanhar toques logo aqui: quem toca noutro disco
    // enquanto esta ainda está a voltar não tem de esperar por ela.
    setClosing(true)
    cancelAnimation(progress)
    progress.value = withTiming(0, CLOSE, (finished) => {
      if (finished) runOnJS(unmount)()
    })
  }, [dismiss, progress, reduceMotion, unmount])

  const goTo = useCallback((target: number) => {
    const next = Math.max(0, Math.min(last, target))
    if (next === settled.value) return
    settled.value = next
    setOpenIndex(next)
    cancelAnimation(position)
    position.value = reduceMotion ? next : withSpring(next, PAGE_SPRING)
  }, [last, position, reduceMotion, settled])

  // Rolar para outro post fecha o que estava aberto: uma fotografia em grande
  // não pode ficar pendurada sobre um momento que já não se vê.
  useEffect(() => {
    if (!isActive) dismiss()
  }, [dismiss, isActive])

  // As mesmas capturas continuam abertas numa actualização do post; outras não.
  const signature = useMemo(
    () => perspectives.map((perspective) => perspective.capture.id).join('|'),
    [perspectives],
  )
  useEffect(() => {
    dismiss()
  }, [dismiss, signature])

  const pageWidth = Math.max(1, box.width)

  const pan = useMemo(() => Gesture.Pan()
    // O gesto só vence quando a intenção horizontal é inequívoca. Um arrasto
    // vertical falha cedo e segue para o pager da feed sem ficar preso aqui.
    .activeOffsetX([-11, 11])
    .failOffsetY([-9, 9])
    .maxPointers(1)
    .onStart((event) => {
      cancelAnimation(position)
      dragOrigin.value = position.value
      // `translationX` já traz os pontos gastos a activar o gesto; sem guardar
      // a base, a fotografia dava um salto de 11pt ao arrancar.
      dragStart.value = event.translationX
    })
    .onUpdate((event) => {
      const raw = dragOrigin.value - (event.translationX - dragStart.value) / pageWidth
      const near = Math.max(settled.value - 1, Math.min(settled.value + 1, raw))
      position.value = near < 0
        ? near * EDGE_RESISTANCE
        : near > last ? last + (near - last) * EDGE_RESISTANCE : near
    })
    .onEnd((event, success) => {
      let target = settled.value
      const velocity = success ? -event.velocityX / pageWidth : 0
      if (success) {
        const distance = position.value - settled.value
        const direction = Math.sign(distance)
        // Arrastou para a frente mas está a devolver a fotografia depressa:
        // quer ficar onde estava, não andar para trás nem para a frente.
        const returning = velocity * direction < -0.3
        const advance = direction !== 0 && !returning
          && (Math.abs(distance) > 0.22 || velocity * direction > 0.5)
        if (advance) target = Math.max(0, Math.min(last, settled.value + direction))
      }
      if (target !== settled.value) {
        settled.value = target
        runOnJS(setOpenIndex)(target)
      }
      position.value = reduceMotion
        ? target
        : withSpring(target, { ...PAGE_SPRING, velocity })
    }), [dragOrigin, dragStart, last, pageWidth, position, reduceMotion, settled])

  const tap = useMemo(() => Gesture.Tap()
    .maxDistance(10)
    .onEnd((_event, success) => {
      if (success) runOnJS(close)()
    }), [close])

  // Com uma só perspetiva não há para onde deslizar, e um Pan desligado dentro
  // de um `Exclusive` deixaria o toque à espera de uma falha que nunca chega.
  const gesture = useMemo(
    () => (count > 1 ? Gesture.Exclusive(pan, tap) : tap),
    [count, pan, tap],
  )

  // De onde a fotografia sai e para onde volta: o disco da perspetiva aberta.
  // Uma perspetiva que não coube nos seis discos volta ao do `+N`, que é quem a
  // representa na figura.
  const origin = useMemo(() => {
    const fallback = { x: 0, y: 0, scale: 0.4 }
    if (openIndex === null || !ready) return fallback
    const disc = circleDiscRect(count, figureWidth, openIndex)
    if (!disc) return fallback
    return {
      x: figureLeft + disc.x + disc.d / 2 - box.width / 2,
      y: groupTop + disc.y + disc.d / 2 - box.height / 2,
      scale: disc.d / Math.max(1, Math.min(box.width, box.height)),
    }
  }, [box.height, box.width, count, figureLeft, figureWidth, groupTop, openIndex, ready])

  // O fundo não cresce: escurece no lugar, e a figura apaga-se por baixo
  // enquanto a fotografia sai do disco.
  const backdropStyle = useAnimatedStyle(() => ({ opacity: progress.value }))

  const photoStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0, 0.2], [0, 1], Extrapolation.CLAMP),
    transform: [
      { translateX: interpolate(progress.value, [0, 1], [origin.x, 0]) },
      { translateY: interpolate(progress.value, [0, 1], [origin.y, 0]) },
      { scale: interpolate(progress.value, [0, 1], [origin.scale, 1], Extrapolation.CLAMP) },
    ],
  }), [origin.scale, origin.x, origin.y])

  // A etiqueta chega depois da fotografia: só se lê quando ela já assentou.
  const tagStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0.55, 1], [0, 1], Extrapolation.CLAMP),
  }))

  const current = openIndex !== null && openIndex <= last ? perspectives[openIndex] : undefined
  const currentName = current?.participant?.name?.trim()
    || current?.participant?.username?.trim()
    || ''
  const currentLate = current?.capture.late === true

  // Retirar a fotografia aberta: a minha, ou — sendo eu o anfitrião — a de
  // quem entrou depois, porque fui eu que a deixei entrar.
  const myId = useAuthStore((state) => state.user?.id)
  const relation = useMemo(() => circleRelation(post, myId), [myId, post])
  const canRemoveCurrent = !!current && !!relation && !!myId && (
    current.capture.userId === myId || (currentLate && relation.isHost)
  )
  const [removing, setRemoving] = useState(false)
  const removeCurrent = useCallback(async () => {
    if (!current || !relation || removing) return
    const ok = await confirm({
      title: t.circleJoin_removeOneTitle,
      message: t.circleJoin_removeOneMsg,
      confirmText: t.circleJoin_removeConfirm,
      destructive: true,
    })
    if (!ok) return
    setRemoving(true)
    try {
      await circle.removeMomentPhotos(relation.momentId, current.capture.id)
      close()
      toast.success(t.circleJoin_removed)
    } catch (err: any) {
      toast.error(t.circle_errTitle, err?.response?.data?.message || t.circleJoin_removeFailed)
    } finally {
      setRemoving(false)
    }
  }, [close, current, relation, removing, t])

  const handleAccessibilityAction = useCallback((event: AccessibilityActionEvent) => {
    if (openIndex === null) return
    switch (event.nativeEvent.actionName) {
      case 'activate':
        close()
        break
      case 'increment':
        goTo(openIndex + 1)
        break
      case 'decrement':
        goTo(openIndex - 1)
        break
    }
  }, [close, goTo, openIndex])

  const pages: React.ReactNode[] = []
  if (current && openIndex !== null) {
    for (let index = Math.max(0, openIndex - 1); index <= Math.min(last, openIndex + 1); index++) {
      pages.push(
        <PerspectivePage
          key={perspectives[index].capture.id}
          perspective={perspectives[index]}
          index={index}
          position={position}
          width={box.width}
          height={box.height}
          failedLabel={t.home_media_failed}
        />,
      )
    }
  }

  return (
    <View style={StyleSheet.absoluteFill} onLayout={onLayout} pointerEvents="box-none">
      {ready && (
        <View style={[s.group, { top: groupTop }]} pointerEvents="box-none">
          <CircleMediaComposition
            slots={shape.slots}
            people={shape.people}
            width={figureWidth}
            postId={post.id}
            onDark
            onSelect={open}
            perspectiveLabel={perspectiveLabel}
            lateLabel={t.circleJoin_lateA11y}
          />
          {onCreateCircle && (
            <View style={s.inviteSlot}>
              <CircleInvite post={post} onCreateCircle={onCreateCircle} />
            </View>
          )}
        </View>
      )}

      {ready && current && openIndex !== null && (
        <GestureDetector gesture={gesture}>
          <View
            style={StyleSheet.absoluteFill}
            pointerEvents={closing ? 'none' : 'auto'}
            accessible
            accessibilityRole={count > 1 ? 'adjustable' : 'button'}
            accessibilityLabel={t.circle_photoOf
              .replace('{name}', currentName)
              .replace('{index}', String(openIndex + 1))
              .replace('{total}', String(count))}
            accessibilityHint={t.circle_photoClose}
            accessibilityValue={count > 1
              ? { min: 1, max: count, now: openIndex + 1, text: `${openIndex + 1} / ${count}` }
              : undefined}
            accessibilityActions={count > 1
              ? [
                { name: 'activate', label: t.circle_photoClose },
                { name: 'increment', label: t.circle_photoNext },
                { name: 'decrement', label: t.circle_photoPrev },
              ]
              : [{ name: 'activate', label: t.circle_photoClose }]}
            onAccessibilityAction={handleAccessibilityAction}
          >
            <Animated.View style={[s.backdrop, backdropStyle]} pointerEvents="none" />
            <Animated.View style={[s.photoLayer, photoStyle]} pointerEvents="none">
              {pages}
            </Animated.View>

            <Animated.View
              style={[s.tagRow, { top: chromeRow.top + (chromeRow.height - TAG_HEIGHT) / 2 }, tagStyle]}
              pointerEvents="none"
            >
              <View style={s.tag}>
                <AvatarImage uri={current.participant?.avatar} name={currentName} size={TAG_FACE} />
                {!!currentName && (
                  <Text style={s.tagName} numberOfLines={1} maxFontSizeMultiplier={1.2}>
                    {firstName(currentName)}
                  </Text>
                )}
                {/* O selo, dito por extenso: com a fotografia em grande já não
                    há anel tracejado à vista para o dizer. */}
                {currentLate && (
                  <Text style={s.tagLate} numberOfLines={1} maxFontSizeMultiplier={1.2}>
                    {t.circleJoin_late}
                  </Text>
                )}
                {count > 1 && (
                  <Text style={s.tagCount} maxFontSizeMultiplier={1.2}>
                    {openIndex + 1}/{count}
                  </Text>
                )}
              </View>
            </Animated.View>
          </View>
        </GestureDetector>
      )}

      {/* Fora do detector de gestos: um toque aqui retira, não fecha. Na fila
          do voltar, do lado oposto — onde o cromado não tem nada. */}
      {ready && current && openIndex !== null && canRemoveCurrent && (
        <Animated.View
          style={[s.removeSlot, { top: chromeRow.top, height: chromeRow.height }, tagStyle]}
          pointerEvents={closing ? 'none' : 'box-none'}
        >
          <Pressable
            onPress={removeCurrent}
            disabled={removing}
            style={({ pressed }) => [s.removeButton, pressed && s.invitePressed]}
            accessibilityRole="button"
            accessibilityLabel={t.circleJoin_removeOne}
            accessibilityState={{ busy: removing }}
          >
            <Icon name="trash" size={feedIcon.control} color={feedInk.primary} />
          </Pressable>
        </Animated.View>
      )}
    </View>
  )
}

export default memo(CircleMomentStage)

const s = StyleSheet.create({
  group: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
  },

  // Convite — o contorno é o dos botões da imersiva, um degrau abaixo do de
  // seguir: está sobre o fundo liso, não sobre uma fotografia, e não precisa de
  // gritar para se ver.
  inviteSlot: { marginTop: INVITE_GAP },
  invite: {
    height: INVITE_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    // O rosto fica concêntrico com a ponta redonda do botão.
    paddingLeft: (INVITE_HEIGHT - INVITE_BORDER * 2 - INVITE_FACE) / 2,
    paddingRight: spacing.md,
    borderRadius: radius.full,
    borderWidth: INVITE_BORDER,
    borderColor: feedLine.medium,
  },
  invitePressed: { backgroundColor: feedFill.press },
  inviteFace: {
    width: INVITE_FACE,
    height: INVITE_FACE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inviteText: {
    ...feedType.primary,
    flexShrink: 1,
    color: feedInk.secondary,
  },
  inviteTextMuted: { color: feedInk.muted },

  // Fotografia aberta — por baixo do autor e das acções, que continuam a ler-se
  // por cima dela como em qualquer fotografia da feed.
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.feedSurface,
  },
  photoLayer: {
    ...StyleSheet.absoluteFillObject,
    // As vizinhas esperam fora da caixa. Sem o recorte, enquanto a camada
    // cresce a partir do disco, elas apareciam ao lado dela.
    overflow: 'hidden',
  },
  failed: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.xl,
  },
  failedText: {
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

  // Etiqueta — na fila do voltar, ao centro. O fundo é o local que o Feed
  // System pede para texto sobre mídia: só por baixo das letras, nunca um véu.
  tagRow: {
    position: 'absolute',
    left: TAG_SIDE_CLEARANCE,
    right: TAG_SIDE_CLEARANCE,
    height: TAG_HEIGHT,
    alignItems: 'center',
  },
  tag: {
    maxWidth: '100%',
    height: TAG_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingLeft: (TAG_HEIGHT - TAG_FACE) / 2,
    paddingRight: spacing.sm2,
    borderRadius: radius.full,
    backgroundColor: 'rgba(11,20,26,0.56)',
  },
  tagName: {
    ...feedType.primary,
    flexShrink: 1,
    color: feedInk.primary,
  },
  tagLate: {
    ...feedType.meta,
    color: feedInk.muted,
  },
  // O retirar ocupa o canto da fila do voltar que o cromado deixa livre, com o
  // mesmo alvo de 48.
  removeSlot: {
    position: 'absolute',
    right: spacing.sm,
    width: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  removeButton: {
    width: 40,
    height: 40,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(11,20,26,0.56)',
  },
  tagCount: {
    ...feedType.meta,
    color: feedInk.muted,
    fontVariant: ['tabular-nums'],
  },
})
