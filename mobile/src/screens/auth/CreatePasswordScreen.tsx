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

// ── Progress bar ──────────────────────────────────────────────────────────────
function ProgressBar({ step, total }: { step: number; total: number }) {
  return (
    <View style={p.track}>
      {Array.from({ length: total }, (_, i) => (
        <View key={i} style={[p.seg, i < step ? p.segActive : p.segInactive]} />
      ))}
    </View>
  )
}
const p = StyleSheet.create({
  track:       { flexDirection: 'row', gap: 4, flex: 1 },
  seg:         { flex: 1, height: 3, borderRadius: 2 },
  segActive:   { backgroundColor: '#1A1A1A' },
  segInactive: { backgroundColor: '#E5E5EA' },
})

// ── Password strength ─────────────────────────────────────────────────────────
function strengthLevel(pwd: string): 0 | 1 | 2 | 3 {
  if (!pwd) return 0
  let score = 0
  if (pwd.length >= 8) score++
  if (/[A-Z]/.test(pwd)) score++
  if (/[0-9!@#$%^&*]/.test(pwd)) score++
  return Math.min(score, 3) as 0 | 1 | 2 | 3
}
const STRENGTH_LABEL = ['', 'Fraca', 'Razoável', 'Forte']
const STRENGTH_COLOR = ['', E, '#FF9500', G]

// ── Focused input ─────────────────────────────────────────────────────────────
interface InputProps {
  placeholder: string
  value: string
  onChange: (v: string) => void
  secure: boolean
  onToggleSecure: () => void
  error?: boolean
  autoFocus?: boolean
  onSubmit?: () => void
  icon?: string
}
function PwdInput({ placeholder, value, onChange, secure, onToggleSecure, error, autoFocus, onSubmit, icon = 'lock-closed-outline' }: InputProps) {
  const [focused, setFocused] = useState(false)
  return (
    <View style={[
      fi.wrap,
      focused && fi.focused,
      error  && fi.error,
    ]}>
      <Ionicons name={icon as any} size={18} color={focused ? B : M} style={fi.icon} />
      <TextInput
        style={fi.input}
        placeholder={placeholder}
        placeholderTextColor={M}
        value={value}
        onChangeText={onChange}
        secureTextEntry={secure}
        autoFocus={autoFocus}
        returnKeyType={onSubmit ? 'go' : 'next'}
        onSubmitEditing={onSubmit}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
      />
      <TouchableOpacity onPress={onToggleSecure} hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}>
        <Ionicons name={secure ? 'eye-off-outline' : 'eye-outline'} size={20} color={M} />
      </TouchableOpacity>
    </View>
  )
}
const fi = StyleSheet.create({
  wrap:    { flexDirection: 'row', alignItems: 'center', height: 58, borderRadius: 14, borderWidth: 1.5, borderColor: BD, backgroundColor: SX, paddingHorizontal: 16 },
  focused: { borderColor: B, backgroundColor: BG },
  error:   { borderColor: E },
  icon:    { marginRight: 10 },
  input:   { flex: 1, fontFamily: fonts.regular, fontSize: 16, color: T, paddingVertical: 0 },
})

// ── Screen ────────────────────────────────────────────────────────────────────
export default function CreatePasswordScreen() {
  const nav   = useNavigation<Nav>()
  const route = useRoute<Route>()
  const { top } = useSafeAreaInsets()
  const { phone, countryCode } = route.params

  const [password, setPassword] = useState('')
  const [confirm,  setConfirm]  = useState('')
  const [s1, setS1] = useState(true)
  const [s2, setS2] = useState(true)
  const btnScale = useRef(new Animated.Value(1)).current

  const strength        = strengthLevel(password)
  const confirmTouched  = confirm.length > 0
  const passwordShort   = password.length > 0 && password.length < 6
  const mismatch        = confirmTouched && confirm !== password
  const canNext         = password.length >= 6 && confirm.length >= 1 && !mismatch

  function bounce(cb: () => void) {
    Animated.sequence([
      Animated.spring(btnScale, { toValue: 0.97, useNativeDriver: true, speed: 80, bounciness: 0 }),
      Animated.spring(btnScale, { toValue: 1,    useNativeDriver: true, speed: 40, bounciness: 6 }),
    ]).start(cb)
  }

  function handleNext() {
    if (password.length < 6) return Alert.alert('', 'A senha deve ter pelo menos 6 caracteres')
    if (password !== confirm)  return Alert.alert('', 'As senhas não coincidem')
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    bounce(() => nav.navigate('SetName', { phone, countryCode, password }))
  }

  return (
    <KeyboardAvoidingView style={st.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={[st.inner, { paddingTop: top + 16 }]}>

        {/* Header */}
        <View style={st.header}>
          <TouchableOpacity onPress={() => nav.goBack()} style={st.backBtn} hitSlop={{ top: 12, right: 12, bottom: 12, left: 12 }}>
            <Ionicons name="chevron-back" size={24} color={T} />
          </TouchableOpacity>
          <ProgressBar step={1} total={2} />
          <Text style={st.stepLabel}>1 / 2</Text>
        </View>

        {/* Hero */}
        <View style={st.hero}>
          <Text style={st.heading}>Cria{'\n'}uma senha.</Text>
          <Text style={st.sub}>Usa pelo menos 6 caracteres. Nunca a partilhes com ninguém.</Text>
        </View>

        {/* Fields */}
        <View style={st.fields}>
          <View>
            <PwdInput
              placeholder="Senha"
              value={password}
              onChange={setPassword}
              secure={s1}
              onToggleSecure={() => setS1(!s1)}
              error={passwordShort}
              autoFocus
            />

            {/* Strength bar */}
            {password.length > 0 && (
              <View style={st.strengthRow}>
                {[1, 2, 3].map((i) => (
                  <View
                    key={i}
                    style={[
                      st.strengthSeg,
                      { backgroundColor: i <= strength ? STRENGTH_COLOR[strength] : '#E5E5EA' },
                    ]}
                  />
                ))}
                <Text style={[st.strengthTxt, { color: STRENGTH_COLOR[strength] }]}>
                  {STRENGTH_LABEL[strength]}
                </Text>
              </View>
            )}
            {passwordShort && <Text style={st.errorTxt}>Mínimo 6 caracteres</Text>}
          </View>

          <View>
            <PwdInput
              placeholder="Confirmar senha"
              value={confirm}
              onChange={setConfirm}
              secure={s2}
              onToggleSecure={() => setS2(!s2)}
              error={mismatch}
              onSubmit={handleNext}
              icon={mismatch ? 'alert-circle-outline' : 'lock-closed-outline'}
            />
            {mismatch && <Text style={st.errorTxt}>As senhas não coincidem</Text>}
          </View>
        </View>

        <View style={st.spacer} />

        <Animated.View style={{ transform: [{ scale: btnScale }] }}>
          <TouchableOpacity
            style={[st.btn, !canNext && st.btnOff]}
            onPress={handleNext}
            disabled={!canNext}
            activeOpacity={1}
          >
            <Text style={st.btnText}>Continuar</Text>
          </TouchableOpacity>
        </Animated.View>

      </View>
    </KeyboardAvoidingView>
  )
}

const st = StyleSheet.create({
  screen: { flex: 1, backgroundColor: BG },
  inner:  { flex: 1, paddingHorizontal: 28, paddingBottom: 36 },

  header:    { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 44 },
  backBtn:   { width: 36, height: 36, borderRadius: 18, backgroundColor: '#F4F4F6', alignItems: 'center', justifyContent: 'center' },
  stepLabel: { fontSize: 13, fontFamily: fonts.medium, color: M, minWidth: 28, textAlign: 'right' },

  hero:    { marginBottom: 36, gap: 12 },
  heading: { fontSize: 40, fontFamily: fonts.bold, color: T, letterSpacing: -1.2, lineHeight: 46 },
  sub:     { fontSize: 15, fontFamily: fonts.regular, color: S, lineHeight: 22, letterSpacing: -0.1 },

  fields:  { gap: 12 },

  strengthRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 8 },
  strengthSeg: { flex: 1, height: 3, borderRadius: 2 },
  strengthTxt: { fontSize: 12, fontFamily: fonts.semiBold, minWidth: 56, textAlign: 'right' },

  errorTxt: { marginTop: 7, marginLeft: 4, fontSize: 13, fontFamily: fonts.regular, color: E },

  spacer: { flex: 1 },

  btn:     { height: 56, borderRadius: 16, backgroundColor: T, alignItems: 'center', justifyContent: 'center' },
  btnOff:  { opacity: 0.2 },
  btnText: { color: '#fff', fontFamily: fonts.semiBold, fontSize: 16, letterSpacing: -0.2 },
})
