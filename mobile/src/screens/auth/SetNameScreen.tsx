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
const B  = '#CA2851'
const BD = '#E5E5EA'
const BG = '#FFFFFF'
const SX = '#F9F9FB'
const MAX = 30

export default function SetNameScreen() {
  const nav   = useNavigation<Nav>()
  const route = useRoute<Route>()
  const { top, bottom } = useSafeAreaInsets()
  const { register } = useAuthStore()
  const { phone, countryCode, password } = route.params

  const [name,    setName]    = useState('')
  const [focused, setFocused] = useState(false)
  const [loading, setLoading] = useState(false)
  const btnScale = useRef(new Animated.Value(1)).current

  const trimmed   = name.trim()
  const canCreate = trimmed.length >= 2

  function bounce(cb: () => void) {
    Animated.sequence([
      Animated.spring(btnScale, { toValue: 0.97, useNativeDriver: true, speed: 80, bounciness: 0 }),
      Animated.spring(btnScale, { toValue: 1,    useNativeDriver: true, speed: 40, bounciness: 5 }),
    ]).start(cb)
  }

  async function handleRegister() {
    if (!canCreate) return
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    bounce(async () => {
      setLoading(true)
      try {
        await register(trimmed, phone, countryCode, password, password)
      } catch (e: unknown) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
        Alert.alert('Erro', e instanceof Error ? e.message : 'Não foi possível criar a conta')
      } finally { setLoading(false) }
    })
  }

  const initial = trimmed[0]?.toUpperCase() ?? ''

  return (
    <KeyboardAvoidingView style={s.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={[s.inner, { paddingTop: top + 14, paddingBottom: bottom + 24 }]}>

        {/* Square back button */}
        <TouchableOpacity onPress={() => nav.goBack()} style={s.backBtn} hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}>
          <Ionicons name="chevron-back" size={20} color={T} />
        </TouchableOpacity>

        {/* Centered hero */}
        <View style={s.hero}>
          <Text style={s.heading}>Como{'\n'}te chamas?</Text>
          <Text style={s.sub}>O teu nome é como apareces no teu perfil.</Text>
        </View>

        {/* Underline input */}
        <View style={s.underlineWrap}>
          <TextInput
            style={[s.underlineInput, focused && s.underlineFocused]}
            placeholder="O teu nome"
            placeholderTextColor={M}
            value={name}
            onChangeText={(v) => setName(v.slice(0, MAX))}
            autoCapitalize="words"
            autoCorrect={false}
            autoFocus
            returnKeyType="go"
            onSubmitEditing={handleRegister}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            textAlign="center"
          />
          <View style={[s.underlineLine, focused && s.underlineLineActive]} />
          <Text style={s.charCount}>{name.length} / {MAX}</Text>
        </View>

        {/* Name preview */}
        {trimmed.length >= 2 && (
          <View style={s.preview}>
            <View style={s.previewRing}>
              <View style={s.previewAvatar}>
                <Text style={s.previewInitial}>{initial}</Text>
              </View>
            </View>
            <Text style={s.previewName}>{trimmed}</Text>
            <Text style={s.previewSub}>Assim é como apareças no teu perfil</Text>
          </View>
        )}

        <View style={s.spacer} />

        {/* Full-width CTA */}
        <Animated.View style={{ transform: [{ scale: btnScale }] }}>
          <TouchableOpacity
            style={[s.cta, (!canCreate || loading) && s.ctaOff]}
            onPress={handleRegister}
            disabled={!canCreate || loading}
            activeOpacity={0.88}
          >
            {loading
              ? <ActivityIndicator color="#fff" size="small" />
              : <>
                  <Text style={s.ctaTxt}>Continuar</Text>
                  <Ionicons name="arrow-forward" size={19} color="#fff" />
                </>
            }
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

  hero: { marginTop: 44, marginBottom: 48, gap: 12, alignItems: 'center' },
  heading: {
    fontFamily: fonts.extraBold, fontSize: 30, lineHeight: 36,
    letterSpacing: -0.9, color: T, textAlign: 'center',
  },
  sub: { fontFamily: fonts.regular, fontSize: 15, lineHeight: 22, color: S, textAlign: 'center' },

  underlineWrap: { alignItems: 'center', gap: 8, paddingHorizontal: 8 },
  underlineInput: {
    width: '100%',
    fontFamily: fonts.bold, fontSize: 32, color: T,
    letterSpacing: -0.5, textAlign: 'center',
    paddingVertical: 8, paddingHorizontal: 0,
    backgroundColor: 'transparent',
  },
  underlineFocused: {},
  underlineLine: {
    width: '60%', height: 2, borderRadius: 1,
    backgroundColor: BD,
  },
  underlineLineActive: { backgroundColor: B },
  charCount: { fontSize: 12, fontFamily: fonts.regular, color: M },

  preview: { alignItems: 'center', marginTop: 32, gap: 10 },
  previewRing: {
    width: 72, height: 72, borderRadius: 36,
    borderWidth: 1.5, borderColor: `${B}50`,
    borderStyle: 'dashed',
    padding: 3,
    alignItems: 'center', justifyContent: 'center',
  },
  previewAvatar: {
    width: 60, height: 60, borderRadius: 30,
    backgroundColor: `${B}15`,
    alignItems: 'center', justifyContent: 'center',
  },
  previewInitial: { fontFamily: fonts.bold, fontSize: 22, color: B },
  previewName:   { fontFamily: fonts.bold, fontSize: 17, color: T, letterSpacing: -0.3 },
  previewSub:    { fontFamily: fonts.regular, fontSize: 12, color: M },

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
