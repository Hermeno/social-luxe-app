import React, { useCallback, useMemo, useState } from 'react'
import { ScrollView, StyleSheet, Text, View } from 'react-native'

import AuthScreen from '../components/AuthScreen'
import { Chip } from '../components/choice'
import { Notice, PrimaryButton } from '../components/primitives'
import { fill, useI18n, useT } from '../i18n'
import { useTheme } from '../theme/ThemeProvider'
import { saveInterests, markOnboardingDone } from '../adapters/profile.adapter'
import { classify, type Failure } from '../adapters/errors'
import { INTERESTS, MIN_INTERESTS, interestLabel } from '../data/interests'
import { space } from '../theme/tokens'

interface Props {
  onDone: () => void
  onBack?: () => void
}

/**
 * P02 — os interesses.
 *
 * A regra é **pelo menos três**, e o ecrã diz isso em vez de `3/3`. A diferença
 * não é cosmética: uma fracção com denominador lê-se como quota, e quem chega ao
 * terceiro pára de escolher por achar que acabou. O que se mostra é quantos
 * faltam enquanto faltam, e quantos estão escolhidos depois disso — sem teto.
 *
 * As etiquetas são a única pílula do módulo, e é aqui que ela pertence: uma
 * selecção múltipla de rótulos de comprimento variável não tem forma melhor.
 * O que não têm é ícone por interesse, fotografia de fundo nem categoria com
 * imagem — três maneiras diferentes de inventar conteúdo para encher a grelha.
 *
 * Os identificadores guardados são os do catálogo da aplicação, sem tradução: o
 * que muda entre línguas é o rótulo, nunca o valor que segue para a API.
 */
export default function InterestsScreen({ onDone, onBack }: Props) {
  const { palette, text } = useTheme()
  const { lang } = useI18n()
  const t = useT()
  const [selected, setSelected] = useState<string[]>([])
  const [busy, setBusy] = useState(false)
  const [failure, setFailure] = useState<Failure | null>(null)

  const toggle = useCallback((id: string) => {
    setSelected((current) => (
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id]
    ))
  }, [])

  const count = selected.length
  const missing = MIN_INTERESTS - count
  const ready = count >= MIN_INTERESTS

  const status = useMemo(() => {
    if (count === 0) return t.interestsNeed
    if (missing === 1) return fill(t.interestsNeedOne, { count })
    if (missing > 1) return fill(t.interestsNeedMore, { count, missing })
    return fill(t.interestsChosen, { count })
  }, [count, missing, t])

  const save = useCallback(async () => {
    if (!ready || busy) return
    setBusy(true)
    setFailure(null)
    try {
      await saveInterests(selected)
      // O onboarding fica marcado aqui e não no fim: o passo seguinte é
      // opcional, e quem fechar a app nele não pode ser obrigado a repetir a
      // senha, o nome e os interesses só para lá voltar.
      await markOnboardingDone()
      onDone()
    } catch (error) {
      setFailure(classify(error, t, t.interestsSaveFailed))
    } finally {
      setBusy(false)
    }
  }, [busy, onDone, ready, selected, t])

  return (
    <AuthScreen
      title={t.interestsTitle}
      intro={t.interestsIntro}
      onBack={onBack}
      scroll={false}
      contentStyle={s.content}
      footer={(
        <>
          {/* O estado fica acima do botão e não dentro dele: um rótulo de botão
              que muda de texto a cada toque é difícil de ler e pior de anunciar. */}
          <Text
            style={[text('help'), { color: palette.inkMuted, textAlign: 'center' }]}
            accessibilityLiveRegion="polite"
          >
            {status}
          </Text>
          <PrimaryButton label={t.continue} onPress={save} disabled={!ready} busy={busy} />
          {failure && <Notice message={failure.message} onRetry={save} retryLabel={t.retry} />}
        </>
      )}
    >
      <ScrollView
        style={s.fill}
        // O rodapé vive abaixo deste scroll, não por cima dele: a lista é
        // recortada antes de lá chegar e nenhuma etiqueta fica inalcançável,
        // por mais longo que o catálogo venha a ficar.
        contentContainerStyle={s.grid}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {INTERESTS.map((interest) => (
          <Chip
            key={interest.id}
            label={interestLabel(interest, lang)}
            selected={selected.includes(interest.id)}
            onPress={() => toggle(interest.id)}
          />
        ))}
      </ScrollView>
    </AuthScreen>
  )
}

const s = StyleSheet.create({
  content: { flex: 1 },
  fill: { flex: 1 },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space.sm,
    paddingBottom: space.block,
  },
})
