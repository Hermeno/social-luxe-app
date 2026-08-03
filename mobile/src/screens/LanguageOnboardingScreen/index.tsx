import React from 'react'
import { useEffect, useRef, useState } from 'react'
import {
  View, Text, StyleSheet, TouchableOpacity, Animated, Image, useWindowDimensions,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { LinearGradient } from 'expo-linear-gradient'
import { fonts } from '../../theme'
import { useI18n, Lang } from '../../i18n'

// English em cima, Português em baixo — como pedido.
const LANGS: { code: Lang; native: string; sub: string }[] = [
  { code: 'en', native: 'English',   sub: 'Inglês' },
  { code: 'pt', native: 'Português', sub: 'Portuguese' },
]

export default function LanguageOnboardingScreen({ onDone }: { onDone: () => void }) {
  const { top } = useSafeAreaInsets()
  const { height } = useWindowDimensions()
  const setLang = useI18n((s) => s.setLang)

  const [busy, setBusy] = useState<Lang | null>(null)

  // Duas batidas: o logo respira, depois o seletor aparece.
  const logoOp    = useRef(new Animated.Value(0)).current
  const logoScale = useRef(new Animated.Value(0.94)).current
  const selOp     = useRef(new Animated.Value(0)).current

  useEffect(() => {
    Animated.sequence([
      Animated.parallel([
        Animated.timing(logoOp, { toValue: 1, duration: 520, useNativeDriver: true }),
        Animated.spring(logoScale, { toValue: 1, useNativeDriver: true, damping: 14, stiffness: 130 }),
      ]),
      Animated.delay(180),
      Animated.timing(selOp, { toValue: 1, duration: 460, useNativeDriver: true }),
    ]).start()
  }, [])

  async function choose(code: Lang) {
    if (busy) return
    setBusy(code)
    await setLang(code)
    onDone()
  }

  return (
    <View style={s.root}>
      <LinearGradient
        colors={['#FF6A00', '#FF7A1C', '#FFC58A']}
        locations={[0, 0.45, 1]}
        style={StyleSheet.absoluteFill}
      />

      {/* Logótipo — centrado no terço superior */}
      <Animated.View
        style={[
          s.logoWrap,
          { top: top + height * 0.18, opacity: logoOp, transform: [{ scale: logoScale }] },
        ]}
        pointerEvents="none"
      >
        <Image
          source={require('../../../assets/files/luxee-L-symbol.png')}
          style={s.logoMark}
          resizeMode="contain"
        />
        <Text style={s.wordmark}>luxee</Text>
      </Animated.View>

      {/* Seletor — transparente, no meio da página. Uma linha separa os idiomas. */}
      <Animated.View style={[s.selector, { opacity: selOp }]}>
        {LANGS.map((l, i) => (
          <React.Fragment key={l.code}>
            {i > 0 && <View style={s.divider} />}
            <TouchableOpacity
              style={s.opt}
              activeOpacity={0.6}
              disabled={!!busy}
              onPress={() => choose(l.code)}
            >
              <Text style={[s.optName, busy && busy !== l.code && s.optDim]}>{l.native}</Text>
              <Text style={s.optSub}>{l.sub}</Text>
            </TouchableOpacity>
          </React.Fragment>
        ))}
      </Animated.View>
    </View>
  )
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#FF7A1C' },

  logoWrap: { position: 'absolute', left: 0, right: 0, alignItems: 'center' },
  logoMark: { width: 72, height: 72, tintColor: 'rgba(255,255,255,0.96)', marginBottom: 14 },
  wordmark: {
    fontFamily: fonts.extraBold, fontSize: 42, color: '#FFFFFF', letterSpacing: -1.2,
    textShadowColor: 'rgba(0,0,0,0.12)', textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 8,
  },

  selector: {
    position: 'absolute', left: 0, right: 0, top: 0, bottom: 0,
    alignItems: 'center', justifyContent: 'center',
  },
  opt: { paddingVertical: 22, alignItems: 'center' },
  optName: {
    fontFamily: fonts.bold, fontSize: 30, color: '#FFFFFF', letterSpacing: -0.4,
    textShadowColor: 'rgba(0,0,0,0.10)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 6,
  },
  optDim: { opacity: 0.4 },
  optSub: { fontFamily: fonts.regular, fontSize: 13, color: 'rgba(255,255,255,0.82)', marginTop: 4, letterSpacing: 0.2 },
  divider: { width: 200, height: StyleSheet.hairlineWidth, backgroundColor: 'rgba(255,255,255,0.55)' },
})
