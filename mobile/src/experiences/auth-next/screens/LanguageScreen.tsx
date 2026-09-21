import React from 'react'
import { StyleSheet, Text, View } from 'react-native'

import AuthScreen from '../components/AuthScreen'
import { ChoiceRow } from '../components/choice'
import { PrimaryButton } from '../components/primitives'
import { LanguagePreview } from '../components/Preview'
import { useI18n, useT } from '../i18n'
import { useTheme } from '../theme/ThemeProvider'
import { countryByIso } from '../data/countries'
import { space } from '../theme/tokens'

interface Props {
  onDone: () => void
  onSkip?: () => void
  onBack?: () => void
}

/**
 * L01 — o idioma.
 *
 * Duas línguas reais, duas linhas. Não são cartões promocionais nem uma grelha
 * de bandeiras: é uma escolha entre dois valores, e a forma de uma escolha entre
 * dois valores é uma lista com um ponto aceso.
 *
 * A troca é imediata — o título, o subtítulo e a pré-visualização mudam no
 * toque, e a preferência fica guardada na mesma chave que a aplicação já lê.
 * Nada do que já foi preenchido se perde: o idioma vive num provider acima dos
 * ecrãs e não remonta o percurso.
 *
 * Os subtítulos ficam propositadamente cada um na sua língua. "A nossa língua
 * principal" traduzido para inglês descreveria a opção portuguesa em inglês, a
 * quem está justamente a procurar a portuguesa.
 */
export default function LanguageScreen({ onDone, onSkip, onBack }: Props) {
  const { lang, setLang } = useI18n()
  const { text, palette } = useTheme()
  const t = useT()

  return (
    <AuthScreen
      title={t.languageTitle}
      intro={t.languageIntro}
      onBack={onBack}
      headerRight={onSkip ? (
        <Text
          style={[text('label'), { color: palette.inkMuted }]}
          onPress={onSkip}
          accessibilityRole="button"
          accessibilityLabel={t.skip}
          suppressHighlighting
        >
          {t.skip}
        </Text>
      ) : undefined}
      footer={<PrimaryButton label={t.continue} onPress={onDone} />}
    >
      <View style={s.list} accessibilityRole="radiogroup">
        <ChoiceRow
          title={t.languagePt}
          subtitle={t.languagePtSub}
          selected={lang === 'pt'}
          onPress={() => setLang('pt')}
          leading={<Text style={s.flag}>{countryByIso('PT').flag}</Text>}
          style={[s.row, { borderColor: lang === 'pt' ? palette.ink : palette.line }]}
        />
        <ChoiceRow
          title={t.languageEn}
          subtitle={t.languageEnSub}
          selected={lang === 'en'}
          onPress={() => setLang('en')}
          leading={<Text style={s.flag}>{countryByIso('US').flag}</Text>}
          style={[s.row, { borderColor: lang === 'en' ? palette.ink : palette.line }]}
        />
      </View>

      <LanguagePreview />
    </AuthScreen>
  )
}

const s = StyleSheet.create({
  list: { gap: space.md, paddingBottom: space.block },
  // Contorno em vez de preenchimento: duas superfícies cheias uma sobre a outra
  // pesariam mais que a pergunta que estão a responder.
  row: { borderWidth: 1 },
  flag: { fontSize: 24, lineHeight: 30 },
})
