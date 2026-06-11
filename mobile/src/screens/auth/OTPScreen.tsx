import React, { useState, useRef, useEffect } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, Animated, ActivityIndicator,
  NativeSyntheticEvent, TextInputKeyPressEventData,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native'
import { StackNavigationProp } from '@react-navigation/stack'
import * as Haptics from 'expo-haptics'
import { AuthStackParams } from '../../navigation/AuthNavigator'
import { fonts } from '../../theme'

type Nav   = StackNavigationProp<AuthStackParams>
type Route = RouteProp<AuthStackParams, 'OTP'>

const T  = '#1A1A1A'
const S  = '#6E6E73'
const M  = '#ABABAB'
const B  = '#4C8CE4'
const E  = '#FF3B30'
const BD = '#E5E5EA'
const BG = '#FFFFFF'
const SX = '#F9F9FB'

const CODE_LENGTH = 6
const RESEND_SECS = 60

function maskPhone(phone: string): string {
  if (phone.length < 6) return phone
  const visible = phone.slice(-3)
  const prefix = phone.slice(0, 4)
  return `${prefix} •• ••• ${visible}`
}

export default function OTPScreen() {
  const nav   = useNavigation<Nav>()
  const route = useRoute<Route>()
  const { top, bottom } = useSafeAreaInsets()
  const { phone } = route.params

  const [code,    setCode]    = useState<string[]>(Array(CODE_LENGTH).fill(''))
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState(false)
  const [resend,  setResend]  = useState(RESEND_SECS)
  const inputs  = useRef<(TextInput | null)[]>([])
  const btnScale = useRef(new Animated.Value(1)).current

  useEffect(() => {
    if (resend <= 0) return
    const t = setTimeout(() => setResend((s) => s - 1), 1000)
    return () => clearTimeout(t)
  }, [resend])

  const filled = code.every((c) => c !== '')

  function bounce(cb: () => void) {
    Animated.sequence([
      Animated.spring(btnScale, { toValue: 0.97, useNativeDriver: true, speed: 80, bounciness: 0 }),
      Animated.spring(btnScale, { toValue: 1,    useNativeDriver: true, speed: 40, bounciness: 5 }),
    ]).start(cb)
  }

  function handleChange(text: string, idx: number) {
    const digit = text.replace(/[^0-9]/g, '').slice(-1)
    const next = [...code]; next[idx] = digit; setCode(next); setError(false)
    if (digit && idx < CODE_LENGTH - 1) inputs.current[idx + 1]?.focus()
  }

  function handleKeyPress(e: NativeSyntheticEvent<TextInputKeyPressEventData>, idx: number) {
    if (e.nativeEvent.key === 'Backspace' && !code[idx] && idx > 0) {
      const next = [...code]; next[idx - 1] = ''; setCode(next)
      inputs.current[idx - 1]?.focus()
    }
  }

  async function handleVerify() {
    if (!filled) return
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    bounce(async () => {
      setLoading(true)
      try {
        // TODO: v2 — OTP verification disabled in v1
        // await authService.verifyOTP(phone, code.join(''))
      } catch {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
        setError(true); setCode(Array(CODE_LENGTH).fill(''))
        inputs.current[0]?.focus()
      } finally { setLoading(false) }
    })
  }

  function handleResend() {
    if (resend > 0) return
    setResend(RESEND_SECS); setCode(Array(CODE_LENGTH).fill('')); setError(false)
    inputs.current[0]?.focus()
  }

  return (
    <KeyboardAvoidingView style={s.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={[s.inner, { paddingTop: top + 14, paddingBottom: bottom + 24 }]}>

        {/* Square back button */}
        <TouchableOpacity onPress={() => nav.goBack()} style={s.backBtn} hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}>
          <Ionicons name="chevron-back" size={20} color={T} />
        </TouchableOpacity>

        {/* Hero */}
        <View style={s.hero}>
          <Text style={s.heading}>Confirma{'\n'}o código.</Text>
          <Text style={s.sub}>
            Enviámos um código de 6 dígitos para{'\n'}
            <Text style={s.phoneHighlight}>{maskPhone(phone)}</Text>
          </Text>
        </View>

        {/* 6 code boxes */}
        <View style={s.boxRow}>
          {Array.from({ length: CODE_LENGTH }, (_, i) => (
            <View key={i} style={[s.box, code[i] ? s.boxFilled : null, error ? s.boxError : null]}>
              <TextInput
                ref={(r) => { inputs.current[i] = r }}
                style={s.boxInput}
                value={code[i]}
                onChangeText={(t) => handleChange(t, i)}
                onKeyPress={(e) => handleKeyPress(e, i)}
                keyboardType="number-pad"
                maxLength={2}
                selectTextOnFocus
                caretHidden
                autoFocus={i === 0}
              />
            </View>
          ))}
        </View>

        {error && <Text style={s.errorTxt}>Código incorreto. Tenta novamente.</Text>}

        {/* Resend */}
        <TouchableOpacity style={s.resendRow} onPress={handleResend} disabled={resend > 0} activeOpacity={0.6}>
          <Ionicons name="time-outline" size={14} color={resend > 0 ? M : B} />
          {resend > 0 ? (
            <Text style={s.resendWait}>Reenviar código em <Text style={s.resendTimer}>{resend}s</Text></Text>
          ) : (
            <Text style={s.resendActive}>Reenviar código</Text>
          )}
        </TouchableOpacity>

        <View style={s.spacer} />

        {/* Full-width CTA */}
        <Animated.View style={{ transform: [{ scale: btnScale }] }}>
          <TouchableOpacity
            style={[s.cta, (!filled || loading) && s.ctaOff]}
            onPress={handleVerify}
            disabled={!filled || loading}
            activeOpacity={0.88}
          >
            {loading
              ? <ActivityIndicator color="#fff" size="small" />
              : <Text style={s.ctaTxt}>Verificar</Text>
            }
          </TouchableOpacity>
        </Animated.View>

        {/* Call me link */}
        <TouchableOpacity style={s.callRow} activeOpacity={0.6}>
          <Text style={s.callTxt}>Não recebeste nada? <Text style={s.callLink}>Liga-me</Text></Text>
        </TouchableOpacity>

      </View>
    </KeyboardAvoidingView>
  )
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: BG },
  inner:  { flex: 1, paddingHorizontal: 24 },

  backBtn: {
    width: 44, height: 44, borderRadius: 14,
    borderWidth: 1.5, borderColor: BD,
    backgroundColor: BG,
    alignItems: 'center', justifyContent: 'center',
  },

  hero:          { marginTop: 44, marginBottom: 36, gap: 14 },
  heading:       { fontFamily: fonts.extraBold, fontSize: 34, lineHeight: 40, letterSpacing: -1, color: T },
  sub:           { fontFamily: fonts.regular, fontSize: 15, lineHeight: 22, color: S },
  phoneHighlight:{ fontFamily: fonts.semiBold, color: T },

  boxRow: { flexDirection: 'row', gap: 10 },
  box: {
    flex: 1, height: 64, borderRadius: 16,
    borderWidth: 1.5, borderColor: BD,
    backgroundColor: SX,
    alignItems: 'center', justifyContent: 'center',
  },
  boxFilled: {
    borderColor: B, backgroundColor: BG,
    ...Platform.select({
      ios: { shadowColor: B, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.12, shadowRadius: 8 },
    }),
  },
  boxError:  { borderColor: E, backgroundColor: `${E}0A` },
  boxInput: {
    width: '100%', height: '100%',
    textAlign: 'center', fontSize: 24,
    fontFamily: fonts.bold, color: T,
  },

  errorTxt: { marginTop: 12, fontSize: 13, fontFamily: fonts.regular, color: E, textAlign: 'center' },

  resendRow: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    marginTop: 20, justifyContent: 'center',
  },
  resendWait:   { fontSize: 14, fontFamily: fonts.regular, color: M },
  resendTimer:  { fontFamily: fonts.semiBold, color: S },
  resendActive: { fontSize: 14, fontFamily: fonts.semiBold, color: B },

  spacer: { flex: 1 },

  cta: {
    height: 52, borderRadius: 16,
    backgroundColor: B,
    alignItems: 'center', justifyContent: 'center',
    ...Platform.select({
      ios: { shadowColor: B, shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.65, shadowRadius: 18 },
      android: { elevation: 8 },
    }),
  },
  ctaOff: { opacity: 0.45 },
  ctaTxt: { fontFamily: fonts.bold, fontSize: 17, color: '#fff', letterSpacing: -0.2 },

  callRow: { marginTop: 14, alignItems: 'center' },
  callTxt: { fontSize: 13, fontFamily: fonts.regular, color: M },
  callLink:{ color: S, fontFamily: fonts.semiBold },
})
