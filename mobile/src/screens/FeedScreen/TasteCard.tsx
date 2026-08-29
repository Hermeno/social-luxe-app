import React, { useEffect, useRef, useState } from 'react'
import { Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native'
import FeedIcon from '../../components/FeedIcon'
import { colors, radius, spacing } from '../../theme'
import { feedIcon, feedInk, feedLine, feedTextShadow, feedType } from './tokens'
import { useT } from '../../i18n'
import type { TasteSignal } from '../../services/post.service'

interface Props {
  reduceMotion: boolean
  /** A resposta segue já para cima; o cartão fica a agradecer e sai sozinho. */
  onAnswer: (signal: TasteSignal) => void
  /** Fim da despedida — a célula deixa de o desenhar. */
  onDone: () => void
}

// Quanto tempo o agradecimento fica no ecrã antes de o cartão se apagar.
const THANKS_MS = 1500

// ─── Cartão de gosto ────────────────────────────────────────────────────────
// Duas escolhas, sem fundo nenhum: a publicação continua a ser o que se vê e o
// cartão é só uma pergunta pousada por cima. Aparece de vez em quando, nunca
// fixo — se estivesse sempre lá deixava de ser uma pergunta e passava a ser
// mobília, e ninguém responde a mobília.
//
// Os dois lados são desenhados exactamente iguais de propósito: destacar um
// deles inclinava a resposta, e um sinal inclinado ensina o algoritmo errado.
export default function TasteCard({ reduceMotion, onAnswer, onDone }: Props) {
  const t = useT()
  const [answered, setAnswered] = useState(false)

  const enter  = useRef(new Animated.Value(reduceMotion ? 1 : 0)).current
  const thanks = useRef(new Animated.Value(0)).current
  const doneRef = useRef(onDone)
  doneRef.current = onDone
  const thanksTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => () => { if (thanksTimer.current) clearTimeout(thanksTimer.current) }, [])

  useEffect(() => {
    if (reduceMotion) { enter.setValue(1); return }
    Animated.timing(enter, {
      toValue: 1,
      duration: 280,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start()
  }, [enter, reduceMotion])

  function handleAnswer(signal: TasteSignal) {
    if (answered) return
    setAnswered(true)
    onAnswer(signal)

    if (reduceMotion) {
      thanksTimer.current = setTimeout(() => doneRef.current(), THANKS_MS)
      return
    }
    Animated.sequence([
      Animated.timing(thanks, {
        toValue: 1,
        duration: 200,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.delay(THANKS_MS),
      Animated.timing(thanks, { toValue: 2, duration: 260, useNativeDriver: true }),
    ]).start(({ finished }) => { if (finished) doneRef.current() })
  }

  // Uma só opacidade para os dois estados: as escolhas apagam-se enquanto o
  // agradecimento acende, no mesmo sítio, sem a linha saltar.
  const choicesOpacity = answered
    ? thanks.interpolate({ inputRange: [0, 1], outputRange: [1, 0], extrapolate: 'clamp' })
    : enter
  const thanksOpacity = thanks.interpolate({
    inputRange: [0, 1, 2],
    outputRange: [0, 1, 0],
  })

  return (
    <Animated.View
      style={[
        s.wrap,
        !reduceMotion && {
          opacity: answered ? 1 : enter,
          transform: [{ translateY: enter.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) }],
        },
      ]}
      pointerEvents={answered ? 'none' : 'box-none'}
    >
      {answered && (
        <Animated.Text style={[s.thanks, { opacity: thanksOpacity }]} numberOfLines={1}>
          {t.taste_thanks}
        </Animated.Text>
      )}

      <Animated.View style={{ opacity: choicesOpacity }} pointerEvents={answered ? 'none' : 'box-none'}>
        <Text style={s.question} numberOfLines={1}>{t.taste_question}</Text>
        <View style={s.row}>
          <Pressable
            style={({ pressed }) => [s.pill, pressed && s.pillPressed]}
            onPress={() => handleAnswer('LESS')}
            hitSlop={6}
            accessibilityRole="button"
            accessibilityLabel={t.taste_less}
          >
            <Text style={s.pillTxt} numberOfLines={2}>{t.taste_less}</Text>
          </Pressable>

          <Pressable
            style={({ pressed }) => [s.pill, s.pillMore, pressed && s.pillPressed]}
            onPress={() => handleAnswer('MORE')}
            hitSlop={6}
            accessibilityRole="button"
            accessibilityLabel={t.taste_more}
          >
            <Text style={s.pillTxt} numberOfLines={2}>{t.taste_more}</Text>
            {/* O sinal só está do lado do "sim": este é o caminho que continua,
                o outro é o que fecha. A seta diz isso sem gastar palavras. */}
            <FeedIcon name="chevron-right" size={feedIcon.inline} color={feedInk.secondary} />
          </Pressable>
        </View>
      </Animated.View>
    </Animated.View>
  )
}

// A sombra do texto é o que substitui o fundo: sem ela, uma foto clara por
// baixo comia as letras — e o pedido era mesmo não haver caixa nenhuma.
// É a `feedTextShadow` da Feed; esteve aqui copiada valor a valor.

const s = StyleSheet.create({
  wrap: { marginBottom: spacing.sm2, justifyContent: 'center' },
  question: {
    ...feedTextShadow,
    ...feedType.meta,
    color: feedInk.muted,
    marginBottom: spacing.sm,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  pill: {
    // Metade da largura para cada lado — dois pesos iguais, e nenhum rótulo
    // cortado a meio em ecrãs estreitos (a legenda passa a duas linhas).
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.sm2,
    paddingVertical: spacing.sm,
    // Cantos suaves, não uma cápsula: o traço acompanha o resto da feed em vez
    // de virar um botão de ação.
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: feedLine.strong,
    backgroundColor: 'transparent',
  },
  // O lado do "sim" leva a seta ao lado do texto, sem sair do centro.
  pillMore: { flexDirection: 'row', gap: spacing.xs2 },
  pillPressed: { borderColor: colors.white },
  pillTxt: {
    ...feedTextShadow,
    ...feedType.primary,
    textAlign: 'center',
    color: feedInk.secondary,
  },
  thanks: {
    ...feedTextShadow,
    ...feedType.primary,
    position: 'absolute',
    left: 0,
    right: 0,
    color: feedInk.secondary,
  },
})
