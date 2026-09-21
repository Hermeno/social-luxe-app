import React from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'

import Icon, { type IconName } from '../../../components/Icon'
import AuthScreen from '../components/AuthScreen'
import { ChoiceBox } from '../components/choice'
import { PrimaryButton, QuietAction, SectionLabel } from '../components/primitives'
import Preview from '../components/Preview'
import { useT } from '../i18n'
import { useTheme, type ThemeMode } from '../theme/ThemeProvider'
import { ACCENT_ORDER, brand, space, type AccentKey } from '../theme/tokens'

interface Props {
  onDone: () => void
  onSkip: () => void
  onBack?: () => void
}

const MODES: { mode: ThemeMode; icon: IconName; key: 'themeLight' | 'themeDark' | 'themeAuto' }[] = [
  { mode: 'light', icon: 'sun', key: 'themeLight' },
  { mode: 'dark', icon: 'moon', key: 'themeDark' },
  { mode: 'auto', icon: 'contrast', key: 'themeAuto' },
]

const SIZE_KEYS = ['sizeXs', 'sizeSm', 'sizeMd', 'sizeLg', 'sizeXl'] as const
/** O "Aa" de cada caixa desenhado no tamanho que representa. */
const SIZE_GLYPH = [12, 14, 16, 18, 21]

const ACCENT_KEYS: Record<AccentKey, 'accentBlue' | 'accentIndigo' | 'accentViolet' | 'accentPurple' | 'accentMagenta'> = {
  blue: 'accentBlue',
  indigo: 'accentIndigo',
  violet: 'accentViolet',
  purple: 'accentPurple',
  magenta: 'accentMagenta',
}

const DOT = 34

/**
 * X01 — a aparência.
 *
 * Está implementado a sério, e o alcance está dito no ecrã: as escolhas mudam
 * **este percurso** no instante em que se tocam, sobrevivem a um reinício e
 * ficam guardadas nas chaves que o ecrã de Definições da aplicação já lê
 * (`@theme`, `@text_size`, `@accent_color`). O que não fazemos é dizer que
 * repintam a aplicação inteira: os ecrãs antigos não consomem estes tokens, e
 * prometer o contrário seria vender uma preferência que não acontece.
 *
 * O escuro deste módulo é papel escuro para ler texto — não é o `#0B141A` da
 * feed imersiva, que é uma superfície desenhada para ter fotografia por cima.
 *
 * O acento é um papel estreito de propósito: o ponto de uma escolha, a linha de
 * um campo com foco, o anel do arranque. Não pinta o botão principal — um
 * comando que muda de cor conforme a preferência de cada um deixa de ser o mesmo
 * objecto entre dois telefones — e não vira gradiente em lado nenhum.
 *
 * Nada aqui bloqueia: `Continuar sem personalizar` sai sem guardar escolha
 * nenhuma, e as preferências já tomadas mantêm-se porque foram guardadas ao
 * toque, não no botão.
 */
export default function AppearanceScreen({ onDone, onSkip, onBack }: Props) {
  const { palette, text, accent, accentKey, prefs, setMode, setTextLevel, setAccent } = useTheme()
  const t = useT()

  return (
    <AuthScreen
      title={t.appearanceTitle}
      intro={t.appearanceIntro}
      onBack={onBack}
      headerRight={<QuietAction label={t.skip} onPress={onSkip} tone="muted" />}
      footer={(
        <>
          <PrimaryButton label={t.appearanceSave} onPress={onDone} />
          <QuietAction label={t.appearanceSkip} onPress={onSkip} />
        </>
      )}
    >
      <View style={s.section}>
        <SectionLabel>{t.themeLabel}</SectionLabel>
        <View style={s.row} accessibilityRole="radiogroup">
          {MODES.map(({ mode, icon, key }) => (
            <ChoiceBox
              key={mode}
              selected={prefs.mode === mode}
              onPress={() => setMode(mode)}
              label={t[key]}
              accessibilityLabel={t[key]}
            >
              <Icon
                name={icon}
                size={22}
                color={prefs.mode === mode ? palette.ink : palette.inkMuted}
              />
            </ChoiceBox>
          ))}
        </View>
      </View>

      <View style={s.section}>
        <SectionLabel>{t.textSizeLabel}</SectionLabel>
        <View style={s.row} accessibilityRole="radiogroup">
          {SIZE_KEYS.map((key, index) => {
            const level = index + 1
            return (
              <ChoiceBox
                key={key}
                selected={prefs.textLevel === level}
                onPress={() => setTextLevel(level)}
                label={t[key]}
                accessibilityLabel={t[key]}
                style={s.sizeBox}
              >
                {/* O "Aa" mostra o tamanho em vez de o descrever. Um número
                    ("14 pt") não diz nada a quem está a decidir se consegue ler. */}
                <Text
                  style={{
                    fontSize: SIZE_GLYPH[index],
                    lineHeight: SIZE_GLYPH[index] + 4,
                    color: prefs.textLevel === level ? palette.ink : palette.inkMuted,
                  }}
                  maxFontSizeMultiplier={1.2}
                >
                  Aa
                </Text>
              </ChoiceBox>
            )
          })}
        </View>
      </View>

      <View style={s.section}>
        <SectionLabel>{t.accentLabel}</SectionLabel>
        <View style={s.accents} accessibilityRole="radiogroup">
          {ACCENT_ORDER.map((key) => {
            const active = accentKey === key
            return (
              <Pressable
                key={key}
                onPress={() => setAccent(key)}
                style={({ pressed }) => [s.accentTarget, { opacity: pressed ? 0.7 : 1 }]}
                accessibilityRole="radio"
                accessibilityLabel={t[ACCENT_KEYS[key]]}
                accessibilityState={{ selected: active, checked: active }}
              >
                {/* O escolhido ganha um anel à volta, e não só mais saturação:
                    cinco discos coloridos distinguidos por brilho não se leem
                    sem visão de cor. */}
                <View
                  style={[
                    s.accentRing,
                    { borderColor: active ? palette.ink : 'transparent' },
                  ]}
                >
                  <View style={[s.accentDot, { backgroundColor: brand[key] }]} />
                </View>
              </Pressable>
            )
          })}
        </View>
      </View>

      <Preview />

      <Text style={[text('help'), { color: palette.inkFaint, paddingTop: space.lg }]}>
        {t.appearanceScope}
      </Text>
    </AuthScreen>
  )
}

const s = StyleSheet.create({
  section: { paddingBottom: space.block },
  row: { flexDirection: 'row', gap: space.sm },
  // As cinco caixas de tamanho são mais estreitas que as três do tema; sem isto
  // o "Muito pequeno" partia-se em três linhas.
  sizeBox: { paddingHorizontal: space.xs, minHeight: 76 },
  accents: { flexDirection: 'row', gap: space.md },
  accentTarget: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  accentRing: {
    width: DOT + 10, height: DOT + 10, borderRadius: (DOT + 10) / 2,
    borderWidth: 2, alignItems: 'center', justifyContent: 'center',
  },
  accentDot: { width: DOT, height: DOT, borderRadius: DOT / 2 },
})
