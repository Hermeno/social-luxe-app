import React, { useCallback, useRef, useState } from 'react'
import { StyleSheet, Text, View } from 'react-native'

import AuthScreen from '../components/AuthScreen'
import Field, { FieldFrame } from '../components/Field'
import { Notice, PrimaryButton, QuietAction } from '../components/primitives'
import { useT } from '../i18n'
import { useTheme } from '../theme/ThemeProvider'
import { signIn } from '../adapters/auth.adapter'
import { classify, type Failure } from '../adapters/errors'
import { maskedPhone } from '../state/flow'
import type { Country } from '../data/countries'
import { control, space } from '../theme/tokens'

interface Props {
  phone: string
  country: Country
  onSignedIn: () => void
  onSwitchAccount: () => void
  onBack: () => void
}

/**
 * A03 — entrar numa conta que já existe.
 *
 * O ecrã mostra o número mascarado e mais nada sobre quem é o dono dele. Não há
 * nome nem fotografia porque o `checkPhone` não os devolve — e inventá-los a
 * partir de uma cache local seria mostrar a identidade de quem usou o telefone
 * antes a quem está a tentar entrar agora.
 *
 * O que este ecrã deliberadamente não tem: recuperação de senha, SMS, email,
 * Google, Apple, passkey, biometria. Nenhum desses percursos existe de facto no
 * produto; um botão que não leva a lado nenhum é pior que a sua ausência,
 * porque alguém trancado de fora vai tentá-lo.
 *
 * Sobre os erros: ver `adapters/errors.ts`. Aqui basta dizer que uma falha nunca
 * é traduzida para "senha incorreta" por conta própria — mandar mudar uma senha
 * que estava certa é o pior desfecho possível deste ecrã.
 */
export default function SignInScreen({
  phone, country, onSignedIn, onSwitchAccount, onBack,
}: Props) {
  const { palette, text } = useTheme()
  const t = useT()
  const [password, setPassword] = useState('')
  const [visible, setVisible] = useState(false)
  const [busy, setBusy] = useState(false)
  const [failure, setFailure] = useState<Failure | null>(null)
  const attempt = useRef(0)

  // No login não se aplicam as regras de criação: a conta pode ter sido criada
  // noutra altura, com outras regras. O que basta é não estar vazio.
  const ready = password.length > 0

  const submit = useCallback(async () => {
    if (busy) return
    if (!ready) { setFailure({ kind: 'unknown', message: t.signInEmpty }); return }
    const mine = ++attempt.current
    setBusy(true)
    setFailure(null)
    try {
      await signIn(phone, password)
      if (mine !== attempt.current) return
      // A senha sai da memória no instante em que deixa de ser precisa.
      setPassword('')
      onSignedIn()
    } catch (error) {
      if (mine !== attempt.current) return
      setFailure(classify(error, t, t.signInFailed))
    } finally {
      if (mine === attempt.current) setBusy(false)
    }
  }, [busy, onSignedIn, password, phone, ready, t])

  return (
    <AuthScreen
      title={t.signInTitle}
      intro={t.signInIntro}
      onBack={onBack}
      footer={(
        <>
          <PrimaryButton label={t.signInAction} onPress={submit} disabled={!ready} busy={busy} />
          <QuietAction label={t.signInSwitch} onPress={onSwitchAccount} disabled={busy} />
        </>
      )}
    >
      <View style={s.stack}>
        {/* O número não é um campo: é o contexto de quem está a entrar. Fica na
            forma de um campo para a coluna manter o ritmo, mas sem foco, sem
            teclado e fora da ordem de tabulação. */}
        <FieldFrame style={s.phoneFrame}>
          <Text style={s.flag}>{country.flag}</Text>
          <Text
            style={[text('value'), { color: palette.inkMuted, flex: 1 }]}
            numberOfLines={1}
            accessibilityLabel={`${t.phoneLabel}: ${maskedPhone(phone)}`}
          >
            {maskedPhone(phone)}
          </Text>
        </FieldFrame>

        <Field
          label={t.signInPasswordLabel}
          value={password}
          onChangeText={(value) => { setPassword(value); if (failure) setFailure(null) }}
          secureTextEntry={!visible}
          autoCapitalize="none"
          autoCorrect={false}
          textContentType="password"
          autoComplete="current-password"
          returnKeyType="go"
          onSubmitEditing={submit}
          editable={!busy}
          invalid={failure?.kind === 'server'}
          // Não há ícone de olho riscado na família da app. Em vez de desenhar um
          // novo asset, o estado diz-se pela tinta do glifo e pelo rótulo que o
          // leitor de ecrã anuncia — que é o que muda de facto.
          trailing={{
            icon: 'eye',
            label: visible ? t.passwordHide : t.passwordShow,
            onPress: () => setVisible((value) => !value),
            active: visible,
          }}
        />

        {failure && (
          <Notice
            message={failure.message}
            onRetry={failure.kind === 'offline' || failure.kind === 'timeout' ? submit : undefined}
            retryLabel={t.retry}
          />
        )}
      </View>
    </AuthScreen>
  )
}

const s = StyleSheet.create({
  stack: { gap: space.lg },
  phoneFrame: { paddingLeft: space.lg, paddingRight: space.lg, gap: space.md, height: control.height },
  flag: { fontSize: 20, lineHeight: 24 },
})
