import React, { useState, useRef } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, Animated, Alert,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native'
import { StackNavigationProp } from '@react-navigation/stack'
import * as Haptics from 'expo-haptics'
import { AuthStackParams } from '../../navigation/AuthNavigator'
import { fonts } from '../../theme'

type Nav   = StackNavigationProp<AuthStackParams>
type Route = RouteProp<AuthStackParams, 'CreatePassword'>

const PRIMARY  = '#4C8CE4'
const BG       = '#FFFFFF'
const INPUT_BG = '#F5F5F7'
const TEXT     = '#1A1A1A'
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

export default function CreatePasswordScreen() {
  const nav   = useNavigation<Nav>()
  const route = useRoute<Route>()
  const { phone, countryCode } = route.params
  const [password, setPassword]   = useState('')
  const [confirm,  setConfirm]    = useState('')
  const [secure1,  setSecure1]    = useState(true)
  const [secure2,  setSecure2]    = useState(true)
  const btnScale = useRef(new Animated.Value(1)).current

  function animateBtn(cb: () => void) {
    Animated.sequence([
      Animated.spring(btnScale, { toValue: 0.96, useNativeDriver: true, speed: 60 }),
      Animated.spring(btnScale, { toValue: 1,    useNativeDriver: true, speed: 40, bounciness: 6 }),
    ]).start(cb)
  }

  function handleNext() {
    if (password.length < 6) return Alert.alert('', 'A senha deve ter pelo menos 6 caracteres')
    if (password !== confirm)  return Alert.alert('', 'As senhas não coincidem')
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    animateBtn(() => nav.navigate('SetName', { phone, countryCode, password }))
  }

  const canNext = password.length >= 6 && confirm.length >= 1

  return (
    <KeyboardAvoidingView style={s.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={s.inner}>

        <View style={s.topRow}>
          <Text style={s.brand}>luxe</Text>
          <View style={s.topRight}>
            <StepDots current={0} total={2} />
            <TouchableOpacity onPress={() => nav.goBack()} hitSlop={{ top: 12, right: 12, bottom: 12, left: 12 }}>
              <Ionicons name="chevron-back" size={26} color={TEXT} />
            </TouchableOpacity>
          </View>
        </View>

        <View style={s.headWrap}>
          <Text style={s.heading}>Cria uma senha</Text>
          <Text style={s.sub}>Usa pelo menos 6 caracteres. Nunca a partilhes com ninguém.</Text>
        </View>

        <View style={s.fields}>
          <View style={s.inputWrap}>
            <TextInput
              style={s.input}
              placeholder="Senha"
              placeholderTextColor={MUTED}
              value={password}
              onChangeText={setPassword}
              secureTextEntry={secure1}
              autoFocus
            />
            <TouchableOpacity onPress={() => setSecure1(!secure1)} style={s.eye}>
              <Ionicons name={secure1 ? 'eye-off-outline' : 'eye-outline'} size={20} color={MUTED} />
            </TouchableOpacity>
          </View>

          <View style={s.inputWrap}>
            <TextInput
              style={s.input}
              placeholder="Confirmar senha"
              placeholderTextColor={MUTED}
              value={confirm}
              onChangeText={setConfirm}
              secureTextEntry={secure2}
              returnKeyType="go"
              onSubmitEditing={handleNext}
            />
            <TouchableOpacity onPress={() => setSecure2(!secure2)} style={s.eye}>
              <Ionicons name={secure2 ? 'eye-off-outline' : 'eye-outline'} size={20} color={MUTED} />
            </TouchableOpacity>
          </View>
        </View>

        <View style={s.spacer} />

        <Animated.View style={{ transform: [{ scale: btnScale }] }}>
          <TouchableOpacity
            style={[s.btn, !canNext && s.btnOff]}
            onPress={handleNext}
            disabled={!canNext}
            activeOpacity={1}
          >
            <Text style={s.btnText}>Continuar</Text>
          </TouchableOpacity>
        </Animated.View>

      </View>
    </KeyboardAvoidingView>
  )
}

const s = StyleSheet.create({
  screen:    { flex: 1, backgroundColor: BG },
  inner:     { flex: 1, paddingHorizontal: 28, paddingTop: 64, paddingBottom: 40 },
  topRow:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 52 },
  topRight:  { flexDirection: 'row', alignItems: 'center', gap: 14 },
  brand:     { fontSize: 22, fontFamily: fonts.bold, color: PRIMARY, letterSpacing: -0.3 },
  headWrap:  { marginBottom: 32, gap: 8 },
  heading:   { fontSize: 28, fontFamily: fonts.semiBold, color: TEXT, letterSpacing: -0.5, lineHeight: 34 },
  sub:       { fontSize: 14, fontFamily: fonts.regular, color: MUTED, lineHeight: 20 },
  fields:    { gap: 12 },
  inputWrap: { flexDirection: 'row', alignItems: 'center', backgroundColor: INPUT_BG, borderRadius: 14 },
  input:     { flex: 1, paddingHorizontal: 18, paddingVertical: 18, fontSize: 16, fontFamily: fonts.regular, color: TEXT },
  eye:       { paddingHorizontal: 16 },
  spacer:    { flex: 1 },
  btn:       { backgroundColor: PRIMARY, borderRadius: 14, height: 56, alignItems: 'center', justifyContent: 'center' },
  btnOff:    { opacity: 0.35 },
  btnText:   { color: '#fff', fontFamily: fonts.semiBold, fontSize: 16, letterSpacing: 0.1 },
})
