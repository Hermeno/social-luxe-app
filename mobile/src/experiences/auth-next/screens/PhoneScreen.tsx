import React, { useCallback, useRef, useState } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'

import Icon from '../../../components/Icon'
import AuthScreen from '../components/AuthScreen'
import Field from '../components/Field'
import { Notice, PrimaryButton } from '../components/primitives'
import CountrySheet from './CountrySheet'
import { useI18n, useT } from '../i18n'
import { useTheme } from '../theme/ThemeProvider'
import { checkPhone } from '../adapters/auth.adapter'
import { classify, type Failure } from '../adapters/errors'
import { detectCountry, type Country } from '../data/countries'
import { MIN_LOCAL_DIGITS, e164 } from '../state/flow'
import { control, space } from '../theme/tokens'

interface Props {
  country: Country
  localNumber: string
  onCountryChange: (country: Country) => void
  onNumberChange: (value: string) => void
  onExists: (phone: string) => void
  onNew: (phone: string) => void
  onBack?: () => void
}

/**
 * A01 — o telefone.
 *
 * O texto de apoio diz o que acontece a seguir e mais nada: **verificamos se já
 * existe uma conta**. Não promete verificação por SMS — não há OTP funcional
 * neste percurso, e anunciá-lo faria a pessoa ficar à espera de um código que
 * nunca chega.
 *
 * O limiar de sete dígitos é o do produto e não valida número nenhum: é a partir
 * dali que vale a pena perguntar ao servidor. Por isso o botão fica disponível e
 * não há mensagem de "número inválido" antes de alguém tentar — não sabemos se
 * é inválido.
 *
 * Trocar PT/EN nunca apaga o que já está escrito. É a primeira coisa que se
 * parte quando o idioma remonta a árvore, e a primeira que se nota.
 */
export default function PhoneScreen({
  country, localNumber, onCountryChange, onNumberChange, onExists, onNew, onBack,
}: Props) {
  const { palette, text } = useTheme()
  const { lang, setLang } = useI18n()
  const t = useT()
  const [pickerOpen, setPickerOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [failure, setFailure] = useState<Failure | null>(null)
  // Protege contra a resposta atrasada de uma verificação anterior: se alguém
  // corrigir o número e submeter outra vez, a primeira resposta já não manda.
  const attempt = useRef(0)

  const digits = localNumber.replace(/\D/g, '')
  const ready = digits.length >= MIN_LOCAL_DIGITS

  const submit = useCallback(async () => {
    if (!ready || busy) return
    const mine = ++attempt.current
    setBusy(true)
    setFailure(null)
    const phone = e164({ country, localNumber })
    try {
      const { exists } = await checkPhone(phone)
      if (mine !== attempt.current) return
      if (exists) onExists(phone)
      else onNew(phone)
    } catch (error) {
      if (mine !== attempt.current) return
      setFailure(classify(error, t, t.phoneCheckFailed))
    } finally {
      if (mine === attempt.current) setBusy(false)
    }
  }, [busy, country, localNumber, onExists, onNew, ready, t])

  return (
    <>
      <AuthScreen
        title={t.phoneTitle}
        intro={t.phoneIntro}
        onBack={onBack}
        headerRight={(
          // Dois rótulos e um separador — não um interruptor, não uma bandeira.
          // A língua escolhida fica a preto cheio; a outra, apagada.
          <View style={s.langRow} accessibilityRole="radiogroup">
            <Pressable
              onPress={() => setLang('pt')}
              style={s.langTarget}
              accessibilityRole="radio"
              accessibilityLabel="Português"
              accessibilityState={{ selected: lang === 'pt', checked: lang === 'pt' }}
            >
              <Text style={[text('label'), { color: lang === 'pt' ? palette.ink : palette.inkFaint }]}>
                PT
              </Text>
            </Pressable>
            <Text style={[text('label'), { color: palette.line }]}>|</Text>
            <Pressable
              onPress={() => setLang('en')}
              style={s.langTarget}
              accessibilityRole="radio"
              accessibilityLabel="English"
              accessibilityState={{ selected: lang === 'en', checked: lang === 'en' }}
            >
              <Text style={[text('label'), { color: lang === 'en' ? palette.ink : palette.inkFaint }]}>
                EN
              </Text>
            </Pressable>
          </View>
        )}
        footer={(
          <>
            <PrimaryButton
              label={t.continue}
              onPress={submit}
              disabled={!ready}
              busy={busy}
            />
            {/* Texto informativo, sem link: enquanto não houver documentos reais
                para onde navegar, um sublinhado azul que não abre nada é pior do
                que uma frase que não promete abrir. */}
            <Text style={[text('help'), { color: palette.inkFaint, textAlign: 'center' }]}>
              {t.legalPrefix}
              <Text style={{ color: palette.inkMuted }}>{t.legalTerms}</Text>
              {t.legalAnd}
              <Text style={{ color: palette.inkMuted }}>{t.legalPrivacy}</Text>
              .
            </Text>
          </>
        )}
      >
        <View style={s.field}>
          <Field
            label={t.phoneLabel}
            placeholder={t.phonePlaceholder}
            value={localNumber}
            onChangeText={(value) => {
              onNumberChange(value.replace(/[^\d\s-]/g, ''))
              if (failure) setFailure(null)
            }}
            keyboardType="phone-pad"
            textContentType="telephoneNumber"
            autoComplete="tel"
            returnKeyType="done"
            onSubmitEditing={submit}
            editable={!busy}
            leading={(
              <Pressable
                onPress={() => setPickerOpen(true)}
                style={({ pressed }) => [
                  s.country,
                  { borderRightColor: palette.line, opacity: pressed ? 0.6 : 1 },
                ]}
                accessibilityRole="button"
                accessibilityLabel={`${t.phoneCountryLabel}, ${country.code}`}
              >
                <Text style={s.flag}>{country.flag}</Text>
                <Text style={[text('value'), { color: palette.ink }]}>{country.code}</Text>
                <Icon name="chevron-down" size={16} color={palette.inkMuted} />
              </Pressable>
            )}
          />
          {failure && (
            <Notice
              message={failure.message}
              onRetry={failure.kind === 'server' ? undefined : submit}
              retryLabel={t.retry}
            />
          )}
        </View>
      </AuthScreen>

      <CountrySheet
        visible={pickerOpen}
        selectedIso={country.iso}
        onSelect={onCountryChange}
        onClose={() => setPickerOpen(false)}
      />
    </>
  )
}

/** O país de arranque, quando ainda não há rascunho nenhum. */
export const initialCountry = detectCountry

const s = StyleSheet.create({
  field: { paddingBottom: space.lg },
  langRow: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
  langTarget: {
    minWidth: 32, height: control.target,
    alignItems: 'center', justifyContent: 'center',
  },
  // O indicativo tem contorno próprio à direita: é um controlo dentro de um
  // campo, e sem a linha os dois números — indicativo e telefone — leriam-se
  // como um só.
  country: {
    height: control.height - 2,
    paddingLeft: space.lg,
    paddingRight: space.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    borderRightWidth: 1,
  },
  flag: { fontSize: 20, lineHeight: 24 },
})
