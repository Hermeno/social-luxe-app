import React, { useState, useRef } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, Animated, ActivityIndicator,
} from 'react-native'
import PhoneInput from 'react-native-phone-number-input'
import { useNavigation } from '@react-navigation/native'
import { StackNavigationProp } from '@react-navigation/stack'
import * as Haptics from 'expo-haptics'
import { AuthStackParams } from '../../navigation/AuthNavigator'
import * as authService from '../../services/auth.service'
import { fonts } from '../../theme'

type Nav = StackNavigationProp<AuthStackParams>

const PRIMARY = '#FF4B6E'
const BG      = '#FFFFFF'
const INPUT_BG = '#F5F5F7'
const TEXT     = '#111111'
const MUTED    = '#9CA3AF'

export default function PhoneScreen() {
  const nav   = useNavigation<Nav>()
  const [phone, setPhone]           = useState('')
  const [countryCode, setCountryCode] = useState('+244')
  const [loading, setLoading]       = useState(false)
  const btnScale = useRef(new Animated.Value(1)).current

  function animateBtn(cb: () => void) {
    Animated.sequence([
      Animated.spring(btnScale, { toValue: 0.96, useNativeDriver: true, speed: 60 }),
      Animated.spring(btnScale, { toValue: 1,    useNativeDriver: true, speed: 40, bounciness: 6 }),
    ]).start(cb)
  }

  async function handleContinue() {
    if (!phone) return
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    animateBtn(async () => {
      setLoading(true)
      try {
        const { exists } = await authService.checkPhone(phone)
        if (exists) {
          nav.navigate('LoginPassword', { phone, countryCode })
        } else {
          nav.navigate('CreatePassword', { phone, countryCode })
        }
      } catch {
        nav.navigate('LoginPassword', { phone, countryCode })
      } finally {
        setLoading(false)
      }
    })
  }

  const canContinue = phone.length >= 7

  return (
    <KeyboardAvoidingView style={s.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={s.inner}>

        {/* Brand */}
        <Text style={s.brand}>luxe</Text>

        {/* Heading */}
        <View style={s.headWrap}>
          <Text style={s.heading}>O teu número</Text>
          <Text style={s.sub}>Usamos apenas para identificar a tua conta. Nunca partilhamos.</Text>
        </View>

        {/* Phone input */}
        <PhoneInput
          defaultCode="AO"
          layout="first"
          onChangeFormattedText={setPhone}
          onChangeCountry={(c) => setCountryCode(`+${c.callingCode[0]}`)}
          containerStyle={s.phoneBox}
          textContainerStyle={s.phoneInner}
          textInputStyle={s.phoneText}
          codeTextStyle={s.phoneText}
          flagButtonStyle={s.phoneFlag}
          textInputProps={{ placeholderTextColor: MUTED, returnKeyType: 'done', onSubmitEditing: handleContinue }}
        />

        <View style={s.spacer} />

        {/* CTA */}
        <Animated.View style={{ transform: [{ scale: btnScale }] }}>
          <TouchableOpacity
            style={[s.btn, !canContinue && s.btnOff]}
            onPress={handleContinue}
            disabled={!canContinue || loading}
            activeOpacity={1}
          >
            {loading
              ? <ActivityIndicator color="#fff" />
              : <Text style={s.btnText}>Continuar</Text>
            }
          </TouchableOpacity>
        </Animated.View>

        <View style={s.legalWrap}>
          <Text style={s.legal}>Ao continuar, aceitas os nossos Termos e Política de Privacidade</Text>
        </View>

      </View>
    </KeyboardAvoidingView>
  )
}

const s = StyleSheet.create({
  screen:    { flex: 1, backgroundColor: BG },
  inner:     { flex: 1, paddingHorizontal: 28, paddingTop: 64, paddingBottom: 40 },
  brand:     { fontSize: 22, fontFamily: fonts.bold, color: PRIMARY, letterSpacing: -0.3, marginBottom: 52 },
  headWrap:  { marginBottom: 36, gap: 8 },
  heading:   { fontSize: 28, fontFamily: fonts.semiBold, color: TEXT, letterSpacing: -0.5, lineHeight: 34 },
  sub:       { fontSize: 14, fontFamily: fonts.regular, color: MUTED, lineHeight: 20 },

  phoneBox:  { backgroundColor: INPUT_BG, borderRadius: 14, width: '100%', borderWidth: 0, height: 58 },
  phoneInner:{ backgroundColor: INPUT_BG, borderRadius: 14 },
  phoneText: { color: TEXT, fontFamily: fonts.regular, fontSize: 16, paddingVertical: 0 },
  phoneFlag: { backgroundColor: INPUT_BG, borderRadius: 14 },

  spacer:    { flex: 1 },

  btn:       { backgroundColor: PRIMARY, borderRadius: 14, height: 56, alignItems: 'center', justifyContent: 'center' },
  btnOff:    { opacity: 0.35 },
  btnText:   { color: '#fff', fontFamily: fonts.semiBold, fontSize: 16, letterSpacing: 0.1 },

  legalWrap: { marginTop: 18 },
  legal:     { fontSize: 12, fontFamily: fonts.regular, color: MUTED, textAlign: 'center', lineHeight: 18 },
})
