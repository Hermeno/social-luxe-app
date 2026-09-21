import React, { memo, useCallback, useRef, useState } from 'react'
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native'
import { Image } from 'expo-image'

import { fonts } from '../../theme'
import { feedInk, pageSkeleton } from '../FeedScreen/tokens'

/**
 * A galeria de um álbum na Home.
 *
 * As medidas são as da base 390 do Feed System e escalam com a largura real:
 *
 *   item dominante   316 × 246
 *   margem lateral    37   — o que sobra de 390 depois do item
 *   intervalo         16   — entre um item e o seguinte
 *   espreitadela      21   — a fatia do item seguinte que fica à vista
 *
 * Os quatro números fecham um no outro: `37 = 21 + 16`, e é isso que faz a
 * fotografia seguinte assomar exactamente à margem esquerda da página em vez de
 * um valor escolhido a olho. O passo do snap é `316 + 16`.
 *
 * Não há setas: em telemóvel a espreitadela já diz que há mais, e uma seta
 * permanente é cromado a ocupar mídia. O indicador `1 / N` fica pequeno, no
 * canto, e é a única sobreposição.
 */
const BASE_WIDTH = 390
const BASE_ITEM = 316
const BASE_HEIGHT = 246
const BASE_SIDE = 37
const BASE_GAP = 16

/** Quanto encolhe a fotografia que ainda não está no centro. */
const PEEK_SCALE = 214 / BASE_HEIGHT
const PEEK_OPACITY = 0.72

interface Props {
  urls: string[]
  width: number
  postId: string
  reduceMotion?: boolean
  /** Rótulo de acessibilidade da publicação inteira. */
  label: string
  /** `{index} / {total}` já traduzido por quem chama. */
  counter: (index: number, total: number) => string
  onOpen: () => void
}

function HomeAlbumGallery({ urls, width, postId, reduceMotion = false, label, counter, onOpen }: Props) {
  const scale = width / BASE_WIDTH
  const item = BASE_ITEM * scale
  const height = BASE_HEIGHT * scale
  const side = BASE_SIDE * scale
  const gap = BASE_GAP * scale
  const step = item + gap

  const [index, setIndex] = useState(0)
  const scrollX = useRef(new Animated.Value(0)).current

  const onScroll = useRef(
    Animated.event([{ nativeEvent: { contentOffset: { x: scrollX } } }], { useNativeDriver: true }),
  ).current

  const onMomentumEnd = useCallback((event: { nativeEvent: { contentOffset: { x: number } } }) => {
    const next = Math.round(event.nativeEvent.contentOffset.x / step)
    setIndex(Math.max(0, Math.min(next, urls.length - 1)))
  }, [step, urls.length])

  return (
    // Sem `accessibilityRole` na caixa: um botão à volta de uma lista que se
    // arrasta rouba o gesto ao leitor de ecrã. Quem é botão é cada fotografia.
    <View style={{ height }}>
      <Animated.ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        // Passo, e não `pagingEnabled`: a página não mede a largura do ecrã —
        // mede o item mais o intervalo, que é o que põe a fotografia seguinte
        // na mesma posição em que estava a anterior.
        snapToInterval={step}
        decelerationRate="fast"
        // Sem isto, no iOS, arrastar na diagonal dentro de uma lista vertical
        // move as duas ao mesmo tempo. A intenção horizontal tem de ganhar
        // sozinha ou perder inteira.
        directionalLockEnabled
        contentContainerStyle={{ paddingHorizontal: side, gap }}
        onScroll={onScroll}
        onMomentumScrollEnd={onMomentumEnd}
        scrollEventThrottle={16}
      >
        {urls.map((url, i) => {
          const centre = i * step
          const range = [centre - step, centre, centre + step]
          const shrink = reduceMotion
            ? 1
            : scrollX.interpolate({
                inputRange: range,
                outputRange: [PEEK_SCALE, 1, PEEK_SCALE],
                extrapolate: 'clamp',
              })
          const fade = reduceMotion
            ? 1
            : scrollX.interpolate({
                inputRange: range,
                outputRange: [PEEK_OPACITY, 1, PEEK_OPACITY],
                extrapolate: 'clamp',
              })

          return (
            <Animated.View
              key={`${postId}:${i}`}
              style={[
                s.slide,
                { width: item, height, transform: [{ scale: shrink }], opacity: fade },
              ]}
            >
              <Pressable
                style={StyleSheet.absoluteFill}
                onPress={onOpen}
                accessibilityRole="button"
                accessibilityLabel={`${label} · ${counter(i + 1, urls.length)}`}
              >
                <Image
                  source={{ uri: url }}
                  style={s.photo}
                  contentFit="cover"
                  cachePolicy="disk"
                  recyclingKey={`${postId}:album:${i}`}
                  transition={reduceMotion ? 0 : 160}
                />
              </Pressable>
            </Animated.View>
          )
        })}
      </Animated.ScrollView>

      <View style={[s.counter, { right: side + 10 * scale, bottom: 12 * scale }]} pointerEvents="none">
        <Text style={s.counterText} maxFontSizeMultiplier={1.2}>
          {counter(index + 1, urls.length)}
        </Text>
      </View>
    </View>
  )
}

export default memo(HomeAlbumGallery)

const s = StyleSheet.create({
  slide: { borderRadius: 18, overflow: 'hidden', backgroundColor: pageSkeleton },
  photo: { width: '100%', height: '100%' },
  counter: {
    position: 'absolute',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
    backgroundColor: 'rgba(11,20,26,0.76)',
  },
  counterText: {
    color: feedInk.primary,
    fontFamily: fonts.semiBold,
    fontSize: 10,
    lineHeight: 13,
    fontVariant: ['tabular-nums'],
  },
})
