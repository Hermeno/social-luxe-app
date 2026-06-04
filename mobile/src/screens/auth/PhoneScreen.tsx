import React, { useState, useRef } from 'react'
import {
  View, Text, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, Animated, ActivityIndicator,
} from 'react-native'
import PhoneInput from 'react-native-phone-number-input'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import * as Haptics from 'expo-haptics'
import { useNavigation } from '@react-navigation/native'
import { StackNavigationProp } from '@react-navigation/stack'
import { AuthStackParams } from '../../navigation/AuthNavigator'
import * as authService from '../../services/auth.service'
import { fonts } from '../../theme'

type Nav = StackNavigationProp<AuthStackParams>

// ── Design tokens ─────────────────────────────────────────────────────────────
const T  = '#1A1A1A'
const S  = '#6E6E73'
const M  = '#ABABAB'
const B  = '#4C8CE4'
const BD = '#E5E5EA'
const BG = '#FFFFFF'
const SX = '#F9F9FB'

export default function PhoneScreen() {
  const nav     = useNavigation<Nav>()
  const { top } = useSafeAreaInsets()
  const [phone,       setPhone]       = useState('')
  const [countryCode, setCountryCode] = useState('+244')
  const [loading,     setLoading]     = useState(false)
  const btnScale = useRef(new Animated.Value(1)).current

  function bounce(cb: () => void) {
    Animated.sequence([
      Animated.spring(btnScale, { toValue: 0.97, useNativeDriver: true, speed: 80, bounciness: 0 }),
      Animated.spring(btnScale, { toValue: 1,    useNativeDriver: true, speed: 40, bounciness: 6 }),
    ]).start(cb)
  }

  async function handleContinue() {
    if (!canGo) return
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    bounce(async () => {
      setLoading(true)
      try {
        const { exists } = await authService.checkPhone(phone)
        nav.navigate(exists ? 'LoginPassword' : 'CreatePassword', { phone, countryCode })
      } catch {
        nav.navigate('LoginPassword', { phone, countryCode })
      } finally { setLoading(false) }
    })
  }

  const canGo = phone.length >= 7

  return (
    <KeyboardAvoidingView style={s.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={[s.inner, { paddingTop: top + 20 }]}>

        {/* Brand */}
        <View style={s.brandRow}>
          <Text style={s.brand}>luxee</Text>
          <View style={s.brandDot} />
        </View>

        {/* Hero text */}
        <View style={s.hero}>
          <Text style={s.heading}>O teu{'\n'}número.</Text>
          <Text style={s.sub}>Usamos apenas para identificar a tua conta.{'\n'}Nunca partilhamos com terceiros.</Text>
        </View>

        {/* Phone input */}
        <View style={s.phoneWrap}>
          <PhoneInput
            defaultCode="AO"
            layout="first"
            onChangeFormattedText={setPhone}
            onChangeCountry={(c) => setCountryCode(`+${c.callingCode[0]}`)}
            containerStyle={s.phoneContainer}
            textContainerStyle={s.phoneTextContainer}
            textInputStyle={s.phoneText}
            codeTextStyle={s.phoneText}
            flagButtonStyle={s.phoneFlag}
            textInputProps={{
              placeholderTextColor: M,
              returnKeyType: 'done',
              onSubmitEditing: handleContinue,
            }}
          />
        </View>

        <View style={s.spacer} />

        {/* CTA */}
        <Animated.View style={{ transform: [{ scale: btnScale }] }}>
          <TouchableOpacity
            style={[s.btn, !canGo && s.btnOff]}
            onPress={handleContinue}
            disabled={!canGo || loading}
            activeOpacity={1}
          >
            {loading
              ? <ActivityIndicator color="#fff" />
              : <Text style={s.btnText}>Continuar</Text>
            }
          </TouchableOpacity>
        </Animated.View>

        {/* Legal */}
        <Text style={s.legal}>
          Ao continuar, aceitas os{' '}
          <Text style={s.legalLink}>Termos de Serviço</Text>
          {' '}e a{' '}
          <Text style={s.legalLink}>Política de Privacidade</Text>
        </Text>

      </View>
    </KeyboardAvoidingView>
  )
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: BG },
  inner:  { flex: 1, paddingHorizontal: 28, paddingBottom: 36 },

  // Brand
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 52 },
  brand:    { fontFamily: fonts.bold, fontSize: 22, color: T, letterSpacing: -0.6 },
  brandDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: B, marginTop: 2 },

  // Hero
  hero:    { marginBottom: 40, gap: 12 },
  heading: {
    fontSize: 40, fontFamily: fonts.bold, color: T,
    letterSpacing: -1.2, lineHeight: 46,
  },
  sub: {
    fontSize: 15, fontFamily: fonts.regular, color: S,
    lineHeight: 22, letterSpacing: -0.1,
  },

  // Phone input
  phoneWrap:          { borderRadius: 14, overflow: 'hidden', borderWidth: 1.5, borderColor: BD, backgroundColor: SX },
  phoneContainer:     { width: '100%', backgroundColor: 'transparent', height: 58 },
  phoneTextContainer: { backgroundColor: 'transparent', paddingVertical: 0, borderLeftWidth: 1, borderLeftColor: BD },
  phoneText:          { fontFamily: fonts.regular, fontSize: 16, color: T },
  phoneFlag:          { backgroundColor: 'transparent' },

  spacer: { flex: 1 },

  // CTA
  btn:     { height: 56, borderRadius: 16, backgroundColor: B, alignItems: 'center', justifyContent: 'center' },
  btnOff:  { opacity: 0.3 },
  btnText: { color: '#fff', fontFamily: fonts.semiBold, fontSize: 16, letterSpacing: -0.2 },

  // Legal
  legal:     { marginTop: 16, fontSize: 12, fontFamily: fonts.regular, color: M, textAlign: 'center', lineHeight: 18 },
  legalLink: { color: S, fontFamily: fonts.medium },
})
