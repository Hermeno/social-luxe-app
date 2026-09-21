import React, { useEffect, useRef } from 'react'
import { Animated, Pressable, StyleSheet, Text } from 'react-native'
import PostActionIcon, { type PostActionIconName } from '../../components/PostActionIcon'
import { spacing } from '../../theme'
import { formatCount } from '../../utils/count'
import { actionInkActive, actionInkRest, feedIcon, homeType, pageInk } from '../FeedScreen/tokens'

interface Props {
  name: PostActionIconName
  label: string
  count: number
  selected?: boolean
  onPress: () => void
  trailing?: boolean
  reduceMotion: boolean
}

/**
 * Uma acção da Home — o glifo e, quando existe actividade, o número ao lado.
 *
 * A tinta de repouso é a da página (`actionInkRest.page`): um comando não compete
 * com a fotografia nem com o nome, mas tem de se ler. O estado accionado sobe
 * para preto — o desenho já mudou (o coração encheu-se), e a tinta só sublinha,
 * sem trazer uma terceira cor para dentro da publicação.
 */
export default function HomePostAction({
  name, label, count, selected, onPress, trailing = false, reduceMotion,
}: Props) {
  const scale = useRef(new Animated.Value(1)).current
  const ink = selected ? actionInkActive.page : actionInkRest.page

  useEffect(() => {
    if (reduceMotion) { scale.stopAnimation(); scale.setValue(1) }
    return () => scale.stopAnimation()
  }, [reduceMotion, scale])

  function animate(toValue: number) {
    if (reduceMotion) return
    // 160ms de ida e volta, que é o que a spec reserva ao feedback de gosto.
    Animated.spring(scale, { toValue, speed: 32, bounciness: 5, useNativeDriver: true }).start()
  }

  return (
    <Pressable
      style={[s.hit, trailing && s.trailing]}
      // A caixa mede o que o par mede; os 6 de cada lado levam o alvo aos 44
      // sem alargar o desenho. Com 12 de intervalo entre acções, os alvos
      // encostam-se sem se sobreporem — ninguém rouba o toque ao vizinho.
      hitSlop={{ top: 0, bottom: 0, left: spacing.xs2, right: spacing.xs2 }}
      onPress={onPress}
      onPressIn={() => animate(0.9)}
      onPressOut={() => animate(1)}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityValue={{ text: String(Math.max(0, count)) }}
      accessibilityState={selected === undefined ? undefined : { selected }}
    >
      <Animated.View
        style={[s.content, trailing && s.contentTrailing, { transform: [{ scale }] }]}
        pointerEvents="none"
      >
        <PostActionIcon name={name} size={feedIcon.action} color={ink} selected={selected} />
        {count > 0 && (
          <Text style={s.metric} maxFontSizeMultiplier={1.3} numberOfLines={1}>
            {formatCount(count)}
          </Text>
        )}
      </Animated.View>
    </Pressable>
  )
}

const s = StyleSheet.create({
  // Sem largura mínima: uma acção sem contagem ficava numa caixa de 44 com o
  // glifo encostado à esquerda, e os 12 de folga que sobravam somavam-se ao
  // intervalo seguinte. O resultado era uma fila que mudava de cadência
  // conforme houvesse ou não números — ver o `hitSlop` acima.
  hit: { minHeight: 48, justifyContent: 'center' },
  trailing: { marginLeft: 'auto' },
  // 2pt entre o desenho e o número, e não mais: o glifo já traz 5,5 de vazio
  // dentro da própria caixa (ver `FEED_GLYPH_INK_INSET`), e somar-lhe um degrau
  // inteiro da escada separava um par que se lê como uma coisa só.
  content: { flexDirection: 'row', alignItems: 'center', gap: spacing.xxs },
  // A última acção da fila espelha o par: o glifo fica sempre por fora, e é a
  // tinta dele — nunca a largura variável de um número — que assenta na margem
  // direita da página, tal como o primeiro glifo assenta na esquerda.
  contentTrailing: { flexDirection: 'row-reverse' },
  metric: {
    // O número é texto: fica na tinta de leitura da página, não na do glifo.
    color: pageInk.secondary,
    fontVariant: ['tabular-nums'],
    ...homeType.metric,
  },
})
