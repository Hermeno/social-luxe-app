import React, { memo, useMemo } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { Image } from 'expo-image'

import BrandAvatarRing from './BrandAvatarRing'
import { colors, fonts } from '../theme'
import { feedInk, feedSkeleton, pageSkeleton } from '../screens/FeedScreen/tokens'
import {
  CIRCLE_MAX_SLOTS, circleClusterLayout, circleHasCentre, type ClusterDisc,
} from '../screens/HomeScreen/circleCluster'

export interface CircleSlot {
  /** URL já resolvido da fotografia desta perspetiva. */
  url: string
  /** Nome de quem a tirou. O rótulo mostra só o primeiro. */
  name?: string | null
  /** Entrou no Círculo depois do disparo — desenha-se com o anel tracejado. */
  late?: boolean
}

interface Props {
  /** Perspetivas na ordem de captura. Mais do que cabem: as extras contam no `+N`. */
  slots: CircleSlot[]
  /** Total de participantes do momento — pode ser maior que `slots`. */
  people?: number
  /** Largura disponível; a altura sai da composição. */
  width: number
  /** Identidade da publicação: entra nas chaves de reciclagem das imagens. */
  postId: string
  /**
   * Quem está no meio. Só as composições de cinco ou mais têm slot central;
   * abaixo disso o valor é ignorado e a ordem é a de captura.
   */
  activeIndex?: number
  /** Quando existe, cada perspetiva passa a ser um botão. */
  onSelect?: (index: number) => void
  /** Sobre a página branca ou sobre o fundo escuro da imersiva. */
  onDark?: boolean
  /** Rótulo com o primeiro nome. Por omissão só a partir de três perspetivas. */
  showLabels?: boolean
  /** "Ver perspetiva de {nome}" — a frase vem do i18n de quem chama. */
  perspectiveLabel?: (name: string) => string
  /** Acrescentado ao rótulo de uma perspetiva tardia — ", chegou depois". */
  lateLabel?: string
}

/**
 * Espessura do recorte entre discos sobrepostos.
 *
 * Não é moldura: é da cor da superfície. Serve para dois discos que se tocam não
 * se fundirem num borrão — sem ele, duas fotografias escuras encostadas lêem-se
 * como uma mancha só.
 */
const CUT = 3

/** Traço do anel de identidade, em fracção do diâmetro do disco. */
const RING_RATIO = 0.019
const RING_MIN = 2

/** Abaixo deste diâmetro um rótulo deixa de caber sem tapar o rosto. */
const LABEL_MIN_DIAMETER = 92

function firstName(name: string | null | undefined): string {
  return (name ?? '').trim().split(/\s+/)[0] ?? ''
}

/**
 * A que disco vai cada perspetiva.
 *
 * A ordem dos participantes é a mesma em todo o lado — é o que faz a Home e a
 * imersiva desenharem a mesma figura. O que muda entre as duas é **quem está no
 * meio**: nas composições com centro, quem está activo assume-o e os restantes
 * seguem-no ciclicamente, mantendo-se na ordem relativa em que foram capturados.
 *
 * Sem centro (duas, três ou quatro perspetivas) os discos são todos iguais e não
 * há nada a promover: cada um fica no seu lugar.
 */
function arrangement(count: number, activeIndex: number): number[] {
  const discOf = new Array<number>(count)
  if (!circleHasCentre(count)) {
    for (let i = 0; i < count; i++) discOf[i] = i
    return discOf
  }
  const active = ((activeIndex % count) + count) % count
  discOf[active] = 0
  for (let step = 1; step < count; step++) {
    discOf[(active + step) % count] = step
  }
  return discOf
}

/**
 * Onde fica o disco de uma perspetiva, na caixa da composição.
 *
 * Para quem precisa de saber de onde sai uma fotografia sem montar a figura —
 * a imersiva abre a foto a crescer a partir do disco em que se tocou. Usa as
 * mesmas duas contas que a figura: a tabela de posições e quem está no meio.
 * Uma perspetiva para lá do último disco cai nele, que é o que carrega o `+N`.
 */
export function circleDiscRect(
  slots: number,
  width: number,
  index: number,
  activeIndex = 0,
): ClusterDisc | undefined {
  const shown = Math.min(slots, CIRCLE_MAX_SLOTS)
  if (shown <= 0) return undefined
  const layout = circleClusterLayout(shown, width)
  const discOf = arrangement(shown, activeIndex)
  return layout.discs[discOf[Math.min(Math.max(0, index), shown - 1)]]
}

/**
 * A composição circular de um Círculo.
 *
 * É o elemento visual da publicação, não uma ilustração dentro dela: não leva
 * cartão, moldura, sombra nem fundo próprio. As fotografias assentam na
 * superfície e a figura que formam é o post.
 *
 * Partilhada entre a Home e a imersiva de propósito — é a única maneira de a
 * mesma publicação se desenhar igual dos dois lados, que é o que a spec pede.
 * A geometria vive em `circleCluster.ts`, separada porque é matemática pura e
 * verificável contra o documento sem montar nada.
 */
function CircleMediaComposition({
  slots, people, width, postId, activeIndex = 0, onSelect, onDark = false,
  showLabels, perspectiveLabel, lateLabel,
}: Props) {
  // A figura desenha-se com as fotografias que existem — nunca com o número de
  // participantes. Uma ronda pode acabar com seis pessoas e quatro capturas, e
  // aí a composição é de quatro; quem não fotografou entra na contagem do `+N`,
  // que é onde a informação pertence, e não num disco vazio.
  const shown = slots.slice(0, CIRCLE_MAX_SLOTS)
  const total = Math.max(people ?? shown.length, slots.length)
  const extra = Math.max(0, total - shown.length)

  const layout = useMemo(() => circleClusterLayout(shown.length, width), [shown.length, width])
  const discOf = useMemo(() => arrangement(shown.length, activeIndex), [shown.length, activeIndex])

  const labels = showLabels ?? shown.length >= 3
  const cut = onDark ? colors.feedSurface : colors.white
  const well = { backgroundColor: onDark ? feedSkeleton : pageSkeleton }

  return (
    <View style={{ width, height: layout.height }}>
      {shown.map((slot, index) => {
        const disc = layout.discs[discOf[index]]
        if (!disc) return null

        const ring = Math.max(RING_MIN, disc.d * RING_RATIO)
        const inset = ring + CUT
        const photo = disc.d - inset * 2
        const label = labels ? firstName(slot.name) : ''
        // O último slot é o que absorve quem não coube. Continua a ser uma
        // fotografia real por baixo — a spec é explícita: nunca um ponto.
        const overflow = extra > 0 && index === shown.length - 1
        const name = firstName(slot.name)
        const late = slot.late === true
        const a11y = overflow
          ? `+${extra}`
          : `${name && perspectiveLabel ? perspectiveLabel(name) : name}${late && lateLabel ? lateLabel : ''}`

        const face = (
          <>
            <View
              style={[
                s.photoWell,
                well,
                { left: inset, top: inset, width: photo, height: photo, borderRadius: photo / 2 },
              ]}
            >
              {slot.url ? (
                <Image
                  source={{ uri: slot.url }}
                  style={s.photo}
                  contentFit="cover"
                  cachePolicy="disk"
                  recyclingKey={`${postId}:circle:${index}`}
                  transition={140}
                />
              ) : (
                <View style={[s.empty, well]} />
              )}
              {overflow && (
                <View style={s.overflow}>
                  <Text style={s.overflowText} maxFontSizeMultiplier={1.2}>+{extra}</Text>
                </View>
              )}
            </View>
            <BrandAvatarRing size={disc.d} strokeWidth={ring} dashed={late} style={StyleSheet.absoluteFill} />
            {!!label && !overflow && disc.d >= LABEL_MIN_DIAMETER && (
              <View style={[s.labelWrap, { bottom: inset + disc.d * 0.04 }]} pointerEvents="none">
                <Text style={s.label} numberOfLines={1} maxFontSizeMultiplier={1.2}>{label}</Text>
              </View>
            )}
          </>
        )

        const box = {
          left: disc.x,
          top: disc.y,
          width: disc.d,
          height: disc.d,
          borderRadius: disc.d / 2,
          backgroundColor: cut,
          zIndex: disc.z,
        }

        return onSelect ? (
          <Pressable
            key={`${postId}:${index}`}
            style={[s.disc, box]}
            onPress={() => onSelect(index)}
            accessibilityRole="button"
            accessibilityLabel={a11y || undefined}
            accessibilityState={{ selected: discOf[index] === 0 }}
          >
            {face}
          </Pressable>
        ) : (
          <View
            key={`${postId}:${index}`}
            style={[s.disc, box]}
            // Sem `onSelect` a figura é conteúdo, não comando: quem lê o ecrã
            // ouve a publicação inteira pelo botão que a embrulha, e não seis
            // fotografias soltas sem destino.
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
          >
            {face}
          </View>
        )
      })}
    </View>
  )
}

export default memo(CircleMediaComposition)

const s = StyleSheet.create({
  disc: { position: 'absolute' },
  // A cor do poço vem de `onDark`, em linha: a mesma figura assenta na página
  // branca e no fundo da imersiva.
  photoWell: { position: 'absolute', overflow: 'hidden' },
  photo: { width: '100%', height: '100%' },
  empty: { flex: 1 },
  overflow: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(11,20,26,0.52)',
  },
  overflowText: {
    color: feedInk.primary,
    fontFamily: fonts.bold,
    fontSize: 20,
    lineHeight: 24,
    letterSpacing: -0.4,
  },
  labelWrap: {
    position: 'absolute',
    left: '12%',
    right: '12%',
    alignItems: 'center',
  },
  label: {
    maxWidth: '100%',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: 'rgba(11,20,26,0.72)',
    color: feedInk.primary,
    fontFamily: fonts.semiBold,
    fontSize: 9,
    lineHeight: 12,
  },
})
