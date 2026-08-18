import React, { useState } from 'react'
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { AuthBrand, authStyles, authUi } from '../../components/AuthFlow'
import { fonts } from '../../theme'
import { useI18n, Lang } from '../../i18n'

// English em cima, Português em baixo — como pedido.
const LANGS: { code: Lang; native: string; sub: string }[] = [
  { code: 'en', native: 'English',   sub: 'Inglês' },
  { code: 'pt', native: 'Português', sub: 'Portuguese' },
]

// Este ecrã corre ANTES de haver idioma escolhido, por isso é o único sítio da
// app onde o texto não pode vir do i18n: mostra-se nas duas línguas ao mesmo
// tempo. Não é uma string esquecida — é a única forma correta aqui.
const HEADING = 'Escolhe o teu idioma'
const HEADING_EN = 'Choose your language'

export default function LanguageOnboardingScreen({ onDone }: { onDone: () => void }) {
  const { top, bottom } = useSafeAreaInsets()
  const setLang = useI18n((s) => s.setLang)
  const [busy, setBusy] = useState<Lang | null>(null)

  async function choose(code: Lang) {
    if (busy) return
    setBusy(code)
    await setLang(code)
    onDone()
  }

  return (
    <View style={[authStyles.screen, { paddingTop: top + 10, paddingBottom: bottom + 14 }]}>
      <View style={authStyles.page}>
        <View style={s.brandRow}>
          <AuthBrand />
        </View>

        <View style={[authStyles.hero, s.hero]}>
          <Text style={authStyles.heading}>{HEADING_EN}</Text>
          <Text style={authStyles.sub}>{HEADING}</Text>
        </View>

        {/* Mesma linguagem das linhas de opção do resto da entrada: moldura
            clara, divisória fina, e o toque na linha inteira. */}
        <View style={s.card}>
          {LANGS.map((l, i) => {
            const loading = busy === l.code
            return (
              <React.Fragment key={l.code}>
                {i > 0 && <View style={s.divider} />}
                <TouchableOpacity
                  style={s.row}
                  activeOpacity={0.72}
                  disabled={!!busy}
                  onPress={() => choose(l.code)}
                  accessibilityRole="button"
                  accessibilityLabel={l.native}
                  accessibilityState={{ disabled: !!busy, busy: loading }}
                >
                  <View style={s.rowText}>
                    <Text style={[s.name, busy && !loading && s.dim]}>{l.native}</Text>
                    <Text style={[s.sub, busy && !loading && s.dim]}>{l.sub}</Text>
                  </View>
                  {loading && <ActivityIndicator size="small" color={authUi.signal} />}
                </TouchableOpacity>
              </React.Fragment>
            )
          })}
        </View>
      </View>
    </View>
  )
}

const s = StyleSheet.create({
  brandRow: { alignItems: 'flex-start', paddingTop: 6 },
  hero: { marginTop: 34 },

  card: {
    marginTop: 30,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: authUi.line,
    borderRadius: 14,
    backgroundColor: authUi.paper,
    overflow: 'hidden',
  },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: authUi.line, marginLeft: 18 },

  row: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 17, paddingHorizontal: 18, gap: 12,
  },
  rowText: { flex: 1, minWidth: 0 },
  name: { fontFamily: fonts.semiBold, fontSize: 17, color: authUi.ink, letterSpacing: -0.3 },
  sub:  { fontFamily: fonts.regular, fontSize: 12.5, color: authUi.muted, marginTop: 2 },
  dim:  { opacity: 0.4 },
})
