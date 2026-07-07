import React, { useState, useRef } from 'react'
import {
  View, Text, TouchableOpacity, StyleSheet,
  Platform, Animated, ActivityIndicator, Alert,
  ScrollView, Dimensions,
} from 'react-native'
import { Image } from 'expo-image'
import { LinearGradient } from 'expo-linear-gradient'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import * as ImagePicker from 'expo-image-picker'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { api } from '../../services/api'
import { useAuthStore } from '../../store/auth.store'
import { clearAllLocalData } from '../../db/database'
import { fonts } from '../../theme'

const T  = '#1A1A1A'
const S  = '#6E6E73'
const M  = '#ABABAB'
const B  = '#CA2851'
const BD = '#E5E5EA'
const BG = '#FFFFFF'

const { width: W } = Dimensions.get('window')

interface Props { onDone: () => void }

function useBounce() {
  const scale = useRef(new Animated.Value(1)).current
  function bounce(cb: () => void) {
    Animated.sequence([
      Animated.spring(scale, { toValue: 0.97, useNativeDriver: true, speed: 80, bounciness: 0 }),
      Animated.spring(scale, { toValue: 1,    useNativeDriver: true, speed: 40, bounciness: 5 }),
    ]).start(cb)
  }
  return { scale, bounce }
}

// Decorative avatar bg dots for SetPhotoStep
const BG_COLORS = [
  '#FFD580','#CA2851','#FF6B6B','#6BCB77','#A29BFE','#FD79A8',
  '#FDCB6E','#74B9FF','#E17055','#55EFC4','#B2BEC3','#DFE6E9',
  '#81ECEC','#FAB1A0','#6C5CE7','#00CEC9','#FFC3A0','#DCEEFB',
  '#F8C8D4','#C3F0CA','#EAD7F7','#FFEAA7',
]

function AvatarBgGrid() {
  const cols = 5
  const size = Math.floor(W / cols) - 8
  return (
    <View style={bg.grid} pointerEvents="none">
      {BG_COLORS.map((c, i) => (
        <View key={i} style={[bg.dot, { width: size, height: size, borderRadius: size / 2, backgroundColor: c }]} />
      ))}
    </View>
  )
}
const bg = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingHorizontal: 4, justifyContent: 'center', opacity: 0.35 },
  dot:  {},
})

// ── Step 1: Photo ─────────────────────────────────────────────────────────────
function SetPhotoStep({ onNext, onSkip }: { onNext: () => void; onSkip: () => void }) {
  const [avatarUri, setAvatarUri] = useState<string | null>(null)
  const [saving,    setSaving]    = useState(false)
  const { refreshUser }           = useAuthStore()
  const { top, bottom }           = useSafeAreaInsets()

  async function takePhoto() {
    const { status } = await ImagePicker.requestCameraPermissionsAsync()
    if (status !== 'granted') { Alert.alert('Permissão necessária', 'Precisamos acesso à câmara.'); return }
    const result = await ImagePicker.launchCameraAsync({ allowsEditing: true, aspect: [1, 1], quality: 0.85 })
    if (!result.canceled && result.assets[0]) {
      setAvatarUri(result.assets[0].uri)
    }
  }

  async function pickGallery() {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (status !== 'granted') { Alert.alert('Permissão necessária', 'Precisamos acesso à galeria.'); return }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: 'images', allowsEditing: true, aspect: [1, 1], quality: 0.85 })
    if (!result.canceled && result.assets[0]) {
      setAvatarUri(result.assets[0].uri)
    }
  }

  async function handleContinue() {
    if (!avatarUri) { onNext(); return }
    setSaving(true)
    useAuthStore.setState((st) => ({ user: st.user ? { ...st.user, avatar: avatarUri } : null }))
    try {
      const form = new FormData()
      form.append('avatar', { uri: avatarUri, name: 'avatar.jpg', type: 'image/jpeg' } as any)
      await api.put('/users/profile', form, { headers: { 'Content-Type': 'multipart/form-data' } })
      await refreshUser()
    } catch {}
    setSaving(false)
    onNext()
  }

  return (
    <View style={ps.screen}>
      {/* Decorative background */}
      <View style={StyleSheet.absoluteFill}>
        <AvatarBgGrid />
        <LinearGradient
          colors={['rgba(255,255,255,0.55)', 'rgba(255,255,255,0.92)', BG]}
          locations={[0, 0.42, 0.7]}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />
      </View>

      <View style={[ps.content, { paddingTop: top + 14, paddingBottom: bottom + 24 }]}>
        {/* Back */}
        <TouchableOpacity style={ps.backBtn} onPress={onSkip} hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}>
          <Ionicons name="chevron-back" size={20} color={T} />
        </TouchableOpacity>

        {/* Hero */}
        <View style={ps.hero}>
          <Text style={ps.heading}>Mostra-te.</Text>
          <Text style={ps.sub}>A tua foto ajuda as pessoas{'\n'}a reconhecer-te.</Text>
        </View>

        {/* Dashed circle picker */}
        <TouchableOpacity style={ps.dashedCircle} onPress={pickGallery} activeOpacity={0.85}>
          {avatarUri
            ? <Image source={{ uri: avatarUri }} style={ps.photoImg} contentFit="cover" />
            : <View style={ps.photoEmpty}>
                <Ionicons name="camera-outline" size={36} color={B} />
              </View>
          }
          <View style={ps.plusBadge}>
            <Ionicons name="add" size={16} color="#fff" />
          </View>
        </TouchableOpacity>

        <View style={ps.spacer} />

        {/* Two action buttons */}
        <View style={ps.btnPair}>
          <TouchableOpacity style={ps.btnBlue} onPress={takePhoto} disabled={saving} activeOpacity={0.88}>
            <Ionicons name="camera" size={18} color="#fff" />
            <Text style={ps.btnBlueTxt}>Tirar foto</Text>
          </TouchableOpacity>
          <TouchableOpacity style={ps.btnOutline} onPress={pickGallery} disabled={saving} activeOpacity={0.88}>
            <Ionicons name="images-outline" size={18} color={T} />
            <Text style={ps.btnOutlineTxt}>Galeria</Text>
          </TouchableOpacity>
        </View>

        {avatarUri && (
          <TouchableOpacity style={ps.continueBtn} onPress={handleContinue} disabled={saving} activeOpacity={0.88}>
            {saving
              ? <ActivityIndicator color="#fff" size="small" />
              : <>
                  <Text style={ps.continueTxt}>Continuar</Text>
                  <Ionicons name="arrow-forward" size={18} color="#fff" />
                </>
            }
          </TouchableOpacity>
        )}

        <TouchableOpacity style={ps.skipRow} onPress={onSkip} hitSlop={{ top: 8, bottom: 8 }}>
          <Text style={ps.skipTxt}>Ignorar por agora</Text>
        </TouchableOpacity>
      </View>
    </View>
  )
}

const ps = StyleSheet.create({
  screen: { flex: 1, backgroundColor: BG },
  content:{ flex: 1, paddingHorizontal: 24 },

  backBtn: {
    width: 44, height: 44, borderRadius: 14,
    borderWidth: 1.5, borderColor: 'rgba(0,0,0,0.1)', backgroundColor: 'rgba(255,255,255,0.8)',
    alignItems: 'center', justifyContent: 'center',
  },

  hero:    { marginTop: 36, gap: 12, alignItems: 'center' },
  heading: { fontFamily: fonts.extraBold, fontSize: 30, lineHeight: 36, letterSpacing: -0.9, color: T, textAlign: 'center' },
  sub:     { fontFamily: fonts.regular, fontSize: 15, lineHeight: 22, color: S, textAlign: 'center' },

  dashedCircle: {
    alignSelf: 'center', marginTop: 36,
    width: 120, height: 120, borderRadius: 60,
    borderWidth: 2, borderColor: B, borderStyle: 'dashed',
    alignItems: 'center', justifyContent: 'center',
    overflow: 'hidden',
  },
  photoImg:   { width: 120, height: 120, borderRadius: 60 },
  photoEmpty: { flex: 1, alignItems: 'center', justifyContent: 'center', width: '100%' },
  plusBadge: {
    position: 'absolute', bottom: 6, right: 6,
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: B, alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: BG,
  },

  spacer: { flex: 1 },

  btnPair: { flexDirection: 'row', gap: 12, marginBottom: 12 },
  btnBlue: {
    flex: 1, height: 52, borderRadius: 16,
    backgroundColor: B,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    ...Platform.select({
      ios: { shadowColor: B, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.45, shadowRadius: 12 },
      android: { elevation: 6 },
    }),
  },
  btnBlueTxt: { fontFamily: fonts.bold, fontSize: 15, color: '#fff' },

  btnOutline: {
    flex: 1, height: 52, borderRadius: 16,
    borderWidth: 1.5, borderColor: BD, backgroundColor: BG,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
  },
  btnOutlineTxt: { fontFamily: fonts.bold, fontSize: 15, color: T },

  continueBtn: {
    height: 52, borderRadius: 16, backgroundColor: B,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 12,
    ...Platform.select({
      ios: { shadowColor: B, shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.65, shadowRadius: 18 },
      android: { elevation: 8 },
    }),
  },
  continueTxt: { fontFamily: fonts.bold, fontSize: 17, color: '#fff', letterSpacing: -0.2 },

  skipRow: { alignItems: 'center', paddingVertical: 4 },
  skipTxt: { fontSize: 14, fontFamily: fonts.regular, color: M },
})

// ── Step 2: Interests ─────────────────────────────────────────────────────────
const INTERESTS: { label: string; emoji: string }[] = [
  { label: 'Fotografia',       emoji: '📷' }, { label: 'Música',          emoji: '🎵' },
  { label: 'Viagens',          emoji: '✈️' }, { label: 'Culinária',        emoji: '🍳' },
  { label: 'Moda',             emoji: '👗' }, { label: 'Arte',            emoji: '🎨' },
  { label: 'Desporto',         emoji: '⚽️' }, { label: 'Tecnologia',      emoji: '💻' },
  { label: 'Fitness',          emoji: '💪' }, { label: 'Cinema',          emoji: '🎬' },
  { label: 'Natureza',         emoji: '🌿' }, { label: 'Negócios',        emoji: '💼' },
  { label: 'Dança',            emoji: '💃' }, { label: 'Literatura',      emoji: '📚' },
  { label: 'Jogos',            emoji: '🎮' }, { label: 'Bem-estar',       emoji: '🧘' },
  { label: 'Animais',          emoji: '🐾' }, { label: 'Arquitectura',    emoji: '🏛️' },
  { label: 'Automóveis',       emoji: '🚗' }, { label: 'Beleza',          emoji: '💄' },
  { label: 'Podcast',          emoji: '🎙️' }, { label: 'Espiritualidade', emoji: '✨' },
  { label: 'Política',         emoji: '🏛️' }, { label: 'Ciência',         emoji: '🔬' },
  { label: 'Sustentabilidade', emoji: '🌍' }, { label: 'Voluntariado',    emoji: '🤝' },
  { label: 'Empreendedorismo', emoji: '🚀' }, { label: 'Investimento',    emoji: '📈' },
  { label: 'Futebol',          emoji: '🏆' }, { label: 'Basquete',        emoji: '🏀' },
  { label: 'Surf',             emoji: '🏄' }, { label: 'Corrida',         emoji: '🏃' },
  { label: 'Yoga',             emoji: '🧘‍♀️' }, { label: 'Meditação',      emoji: '🕊️' },
  { label: 'Gastronomia',      emoji: '🍽️' }, { label: 'Vinho',           emoji: '🍷' },
  { label: 'Tatuagem',         emoji: '🖋️' }, { label: 'Graffiti',        emoji: '🎨' },
  { label: 'Teatro',           emoji: '🎭' }, { label: 'Comédia',         emoji: '😂' },
]

function InterestsStep({ onDone, onBack }: { onDone: () => void; onBack: () => void }) {
  const [selected,  setSelected]  = useState<Set<string>>(new Set())
  const [finishing, setFinishing] = useState(false)
  const { top, bottom } = useSafeAreaInsets()
  const { scale, bounce } = useBounce()
  const { refreshUser }  = useAuthStore()

  function toggle(tag: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      next.has(tag) ? next.delete(tag) : next.add(tag)
      return next
    })
  }

  async function handleDone() {
    bounce(async () => {
      setFinishing(true)
      const interests = [...selected]
      try {
        await AsyncStorage.setItem('interests', JSON.stringify(interests))
        await api.put('/users/interests', { interests }).catch(() => {})
        await refreshUser().catch(() => {})
        await clearAllLocalData().catch(() => {})
        await AsyncStorage.setItem('onboarding_done', '1')
      } catch {}
      onDone()
    })
  }

  return (
    <View style={[is.screen, { paddingTop: top + 14 }]}>
      {/* Header */}
      <View style={is.header}>
        <TouchableOpacity onPress={onBack} style={is.backBtn} hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}>
          <Ionicons name="chevron-back" size={20} color={T} />
        </TouchableOpacity>

        {/* 3-segment progress bar */}
        <View style={is.progressRow}>
          {[0, 1, 2].map((i) => (
            <View key={i} style={[is.progressSeg, { backgroundColor: B }]} />
          ))}
        </View>

        <Text style={is.stepLabel}>Passo 3 de 3</Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={is.scrollContent}>
        <View style={is.hero}>
          <Text style={is.heading}>O que te{'\n'}interessa?</Text>
          <Text style={is.sub}>Escolhe pelo menos 3 temas para personalizarmos o teu feed.</Text>
        </View>

        {/* Tags */}
        <View style={is.tagsWrap}>
          {INTERESTS.map(({ label, emoji }) => {
            const on = selected.has(label)
            return (
              <TouchableOpacity
                key={label}
                style={[is.tag, on && is.tagOn]}
                onPress={() => toggle(label)}
                activeOpacity={0.7}
              >
                <Text style={is.tagEmoji}>{emoji}</Text>
                <Text style={[is.tagTxt, on && is.tagTxtOn]}>{label}</Text>
                {on && (
                  <View style={is.tagCheck}>
                    <Ionicons name="checkmark" size={11} color={B} />
                  </View>
                )}
              </TouchableOpacity>
            )
          })}
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Footer */}
      <View style={[is.footer, { paddingBottom: bottom + 16 }]}>
        {selected.size > 0 && (
          <Text style={is.countTxt}>
            {selected.size} selecionado{selected.size !== 1 ? 's' : ''}
          </Text>
        )}
        <Animated.View style={{ transform: [{ scale }] }}>
          <TouchableOpacity
            style={[is.cta, (selected.size < 3 || finishing) && is.ctaOff]}
            onPress={handleDone}
            disabled={selected.size < 3 || finishing}
            activeOpacity={0.88}
          >
            {finishing
              ? <ActivityIndicator color="#fff" size="small" />
              : <Text style={is.ctaTxt}>Começar a explorar</Text>
            }
          </TouchableOpacity>
        </Animated.View>
      </View>
    </View>
  )
}

const is = StyleSheet.create({
  screen:      { flex: 1, backgroundColor: BG },
  scrollContent:{ paddingHorizontal: 24 },

  header:      { paddingHorizontal: 24, gap: 10, marginBottom: 4 },
  backBtn: {
    width: 44, height: 44, borderRadius: 14,
    borderWidth: 1.5, borderColor: BD, backgroundColor: BG,
    alignItems: 'center', justifyContent: 'center',
  },
  progressRow: { flexDirection: 'row', gap: 6 },
  progressSeg: { flex: 1, height: 4, borderRadius: 2 },
  stepLabel:   { fontFamily: fonts.medium, fontSize: 13, color: M },

  hero:    { marginTop: 28, marginBottom: 28, gap: 12 },
  heading: { fontFamily: fonts.extraBold, fontSize: 30, lineHeight: 36, letterSpacing: -0.9, color: T },
  sub:     { fontFamily: fonts.regular, fontSize: 15, lineHeight: 22, color: S },

  tagsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  tag: {
    flexDirection: 'row', alignItems: 'center', gap: 7,
    paddingHorizontal: 16, paddingVertical: 12,
    borderRadius: 999,
    borderWidth: 1.5, borderColor: BD,
    backgroundColor: BG,
  },
  tagOn:     { backgroundColor: T, borderColor: T },
  tagEmoji:  { fontSize: 15 },
  tagTxt:    { fontFamily: fonts.semiBold, fontSize: 15, color: T },
  tagTxtOn:  { color: '#fff' },
  tagCheck: {
    width: 16, height: 16, borderRadius: 8,
    backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center',
  },

  footer:   { paddingHorizontal: 24, gap: 10, borderTopWidth: 1, borderTopColor: BD, paddingTop: 14 },
  countTxt: { fontFamily: fonts.medium, fontSize: 13, color: M, textAlign: 'center' },

  cta: {
    height: 52, borderRadius: 16, backgroundColor: T,
    alignItems: 'center', justifyContent: 'center',
    ...Platform.select({
      ios: { shadowColor: T, shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.25, shadowRadius: 16 },
      android: { elevation: 8 },
    }),
  },
  ctaOff: { opacity: 0.35 },
  ctaTxt: { fontFamily: fonts.bold, fontSize: 17, color: '#fff', letterSpacing: -0.2 },
})

// ── Main ──────────────────────────────────────────────────────────────────────
export default function OnboardingScreen({ onDone }: Props) {
  const [step, setStep] = useState<0 | 1>(0)
  if (step === 0) {
    return <SetPhotoStep onNext={() => setStep(1)} onSkip={() => setStep(1)} />
  }
  return <InterestsStep onDone={onDone} onBack={() => setStep(0)} />
}
