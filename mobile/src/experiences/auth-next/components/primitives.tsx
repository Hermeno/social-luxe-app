import React from 'react'
import {
  ActivityIndicator, Pressable, StyleSheet, Text, View,
  type StyleProp, type TextStyle, type ViewStyle,
} from 'react-native'

import Icon, { type IconName } from '../../../components/Icon'
import { useTheme } from '../theme/ThemeProvider'
import { control, radius, space } from '../theme/tokens'

/**
 * Os controlos do módulo.
 *
 * Três botões e nada mais: o comando principal, o comando de segunda ordem e a
 * saída discreta. Um formulário com quatro pesos de botão obriga a pessoa a
 * decidir qual é o importante, e essa decisão já devia estar tomada no desenho.
 */

interface PrimaryProps {
  label: string
  onPress: () => void
  disabled?: boolean
  busy?: boolean
  icon?: IconName
  style?: StyleProp<ViewStyle>
  accessibilityLabel?: string
}

/**
 * O comando principal. Neutro — preto sobre papel, papel sobre escuro.
 *
 * Não leva a cor de acento nem gradiente. O acento é identidade; um botão que
 * muda de cor conforme a preferência de alguém deixa de ser reconhecível como o
 * mesmo objecto entre dois telefones.
 *
 * Desactivado, baixa a opacidade mas mantém-se acessível e anunciável: um botão
 * que desaparece deixa a pessoa sem saber o que falta fazer.
 */
export function PrimaryButton({
  label, onPress, disabled, busy, icon, style, accessibilityLabel,
}: PrimaryProps) {
  const { palette, text } = useTheme()
  const off = Boolean(disabled) || Boolean(busy)

  return (
    <Pressable
      onPress={off ? undefined : onPress}
      disabled={off}
      style={({ pressed }) => [
        s.primary,
        { backgroundColor: palette.ctaBg, opacity: disabled ? 0.38 : pressed ? 0.86 : 1 },
        style,
      ]}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled: off, busy }}
    >
      {busy ? (
        <ActivityIndicator color={palette.ctaInk} />
      ) : (
        <>
          {icon && <Icon name={icon} size={20} color={palette.ctaInk} />}
          <Text style={[text('action'), { color: palette.ctaInk }]} numberOfLines={1}>{label}</Text>
        </>
      )}
    </Pressable>
  )
}

/**
 * O comando de segunda ordem — contorno, sem preenchimento.
 *
 * Tem a mesma altura e o mesmo raio do principal de propósito: são irmãos, e o
 * que os distingue é o peso da tinta, não a forma. Dois botões de formas
 * diferentes um por cima do outro lêem-se como dois sistemas.
 */
export function SecondaryButton({
  label, onPress, disabled, busy, icon, style, accessibilityLabel,
}: PrimaryProps) {
  const { palette, text } = useTheme()
  const off = Boolean(disabled) || Boolean(busy)

  return (
    <Pressable
      onPress={off ? undefined : onPress}
      disabled={off}
      style={({ pressed }) => [
        s.primary,
        s.secondary,
        {
          backgroundColor: pressed ? palette.field : palette.surface,
          borderColor: palette.lineStrong,
          opacity: disabled ? 0.38 : 1,
        },
        style,
      ]}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled: off, busy }}
    >
      {busy ? (
        <ActivityIndicator color={palette.ink} />
      ) : (
        <>
          {icon && <Icon name={icon} size={20} color={palette.ink} />}
          <Text style={[text('action'), { color: palette.ink }]} numberOfLines={1}>{label}</Text>
        </>
      )}
    </Pressable>
  )
}

/**
 * A saída discreta — "Ignorar por agora", "Trocar conta".
 *
 * Sublinhado e não botão: o que ela faz é sair do caminho principal, e dar-lhe
 * uma caixa poria duas propostas com o mesmo peso à frente de quem lê. O alvo de
 * toque continua nos 48 mesmo com o texto pequeno.
 */
export function QuietAction({
  label, onPress, disabled, style, tone = 'muted',
}: {
  label: string
  onPress: () => void
  disabled?: boolean
  style?: StyleProp<ViewStyle>
  tone?: 'muted' | 'ink'
}) {
  const { palette, text } = useTheme()
  return (
    <Pressable
      onPress={disabled ? undefined : onPress}
      disabled={disabled}
      style={({ pressed }) => [s.quiet, { opacity: disabled ? 0.38 : pressed ? 0.6 : 1 }, style]}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: Boolean(disabled) }}
    >
      <Text
        style={[
          text('action'),
          {
            color: tone === 'ink' ? palette.ink : palette.inkMuted,
            textDecorationLine: 'underline',
          },
        ]}
      >
        {label}
      </Text>
    </Pressable>
  )
}

/**
 * Um aviso inline — o erro que pertence a um campo ou a uma secção.
 *
 * Não é um toast: um toast desaparece antes de a pessoa acabar de o ler e leva
 * consigo a única indicação do que correu mal. Fica onde o problema está, e traz
 * o retry consigo quando há alguma coisa para repetir.
 */
export function Notice({
  message, onRetry, retryLabel, tone = 'danger',
}: {
  message: string
  onRetry?: () => void
  retryLabel?: string
  tone?: 'danger' | 'muted'
}) {
  const { palette, text } = useTheme()
  const ink = tone === 'danger' ? palette.danger : palette.inkMuted

  return (
    <View style={s.notice} accessibilityRole="alert" accessibilityLiveRegion="polite">
      <Text style={[text('error'), { color: ink, flexShrink: 1 }]}>{message}</Text>
      {onRetry && retryLabel && (
        <Pressable
          onPress={onRetry}
          style={({ pressed }) => [s.noticeRetry, { opacity: pressed ? 0.6 : 1 }]}
          accessibilityRole="button"
          accessibilityLabel={retryLabel}
        >
          <Text style={[text('error'), { color: palette.ink, textDecorationLine: 'underline' }]}>
            {retryLabel}
          </Text>
        </Pressable>
      )}
    </View>
  )
}

/**
 * O sinal de que algo está a acontecer, no A00.
 *
 * É o indicador nativo, tingido com a cor de acento — e é o único sítio do
 * módulo onde a marca aparece a pintar movimento. O desenho aprovado mostra um
 * anel com a progressão azul → magenta; fazê-lo a sério exigiria um gradiente
 * cónico animado, e um arranque não é sítio para gastar o primeiro frame numa
 * decoração. A diferença fica registada como divergência assumida.
 */
export function BrandSpinner({ size = 26, label }: { size?: number; label: string }) {
  const { accent } = useTheme()
  return (
    <View accessibilityRole="progressbar" accessibilityLabel={label} accessibilityState={{ busy: true }}>
      <ActivityIndicator size="small" color={accent} style={{ width: size, height: size }} />
    </View>
  )
}

/** Rótulo de secção — "Tema", "Sugestões de identificadores". */
export function SectionLabel({ children, style }: { children: string; style?: StyleProp<TextStyle> }) {
  const { palette, text } = useTheme()
  return (
    <Text
      style={[text('label'), { color: palette.ink, marginBottom: space.md }, style]}
      accessibilityRole="header"
    >
      {children}
    </Text>
  )
}

const s = StyleSheet.create({
  primary: {
    height: control.height,
    borderRadius: radius.box,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.sm,
    paddingHorizontal: space.xl,
  },
  secondary: { borderWidth: 1 },
  quiet: { minHeight: control.target, alignItems: 'center', justifyContent: 'center' },
  notice: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: space.sm,
    paddingTop: space.md,
  },
  noticeRetry: { minHeight: 32, justifyContent: 'center' },
})
