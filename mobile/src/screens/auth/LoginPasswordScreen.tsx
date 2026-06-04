import React, { useState, useRef } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, Animated, ActivityIndicator, Alert,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native'
import { StackNavigationProp } from '@react-navigation/stack'
import * as Haptics from 'expo-haptics'
import { useAuthStore } from '../../store/auth.store'
import { AuthStackParams } from '../../navigation/AuthNavigator'
import { fonts } from '../../theme'

type Nav   = StackNavigationProp<AuthStackParams>
type Route = RouteProp<AuthStackParams, 'LoginPassword'>

const T  = '#1A1A1A'
const S  = '#6E6E73'
const M  = '#ABABAB'
const B  = '#4C8CE4'
const E  = '#FF3B30'
const BD = '#E5E5EA'
const BG = '#FFFFFF'
const SX = '#F9F9FB'

export default function LoginPasswordScreen() {
  const nav    = useNavigation<Nav>()
  const route  = useRoute<Route>()
  const { top } = useSafeAreaInsets()
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
      Animated.spring(btnScale, { toValue: 1,    useNativeDriver: true, speed: 40, bounciness: 6 }),
    ]).start(cb)
  }

  function shake() {
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 8,  duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -8, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 6,  duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -6, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0,  duration: 40, useNativeDriver: true }),
    ]).start()
  }

  async function handleLogin() {
    if (!password) return
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    bounce(async () => {
      setLoading(true)
      setError(false)
      try {
        await login(phone, password)
      } catch {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
        setError(true)
        shake()
      } finally { setLoading(false) }
    })
  }

  return (
    <KeyboardAvoidingView style={s.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={[s.inner, { paddingTop: top + 16 }]}>

        {/* Header */}
        <View style={s.header}>
          <TouchableOpacity
            onPress={() => nav.goBack()}
            style={s.backBtn}
            hitSlop={{ top: 12, right: 12, bottom: 12, left: 12 }}
          >
            <Ionicons name="chevron-back" size={24} color={T} />
          </TouchableOpacity>
          <Text style={s.brand}>luxee</Text>
          <View style={{ width: 36 }} />
        </View>

        {/* Hero */}
        <View style={s.hero}>
          <Text style={s.heading}>Bem‑vindo{'\n'}de volta.</Text>

          {/* Phone badge */}
          <View style={s.phoneBadge}>
            <Ionicons name="call-outline" size={14} color={S} />
            <Text style={s.phoneTxt}>{phone}</Text>
          </View>
        </View>

        {/* Password input */}
        <Animated.View style={{ transform: [{ translateX: shakeAnim }] }}>
          <View style={[s.inputWrap, focused && s.inputFocused, error && s.inputError]}>
            <Ionicons name="lock-closed-outline" size={18} color={focused ? B : M} style={s.inputIcon} />
            <TextInput
              style={s.input}
              placeholder="Senha"
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
            <TouchableOpacity onPress={() => setSecure(!secure)} style={s.eyeBtn} hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}>
              <Ionicons name={secure ? 'eye-off-outline' : 'eye-outline'} size={20} color={M} />
            </TouchableOpacity>
          </View>
          {error && (
            <Text style={s.errorTxt}>Senha incorreta. Tenta novamente.</Text>
          )}
        </Animated.View>

        <View style={s.spacer} />

        {/* CTA */}
        <Animated.View style={{ transform: [{ scale: btnScale }] }}>
          <TouchableOpacity
            style={[s.btn, (!password || loading) && s.btnOff]}
            onPress={handleLogin}
            disabled={!password || loading}
            activeOpacity={1}
          >
            {loading
              ? <ActivityIndicator color="#fff" />
              : <Text style={s.btnText}>Entrar</Text>
            }
          </TouchableOpacity>
        </Animated.View>

        {/* Switch to register */}
        <TouchableOpacity
          style={s.switchRow}
          onPress={() => nav.navigate('CreatePassword', route.params)}
          hitSlop={{ top: 8, bottom: 8 }}
        >
          <Text style={s.switchTxt}>
            Não tens conta?{'  '}
            <Text style={s.switchLink}>Criar agora</Text>
          </Text>
        </TouchableOpacity>

      </View>
    </KeyboardAvoidingView>
  )
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: BG },
  inner:  { flex: 1, paddingHorizontal: 28, paddingBottom: 36 },

  header:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 44 },
  backBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#F4F4F6', alignItems: 'center', justifyContent: 'center' },
  brand:   { fontFamily: fonts.bold, fontSize: 22, color: T, letterSpacing: -0.6 },

  hero:    { marginBottom: 36, gap: 14 },
  heading: { fontSize: 40, fontFamily: fonts.bold, color: T, letterSpacing: -1.2, lineHeight: 46 },

  phoneBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start',
    backgroundColor: '#F4F4F6', borderRadius: 20,
    paddingHorizontal: 12, paddingVertical: 7,
  },
  phoneTxt: { fontFamily: fonts.medium, fontSize: 14, color: S, letterSpacing: -0.2 },

  inputWrap: {
    flexDirection: 'row', alignItems: 'center',
    height: 58, borderRadius: 14,
    borderWidth: 1.5, borderColor: BD,
    backgroundColor: SX, paddingHorizontal: 16,
  },
  inputFocused: { borderColor: B, backgroundColor: BG },
  inputError:   { borderColor: E },
  inputIcon:    { marginRight: 10 },
  input:        { flex: 1, fontFamily: fonts.regular, fontSize: 16, color: T, paddingVertical: 0 },
  eyeBtn:       { paddingLeft: 8 },
  errorTxt:     { marginTop: 8, marginLeft: 4, fontSize: 13, fontFamily: fonts.regular, color: E },

  spacer: { flex: 1 },

  btn:     { height: 56, borderRadius: 16, backgroundColor: B, alignItems: 'center', justifyContent: 'center' },
  btnOff:  { opacity: 0.3 },
  btnText: { color: '#fff', fontFamily: fonts.semiBold, fontSize: 16, letterSpacing: -0.2 },

  switchRow: { marginTop: 20, alignItems: 'center' },
  switchTxt: { fontSize: 14, fontFamily: fonts.regular, color: M },
  switchLink:{ fontFamily: fonts.semiBold, color: B },
})
