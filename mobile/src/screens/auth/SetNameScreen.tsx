import React, { useState, useEffect } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ActivityIndicator, Alert, ScrollView,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native'
import { StackNavigationProp } from '@react-navigation/stack'
import { useAuthStore } from '../../store/auth.store'
import { getUsernameOptions } from '../../services/auth.service'
import { AuthStackParams } from '../../navigation/AuthNavigator'
import { fonts } from '../../theme'
import { useT } from '../../i18n'
import {
  AuthFieldFrame,
  AuthHeader,
  AuthPrimaryButton,
  authStyles,
  authUi,
} from '../../components/AuthFlow'
import { displayHandle } from '../../utils/handle'

type Nav   = StackNavigationProp<AuthStackParams>
type Route = RouteProp<AuthStackParams, 'SetName'>

const MAX = 30

export default function SetNameScreen() {
  const nav   = useNavigation<Nav>()
  const route = useRoute<Route>()
  const t     = useT()
  const { top, bottom } = useSafeAreaInsets()
  const { register } = useAuthStore()
  const { phone, countryCode, password } = route.params

  const [name,    setName]    = useState('')
  const [focused, setFocused] = useState(false)
  const [loading, setLoading] = useState(false)

  // @handle: opções (nome + número) para o utilizador escolher.
  const [handleOptions, setHandleOptions]   = useState<string[]>([])
  const [selectedHandle, setSelectedHandle] = useState<string | null>(null)
  const [loadingHandles, setLoadingHandles] = useState(false)

  const trimmed   = name.trim()
  const canCreate = trimmed.length >= 2

  // Busca as opções ~600ms depois de parar de escrever.
  useEffect(() => {
    if (trimmed.length < 2) {
      setLoadingHandles(false)
      setHandleOptions([])
      setSelectedHandle(null)
      return
    }
    setLoadingHandles(true)
    let cancelled = false
    const id = setTimeout(async () => {
      try {
        const res = await getUsernameOptions(trimmed)
        if (cancelled) return
        setHandleOptions(res.options)
        setSelectedHandle((prev) => (prev && res.options.includes(prev) ? prev : res.options[0] ?? null))
      } catch {
        if (!cancelled) {
          setHandleOptions([])
          setSelectedHandle(null)
        }
      } finally {
        if (!cancelled) setLoadingHandles(false)
      }
    }, 600)
    return () => {
      cancelled = true
      clearTimeout(id)
    }
  }, [trimmed])

  async function refreshHandles() {
    if (trimmed.length < 2 || loadingHandles) return
    setLoadingHandles(true)
    try {
      const res = await getUsernameOptions(trimmed)
      setHandleOptions(res.options)
      setSelectedHandle(res.options[0] ?? null)
    } catch {} finally { setLoadingHandles(false) }
  }

  async function handleRegister() {
    if (!canCreate || loading) return
    setLoading(true)
    try {
      await register(trimmed, phone, countryCode, password, password, selectedHandle ?? undefined)
    } catch (e: unknown) {
      Alert.alert(t.error, e instanceof Error ? e.message : t.au_name_create_fail)
    } finally { setLoading(false) }
  }

  return (
    <KeyboardAvoidingView style={authStyles.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={[authStyles.page, { paddingTop: top + 10, paddingBottom: bottom + 18 }]}>
        <AuthHeader step={3} total={5} stage={t.au_stage_identity} onBack={() => nav.goBack()} />

        <ScrollView
          style={s.scroll}
          contentContainerStyle={s.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={authStyles.hero}>
            <Text style={authStyles.heading}>{t.au_name_heading}</Text>
            <Text style={authStyles.sub}>{t.au_name_sub}</Text>
          </View>

          <View style={s.formBlock}>
            <AuthFieldFrame focused={focused}>
              <TextInput
                style={s.nameInput}
                placeholder={t.au_name_ph}
                placeholderTextColor={authUi.faint}
                value={name}
                onChangeText={(value) => setName(value.slice(0, MAX))}
                autoCapitalize="words"
                autoCorrect={false}
                autoFocus
                returnKeyType="go"
                onSubmitEditing={handleRegister}
                onFocus={() => setFocused(true)}
                onBlur={() => setFocused(false)}
              />
              <Text style={s.charCount}>{String(name.length).padStart(2, '0')} / {MAX}</Text>
            </AuthFieldFrame>
          </View>

          {trimmed.length >= 2 && (
            <View style={s.handleSection}>
              <View style={s.handleHead}>
                <Text style={s.handleTitle}>{t.au_handle_title}</Text>
                <TouchableOpacity
                  style={s.refreshButton}
                  onPress={refreshHandles}
                  disabled={loadingHandles}
                  activeOpacity={0.7}
                  accessibilityRole="button"
                  accessibilityLabel={t.au_handle_refresh}
                >
                  <Ionicons name="refresh" size={17} color={loadingHandles ? authUi.faint : authUi.muted} />
                </TouchableOpacity>
              </View>

              {loadingHandles && handleOptions.length === 0 ? (
                <View style={s.handleLoading}>
                  <ActivityIndicator color={authUi.signal} size="small" />
                  <Text style={s.loadingLabel}>{t.au_handle_checking}</Text>
                </View>
              ) : (
                <View style={s.handleList}>
                  {handleOptions.map((handle) => {
                    const selected = handle === selectedHandle
                    return (
                      <TouchableOpacity
                        key={handle}
                        style={[s.handleOption, selected && s.handleOptionSelected]}
                        onPress={() => setSelectedHandle(handle)}
                        activeOpacity={0.72}
                        accessibilityRole="radio"
                        accessibilityState={{ checked: selected }}
                      >
                        <Text style={[s.handleText, selected && s.handleTextSelected]}>{displayHandle(handle)}</Text>
                        {selected ? <Ionicons name="checkmark" size={17} color={authUi.signal} /> : null}
                      </TouchableOpacity>
                    )
                  })}
                </View>
              )}
            </View>
          )}

          <View style={s.spacer} />
          <AuthPrimaryButton
            label={t.au_continue}
            onPress={handleRegister}
            disabled={!canCreate}
            loading={loading}
            style={s.cta}
          />
        </ScrollView>
      </View>
    </KeyboardAvoidingView>
  )
}

const s = StyleSheet.create({
  scroll: { flex: 1 },
  scrollContent: { flexGrow: 1, paddingBottom: 2 },
  formBlock: { marginTop: 30 },
  nameInput: {
    flex: 1,
    height: 58,
    paddingHorizontal: 13,
    color: authUi.ink,
    fontFamily: fonts.semiBold,
    fontSize: 17,
    letterSpacing: -0.2,
  },
  charCount: {
    paddingRight: 14,
    color: authUi.faint,
    fontFamily: fonts.medium,
    fontSize: 10.5,
    fontVariant: ['tabular-nums'],
  },
  handleSection: { marginTop: 22 },
  handleHead: { height: 36, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  handleTitle: { color: authUi.muted, fontFamily: fonts.medium, fontSize: 13, lineHeight: 17 },
  refreshButton: { width: 44, height: 44, marginRight: -10, alignItems: 'center', justifyContent: 'center' },
  handleLoading: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 10 },
  loadingLabel: { color: authUi.muted, fontFamily: fonts.regular, fontSize: 12.5 },
  handleList: { marginTop: 4, gap: 8 },
  handleOption: {
    minHeight: 46,
    paddingHorizontal: 13,
    borderRadius: 11,
    borderWidth: 1,
    borderColor: authUi.line,
    backgroundColor: authUi.surface,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  handleOptionSelected: { borderColor: authUi.signal, backgroundColor: '#FFF8F2' },
  handleText: { color: authUi.muted, fontFamily: fonts.semiBold, fontSize: 14 },
  handleTextSelected: { color: authUi.ink },
  spacer: { flex: 1, minHeight: 28 },
  cta: { marginTop: 8 },
})
