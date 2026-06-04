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
type Route = RouteProp<AuthStackParams, 'SetName'>

const T  = '#1A1A1A'
const S  = '#6E6E73'
const M  = '#ABABAB'
const B  = '#4C8CE4'
const E  = '#FF3B30'
const BD = '#E5E5EA'
const BG = '#FFFFFF'
const SX = '#F9F9FB'

// ── Progress bar (reuse same component) ───────────────────────────────────────
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

// ── Screen ────────────────────────────────────────────────────────────────────
export default function SetNameScreen() {
  const nav   = useNavigation<Nav>()
  const route = useRoute<Route>()
  const { top } = useSafeAreaInsets()
  const { register } = useAuthStore()
  const { phone, countryCode, password } = route.params

  const [name,    setName]    = useState('')
  const [focused, setFocused] = useState(false)
  const [loading, setLoading] = useState(false)
  const btnScale = useRef(new Animated.Value(1)).current

  const canCreate = name.trim().length >= 2

  function bounce(cb: () => void) {
    Animated.sequence([
      Animated.spring(btnScale, { toValue: 0.97, useNativeDriver: true, speed: 80, bounciness: 0 }),
      Animated.spring(btnScale, { toValue: 1,    useNativeDriver: true, speed: 40, bounciness: 6 }),
    ]).start(cb)
  }

  async function handleRegister() {
    if (!canCreate) return
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    bounce(async () => {
      setLoading(true)
      try {
        await register(name.trim(), phone, countryCode, password, password)
        // RootNavigator transitions to onboarding automatically
      } catch (e: unknown) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
        Alert.alert('Erro', e instanceof Error ? e.message : 'Não foi possível criar a conta')
      } finally { setLoading(false) }
    })
  }

  return (
    <KeyboardAvoidingView style={s.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={[s.inner, { paddingTop: top + 16 }]}>

        {/* Header */}
        <View style={s.header}>
          <TouchableOpacity onPress={() => nav.goBack()} style={s.backBtn} hitSlop={{ top: 12, right: 12, bottom: 12, left: 12 }}>
            <Ionicons name="chevron-back" size={24} color={T} />
          </TouchableOpacity>
          <ProgressBar step={2} total={2} />
          <Text style={s.stepLabel}>2 / 2</Text>
        </View>

        {/* Hero */}
        <View style={s.hero}>
          <Text style={s.heading}>Como te{'\n'}chamas?</Text>
          <Text style={s.sub}>Este é o nome que os outros irão ver no teu perfil. Podes alterá-lo depois.</Text>
        </View>

        {/* Name input */}
        <View style={[s.inputWrap, focused && s.inputFocused]}>
          <Ionicons name="person-outline" size={18} color={focused ? B : M} style={s.icon} />
          <TextInput
            style={s.input}
            placeholder="O teu nome"
            placeholderTextColor={M}
            value={name}
            onChangeText={setName}
            autoCapitalize="words"
            autoCorrect={false}
            autoFocus
            returnKeyType="go"
            onSubmitEditing={handleRegister}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
          />
          {name.trim().length >= 2 && (
            <Ionicons name="checkmark-circle" size={20} color="#34C759" />
          )}
        </View>

        {/* Character hint */}
        {name.length > 0 && name.trim().length < 2 && (
          <Text style={s.hint}>Mínimo 2 caracteres</Text>
        )}

        <View style={s.spacer} />

        {/* Finish step indicator */}
        <View style={s.finishRow}>
          <View style={s.finishDot} />
          <Text style={s.finishTxt}>Última etapa</Text>
        </View>

        {/* CTA */}
        <Animated.View style={{ transform: [{ scale: btnScale }] }}>
          <TouchableOpacity
            style={[s.btn, (!canCreate || loading) && s.btnOff]}
            onPress={handleRegister}
            disabled={!canCreate || loading}
            activeOpacity={1}
          >
            {loading
              ? <ActivityIndicator color="#fff" />
              : (
                <View style={s.btnInner}>
                  <Text style={s.btnText}>Criar conta</Text>
                  <Ionicons name="arrow-forward" size={18} color="#fff" />
                </View>
              )
            }
          </TouchableOpacity>
        </Animated.View>

      </View>
    </KeyboardAvoidingView>
  )
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: BG },
  inner:  { flex: 1, paddingHorizontal: 28, paddingBottom: 36 },

  header:    { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 44 },
  backBtn:   { width: 36, height: 36, borderRadius: 18, backgroundColor: '#F4F4F6', alignItems: 'center', justifyContent: 'center' },
  stepLabel: { fontSize: 13, fontFamily: fonts.medium, color: M, minWidth: 28, textAlign: 'right' },

  hero:    { marginBottom: 36, gap: 12 },
  heading: { fontSize: 40, fontFamily: fonts.bold, color: T, letterSpacing: -1.2, lineHeight: 46 },
  sub:     { fontSize: 15, fontFamily: fonts.regular, color: S, lineHeight: 22, letterSpacing: -0.1 },

  inputWrap: {
    flexDirection: 'row', alignItems: 'center',
    height: 58, borderRadius: 14,
    borderWidth: 1.5, borderColor: BD,
    backgroundColor: SX, paddingHorizontal: 16,
  },
  inputFocused: { borderColor: B, backgroundColor: BG },
  icon:  { marginRight: 10 },
  input: { flex: 1, fontFamily: fonts.regular, fontSize: 16, color: T, paddingVertical: 0 },
  hint:  { marginTop: 7, marginLeft: 4, fontSize: 13, fontFamily: fonts.regular, color: M },

  spacer: { flex: 1 },

  finishRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 14 },
  finishDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#34C759' },
  finishTxt: { fontSize: 13, fontFamily: fonts.medium, color: S },

  btn:     { height: 56, borderRadius: 16, backgroundColor: T, alignItems: 'center', justifyContent: 'center' },
  btnOff:  { opacity: 0.2 },
  btnInner:{ flexDirection: 'row', alignItems: 'center', gap: 8 },
  btnText: { color: '#fff', fontFamily: fonts.semiBold, fontSize: 16, letterSpacing: -0.2 },
})
