import React, { useState, useRef } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, Animated, ActivityIndicator, Alert,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native'
import { StackNavigationProp } from '@react-navigation/stack'
import * as Haptics from 'expo-haptics'
import { useAuthStore } from '../../store/auth.store'
import { AuthStackParams } from '../../navigation/AuthNavigator'
import { fonts } from '../../theme'

type Nav   = StackNavigationProp<AuthStackParams>
type Route = RouteProp<AuthStackParams, 'SetName'>

const PRIMARY  = '#FF4B6E'
const BG       = '#FFFFFF'
const INPUT_BG = '#F5F5F7'
const TEXT     = '#111111'
const MUTED    = '#9CA3AF'

function StepDots({ current, total }: { current: number; total: number }) {
  return (
    <View style={{ flexDirection: 'row', gap: 5 }}>
      {Array.from({ length: total }, (_, i) => (
        <View key={i} style={{
          width: i === current ? 18 : 6, height: 6,
          borderRadius: 3,
          backgroundColor: i === current ? PRIMARY : '#E5E5E5',
        }} />
      ))}
    </View>
  )
}

export default function SetNameScreen() {
  const nav   = useNavigation<Nav>()
  const route = useRoute<Route>()
  const { register } = useAuthStore()
  const { phone, countryCode, password } = route.params
  const [name,    setName]    = useState('')
  const [loading, setLoading] = useState(false)
  const btnScale = useRef(new Animated.Value(1)).current

  function animateBtn(cb: () => void) {
    Animated.sequence([
      Animated.spring(btnScale, { toValue: 0.96, useNativeDriver: true, speed: 60 }),
      Animated.spring(btnScale, { toValue: 1,    useNativeDriver: true, speed: 40, bounciness: 6 }),
    ]).start(cb)
  }

  async function handleRegister() {
    if (!name.trim()) return
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    animateBtn(async () => {
      setLoading(true)
      try {
        // password used as both password and confirmPassword (already validated match)
        await register(name.trim(), phone, countryCode, password, password)
        // Auth store sets isAuthenticated = true → RootNavigator shows OnboardingScreen
      } catch (e: unknown) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
        Alert.alert('Erro', e instanceof Error ? e.message : 'Não foi possível criar a conta')
      } finally {
        setLoading(false)
      }
    })
  }

  return (
    <KeyboardAvoidingView style={s.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={s.inner}>

        <View style={s.topRow}>
          <Text style={s.brand}>luxe</Text>
          <View style={s.topRight}>
            <StepDots current={1} total={2} />
            <TouchableOpacity onPress={() => nav.goBack()} hitSlop={{ top: 12, right: 12, bottom: 12, left: 12 }}>
              <Ionicons name="chevron-back" size={26} color={TEXT} />
            </TouchableOpacity>
          </View>
        </View>

        <View style={s.headWrap}>
          <Text style={s.heading}>Como te chamas?</Text>
          <Text style={s.sub}>Este é o nome que os outros irão ver no teu perfil.</Text>
        </View>

        <TextInput
          style={s.input}
          placeholder="O teu nome"
          placeholderTextColor={MUTED}
          value={name}
          onChangeText={setName}
          autoCapitalize="words"
          autoFocus
          returnKeyType="go"
          onSubmitEditing={handleRegister}
        />

        <View style={s.spacer} />

        <Animated.View style={{ transform: [{ scale: btnScale }] }}>
          <TouchableOpacity
            style={[s.btn, (!name.trim() || loading) && s.btnOff]}
            onPress={handleRegister}
            disabled={!name.trim() || loading}
            activeOpacity={1}
          >
            {loading
              ? <ActivityIndicator color="#fff" />
              : <Text style={s.btnText}>Criar conta</Text>
            }
          </TouchableOpacity>
        </Animated.View>

      </View>
    </KeyboardAvoidingView>
  )
}

const s = StyleSheet.create({
  screen:   { flex: 1, backgroundColor: BG },
  inner:    { flex: 1, paddingHorizontal: 28, paddingTop: 64, paddingBottom: 40 },
  topRow:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 52 },
  topRight: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  brand:    { fontSize: 22, fontFamily: fonts.bold, color: PRIMARY, letterSpacing: -0.3 },
  headWrap: { marginBottom: 32, gap: 8 },
  heading:  { fontSize: 28, fontFamily: fonts.semiBold, color: TEXT, letterSpacing: -0.5, lineHeight: 34 },
  sub:      { fontSize: 14, fontFamily: fonts.regular, color: MUTED, lineHeight: 20 },
  input:    { backgroundColor: INPUT_BG, borderRadius: 14, paddingHorizontal: 18, paddingVertical: 18, fontSize: 16, fontFamily: fonts.regular, color: TEXT },
  spacer:   { flex: 1 },
  btn:      { backgroundColor: PRIMARY, borderRadius: 14, height: 56, alignItems: 'center', justifyContent: 'center' },
  btnOff:   { opacity: 0.35 },
  btnText:  { color: '#fff', fontFamily: fonts.semiBold, fontSize: 16, letterSpacing: 0.1 },
})
