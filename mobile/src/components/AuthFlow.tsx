import React from 'react'
import Wordmark from './Wordmark'
import {
  ActivityIndicator,
  StyleProp,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ViewStyle,
} from 'react-native'

import Icon from './Icon'
import { colors, fonts } from '../theme'
import { useT } from '../i18n'

export const authUi = {
  paper: '#FFFFFF',
  surface: '#F7F7F7',
  ink: '#111111',
  muted: '#737373',
  faint: '#737373',
  line: '#E8E8E8',
  lineStrong: '#D8D8D8',
  signal: colors.primary,
  danger: '#C62828',
  success: '#198754',
}

export function AuthBrand({ light = false }: { light?: boolean }) {
  return (
    <View style={af.brandLockup} accessibilityRole="header">
      <Wordmark height={32} color={light ? '#FFFFFF' : authUi.ink} />
    </View>
  )
}

export function AuthHeader({
  onBack,
  right,
}: {
  step: number
  total: number
  stage: string
  onBack?: () => void
  right?: React.ReactNode
}) {
  const t = useT()
  return (
    <View style={af.header}>
      <View style={af.topRow}>
        <View style={af.sideSlot}>
          {onBack && (
            <TouchableOpacity
              style={af.back}
              onPress={onBack}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel={t.back}
              hitSlop={6}
            >
              <Icon name="chevron-left" size={21} color={authUi.ink} strokeWidth={2} />
            </TouchableOpacity>
          )}
        </View>
        <AuthBrand />
        <View style={af.rightSlot}>{right}</View>
      </View>
    </View>
  )
}

export function AuthFieldFrame({
  focused = false,
  error = false,
  children,
  style,
}: {
  focused?: boolean
  error?: boolean
  children: React.ReactNode
  style?: StyleProp<ViewStyle>
}) {
  return (
    <View style={[af.field, focused && af.fieldFocused, error && af.fieldError, style]}>
      {children}
    </View>
  )
}

export function AuthPrimaryButton({
  label,
  onPress,
  disabled = false,
  loading = false,
  style,
}: {
  label: string
  onPress: () => void
  disabled?: boolean
  loading?: boolean
  style?: StyleProp<ViewStyle>
}) {
  return (
    <View style={style}>
      <TouchableOpacity
        style={[af.primary, disabled && !loading && af.primaryDisabled]}
        onPress={onPress}
        disabled={disabled || loading}
        activeOpacity={0.82}
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityState={{ disabled: disabled || loading, busy: loading }}
      >
        {loading
          ? <ActivityIndicator size="small" color="#FFFFFF" />
          : <Text style={[af.primaryLabel, disabled && af.primaryLabelDisabled]}>{label}</Text>
        }
      </TouchableOpacity>
    </View>
  )
}

export const authStyles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: authUi.paper },
  page: { flex: 1, paddingHorizontal: 24 },
  hero: { marginTop: 46, gap: 10 },
  eyebrow: {
    color: authUi.signal,
    fontFamily: fonts.bold,
    fontSize: 10,
    lineHeight: 13,
    letterSpacing: 1.45,
  },
  heading: {
    maxWidth: 340,
    color: authUi.ink,
    fontFamily: fonts.bold,
    fontSize: 30,
    lineHeight: 36,
    letterSpacing: -0.75,
  },
  sub: {
    maxWidth: 340,
    color: authUi.muted,
    fontFamily: fonts.regular,
    fontSize: 14.5,
    lineHeight: 21,
    letterSpacing: -0.12,
  },
  fieldLabel: {
    color: authUi.muted,
    fontFamily: fonts.medium,
    fontSize: 13,
    lineHeight: 17,
  },
  spacer: { flex: 1 },
})

const af = StyleSheet.create({
  header: { height: 52, justifyContent: 'center' },
  topRow: {
    height: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sideSlot: { width: 84, alignItems: 'flex-start' },
  rightSlot: { width: 84, alignItems: 'flex-end' },
  back: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: -12,
  },
  brandLockup: { alignItems: 'center', justifyContent: 'center' },
  field: {
    minHeight: 54,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: authUi.line,
    backgroundColor: authUi.surface,
    overflow: 'hidden',
  },
  fieldFocused: { borderColor: '#A8A8A8', backgroundColor: '#FFFFFF' },
  fieldError: { borderColor: authUi.danger },
  primary: {
    height: 50,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    backgroundColor: authUi.ink,
    overflow: 'hidden',
  },
  primaryDisabled: { backgroundColor: '#EFEFEF' },
  primaryLabel: {
    color: '#FFFFFF',
    fontFamily: fonts.semiBold,
    fontSize: 15,
    lineHeight: 20,
    letterSpacing: -0.2,
  },
  primaryLabelDisabled: { color: '#A8A8A8' },
})
