import React, { useState, useRef } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, Animated, ActivityIndicator,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native'
import { StackNavigationProp } from '@react-navigation/stack'
import { useAuthStore } from '../../store/auth.store'
import { AuthStackParams } from '../../navigation/AuthNavigator'
import { fonts } from '../../theme'

type Nav   = StackNavigationProp<AuthStackParams>
type Route = RouteProp<AuthStackParams, 'LoginPassword'>

const T  = '#1A1A1A'
const S  = '#6E6E73'
const M  = '#ABABAB'
const B  = '#CA2851'
const E  = '#FF3B30'
const BD = '#E5E5EA'
const BG = '#FFFFFF'
const SX = '#F9F9FB'

function maskPhone(phone: string): string {
  if (phone.length < 6) return phone
  const visible = phone.slice(-3)
  const prefix = phone.slice(0, 4)
  return `${prefix} •• ••• ${visible}`
}

export default function LoginPasswordScreen() {
  const nav    = useNavigation<Nav>()
  const route  = useRoute<Route>()
  const { top, bottom } = useSafeAreaInsets()
  const { login } = useAuthStore()
  const { phone } = route.params

  const [password, setPassword] = useState('')
  const [secure,   setSecure]   = useState(true)
  const [focused,  setFocused]  = useState(false)
  const [error,    setError]    = useState(false)
  const [loading,  setLoading]  = useState(false)
  const btnScale  = useRef(new Animated.Value(1)).current
  const shakeAnim = useRef(new Animated.Value(0)).current

  function bounce(cb: () => void) {
    Animated.sequence([
      Animated.spring(btnScale, { toValue: 0.97, useNativeDriver: true, speed: 80, bounciness: 0 }),
      Animated.spring(btnScale, { toValue: 1,    useNativeDriver: true, speed: 40, bounciness: 5 }),
    ]).start(cb)
  }

  function shake() {
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 8,  duration: 55, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -8, duration: 55, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 5,  duration: 45, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -5, duration: 45, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0,  duration: 35, useNativeDriver: true }),
    ]).start()
  }

  async function handleLogin() {
    if (!password) return
    bounce(async () => {
      setLoading(true); setError(false)
      try {
        await login(phone, password)
      } catch {
        setError(true); shake()
      } finally { setLoading(false) }
    })
  }

  // Avatar initials from phone last 2 digits
  const avatarLabel = phone.replace(/\D/g, '').slice(-2) || '••'

  return (
    <KeyboardAvoidingView style={s.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={[s.inner, { paddingTop: top + 14, paddingBottom: bottom + 24 }]}>

        {/* Square back button */}
        <TouchableOpacity onPress={() => nav.goBack()} style={s.backBtn} hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}>
          <Ionicons name="chevron-back" size={20} color={T} />
        </TouchableOpacity>

        {/* Avatar + greeting */}
        <View style={s.hero}>
          {/* Dashed ring + avatar */}
          <View style={s.avatarArea}>
            <View style={s.avatarRing}>
              <View style={s.avatar}>
                <Ionicons name="person" size={44} color={B} />
              </View>
            </View>
          </View>

          <Text style={s.greeting}>Bem-vinda de volta,</Text>
          <Text style={s.phoneTxt}>{maskPhone(phone)}</Text>
        </View>

        {/* Password input */}
        <Animated.View style={{ transform: [{ translateX: shakeAnim }] }}>
          <View style={[s.inputWrap, focused && s.inputFocused, error && s.inputError]}>
            <TextInput
              style={s.input}
              placeholder="A tua senha"
              placeholderTextColor={M}
              value={password}
              onChangeText={(v) => { setPassword(v); setError(false) }}
              secureTextEntry={secure}
              autoFocus
              returnKeyType="go"
              onSubmitEditing={handleLogin}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
            />
            <TouchableOpacity onPress={() => setSecure(!secure)} hitSlop={{ top: 10, right: 10, bottom: 10, left: 10 }}>
              <Ionicons name={secure ? 'eye-off-outline' : 'eye-outline'} size={20} color={M} />
            </TouchableOpacity>
          </View>
          {error && <Text style={s.errorTxt}>Senha incorreta. Tenta novamente.</Text>}
        </Animated.View>

        {/* Forgot password — right-aligned, disabled in v1 */}
        <TouchableOpacity style={s.forgotRow} disabled activeOpacity={0.6}>
          <Text style={s.forgotTxt}>Esqueceste a senha?</Text>
        </TouchableOpacity>

        <View style={s.spacer} />

        {/* Full-width CTA */}
        <Animated.View style={{ transform: [{ scale: btnScale }] }}>
          <TouchableOpacity
            style={[s.cta, (!password || loading) && s.ctaOff]}
            onPress={handleLogin}
            disabled={!password || loading}
            activeOpacity={0.88}
          >
            {loading
              ? <ActivityIndicator color="#fff" size="small" />
              : <Text style={s.ctaTxt}>Entrar</Text>
            }
          </TouchableOpacity>
        </Animated.View>

        {/* Switch account */}
        <TouchableOpacity style={s.switchRow} onPress={() => nav.goBack()} activeOpacity={0.6}>
          <Text style={s.switchTxt}>Não és tu? <Text style={s.switchLink}>Trocar de conta</Text></Text>
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
    borderWidth: 1.5, borderColor: BD, backgroundColor: BG,
    alignItems: 'center', justifyContent: 'center',
  },

  hero: { alignItems: 'center', marginTop: 44, marginBottom: 36, gap: 10 },

  avatarArea: { marginBottom: 6 },
  avatarRing: {
    width: 112, height: 112, borderRadius: 56,
    borderWidth: 2, borderColor: BD,
    borderStyle: 'dashed',
    padding: 4,
    alignItems: 'center', justifyContent: 'center',
  },
  avatar: {
    width: 100, height: 100, borderRadius: 50,
    backgroundColor: `${B}12`,
    alignItems: 'center', justifyContent: 'center',
  },

  greeting: { fontFamily: fonts.regular, fontSize: 15, color: S, marginTop: 4 },
  phoneTxt:  { fontFamily: fonts.bold, fontSize: 20, color: T, letterSpacing: -0.4 },

  inputWrap: {
    flexDirection: 'row', alignItems: 'center',
    height: 56, borderRadius: 16,
    borderWidth: 1.5, borderColor: BD,
    backgroundColor: SX, paddingHorizontal: 18,
  },
  inputFocused: {
    borderColor: B, backgroundColor: BG,
    ...Platform.select({
      ios: { shadowColor: B, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.12, shadowRadius: 10 },
    }),
  },
  inputError: { borderColor: E },
  input:      { flex: 1, fontFamily: fonts.medium, fontSize: 17, color: T, paddingVertical: 0 },
  errorTxt:   { marginTop: 8, fontSize: 13, fontFamily: fonts.regular, color: E },

  forgotRow: { alignItems: 'flex-end', marginTop: 12 },
  forgotTxt: { fontSize: 13, fontFamily: fonts.semiBold, color: M },

  spacer: { flex: 1 },

  cta: {
    height: 52, borderRadius: 16, backgroundColor: B,
    alignItems: 'center', justifyContent: 'center',
    ...Platform.select({
      ios: { shadowColor: B, shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.65, shadowRadius: 18 },
      android: { elevation: 8 },
    }),
  },
  ctaOff: { opacity: 0.35 },
  ctaTxt: { fontFamily: fonts.bold, fontSize: 17, color: '#fff', letterSpacing: -0.2 },

  switchRow: { marginTop: 14, alignItems: 'center' },
  switchTxt: { fontSize: 13, fontFamily: fonts.regular, color: M },
  switchLink:{ color: S, fontFamily: fonts.semiBold },
})
