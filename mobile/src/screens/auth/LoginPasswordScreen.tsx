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
type Route = RouteProp<AuthStackParams, 'LoginPassword'>

const PRIMARY  = '#4C8CE4'
const BG       = '#FFFFFF'
const INPUT_BG = '#F5F5F7'
const TEXT     = '#1A1A1A'
const MUTED    = '#9CA3AF'

export default function LoginPasswordScreen() {
  const nav   = useNavigation<Nav>()
  const route = useRoute<Route>()
  const { login } = useAuthStore()
  const { phone }  = route.params
  const [password, setPassword] = useState('')
  const [secure,   setSecure]   = useState(true)
  const [loading,  setLoading]  = useState(false)
  const btnScale = useRef(new Animated.Value(1)).current

  function animateBtn(cb: () => void) {
    Animated.sequence([
      Animated.spring(btnScale, { toValue: 0.96, useNativeDriver: true, speed: 60 }),
      Animated.spring(btnScale, { toValue: 1,    useNativeDriver: true, speed: 40, bounciness: 6 }),
    ]).start(cb)
  }

  async function handleLogin() {
    if (!password) return
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    animateBtn(async () => {
      setLoading(true)
      try {
        await login(phone, password)
      } catch (e: unknown) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
        Alert.alert('Senha incorreta', 'Verifica a tua senha e tenta novamente.')
      } finally {
        setLoading(false)
      }
    })
  }

  return (
    <KeyboardAvoidingView style={s.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={s.inner}>

        {/* Top row */}
        <View style={s.topRow}>
          <Text style={s.brand}>luxe</Text>
          <TouchableOpacity onPress={() => nav.goBack()} hitSlop={{ top: 12, right: 12, bottom: 12, left: 12 }}>
            <Ionicons name="chevron-back" size={26} color={TEXT} />
          </TouchableOpacity>
        </View>

        {/* Heading */}
        <View style={s.headWrap}>
          <Text style={s.heading}>Bem‑vindo de volta</Text>
          <Text style={s.sub}>{phone}</Text>
        </View>

        {/* Password input */}
        <View style={s.inputWrap}>
          <TextInput
            style={s.input}
            placeholder="Senha"
            placeholderTextColor={MUTED}
            value={password}
            onChangeText={setPassword}
            secureTextEntry={secure}
            autoFocus
            returnKeyType="go"
            onSubmitEditing={handleLogin}
          />
          <TouchableOpacity onPress={() => setSecure(!secure)} style={s.eye}>
            <Ionicons name={secure ? 'eye-off-outline' : 'eye-outline'} size={20} color={MUTED} />
          </TouchableOpacity>
        </View>

        <View style={s.spacer} />

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

        <TouchableOpacity style={s.switchWrap} onPress={() => nav.navigate('CreatePassword', route.params)}>
          <Text style={s.switchText}>Não tens conta? <Text style={s.switchBold}>Criar agora</Text></Text>
        </TouchableOpacity>

      </View>
    </KeyboardAvoidingView>
  )
}

const s = StyleSheet.create({
  screen:     { flex: 1, backgroundColor: BG },
  inner:      { flex: 1, paddingHorizontal: 28, paddingTop: 64, paddingBottom: 40 },
  topRow:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 52 },
  brand:      { fontSize: 22, fontFamily: fonts.bold, color: PRIMARY, letterSpacing: -0.3 },
  headWrap:   { marginBottom: 36, gap: 6 },
  heading:    { fontSize: 28, fontFamily: fonts.semiBold, color: TEXT, letterSpacing: -0.5, lineHeight: 34 },
  sub:        { fontSize: 15, fontFamily: fonts.regular, color: MUTED },
  inputWrap:  { flexDirection: 'row', alignItems: 'center', backgroundColor: INPUT_BG, borderRadius: 14 },
  input:      { flex: 1, paddingHorizontal: 18, paddingVertical: 18, fontSize: 16, fontFamily: fonts.regular, color: TEXT },
  eye:        { paddingHorizontal: 16 },
  spacer:     { flex: 1 },
  btn:        { backgroundColor: PRIMARY, borderRadius: 14, height: 56, alignItems: 'center', justifyContent: 'center' },
  btnOff:     { opacity: 0.35 },
  btnText:    { color: '#fff', fontFamily: fonts.semiBold, fontSize: 16, letterSpacing: 0.1 },
  switchWrap: { marginTop: 20, alignItems: 'center' },
  switchText: { fontSize: 14, fontFamily: fonts.regular, color: MUTED },
  switchBold: { fontFamily: fonts.semiBold, color: PRIMARY },
})
