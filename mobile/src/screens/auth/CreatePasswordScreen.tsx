import React, { useState } from 'react'
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  ScrollView,
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
import { AuthStackParams } from '../../navigation/AuthNavigator'
import { fonts } from '../../theme'
import { Strings, useT } from '../../i18n'

type Nav = StackNavigationProp<AuthStackParams>
type Route = RouteProp<AuthStackParams, 'CreatePassword'>

interface CheckItem {
  key: keyof Strings
  test: (password: string) => boolean
}

const CHECKS: CheckItem[] = [
  { key: 'au_pass_check_len', test: (password) => password.length >= 8 },
  { key: 'au_pass_check_num', test: (password) => /[0-9]/.test(password) },
  { key: 'au_pass_check_upper', test: (password) => /[A-Z]/.test(password) },
]

export default function CreatePasswordScreen() {
  const nav = useNavigation<Nav>()
  const route = useRoute<Route>()
  const t = useT()
  const { top, bottom } = useSafeAreaInsets()
  const { phone, countryCode } = route.params

  const [password, setPassword] = useState('')
  const [secure, setSecure] = useState(true)
  const [focused, setFocused] = useState(false)

  const allPassed = CHECKS.every((check) => check.test(password))

  function handleNext() {
    if (!allPassed) {
      Alert.alert('', t.au_pass_req_fail)
      return
    }
    nav.navigate('SetName', { phone, countryCode, password })
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
          total={5}
          stage={t.au_stage_security}
          onBack={() => nav.goBack()}
        />

        <View style={[authStyles.hero, s.hero]}>
          <Text style={authStyles.heading}>{t.au_pass_heading}</Text>
        </View>

        <View style={s.fieldGroup}>
          <AuthFieldFrame focused={focused}>
            <TextInput
              style={s.input}
              placeholder={t.au_pass_ph}
              placeholderTextColor={authUi.faint}
              value={password}
              onChangeText={setPassword}
              secureTextEntry={secure}
              autoFocus
              autoCapitalize="none"
              autoCorrect={false}
              textContentType="newPassword"
              returnKeyType="go"
              onSubmitEditing={handleNext}
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
                <Icon name="eye" size={21} color={authUi.muted} strokeWidth={1.75} />
                {secure && <View style={s.eyeSlash} />}
              </View>
            </TouchableOpacity>
          </AuthFieldFrame>
        </View>

        <View style={s.checklist}>
            {CHECKS.map((check) => {
              const passed = check.test(password)
              return (
                <View key={check.key} style={s.checkRow}>
                  {passed
                    ? <Icon name="check" size={13} color={authUi.success} strokeWidth={2.3} />
                    : <View style={s.requirementDot} />}
                  <Text style={[s.checkLabel, passed && s.checkLabelPassed]}>
                    {t[check.key]}
                  </Text>
                </View>
              )
            })}
        </View>

        <View style={authStyles.spacer} />

        <AuthPrimaryButton
          label={t.au_continue}
          onPress={handleNext}
          disabled={!allPassed}
          style={s.primary}
        />
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

const s = StyleSheet.create({
  page: { flexGrow: 1, paddingHorizontal: 24, backgroundColor: authUi.paper },
  hero: { marginBottom: 26 },
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
  checklist: { marginTop: 14, gap: 8, paddingHorizontal: 2 },
  checkRow: {
    minHeight: 22,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  requirementDot: { width: 5, height: 5, marginHorizontal: 4, borderRadius: 2.5, backgroundColor: authUi.faint },
  checkLabel: {
    color: authUi.muted,
    fontFamily: fonts.regular,
    fontSize: 12.5,
    lineHeight: 17,
  },
  checkLabelPassed: { color: authUi.ink, fontFamily: fonts.medium },
  primary: { marginTop: 18 },
})
