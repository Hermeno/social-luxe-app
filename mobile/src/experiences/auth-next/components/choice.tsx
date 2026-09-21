import React from 'react'
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native'

import Icon from '../../../components/Icon'
import { useTheme } from '../theme/ThemeProvider'
import { control, radius, space } from '../theme/tokens'

/**
 * O ponto de selecção.
 *
 * Um anel que ganha um miolo. A cor de acento entra aqui — é um papel de
 * escolha, não decoração — mas a forma sozinha já diz tudo: quem não distingue
 * a cor continua a ver um círculo cheio contra um círculo vazio.
 */
export function Radio({ selected, size = 22 }: { selected: boolean; size?: number }) {
  const { palette, accent } = useTheme()
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        borderWidth: selected ? 0 : 1.5,
        borderColor: palette.lineStrong,
        backgroundColor: selected ? accent : 'transparent',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {selected && (
        <View
          style={{
            width: size * 0.34,
            height: size * 0.34,
            borderRadius: size * 0.17,
            backgroundColor: palette.surface,
          }}
        />
      )}
    </View>
  )
}

/**
 * Uma linha de escolha — país, idioma.
 *
 * A linha inteira é o alvo. Um radio de 22px como único ponto de toque é o tipo
 * de detalhe que só falha em telefones reais, com dedos reais.
 */
export function ChoiceRow({
  title, subtitle, leading, selected, onPress, style,
}: {
  title: string
  subtitle?: string
  leading?: React.ReactNode
  selected: boolean
  onPress: () => void
  style?: StyleProp<ViewStyle>
}) {
  const { palette, text } = useTheme()

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        s.row,
        { backgroundColor: pressed ? palette.field : 'transparent' },
        style,
      ]}
      accessibilityRole="radio"
      accessibilityLabel={subtitle ? `${title}, ${subtitle}` : title}
      accessibilityState={{ selected, checked: selected }}
    >
      {leading}
      <View style={s.rowText}>
        <Text style={[text('row'), { color: palette.ink }]} numberOfLines={1}>{title}</Text>
        {!!subtitle && (
          <Text style={[text('rowSub'), { color: palette.inkMuted }]} numberOfLines={1}>
            {subtitle}
          </Text>
        )}
      </View>
      <Radio selected={selected} />
    </Pressable>
  )
}

/**
 * A etiqueta de um interesse.
 *
 * Aqui a pílula justifica-se: é uma selecção múltipla de rótulos de comprimento
 * variável, e a forma que melhor a comunica é mesmo uma etiqueta que se acende.
 * Justifica-se aqui e em mais lado nenhum deste módulo — foi por isso que os
 * botões e os campos ficaram com cantos de 12 e não em cápsula.
 *
 * Escolhida, inverte a tinta e ganha o visto. A inversão é o sinal forte; o
 * visto é o que garante que a informação não vive só na cor.
 */
export function Chip({
  label, selected, onPress,
}: {
  label: string
  selected: boolean
  onPress: () => void
}) {
  const { palette, text } = useTheme()

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        s.chip,
        {
          backgroundColor: selected ? palette.ctaBg : palette.field,
          borderColor: selected ? palette.ctaBg : palette.line,
          opacity: pressed ? 0.82 : 1,
        },
      ]}
      accessibilityRole="checkbox"
      accessibilityLabel={label}
      accessibilityState={{ checked: selected }}
    >
      {selected && <Icon name="check" size={15} color={palette.ctaInk} strokeWidth={2.4} />}
      <Text
        style={[text('rowSub'), { color: selected ? palette.ctaInk : palette.ink }]}
        numberOfLines={1}
      >
        {label}
      </Text>
    </Pressable>
  )
}

/**
 * Uma escolha em caixa — o tema e o tamanho de texto do X01.
 *
 * É a única forma do módulo que mostra o resultado dentro do próprio controlo:
 * o "Aa" de cada tamanho está desenhado no tamanho que representa, e os ícones
 * do tema mostram o sol, a lua e o ecrã. Quem escolhe vê o que vai receber sem
 * ter de aplicar para descobrir.
 */
export function ChoiceBox({
  selected, onPress, label, accessibilityLabel, children, style,
}: {
  selected: boolean
  onPress: () => void
  label?: string
  accessibilityLabel: string
  children: React.ReactNode
  style?: StyleProp<ViewStyle>
}) {
  const { palette, text } = useTheme()

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        s.box,
        {
          backgroundColor: palette.surface,
          borderColor: selected ? palette.ink : palette.line,
          borderWidth: selected ? 1.5 : 1,
          opacity: pressed ? 0.8 : 1,
        },
        style,
      ]}
      accessibilityRole="radio"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ selected, checked: selected }}
    >
      {children}
      {!!label && (
        <Text
          style={[text('help'), { color: selected ? palette.ink : palette.inkMuted, textAlign: 'center' }]}
          numberOfLines={2}
        >
          {label}
        </Text>
      )}
    </Pressable>
  )
}

const s = StyleSheet.create({
  row: {
    minHeight: 64,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingHorizontal: space.lg,
    borderRadius: radius.box,
  },
  rowText: { flex: 1, minWidth: 0, gap: 2 },
  chip: {
    minHeight: control.target - 4,
    borderRadius: radius.chip,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingHorizontal: space.lg,
  },
  box: {
    flex: 1,
    minHeight: 72,
    borderRadius: radius.box,
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.sm,
    paddingVertical: space.md,
    paddingHorizontal: space.sm,
  },
})
