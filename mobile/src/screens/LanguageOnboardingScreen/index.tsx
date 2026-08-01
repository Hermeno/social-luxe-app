import React, { useEffect, useRef, useState } from 'react'
import {
  View, Text, StyleSheet, TouchableOpacity, Animated, Image, useWindowDimensions,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { LinearGradient } from 'expo-linear-gradient'
import { Ionicons } from '@expo/vector-icons'
import { fonts, colors } from '../../theme'
import { useI18n, Lang } from '../../i18n'

// Idiomas suportados. `native` é o nome no próprio idioma (auto-explicativo,
// mesmo antes de escolher); `sub` é a tradução curta.
const LANGS: { code: Lang; native: string; sub: string; flag: string }[] = [
  { code: 'pt', native: 'Português', sub: 'Portuguese', flag: '🇲🇿' },
  { code: 'en', native: 'English',   sub: 'Inglês',     flag: '🇬🇧' },
]

export default function LanguageOnboardingScreen({ onDone }: { onDone: () => void }) {
  const { top, bottom } = useSafeAreaInsets()
  const { height } = useWindowDimensions()
  const setLang = useI18n((s) => s.setLang)

  const [busy, setBusy] = useState<Lang | null>(null)

  // Duas batidas: primeiro o logo respira, depois o cartão sobe.
  const logoOp = useRef(new Animated.Value(0)).current
  const logoScale = useRef(new Animated.Value(0.94)).current
  const cardY = useRef(new Animated.Value(height)).current

  useEffect(() => {
    Animated.sequence([
      Animated.parallel([
        Animated.timing(logoOp, { toValue: 1, duration: 520, useNativeDriver: true }),
        Animated.spring(logoScale, { toValue: 1, useNativeDriver: true, damping: 14, stiffness: 130 }),
      ]),
      Animated.delay(220),
      Animated.spring(cardY, { toValue: 0, useNativeDriver: true, damping: 22, stiffness: 170 }),
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

      {/* Cartão branco — sobe de baixo */}
      <Animated.View style={[s.card, { paddingBottom: bottom + 22, transform: [{ translateY: cardY }] }]}>
        <View style={s.grabber} />

        <View style={s.head}>
          <Ionicons name="globe-outline" size={18} color="#FF7A1C" />
          <Text style={s.title}>Choose your language</Text>
        </View>
        <Text style={s.sub}>Escolha o seu idioma</Text>

        <View style={s.list}>
          {LANGS.map((l, i) => (
            <TouchableOpacity
              key={l.code}
              style={[s.row, i > 0 && s.rowBorder, busy === l.code && s.rowActive]}
              activeOpacity={0.7}
              onPress={() => choose(l.code)}
            >
              <Text style={s.flag}>{l.flag}</Text>
              <View style={s.rowText}>
                <Text style={s.native}>{l.native}</Text>
                <Text style={s.rowSub}>{l.sub}</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#C9C9CE" />
            </TouchableOpacity>
          ))}
        </View>
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

  card: {
    position: 'absolute', left: 0, right: 0, bottom: 0,
    backgroundColor: colors.white,
    borderTopLeftRadius: 28, borderTopRightRadius: 28,
    paddingHorizontal: 22, paddingTop: 10,
    shadowColor: '#000', shadowOffset: { width: 0, height: -6 }, shadowOpacity: 0.12, shadowRadius: 20,
    elevation: 12,
  },
  grabber: { alignSelf: 'center', width: 40, height: 5, borderRadius: 3, backgroundColor: '#E7E7EC', marginBottom: 18 },

  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 },
  title: { fontFamily: fonts.bold, fontSize: 19, color: '#1A1A1A', letterSpacing: -0.3 },
  sub:   { fontFamily: fonts.regular, fontSize: 13, color: colors.gray400, textAlign: 'center', marginTop: 3 },

  list: { marginTop: 18 },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    paddingVertical: 15, borderRadius: 14, paddingHorizontal: 6,
  },
  rowBorder: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#EDEDF1' },
  rowActive: { backgroundColor: 'rgba(255,122,28,0.08)' },
  flag: { fontSize: 26 },
  rowText: { flex: 1 },
  native: { fontFamily: fonts.semiBold, fontSize: 16, color: '#1A1A1A', letterSpacing: -0.2 },
  rowSub: { fontFamily: fonts.regular, fontSize: 12.5, color: colors.gray400, marginTop: 1 },
})
