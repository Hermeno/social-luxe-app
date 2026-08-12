import React, { useState } from 'react'
import {
  View, Text, TouchableOpacity, StyleSheet,
  Alert, ScrollView,
} from 'react-native'
import { Image } from 'expo-image'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import * as ImagePicker from 'expo-image-picker'
import { StatusBar } from 'expo-status-bar'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { api } from '../../services/api'
import { useAuthStore } from '../../store/auth.store'
import { clearAllLocalData } from '../../db/database'
import { fonts } from '../../theme'
import { useT, useI18n } from '../../i18n'
import Icon from '../../components/Icon'
import { AuthHeader, AuthPrimaryButton, authStyles, authUi } from '../../components/AuthFlow'

interface Props { onDone: () => void }

// ── Step 1: Photo ─────────────────────────────────────────────────────────────
function SetPhotoStep({ onNext, onSkip }: { onNext: () => void; onSkip: () => void }) {
  const t = useT()
  const [avatarUri, setAvatarUri] = useState<string | null>(null)
  const [saving,    setSaving]    = useState(false)
  const { refreshUser }           = useAuthStore()
  const { top, bottom }           = useSafeAreaInsets()
  const photoActionLabel = avatarUri
    ? t.ep_changePhoto
    : `${t.add} ${t.cr_photo.toLocaleLowerCase()}`

  async function takePhoto() {
    const { status } = await ImagePicker.requestCameraPermissionsAsync()
    if (status !== 'granted') { Alert.alert(t.ob_perm_needed, t.ob_perm_camera); return }
    const result = await ImagePicker.launchCameraAsync({ allowsEditing: true, aspect: [1, 1], quality: 0.85 })
    if (!result.canceled && result.assets[0]) {
      setAvatarUri(result.assets[0].uri)
    }
  }

  async function pickGallery() {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (status !== 'granted') { Alert.alert(t.ob_perm_needed, t.ob_perm_gallery); return }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: 'images', allowsEditing: true, aspect: [1, 1], quality: 0.85 })
    if (!result.canceled && result.assets[0]) {
      setAvatarUri(result.assets[0].uri)
    }
  }

  function showPhotoOptions() {
    if (saving) return
    Alert.alert(
      photoActionLabel,
      undefined,
      [
        { text: t.ob_take_photo, onPress: () => { void takePhoto() } },
        { text: t.ob_gallery, onPress: () => { void pickGallery() } },
        { text: t.cancel, style: 'cancel' },
      ],
      { cancelable: true },
    )
  }

  async function handleContinue() {
    if (!avatarUri) { onNext(); return }
    setSaving(true)
    const previousAvatar = useAuthStore.getState().user?.avatar ?? null
    useAuthStore.setState((st) => ({ user: st.user ? { ...st.user, avatar: avatarUri } : null }))
    try {
      const form = new FormData()
      form.append('avatar', { uri: avatarUri, name: 'avatar.jpg', type: 'image/jpeg' } as any)
      await api.put('/users/profile', form, { headers: { 'Content-Type': 'multipart/form-data' } })
      await refreshUser()
    } catch {
      useAuthStore.setState((st) => ({ user: st.user ? { ...st.user, avatar: previousAvatar } : null }))
      Alert.alert(t.error, t.ob_photo_save_fail)
      return
    } finally {
      setSaving(false)
    }
    onNext()
  }

  return (
    <View style={[authStyles.screen, ps.screen]}>
      <View style={[authStyles.page, { paddingTop: top + 12 }]}>
        <AuthHeader
          step={4}
          total={5}
          stage={t.au_stage_profile}
          right={(
            <TouchableOpacity
              style={ps.headerSkip}
              onPress={onSkip}
              disabled={saving}
              hitSlop={{ top: 8, bottom: 8, left: 12, right: 12 }}
              accessibilityRole="button"
              accessibilityLabel={t.ob_skip}
              accessibilityState={{ disabled: saving }}
            >
              <Text style={ps.headerSkipLabel}>{t.ob_skip}</Text>
            </TouchableOpacity>
          )}
        />

        <ScrollView
          style={ps.body}
          contentContainerStyle={ps.bodyContent}
          showsVerticalScrollIndicator={false}
          bounces={false}
        >
          <View style={[authStyles.hero, ps.hero]}>
            <Text style={authStyles.heading}>{t.ob_photo_heading}</Text>
            <Text style={authStyles.sub}>{t.ob_photo_sub}</Text>
          </View>

          <View style={ps.photoArea}>
            <View style={ps.avatar}>
              {avatarUri ? (
                <Image
                  source={{ uri: avatarUri }}
                  style={ps.photo}
                  contentFit="cover"
                  accessibilityLabel={t.ob_photo_heading}
                />
              ) : (
                <View style={ps.emptyAvatar}>
                  <Icon name="camera" size={36} color={authUi.muted} strokeWidth={1.6} />
                </View>
              )}
            </View>

            <TouchableOpacity
              style={[ps.photoAction, saving && ps.actionDisabled]}
              onPress={showPhotoOptions}
              disabled={saving}
              activeOpacity={0.65}
              accessibilityRole="button"
              accessibilityLabel={photoActionLabel}
              accessibilityState={{ disabled: saving }}
            >
              <Text style={ps.photoActionLabel}>{photoActionLabel}</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>

        <View style={[ps.footer, { paddingBottom: Math.max(bottom, 12) + 8 }]}>
          <AuthPrimaryButton
            label={t.au_continue}
            onPress={handleContinue}
            loading={saving}
          />
        </View>
      </View>
    </View>
  )
}

const ps = StyleSheet.create({
  screen: { backgroundColor: '#FFFFFF' },
  body: { flex: 1 },
  bodyContent: { paddingBottom: 22 },
  hero: { marginTop: 28 },
  headerSkip: {
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'flex-end',
  },
  headerSkipLabel: {
    color: authUi.muted,
    fontFamily: fonts.medium,
    fontSize: 13,
    lineHeight: 18,
  },
  photoArea: {
    alignItems: 'center',
    marginTop: 40,
  },
  avatar: {
    width: 152,
    height: 152,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: authUi.line,
    borderRadius: 76,
    backgroundColor: '#F2F2F2',
    overflow: 'hidden',
  },
  photo: { width: '100%', height: '100%' },
  emptyAvatar: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F2F2F2',
  },
  photoAction: {
    minHeight: 44,
    marginTop: 10,
    paddingHorizontal: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoActionLabel: {
    color: authUi.ink,
    fontFamily: fonts.semiBold,
    fontSize: 14,
    lineHeight: 19,
  },
  actionDisabled: { opacity: 0.45 },
  footer: {
    paddingTop: 12,
    backgroundColor: '#FFFFFF',
  },
})

// ── Step 2: Interests ─────────────────────────────────────────────────────────
// `id` is the stable value stored/sent to the API (never translate it); `en` is
// the English display label. Portuguese display uses `id`.
export const INTERESTS: { id: string; en: string; emoji: string }[] = [
  { id: 'Fotografia',       en: 'Photography',     emoji: '📷' }, { id: 'Música',          en: 'Music',          emoji: '🎵' },
  { id: 'Viagens',          en: 'Travel',          emoji: '✈️' }, { id: 'Culinária',        en: 'Cooking',        emoji: '🍳' },
  { id: 'Moda',             en: 'Fashion',         emoji: '👗' }, { id: 'Arte',            en: 'Art',            emoji: '🎨' },
  { id: 'Desporto',         en: 'Sports',          emoji: '⚽️' }, { id: 'Tecnologia',      en: 'Technology',     emoji: '💻' },
  { id: 'Fitness',          en: 'Fitness',         emoji: '💪' }, { id: 'Cinema',          en: 'Cinema',         emoji: '🎬' },
  { id: 'Natureza',         en: 'Nature',          emoji: '🌿' }, { id: 'Negócios',        en: 'Business',       emoji: '💼' },
  { id: 'Dança',            en: 'Dance',           emoji: '💃' }, { id: 'Literatura',      en: 'Literature',     emoji: '📚' },
  { id: 'Jogos',            en: 'Games',           emoji: '🎮' }, { id: 'Bem-estar',       en: 'Wellness',       emoji: '🧘' },
  { id: 'Animais',          en: 'Animals',         emoji: '🐾' }, { id: 'Arquitectura',    en: 'Architecture',   emoji: '🏛️' },
  { id: 'Automóveis',       en: 'Cars',            emoji: '🚗' }, { id: 'Beleza',          en: 'Beauty',         emoji: '💄' },
  { id: 'Podcast',          en: 'Podcast',         emoji: '🎙️' }, { id: 'Espiritualidade', en: 'Spirituality',   emoji: '✨' },
  { id: 'Política',         en: 'Politics',        emoji: '🏛️' }, { id: 'Ciência',         en: 'Science',        emoji: '🔬' },
  { id: 'Sustentabilidade', en: 'Sustainability',  emoji: '🌍' }, { id: 'Voluntariado',    en: 'Volunteering',   emoji: '🤝' },
  { id: 'Empreendedorismo', en: 'Entrepreneurship', emoji: '🚀' }, { id: 'Investimento',   en: 'Investing',      emoji: '📈' },
  { id: 'Futebol',          en: 'Football',        emoji: '🏆' }, { id: 'Basquete',        en: 'Basketball',     emoji: '🏀' },
  { id: 'Surf',             en: 'Surfing',         emoji: '🏄' }, { id: 'Corrida',         en: 'Running',        emoji: '🏃' },
  { id: 'Yoga',             en: 'Yoga',            emoji: '🧘‍♀️' }, { id: 'Meditação',      en: 'Meditation',     emoji: '🕊️' },
  { id: 'Gastronomia',      en: 'Gastronomy',      emoji: '🍽️' }, { id: 'Vinho',           en: 'Wine',           emoji: '🍷' },
  { id: 'Tatuagem',         en: 'Tattoo',          emoji: '🖋️' }, { id: 'Graffiti',        en: 'Graffiti',       emoji: '🎨' },
  { id: 'Teatro',           en: 'Theatre',         emoji: '🎭' }, { id: 'Comédia',         en: 'Comedy',         emoji: '😂' },
]

function InterestsStep({ onDone, onBack }: { onDone: () => void; onBack: () => void }) {
  const t = useT()
  const { lang } = useI18n()
  const [selected,  setSelected]  = useState<Set<string>>(new Set())
  const [finishing, setFinishing] = useState(false)
  const { top, bottom } = useSafeAreaInsets()
  const { refreshUser }  = useAuthStore()

  function toggle(tag: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      next.has(tag) ? next.delete(tag) : next.add(tag)
      return next
    })
  }

  async function handleDone() {
    if (selected.size < 3 || finishing) return
    setFinishing(true)
    const interests = [...selected]
    try {
      await AsyncStorage.setItem('interests', JSON.stringify(interests))
      await api.put('/users/interests', { interests })
      await refreshUser().catch(() => {})
      await clearAllLocalData().catch(() => {})
      await AsyncStorage.setItem('onboarding_done', '1')
      onDone()
    } catch {
      setFinishing(false)
      Alert.alert(t.error, t.ob_interests_save_fail)
    }
  }

  return (
    <View style={[authStyles.screen, is.screen]}>
      <View style={[authStyles.page, { paddingTop: top + 12 }]}>
        <AuthHeader
          step={5}
          total={5}
          stage={t.au_stage_personalize}
          onBack={onBack}
        />

        <ScrollView
          style={is.body}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={is.scrollContent}
        >
          <View style={[authStyles.hero, is.hero]}>
            <Text style={authStyles.heading}>{t.ob_interests_heading}</Text>
            <Text style={authStyles.sub}>{t.ob_interests_sub}</Text>
          </View>

          <View style={is.grid}>
            {INTERESTS.map(({ id, en }) => {
              const on = selected.has(id)
              return (
                <TouchableOpacity
                  key={id}
                  style={[is.interest, on && is.interestOn]}
                  onPress={() => toggle(id)}
                  activeOpacity={0.72}
                  accessibilityRole="checkbox"
                  accessibilityLabel={lang === 'en' ? en : id}
                  accessibilityState={{ checked: on }}
                >
                  <Text style={[is.interestLabel, on && is.interestLabelOn]}>
                    {lang === 'en' ? en : id}
                  </Text>
                </TouchableOpacity>
              )
            })}
          </View>
        </ScrollView>

        <View style={[is.footer, { paddingBottom: Math.max(bottom, 12) + 8 }]}>
          <Text style={is.counterText} accessibilityLiveRegion="polite">
            {selected.size} / 3 · {selected.size === 1 ? t.ob_selected_one : t.ob_selected_many}
          </Text>

          <AuthPrimaryButton
            label={t.ob_start}
            onPress={handleDone}
            disabled={selected.size < 3}
            loading={finishing}
          />
        </View>
      </View>
    </View>
  )
}

const is = StyleSheet.create({
  screen: { backgroundColor: '#FFFFFF' },
  body: { flex: 1 },
  scrollContent: { paddingBottom: 18 },
  hero: { marginTop: 24, marginBottom: 24 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  interest: {
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 22,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: authUi.lineStrong,
    backgroundColor: authUi.surface,
  },
  interestOn: { borderColor: authUi.ink, backgroundColor: authUi.ink },
  interestLabel: {
    color: authUi.ink,
    fontFamily: fonts.medium,
    fontSize: 14,
    lineHeight: 18,
  },
  interestLabelOn: { color: '#FFFFFF', fontFamily: fonts.semiBold },
  footer: {
    gap: 8,
    paddingTop: 12,
    backgroundColor: '#FFFFFF',
  },
  counterText: {
    color: authUi.muted,
    fontFamily: fonts.medium,
    fontSize: 13,
    lineHeight: 18,
    textAlign: 'center',
    fontVariant: ['tabular-nums'],
  },
})

// ── Main ──────────────────────────────────────────────────────────────────────
export default function OnboardingScreen({ onDone }: Props) {
  const [step, setStep] = useState<0 | 1>(0)
  return (
    <>
      <StatusBar style="dark" />
      {step === 0
        ? <SetPhotoStep onNext={() => setStep(1)} onSkip={() => setStep(1)} />
        : <InterestsStep onDone={onDone} onBack={() => setStep(0)} />}
    </>
  )
}
