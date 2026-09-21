import React, { useCallback, useEffect, useRef, useState } from 'react'
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native'

import Icon from '../../../components/Icon'
import AuthScreen from '../components/AuthScreen'
import Field from '../components/Field'
import { Notice, PrimaryButton, QuietAction, SectionLabel } from '../components/primitives'
import { useT, fill } from '../i18n'
import { useTheme } from '../theme/ThemeProvider'
import { createAccount, suggestHandles } from '../adapters/auth.adapter'
import { classify, type Failure } from '../adapters/errors'
import { NAME_MAX, nameReady } from '../state/flow'
import type { Country } from '../data/countries'
import { control, radius, space } from '../theme/tokens'

/** Tempo de silêncio antes de perguntar ao servidor. É o que a app já pratica. */
const DEBOUNCE_MS = 600

interface Props {
  name: string
  handle: string | null
  phone: string
  country: Country
  password: string
  onNameChange: (value: string) => void
  onHandleChange: (value: string | null) => void
  onRegistered: (assignedHandle: string | null) => void
  onBack: () => void
}

/**
 * A05 — nome e identificador. É aqui que a conta passa a existir.
 *
 * Duas verdades que o ecrã tem de dizer em voz alta:
 *
 * 1. O identificador é opcional. Quem não escolher nenhum continua, e o servidor
 *    atribui um. Uma falha no serviço de sugestões não pode trancar o registo —
 *    seria um serviço acessório a bloquear o principal.
 *
 * 2. Uma sugestão não é uma reserva. Entre ver a lista e submeter, o
 *    identificador pode ficar de outra pessoa. Por isso a nota por baixo do
 *    campo diz exactamente isso, e por isso, depois do registo, o que se mostra
 *    é o que o servidor devolveu — não o que foi escolhido.
 */
export default function IdentityScreen({
  name, handle, phone, country, password,
  onNameChange, onHandleChange, onRegistered, onBack,
}: Props) {
  const { palette, text, accent } = useTheme()
  const t = useT()

  const [options, setOptions] = useState<string[]>([])
  const [loadingHandles, setLoadingHandles] = useState(false)
  const [handlesFailed, setHandlesFailed] = useState(false)
  const [busy, setBusy] = useState(false)
  const [failure, setFailure] = useState<Failure | null>(null)
  const [touchedName, setTouchedName] = useState(false)

  const trimmed = name.trim()
  const canRegister = nameReady(name)
  // Cada pedido de sugestões carrega o seu número: uma resposta lenta de um nome
  // já apagado não pode reescrever a lista do nome actual.
  const suggestRun = useRef(0)
  // O identificador escolhido também vive numa ref.
  //
  // As duas funções que precisam dele — o debounce das sugestões e o registo —
  // podem correr depois do render em que foram criadas, e nesse caso o valor
  // que fecharam já não é o que está no ecrã. Foi assim que "Ignorar por agora"
  // chegou a submeter o identificador que a pessoa acabara de descartar.
  const handleRef = useRef(handle)
  handleRef.current = handle

  const fetchSuggestions = useCallback(async (forName: string) => {
    const mine = ++suggestRun.current
    setLoadingHandles(true)
    setHandlesFailed(false)
    try {
      const result = await suggestHandles(forName)
      if (mine !== suggestRun.current) return
      setOptions(result)
      // Mantém a escolha se ela ainda estiver na lista; senão não escolhe
      // sozinho — o identificador é da pessoa, não do ecrã.
      const chosen = handleRef.current
      onHandleChange(chosen && result.includes(chosen) ? chosen : null)
    } catch {
      if (mine !== suggestRun.current) return
      setOptions([])
      setHandlesFailed(true)
    } finally {
      if (mine === suggestRun.current) setLoadingHandles(false)
    }
  }, [onHandleChange])

  useEffect(() => {
    if (trimmed.length < 2) {
      suggestRun.current++
      setOptions([])
      setLoadingHandles(false)
      setHandlesFailed(false)
      return
    }
    const timer = setTimeout(() => { void fetchSuggestions(trimmed) }, DEBOUNCE_MS)
    return () => clearTimeout(timer)
  }, [fetchSuggestions, trimmed])

  /**
   * `withHandle` é explícito e não opcional por gosto: quem submete pelo botão
   * principal manda o identificador escolhido, e quem submete por "Ignorar por
   * agora" manda `null`. Ler o estado aqui dentro daria o valor do render
   * anterior ao toque.
   */
  const register = useCallback(async (withHandle: string | null) => {
    if (!canRegister || busy) return
    setBusy(true)
    setFailure(null)
    try {
      const { assignedHandle } = await createAccount({
        name: trimmed,
        e164: phone,
        countryCode: country.code,
        password,
        handle: withHandle ?? undefined,
      })
      onRegistered(assignedHandle)
    } catch (error) {
      setFailure(classify(error, t, t.registerFailed))
      setBusy(false)
    }
  }, [busy, canRegister, country.code, onRegistered, password, phone, t, trimmed])

  const nameInvalid = touchedName && trimmed.length > 0 && !canRegister

  return (
    <AuthScreen
      title={t.identityTitle}
      intro={t.identityIntro}
      onBack={onBack}
      footer={(
        <>
          <PrimaryButton
            label={t.continue}
            onPress={() => { void register(handle) }}
            disabled={!canRegister}
            busy={busy}
            accessibilityLabel={t.createAccount}
          />
          {/* Continuar sem identificador é a mesma acção com a escolha limpa —
              não um segundo caminho. O registo acontece na mesma. */}
          <QuietAction
            label={t.skipForNow}
            onPress={() => { onHandleChange(null); void register(null) }}
            disabled={!canRegister || busy}
          />
        </>
      )}
    >
      <View style={s.stack}>
        <Field
          label={t.nameLabel}
          placeholder={t.namePlaceholder}
          value={name}
          onChangeText={onNameChange}
          onBlur={() => setTouchedName(true)}
          maxLength={NAME_MAX}
          autoCapitalize="words"
          autoCorrect={false}
          textContentType="name"
          returnKeyType="next"
          editable={!busy}
          invalid={nameInvalid}
          help={nameInvalid ? t.nameTooShort : undefined}
        />

        <Field
          label={t.handleLabel}
          placeholder={t.handlePlaceholder}
          // Mostrado sem `@` — é assim que o produto o escreve em todo o lado.
          value={handle ?? ''}
          editable={false}
          // Actualizar sugestões vive na moldura, à direita: pertence ao campo.
          trailing={{
            icon: 'refresh',
            label: t.handleRefresh,
            onPress: () => { if (trimmed.length >= 2) void fetchSuggestions(trimmed) },
          }}
          help={t.handleNote}
        />

        {trimmed.length >= 2 && (
          <View>
            <SectionLabel>{t.handleSuggestions}</SectionLabel>

            {loadingHandles ? (
              <View style={s.handleLoading} accessibilityRole="progressbar" accessibilityLabel={t.handleLoading}>
                <ActivityIndicator color={accent} />
                <Text style={[text('rowSub'), { color: palette.inkMuted }]}>{t.handleLoading}</Text>
              </View>
            ) : handlesFailed ? (
              <Notice
                message={t.handleFailed}
                onRetry={() => { void fetchSuggestions(trimmed) }}
                retryLabel={t.retry}
                tone="muted"
              />
            ) : options.length === 0 ? (
              <Text style={[text('rowSub'), { color: palette.inkMuted }]}>{t.handleNone}</Text>
            ) : (
              <View style={s.options}>
                {options.map((option) => {
                  const active = option === handle
                  return (
                    <Pressable
                      key={option}
                      onPress={() => onHandleChange(active ? null : option)}
                      style={({ pressed }) => [
                        s.option,
                        {
                          backgroundColor: active ? palette.ctaBg : palette.field,
                          borderColor: active ? palette.ctaBg : palette.line,
                          opacity: pressed ? 0.82 : 1,
                        },
                      ]}
                      accessibilityRole="radio"
                      accessibilityLabel={option}
                      accessibilityState={{ selected: active, checked: active }}
                    >
                      {active && <Icon name="check" size={15} color={palette.ctaInk} strokeWidth={2.4} />}
                      <Text
                        style={[text('rowSub'), { color: active ? palette.ctaInk : palette.ink }]}
                        numberOfLines={1}
                      >
                        {option}
                      </Text>
                    </Pressable>
                  )
                })}
              </View>
            )}
          </View>
        )}

        {failure && (
          <Notice
            message={failure.message}
            onRetry={failure.kind === 'server' ? undefined : () => { void register(handle) }}
            retryLabel={t.retry}
          />
        )}
      </View>
    </AuthScreen>
  )
}

/** A frase que diz que o servidor escolheu outro identificador. */
export function reassignedMessage(t: ReturnType<typeof useT>, assigned: string): string {
  return fill(t.handleReassigned, { handle: assigned })
}

const s = StyleSheet.create({
  stack: { gap: space.xl },
  handleLoading: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: control.target },
  options: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  option: {
    minHeight: control.target - 4,
    borderRadius: radius.chip,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingHorizontal: space.lg,
  },
})
