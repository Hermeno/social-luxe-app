import React, { useState, useRef } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, Animated, ActivityIndicator,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { useNavigation } from '@react-navigation/native'
import { StackNavigationProp } from '@react-navigation/stack'
import { AuthStackParams } from '../../navigation/AuthNavigator'
import * as authService from '../../services/auth.service'
import { fonts } from '../../theme'

function detectCountry(): string {
  try {
    const locale = Intl.DateTimeFormat().resolvedOptions().locale
    const parts = locale.split('-')
    for (let i = parts.length - 1; i >= 0; i--) {
      const p = parts[i]
      if (p.length === 2 && p === p.toUpperCase()) return p
    }
  } catch {}
  return 'AO'
}

function callingCodeForCountry(country: string): { code: string; flag: string } {
  const map: Record<string, { code: string; flag: string }> = {
    AO: { code: '+244', flag: '🇦🇴' },
    PT: { code: '+351', flag: '🇵🇹' },
    BR: { code: '+55',  flag: '🇧🇷' },
    MZ: { code: '+258', flag: '🇲🇿' },
    CV: { code: '+238', flag: '🇨🇻' },
    ST: { code: '+239', flag: '🇸🇹' },
    GW: { code: '+245', flag: '🇬🇼' },
  }
  return map[country] ?? { code: '+244', flag: '🇦🇴' }
}

type Nav = StackNavigationProp<AuthStackParams>

export default function PhoneScreen() {
  const nav     = useNavigation<Nav>()
  const { top, bottom } = useSafeAreaInsets()
  const country = detectCountry()
  const { code: defaultCode, flag: defaultFlag } = callingCodeForCountry(country)

  const [phone,   setPhone]   = useState('')
  const [code,    setCode]    = useState(defaultCode)
  const [flag,    setFlag]    = useState(defaultFlag)
  const [loading, setLoading] = useState(false)
  const [focused, setFocused] = useState(false)
  const btnScale = useRef(new Animated.Value(1)).current

  const canGo = phone.replace(/\D/g, '').length >= 7

  function bounce(cb: () => void) {
    Animated.sequence([
      Animated.spring(btnScale, { toValue: 0.97, useNativeDriver: true, speed: 60, bounciness: 0 }),
      Animated.spring(btnScale, { toValue: 1,    useNativeDriver: true, speed: 40, bounciness: 5 }),
    ]).start(cb)
  }

  async function handleContinue() {
    if (!canGo) return
    bounce(async () => {
      setLoading(true)
      try {
        const full = `${code}${phone.replace(/\D/g, '')}`
        const { exists } = await authService.checkPhone(full)
        nav.navigate(exists ? 'LoginPassword' : 'CreatePassword', { phone: full, countryCode: code })
      } catch {
        const full = `${code}${phone.replace(/\D/g, '')}`
        nav.navigate('LoginPassword', { phone: full, countryCode: code })
      } finally { setLoading(false) }
    })
  }

  return (
    <KeyboardAvoidingView style={s.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={[s.inner, { paddingTop: top + 18, paddingBottom: bottom + 14 }]}>

        {/* Brand + tagline */}
        <View style={s.brandRow}>
          <Text style={s.brand}>luxee</Text>
          <View style={s.brandDot} />
          <Text style={s.tagline}>histórias que desaparecem</Text>
        </View>

        {/* Heading */}
        <View style={s.hero}>
          <Text style={s.heading}>Qual é o teu{'\n'}número?</Text>
          <Text style={s.sub}>Vamos enviar-te um código por SMS para confirmar que és mesmo tu.</Text>
        </View>

        {/* Phone inputs */}
        <View style={s.inputRow}>
          {/* Country code selector */}
          <TouchableOpacity style={s.countryBtn} activeOpacity={0.75}>
            <Text style={s.countryFlag}>{flag}</Text>
            <Text style={s.countryCode}>{code}</Text>
            <Ionicons name="chevron-down" size={18} color="#ABABAB" />
          </TouchableOpacity>

          {/* Number field */}
          <View style={[s.phoneWrap, focused && s.phoneWrapFocused]}>
            <TextInput
              style={s.phoneInput}
              placeholder="923 456 789"
              placeholderTextColor="#ABABAB"
              value={phone}
              onChangeText={setPhone}
              keyboardType="phone-pad"
              returnKeyType="done"
              onSubmitEditing={handleContinue}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              autoFocus
            />
          </View>
        </View>

        <View style={s.spacer} />

        {/* CTA */}
        <Animated.View style={{ transform: [{ scale: btnScale }] }}>
          <TouchableOpacity
            style={[s.cta, (!canGo || loading) && s.ctaOff]}
            onPress={handleContinue}
            disabled={!canGo || loading}
            activeOpacity={0.88}
          >
            {loading
              ? <ActivityIndicator color="#fff" size="small" />
              : <>
                  <Text style={s.ctaTxt}>Continuar</Text>
                  <Ionicons name="arrow-forward" size={19} color="#fff" />
                </>
            }
          </TouchableOpacity>
        </Animated.View>

        {/* Legal */}
        <Text style={s.legal}>
          Ao continuar, aceitas os{' '}
          <Text style={s.legalLink}>Termos</Text>
          {' '}e a{' '}
          <Text style={s.legalLink}>Política de Privacidade</Text>
          {' '}da luxee.
        </Text>

      </View>
    </KeyboardAvoidingView>
  )
}

const B  = '#CA2851'
const T  = '#1A1A1A'
const S  = '#6E6E73'
const M  = '#ABABAB'
const BD = '#E5E5EA'
const BG = '#FFFFFF'
const SX = '#F9F9FB'

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: BG },
  inner:  { flex: 1, paddingHorizontal: 24 },

  brandRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 7, marginBottom: 0 },
  brand:    { fontFamily: fonts.bold, fontSize: 22, color: T, letterSpacing: -0.6 },
  brandDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: B, marginTop: 9 },
  tagline:  { marginLeft: 6, fontFamily: fonts.medium, fontSize: 13, color: M, letterSpacing: -0.1, marginTop: 6 },

  hero:    { marginTop: 48, gap: 14 },
  heading: { fontFamily: fonts.extraBold, fontSize: 34, lineHeight: 40, letterSpacing: -1, color: T },
  sub:     { fontFamily: fonts.regular, fontSize: 15, lineHeight: 22, color: S },

  inputRow: { marginTop: 34, flexDirection: 'row', gap: 10 },

  countryBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    height: 56, borderRadius: 16,
    borderWidth: 1.5, borderColor: BD,
    backgroundColor: SX, paddingHorizontal: 14,
    flexShrink: 0,
  },
  countryFlag: { fontSize: 22, lineHeight: 26 },
  countryCode: { fontFamily: fonts.semiBold, fontSize: 17, color: T },

  phoneWrap: {
    flex: 1, height: 56, borderRadius: 16,
    borderWidth: 1.5, borderColor: BD,
    backgroundColor: SX,
    paddingHorizontal: 16, justifyContent: 'center',
  },
  phoneWrapFocused: {
    borderColor: B, backgroundColor: BG,
    ...Platform.select({
      ios: { shadowColor: B, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.15, shadowRadius: 12 },
    }),
  },
  phoneInput: {
    fontFamily: fonts.medium, fontSize: 17,
    color: T, letterSpacing: 0.3,
    paddingVertical: 0,
  },

  spacer: { flex: 1 },

  cta: {
    height: 52, borderRadius: 16,
    backgroundColor: B,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    ...Platform.select({
      ios: { shadowColor: B, shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.65, shadowRadius: 18 },
      android: { elevation: 8 },
    }),
  },
  ctaOff: { opacity: 0.45 },
  ctaTxt: { fontFamily: fonts.bold, fontSize: 17, color: '#fff', letterSpacing: -0.2 },

  legal:     { marginTop: 16, fontSize: 12, fontFamily: fonts.regular, color: M, textAlign: 'center', lineHeight: 18, paddingHorizontal: 6 },
  legalLink: { color: S, fontFamily: fonts.semiBold },
})
