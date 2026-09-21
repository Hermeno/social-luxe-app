import React from 'react'
import { StyleSheet, Text, View } from 'react-native'

import Icon from '../../../components/Icon'
import { useTheme } from '../theme/ThemeProvider'
import { useT } from '../i18n'
import { radius, space } from '../theme/tokens'
import { SectionLabel } from './primitives'

/**
 * A pré-visualização do L01 e do X01.
 *
 * Mostra o que a escolha faz — tipografia, tinta, acento — sobre uma publicação
 * fingida com a forma da publicação real.
 *
 * As acções desenhadas são as que a Luxey tem: gostar, comentar, repostar,
 * partilhar. O desenho aprovado trazia um marcador e um avião de papel; os dois
 * foram deixados de fora de propósito, porque a Luxey não guarda publicações e o
 * seu partilhar não é um avião. Uma pré-visualização que promete funcionalidades
 * inexistentes ensina a app errada a quem ainda nem entrou nela.
 *
 * A contagem é um número redondo e fixo, não uma métrica a fingir que é real.
 */
export default function Preview({ children }: { children?: React.ReactNode }) {
  const { palette, text, accent } = useTheme()
  const t = useT()

  return (
    <View>
      <SectionLabel>{t.preview}</SectionLabel>
      <View style={[s.card, { backgroundColor: palette.field, borderColor: palette.line }]}>
        {children ?? (
          <>
            <View style={s.head}>
              <View style={[s.avatar, { backgroundColor: palette.surface, borderColor: accent }]}>
                <Icon name="user" size={16} color={palette.inkMuted} />
              </View>
              <View style={s.headText}>
                <Text style={[text('label'), { color: palette.ink }]}>{t.previewPostAuthor}</Text>
                <Text style={[text('help'), { color: palette.inkMuted }]}>{t.previewPostTime}</Text>
              </View>
            </View>
            <Text style={[text('intro'), { color: palette.ink }]}>{t.previewPostBody}</Text>
            <View style={s.actions}>
              <View style={s.action}>
                <Icon name="heart" size={18} color={palette.inkMuted} />
                <Text style={[text('help'), { color: palette.inkMuted }]}>1,2 mil</Text>
              </View>
              <Icon name="message" size={18} color={palette.inkMuted} />
              <Icon name="swap" size={18} color={palette.inkMuted} />
              <Icon name="share" size={18} color={palette.inkMuted} />
            </View>
          </>
        )}
      </View>
    </View>
  )
}

/** A pré-visualização do idioma: uma saudação e uma frase, nada mais. */
export function LanguagePreview() {
  const { palette, text } = useTheme()
  const t = useT()

  return (
    <View>
      <SectionLabel>{t.preview}</SectionLabel>
      <View style={[s.card, { backgroundColor: palette.field, borderColor: palette.line }]}>
        <Text style={[text('row'), { color: palette.ink }]}>{t.previewGreeting}</Text>
        <Text style={[text('intro'), { color: palette.inkMuted }]}>{t.previewBody}</Text>
      </View>
    </View>
  )
}

const s = StyleSheet.create({
  card: {
    borderRadius: radius.box,
    borderWidth: 1,
    padding: space.lg,
    gap: space.md,
  },
  head: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  avatar: {
    width: 32, height: 32, borderRadius: 16, borderWidth: 1.5,
    alignItems: 'center', justifyContent: 'center',
  },
  headText: { gap: 1 },
  actions: { flexDirection: 'row', alignItems: 'center', gap: space.xl, paddingTop: space.xs },
  action: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
})
