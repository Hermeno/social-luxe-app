import React, { useMemo, useState } from 'react'
import { StyleSheet, Text, View } from 'react-native'

import Icon from '../../../components/Icon'
import AuthScreen from '../components/AuthScreen'
import Field from '../components/Field'
import { PrimaryButton } from '../components/primitives'
import { useT } from '../i18n'
import { useTheme } from '../theme/ThemeProvider'
import { PASSWORD_RULES, passwordReady } from '../state/flow'
import { space } from '../theme/tokens'

interface Props {
  value: string
  onChange: (value: string) => void
  onContinue: () => void
  onBack: () => void
}

const DOT = 20

/**
 * A04 — criar a senha.
 *
 * Um campo. Não há confirmação: repetir a senha protege contra um erro de
 * escrita que o botão de mostrar já resolve, e custa um campo inteiro a toda a
 * gente. As três regras são as que a aplicação aplica — nem mais, nem menos, e
 * nenhuma delas inventada para parecer rigoroso.
 *
 * A lista de requisitos vive por baixo do campo e em tinta de apoio. Já esteve
 * em desenhos com três linhas grandes e um ícone por regra, e o resultado é uma
 * página onde o objecto mais visível não é o campo onde se escreve.
 *
 * A senha NUNCA toca em disco. Fica em memória entre este ecrã e o registo em
 * A05, e desaparece assim que a conta existe. Guardá-la para "retomar depois"
 * transformaria uma conveniência de percurso numa credencial em claro no
 * telefone.
 */
export default function PasswordScreen({ value, onChange, onContinue, onBack }: Props) {
  const { palette, text, accent } = useTheme()
  const t = useT()
  const [visible, setVisible] = useState(false)

  const labels: Record<string, string> = useMemo(() => ({
    length: t.ruleLength,
    number: t.ruleNumber,
    upper: t.ruleUpper,
  }), [t])

  const ready = passwordReady(value)

  return (
    <AuthScreen
      title={t.passwordTitle}
      intro={t.passwordIntro}
      onBack={onBack}
      footer={<PrimaryButton label={t.continue} onPress={onContinue} disabled={!ready} />}
    >
      <Field
        label={t.passwordLabel}
        value={value}
        onChangeText={onChange}
        secureTextEntry={!visible}
        autoCapitalize="none"
        autoCorrect={false}
        textContentType="newPassword"
        autoComplete="new-password"
        returnKeyType="next"
        onSubmitEditing={() => { if (ready) onContinue() }}
        trailing={{
          icon: 'eye',
          label: visible ? t.passwordHide : t.passwordShow,
          onPress: () => setVisible((current) => !current),
          active: visible,
        }}
      />

      <View style={s.rules}>
        {PASSWORD_RULES.map((rule) => {
          const met = rule.test(value)
          return (
            <View
              key={rule.id}
              style={s.rule}
              accessible
              accessibilityRole="text"
              accessibilityLabel={`${labels[rule.id]}, ${met ? t.ruleMet : t.rulePending}`}
            >
              <View
                style={[
                  s.dot,
                  met
                    ? { backgroundColor: accent, borderColor: accent }
                    : { borderColor: palette.lineStrong },
                ]}
              >
                {/* Antes de cumprida, a regra é um anel vazio e não uma cruz:
                    ainda não está errada, só ainda não aconteceu. */}
                {met && <Icon name="check" size={12} color={palette.surface} strokeWidth={2.6} />}
              </View>
              <Text
                style={[text('rowSub'), { color: met ? palette.ink : palette.inkMuted, flexShrink: 1 }]}
              >
                {labels[rule.id]}
              </Text>
            </View>
          )
        })}
      </View>
    </AuthScreen>
  )
}

const s = StyleSheet.create({
  rules: { paddingTop: space.xl, gap: space.md },
  rule: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: 24 },
  dot: {
    width: DOT, height: DOT, borderRadius: DOT / 2, borderWidth: 1.5,
    alignItems: 'center', justifyContent: 'center',
  },
})
