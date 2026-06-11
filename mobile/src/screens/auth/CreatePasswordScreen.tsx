import React, { useState, useRef } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, Animated, Alert,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native'
import { StackNavigationProp } from '@react-navigation/stack'
import * as Haptics from 'expo-haptics'
import { AuthStackParams } from '../../navigation/AuthNavigator'
import { fonts } from '../../theme'

type Nav   = StackNavigationProp<AuthStackParams>
type Route = RouteProp<AuthStackParams, 'CreatePassword'>

const T  = '#1A1A1A'
const S  = '#6E6E73'
const M  = '#ABABAB'
const B  = '#4C8CE4'
const E  = '#FF3B30'
const G  = '#34C759'
const BD = '#E5E5EA'
const BG = '#FFFFFF'
const SX = '#F9F9FB'

function strengthLevel(pwd: string): 0 | 1 | 2 | 3 | 4 {
  if (!pwd) return 0
  let score = 0
  if (pwd.length >= 8) score++
  if (/[0-9]/.test(pwd)) score++
  if (/[A-Z]/.test(pwd)) score++
  if (/[!@#$%^&*]/.test(pwd)) score++
  return Math.min(score, 4) as 0 | 1 | 2 | 3 | 4
}

const SEG_COLOR: Record<number, string> = {
  0: BD, 1: E, 2: '#FF9500', 3: '#FFCC00', 4: G,
}

interface CheckItem { label: string; test: (p: string) => boolean }
const CHECKS: CheckItem[] = [
  { label: 'Mínimo 8 caracteres',     test: (p) => p.length >= 8 },
  { label: 'Pelo menos 1 número',     test: (p) => /[0-9]/.test(p) },
  { label: 'Pelo menos 1 maiúscula',  test: (p) => /[A-Z]/.test(p) },
]

export default function CreatePasswordScreen() {
  const nav   = useNavigation<Nav>()
  const route = useRoute<Route>()
  const { top, bottom } = useSafeAreaInsets()
  const { phone, countryCode } = route.params

  const [password, setPassword] = useState('')
  const [secure,   setSecure]   = useState(true)
  const [focused,  setFocused]  = useState(false)
  const btnScale = useRef(new Animated.Value(1)).current

  const strength   = strengthLevel(password)
  const allPassed  = CHECKS.every((c) => c.test(password))
  const canNext    = allPassed

  function bounce(cb: () => void) {
    Animated.sequence([
      Animated.spring(btnScale, { toValue: 0.97, useNativeDriver: true, speed: 80, bounciness: 0 }),
      Animated.spring(btnScale, { toValue: 1,    useNativeDriver: true, speed: 40, bounciness: 5 }),
    ]).start(cb)
  }

  function handleNext() {
    if (!canNext) return Alert.alert('', 'A senha não cumpre todos os requisitos')
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    bounce(() => nav.navigate('SetName', { phone, countryCode, password }))
  }

  const segColor = (i: number) => i < strength ? SEG_COLOR[strength] : BD

  return (
    <KeyboardAvoidingView style={s.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={[s.inner, { paddingTop: top + 14, paddingBottom: bottom + 24 }]}>

        {/* Square back button */}
        <TouchableOpacity onPress={() => nav.goBack()} style={s.backBtn} hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}>
          <Ionicons name="chevron-back" size={20} color={T} />
        </TouchableOpacity>

        {/* Hero */}
        <View style={s.hero}>
          <Text style={s.heading}>Cria{'\n'}uma senha.</Text>
          <Text style={s.sub}>Vais usá-la para entrar de futuro. Escolhe algo forte e fácil de lembrar.</Text>
        </View>

        {/* Password input */}
        <View style={[s.inputWrap, focused && s.inputFocused]}>
          <TextInput
            style={s.input}
            placeholder="Cria uma senha"
            placeholderTextColor={M}
            value={password}
            onChangeText={setPassword}
            secureTextEntry={secure}
            autoFocus
            returnKeyType="go"
            onSubmitEditing={handleNext}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
          />
          <TouchableOpacity onPress={() => setSecure(!secure)} hitSlop={{ top: 10, right: 10, bottom: 10, left: 10 }}>
            <Ionicons name={secure ? 'eye-off-outline' : 'eye-outline'} size={20} color={M} />
          </TouchableOpacity>
        </View>

        {/* 4-segment strength bar */}
        {password.length > 0 && (
          <View style={s.strengthRow}>
            {[1, 2, 3, 4].map((i) => (
              <View key={i} style={[s.strengthSeg, { backgroundColor: segColor(i) }]} />
            ))}
          </View>
        )}

        {/* Checklist */}
        <View style={s.checklist}>
          {CHECKS.map((c) => {
            const ok = c.test(password)
            return (
              <View key={c.label} style={s.checkItem}>
                <View style={[s.checkCircle, ok && s.checkCircleOk]}>
                  <Ionicons name="checkmark" size={12} color={ok ? '#fff' : BD} />
                </View>
                <Text style={[s.checkLabel, ok && s.checkLabelOk]}>{c.label}</Text>
              </View>
            )
          })}
        </View>

        <View style={s.spacer} />

        {/* Full-width CTA */}
        <Animated.View style={{ transform: [{ scale: btnScale }] }}>
          <TouchableOpacity
            style={[s.cta, !canNext && s.ctaOff]}
            onPress={handleNext}
            disabled={!canNext}
            activeOpacity={0.88}
          >
            <Text style={s.ctaTxt}>Criar conta</Text>
            <Ionicons name="arrow-forward" size={19} color="#fff" />
          </TouchableOpacity>
        </Animated.View>

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

  hero:    { marginTop: 44, marginBottom: 36, gap: 14 },
  heading: { fontFamily: fonts.extraBold, fontSize: 34, lineHeight: 40, letterSpacing: -1, color: T },
  sub:     { fontFamily: fonts.regular, fontSize: 15, lineHeight: 22, color: S },

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
  input: { flex: 1, fontFamily: fonts.medium, fontSize: 17, color: T, paddingVertical: 0 },

  strengthRow: { flexDirection: 'row', gap: 6, marginTop: 10 },
  strengthSeg: { flex: 1, height: 5, borderRadius: 999 },

  checklist: { marginTop: 18, gap: 12 },
  checkItem: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  checkCircle: {
    width: 22, height: 22, borderRadius: 11,
    borderWidth: 1.5, borderColor: BD,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: BG,
  },
  checkCircleOk: { backgroundColor: G, borderColor: G },
  checkLabel:    { fontFamily: fonts.regular, fontSize: 14, color: M },
  checkLabelOk:  { color: T },

  spacer: { flex: 1 },

  cta: {
    height: 52, borderRadius: 16, backgroundColor: B,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    ...Platform.select({
      ios: { shadowColor: B, shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.65, shadowRadius: 18 },
      android: { elevation: 8 },
    }),
  },
  ctaOff: { opacity: 0.35 },
  ctaTxt: { fontFamily: fonts.bold, fontSize: 17, color: '#fff', letterSpacing: -0.2 },
})
