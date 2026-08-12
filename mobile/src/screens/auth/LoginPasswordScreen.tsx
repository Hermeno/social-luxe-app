import React, { useRef, useState } from 'react'
import {
  Animated,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native'
import { StackNavigationProp } from '@react-navigation/stack'

import {
  AuthFieldFrame,
  AuthHeader,
  AuthPrimaryButton,
  authStyles,
  authUi,
} from '../../components/AuthFlow'
import Icon from '../../components/Icon'
import useReducedMotionPreference from '../../hooks/useReducedMotionPreference'
import { useT } from '../../i18n'
import { AuthStackParams } from '../../navigation/AuthNavigator'
import { useAuthStore } from '../../store/auth.store'
import { fonts } from '../../theme'

type Nav = StackNavigationProp<AuthStackParams>
type Route = RouteProp<AuthStackParams, 'LoginPassword'>

function maskPhone(phone: string): string {
  if (phone.length < 6) return phone
  const visible = phone.slice(-3)
  const prefix = phone.slice(0, 4)
  return `${prefix} •• ••• ${visible}`
}

export default function LoginPasswordScreen() {
  const nav = useNavigation<Nav>()
  const route = useRoute<Route>()
  const t = useT()
  const { top, bottom } = useSafeAreaInsets()
  const { login } = useAuthStore()
  const reduceMotion = useReducedMotionPreference()
  const { phone } = route.params

  const [password, setPassword] = useState('')
  const [secure, setSecure] = useState(true)
  const [focused, setFocused] = useState(false)
  const [error, setError] = useState(false)
  const [loading, setLoading] = useState(false)
  const shakeAnim = useRef(new Animated.Value(0)).current

  function shake() {
    shakeAnim.stopAnimation()
    if (reduceMotion) {
      shakeAnim.setValue(0)
      return
    }
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 8, duration: 55, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -8, duration: 55, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 5, duration: 45, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -5, duration: 45, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0, duration: 35, useNativeDriver: true }),
    ]).start()
  }

  async function handleLogin() {
    if (!password || loading) return
    setLoading(true)
    setError(false)
    try {
      await login(phone, password)
    } catch {
      setError(true)
      shake()
    } finally {
      setLoading(false)
    }
  }

  function handlePasswordChange(value: string) {
    setPassword(value)
    setError(false)
    if (reduceMotion) shakeAnim.setValue(0)
  }

  return (
    <KeyboardAvoidingView
      style={authStyles.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        style={authStyles.screen}
        contentContainerStyle={[
          s.page,
          { paddingTop: top + 10, paddingBottom: Math.max(bottom, 14) + 10 },
        ]}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        showsVerticalScrollIndicator={false}
      >
        <AuthHeader
          step={2}
          total={2}
          stage={t.au_stage_security}
          onBack={() => nav.goBack()}
        />

        <View style={[authStyles.hero, s.hero]}>
          <Text style={authStyles.heading}>{t.au_login_greeting}</Text>
          <Text style={s.accountPhone} accessible accessibilityLabel={phone}>{maskPhone(phone)}</Text>
        </View>

        <Animated.View style={{ transform: [{ translateX: shakeAnim }] }}>
          <View style={s.fieldGroup}>
            <AuthFieldFrame focused={focused} error={error}>
              <TextInput
                style={s.input}
                placeholder={t.au_login_ph}
                placeholderTextColor={authUi.faint}
                value={password}
                onChangeText={handlePasswordChange}
                secureTextEntry={secure}
                autoFocus
                autoCapitalize="none"
                autoCorrect={false}
                textContentType="password"
                returnKeyType="go"
                onSubmitEditing={handleLogin}
                onFocus={() => setFocused(true)}
                onBlur={() => setFocused(false)}
              />
              <TouchableOpacity
                style={s.eyeButton}
                onPress={() => setSecure((value) => !value)}
                activeOpacity={0.65}
                accessibilityRole="button"
                accessibilityLabel={secure ? t.au_password_show : t.au_password_hide}
                hitSlop={4}
              >
                <View style={s.eyeGlyph}>
                  <Icon name="eye" size={21} color={error ? authUi.danger : authUi.muted} strokeWidth={1.75} />
                  {secure && <View style={[s.eyeSlash, error && s.eyeSlashError]} />}
                </View>
              </TouchableOpacity>
            </AuthFieldFrame>
          </View>

          {error && (
            <Text style={s.errorText} accessibilityRole="alert">
              {t.au_login_wrong}
            </Text>
          )}
        </Animated.View>

        <View style={authStyles.spacer} />

        <AuthPrimaryButton
          label={t.au_login_enter}
          onPress={handleLogin}
          disabled={!password}
          loading={loading}
          style={s.primary}
        />

        <TouchableOpacity
          style={s.switchRow}
          onPress={() => nav.goBack()}
          activeOpacity={0.65}
          accessibilityRole="button"
          accessibilityLabel={t.au_login_switch}
        >
          <Text style={s.switchText}>{t.au_login_not_you}</Text>
          <Text style={s.switchLink}>{t.au_login_switch}</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

const s = StyleSheet.create({
  page: { flexGrow: 1, paddingHorizontal: 24, backgroundColor: authUi.paper },
  hero: { marginBottom: 28 },
  accountPhone: {
    color: authUi.muted,
    fontFamily: fonts.regular,
    fontSize: 14.5,
    lineHeight: 20,
    fontVariant: ['tabular-nums'],
  },
  fieldGroup: { gap: 0 },
  input: {
    flex: 1,
    height: 54,
    paddingLeft: 14,
    paddingRight: 8,
    paddingVertical: 0,
    color: authUi.ink,
    fontFamily: fonts.medium,
    fontSize: 16,
    letterSpacing: -0.12,
  },
  eyeButton: {
    width: 52,
    height: 54,
    alignItems: 'center',
    justifyContent: 'center',
  },
  eyeGlyph: { width: 23, height: 23, alignItems: 'center', justifyContent: 'center' },
  eyeSlash: {
    position: 'absolute',
    width: 23,
    height: 1.5,
    borderRadius: 0.75,
    backgroundColor: authUi.muted,
    transform: [{ rotate: '42deg' }],
  },
  eyeSlashError: { backgroundColor: authUi.danger },
  errorText: {
    marginTop: 9,
    paddingLeft: 10,
    color: authUi.danger,
    fontFamily: fonts.medium,
    fontSize: 12.5,
    lineHeight: 17,
  },
  primary: { marginTop: 18 },
  switchRow: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
  },
  switchText: {
    color: authUi.faint,
    fontFamily: fonts.regular,
    fontSize: 12.5,
  },
  switchLink: {
    color: authUi.ink,
    fontFamily: fonts.semiBold,
    fontSize: 12.5,
  },
})
