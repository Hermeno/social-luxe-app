import React, { forwardRef, useState } from 'react'
import {
  Pressable, StyleSheet, Text, TextInput, View,
  type StyleProp, type TextInputProps, type ViewStyle,
} from 'react-native'

import Icon, { type IconName } from '../../../components/Icon'
import { useTheme } from '../theme/ThemeProvider'
import { control, radius, space } from '../theme/tokens'

/**
 * A moldura de um campo.
 *
 * Um só nível de contorno em repouso e um segundo em foco — não há sombra, não
 * há preenchimento colorido, não há anel a piscar. O foco muda a linha para a
 * cor de acento, que é o único papel em que o acento toca num controlo: é a
 * confirmação de onde o teclado está a escrever, e não sobra nenhum outro
 * elemento no ecrã a disputar essa leitura.
 */
export function FieldFrame({
  focused, invalid, children, style,
}: {
  focused?: boolean
  invalid?: boolean
  children: React.ReactNode
  style?: StyleProp<ViewStyle>
}) {
  const { palette, accent } = useTheme()
  const border = invalid ? palette.danger : focused ? accent : palette.line

  return (
    <View
      style={[
        s.frame,
        {
          backgroundColor: palette.field,
          borderColor: border,
          // A linha engrossa no foco em vez de só mudar de cor: quem não
          // distingue a cor continua a ver que o campo está activo.
          borderWidth: focused || invalid ? 1.5 : 1,
        },
        style,
      ]}
    >
      {children}
    </View>
  )
}

interface FieldProps extends Omit<TextInputProps, 'style'> {
  label?: string
  /** Mensagem por baixo. Vermelha quando `invalid`, neutra quando é ajuda. */
  help?: string
  invalid?: boolean
  /** Um comando dentro da moldura — o olho da senha, o limpar da pesquisa. */
  trailing?: { icon: IconName; label: string; onPress: () => void; active?: boolean }
  /** Um bloco antes do texto — o seletor de país. */
  leading?: React.ReactNode
  frameStyle?: StyleProp<ViewStyle>
}

/**
 * Campo de texto com rótulo, ajuda e estado de erro.
 *
 * O rótulo fica por cima e sempre visível. Rótulos que flutuam para dentro do
 * campo poupam uma linha e custam a legibilidade no momento em que ela mais
 * importa: com o campo preenchido, o rótulo encolhe justamente quando a pessoa
 * volta atrás para confirmar o que escreveu.
 */
const Field = forwardRef<TextInput, FieldProps>(function Field(
  { label, help, invalid, trailing, leading, frameStyle, onFocus, onBlur, ...input },
  ref,
) {
  const { palette, text } = useTheme()
  const [focused, setFocused] = useState(false)

  return (
    <View>
      {!!label && (
        <Text style={[text('label'), { color: palette.ink, marginBottom: space.sm }]}>
          {label}
        </Text>
      )}

      <FieldFrame focused={focused} invalid={invalid} style={frameStyle}>
        {leading}
        <TextInput
          ref={ref}
          style={[text('value'), s.input, { color: palette.ink }]}
          placeholderTextColor={palette.inkFaint}
          selectionColor={palette.ink}
          accessibilityLabel={label}
          onFocus={(event) => { setFocused(true); onFocus?.(event) }}
          onBlur={(event) => { setFocused(false); onBlur?.(event) }}
          {...input}
        />
        {trailing && (
          <Pressable
            onPress={trailing.onPress}
            style={({ pressed }) => [s.trailing, { opacity: pressed ? 0.55 : 1 }]}
            accessibilityRole="button"
            accessibilityLabel={trailing.label}
            accessibilityState={trailing.active === undefined ? undefined : { selected: trailing.active }}
          >
            <Icon
              name={trailing.icon}
              size={20}
              color={trailing.active ? palette.ink : palette.inkMuted}
            />
          </Pressable>
        )}
      </FieldFrame>

      {!!help && (
        <Text
          style={[
            text(invalid ? 'error' : 'help'),
            { color: invalid ? palette.danger : palette.inkMuted, marginTop: space.sm },
          ]}
          accessibilityLiveRegion={invalid ? 'polite' : 'none'}
        >
          {help}
        </Text>
      )}
    </View>
  )
})

export default Field

const s = StyleSheet.create({
  frame: {
    minHeight: control.height,
    borderRadius: radius.box,
    flexDirection: 'row',
    alignItems: 'center',
  },
  input: {
    flex: 1,
    minWidth: 0,
    paddingHorizontal: space.lg,
    // O `paddingVertical: 0` é o que impede o Android de somar a sua própria
    // folga interna e empurrar o texto para fora do centro da moldura.
    paddingVertical: 0,
  },
  trailing: {
    width: control.target,
    height: control.target,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: space.xs,
  },
})
