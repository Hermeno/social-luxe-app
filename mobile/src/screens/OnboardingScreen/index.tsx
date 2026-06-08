import React, { useEffect, useRef, useState } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, Animated, FlatList,
  ActivityIndicator, Dimensions, Alert,
} from 'react-native'
import { Image } from 'expo-image'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import * as ImagePicker from 'expo-image-picker'
import * as Haptics from 'expo-haptics'
import Toast from 'react-native-toast-message'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { api } from '../../services/api'
import * as followService from '../../services/follow.service'
import { FollowDuration } from '../../services/follow.service'
import FollowSplitButton from '../../components/FollowSplitButton'
import { useAuthStore } from '../../store/auth.store'
import { clearAllLocalData } from '../../db/database'
import { fonts } from '../../theme'
import { API_BASE } from '../../config'

// ── Design tokens (same as auth screens) ─────────────────────────────────────
const T  = '#1A1A1A'
const S  = '#6E6E73'
const M  = '#ABABAB'
const B  = '#4C8CE4'
const BD = '#E5E5EA'
const BG = '#FFFFFF'
const SX = '#F9F9FB'

const { width: W } = Dimensions.get('window')
const CARD_GAP = 12
const CARD_W   = (W - 28 * 2 - CARD_GAP) / 2

interface SuggestedUser {
  id: string; name: string; avatar: string | null
  bio: string | null; _count: { followers: number }
}
interface Props { onDone: () => void }

function fmtFollowers(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000)     return `${(n / 1_000).toFixed(1)}K`
  return String(n)
}

// ── Progress bar ──────────────────────────────────────────────────────────────
function ProgressBar({ step, total }: { step: number; total: number }) {
  return (
    <View style={pb.track}>
      {Array.from({ length: total }, (_, i) => (
        <View key={i} style={[pb.seg, i < step ? pb.active : pb.inactive]} />
      ))}
    </View>
  )
}
const pb = StyleSheet.create({
  track:    { flexDirection: 'row', gap: 4, flex: 1 },
  seg:      { flex: 1, height: 3, borderRadius: 2 },
  active:   { backgroundColor: T },
  inactive: { backgroundColor: BD },
})

// ── Shared button bounce ──────────────────────────────────────────────────────
function useBounce() {
  const scale = useRef(new Animated.Value(1)).current
  function bounce(cb: () => void) {
    Animated.sequence([
      Animated.spring(scale, { toValue: 0.97, useNativeDriver: true, speed: 80, bounciness: 0 }),
      Animated.spring(scale, { toValue: 1,    useNativeDriver: true, speed: 40, bounciness: 6 }),
    ]).start(cb)
  }
  return { scale, bounce }
}

// ── Step 1: Bio ───────────────────────────────────────────────────────────────
function SetBioStep({ onNext, onSkip }: { onNext: (bio: string) => void; onSkip: () => void }) {
  const [bio,     setBio]     = useState('')
  const [saving,  setSaving]  = useState(false)
  const [focused, setFocused] = useState(false)
  const { scale, bounce } = useBounce()

  async function handleSave() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    bounce(async () => {
      if (!bio.trim()) { onSkip(); return }
      setSaving(true)
      try {
        await api.put('/users/profile', { bio: bio.trim() })
        onNext(bio.trim())
      } catch {
        Toast.show({ type: 'error', text1: 'Erro', text2: 'Não foi possível guardar. Tenta novamente.', visibilityTime: 3000 })
      } finally { setSaving(false) }
    })
  }

  return (
    <KeyboardAvoidingView style={s.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <SafeAreaView style={s.safeInner}>

        {/* Header */}
        <View style={s.header}>
          <Text style={s.brand}>luxee</Text>
          <View style={s.headerRight}>
            <ProgressBar step={1} total={3} />
            <Text style={s.stepLabel}>1 / 3</Text>
          </View>
        </View>

        {/* Hero */}
        <View style={s.hero}>
          <Text style={s.heading}>Fala{'\n'}sobre ti.</Text>
          <Text style={s.sub}>Uma bio ajuda as pessoas a conhecer-te melhor.</Text>
        </View>

        {/* Bio textarea */}
        <View style={[s.textareaWrap, focused && s.textareaFocused]}>
          <TextInput
            style={s.textarea}
            placeholder="Escreve algo sobre ti..."
            placeholderTextColor={M}
            value={bio}
            onChangeText={setBio}
            multiline
            maxLength={160}
            textAlignVertical="top"
            autoFocus
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
          />
          <Text style={[s.charCount, bio.length > 140 && s.charCountWarn]}>
            {bio.length}/160
          </Text>
        </View>

        <View style={{ flex: 1 }} />

        {/* CTA */}
        <Animated.View style={{ transform: [{ scale }] }}>
          <TouchableOpacity
            style={[s.btn, saving && s.btnOff]}
            onPress={handleSave}
            disabled={saving}
            activeOpacity={1}
          >
            {saving
              ? <ActivityIndicator color="#fff" />
              : <Text style={s.btnText}>{bio.trim() ? 'Guardar e continuar' : 'Continuar'}</Text>
            }
          </TouchableOpacity>
        </Animated.View>

        <TouchableOpacity style={s.skipRow} onPress={onSkip} hitSlop={{ top: 8, bottom: 8 }}>
          <Text style={s.skipTxt}>Saltar por agora</Text>
        </TouchableOpacity>

      </SafeAreaView>
    </KeyboardAvoidingView>
  )
}

// ── Step 2: Photo ─────────────────────────────────────────────────────────────
function SetPhotoStep({ onNext, onSkip }: { onNext: () => void; onSkip: () => void }) {
  const [avatarUri, setAvatarUri] = useState<string | null>(null)
  const [saving,    setSaving]    = useState(false)
  const { loadUser } = useAuthStore()
  const { scale, bounce } = useBounce()
  const photoScale = useRef(new Animated.Value(1)).current

  async function pickPhoto() {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (status !== 'granted') {
      Alert.alert('Permissão necessária', 'Precisamos acesso à galeria.')
      return
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: 'images', allowsEditing: true, aspect: [1, 1], quality: 0.85,
    })
    if (result.canceled || !result.assets[0]) return
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    setAvatarUri(result.assets[0].uri)
    Animated.sequence([
      Animated.spring(photoScale, { toValue: 0.92, useNativeDriver: true, speed: 50 }),
      Animated.spring(photoScale, { toValue: 1,    useNativeDriver: true, speed: 30, bounciness: 8 }),
    ]).start()
  }

  async function handleSave() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    bounce(async () => {
      if (!avatarUri) { onSkip(); return }
      setSaving(true)
      try {
        const form = new FormData()
        form.append('avatar', { uri: avatarUri, name: 'avatar.jpg', type: 'image/jpeg' } as any)
        await api.put('/users/profile', form, { headers: { 'Content-Type': 'multipart/form-data' } })
        await loadUser()
      } catch {}
      setSaving(false)
      onNext()
    })
  }

  return (
    <SafeAreaView style={s.screen}>
      <View style={s.safeInner}>

        {/* Header */}
        <View style={s.header}>
          <Text style={s.brand}>luxee</Text>
          <View style={s.headerRight}>
            <ProgressBar step={2} total={3} />
            <Text style={s.stepLabel}>2 / 3</Text>
          </View>
        </View>

        {/* Hero */}
        <View style={s.hero}>
          <Text style={s.heading}>A tua{'\n'}foto.</Text>
          <Text style={s.sub}>Ajuda as pessoas a reconhecer-te no teu perfil.</Text>
        </View>

        {/* Photo picker */}
        <View style={s.photoSection}>
          <TouchableOpacity onPress={pickPhoto} activeOpacity={0.85}>
            <Animated.View style={[s.photoRing, { transform: [{ scale: photoScale }] }]}>
              {avatarUri ? (
                <Image source={{ uri: avatarUri }} style={s.photoImg} contentFit="cover" />
              ) : (
                <View style={s.photoEmpty}>
                  <Ionicons name="person-outline" size={48} color={M} />
                </View>
              )}
              {/* Camera badge */}
              <View style={s.cameraBadge}>
                <Ionicons name="camera" size={16} color={BG} />
              </View>
            </Animated.View>
          </TouchableOpacity>

          {avatarUri ? (
            <TouchableOpacity onPress={pickPhoto} style={s.changeBtn}>
              <Text style={s.changeBtnTxt}>Alterar foto</Text>
            </TouchableOpacity>
          ) : (
            <Text style={s.photoHint}>Toca para escolher da galeria</Text>
          )}
        </View>

        <View style={{ flex: 1 }} />

        <Animated.View style={{ transform: [{ scale }] }}>
          <TouchableOpacity
            style={[s.btn, saving && s.btnOff]}
            onPress={handleSave}
            disabled={saving}
            activeOpacity={1}
          >
            {saving
              ? <ActivityIndicator color="#fff" />
              : <Text style={s.btnText}>{avatarUri ? 'Guardar e continuar' : 'Continuar'}</Text>
            }
          </TouchableOpacity>
        </Animated.View>

        <TouchableOpacity style={s.skipRow} onPress={onSkip} hitSlop={{ top: 8, bottom: 8 }}>
          <Text style={s.skipTxt}>Saltar por agora</Text>
        </TouchableOpacity>

      </View>
    </SafeAreaView>
  )
}

// ── Step 3: Suggested users ───────────────────────────────────────────────────
function SuggestedStep({ onDone }: { onDone: () => void }) {
  const [users,     setUsers]     = useState<SuggestedUser[]>([])
  const [loading,   setLoading]   = useState(true)
  const [followed,  setFollowed]  = useState<Set<string>>(new Set())
  const [pending,   setPending]   = useState<Set<string>>(new Set())
  const [finishing, setFinishing] = useState(false)
  const { scale, bounce } = useBounce()

  useEffect(() => {
    // Fetch suggested users AND current following list in parallel
    // so buttons correctly show "Seguindo" for people already followed
    Promise.all([
      api.get('/users/suggested').then((r) => r.data.data ?? r.data),
      api.get('/users/following').then((r) => r.data.data ?? r.data ?? []),
    ])
      .then(([suggested, following]) => {
        setUsers((suggested as SuggestedUser[]).slice(0, 12))
        setFollowed(new Set((following as { id: string }[]).map((u) => u.id)))
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  async function toggleFollow(userId: string, duration: FollowDuration = 'forever') {
    if (pending.has(userId)) return
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    setPending((p) => new Set([...p, userId]))
    try {
      const res = await followService.toggleFollow(userId, duration)
      setFollowed((prev) => {
        const next = new Set(prev)
        res.following ? next.add(userId) : next.delete(userId)
        return next
      })
    } catch {}
    setPending((p) => { const n = new Set(p); n.delete(userId); return n })
  }

  async function handleDone() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    bounce(async () => {
      setFinishing(true)
      await clearAllLocalData().catch(() => {})
      await AsyncStorage.setItem('onboarding_done', '1')
      onDone()
    })
  }

  function renderCard({ item }: { item: SuggestedUser }) {
    const isFollowing = followed.has(item.id)
    const isLoading   = pending.has(item.id)
    const uri = item.avatar
      ? (item.avatar.startsWith('http') ? item.avatar : `${API_BASE}${item.avatar}`)
      : null

    return (
      <View style={c.card}>
        {/* Avatar */}
        <View style={c.avatarWrap}>
          {uri
            ? <Image source={{ uri }} style={c.avatar} contentFit="cover" />
            : <View style={[c.avatar, c.avatarFallback]}>
                <Text style={c.avatarInitial}>{item.name[0]?.toUpperCase() ?? '?'}</Text>
              </View>
          }
        </View>

        {/* Info */}
        <Text style={c.name} numberOfLines={1}>{item.name}</Text>
        <Text style={c.followers} numberOfLines={1}>
          {fmtFollowers(item._count.followers)} seguidores
        </Text>

        {/* Follow button */}
        <FollowSplitButton
          following={isFollowing}
          loading={isLoading}
          onFollow={(duration) => toggleFollow(item.id, duration)}
          theme="light"
        />
      </View>
    )
  }

  return (
    <SafeAreaView style={s.screen}>

      {/* Header */}
      <View style={[s.header, { paddingHorizontal: 28, paddingTop: 12 }]}>
        <Text style={s.brand}>luxee</Text>
        <View style={s.headerRight}>
          <ProgressBar step={3} total={3} />
          <Text style={s.stepLabel}>3 / 3</Text>
        </View>
      </View>

      {/* Hero */}
      <View style={[s.hero, { paddingHorizontal: 28 }]}>
        <Text style={s.heading}>Quem{'\n'}seguir?</Text>
        <Text style={s.sub}>Segue perfis para personalizar o teu feed desde o início.</Text>
      </View>

      {/* Grid */}
      {loading ? (
        <View style={s.loadingWrap}>
          <ActivityIndicator color={B} />
        </View>
      ) : (
        <FlatList
          data={users}
          keyExtractor={(u) => u.id}
          numColumns={2}
          columnWrapperStyle={c.row}
          contentContainerStyle={c.grid}
          showsVerticalScrollIndicator={false}
          renderItem={renderCard}
        />
      )}

      {/* Footer CTA */}
      <View style={s.suggestFooter}>
        <View style={s.followedPill}>
          <Text style={s.followedTxt}>
            {followed.size > 0
              ? `${followed.size} perfil${followed.size > 1 ? 'is' : ''} selecionado${followed.size > 1 ? 's' : ''}`
              : 'Seleciona pelo menos um'
            }
          </Text>
        </View>

        <Animated.View style={{ transform: [{ scale }] }}>
          <TouchableOpacity
            style={[s.btn, finishing && s.btnOff]}
            onPress={handleDone}
            disabled={finishing}
            activeOpacity={1}
          >
            {finishing
              ? <ActivityIndicator color="#fff" />
              : (
                <View style={s.btnInner}>
                  <Text style={s.btnText}>Entrar no Luxe</Text>
                  <Ionicons name="arrow-forward" size={18} color={BG} />
                </View>
              )
            }
          </TouchableOpacity>
        </Animated.View>
      </View>

    </SafeAreaView>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function OnboardingScreen({ onDone }: Props) {
  const [step, setStep] = useState<0 | 1 | 2>(0)
  if (step === 0) return <SetBioStep   onNext={() => setStep(1)} onSkip={() => setStep(1)} />
  if (step === 1) return <SetPhotoStep onNext={() => setStep(2)} onSkip={() => setStep(2)} />
  return <SuggestedStep onDone={onDone} />
}

// ── Shared styles ─────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  screen:    { flex: 1, backgroundColor: BG },
  safeInner: { flex: 1, paddingHorizontal: 28, paddingBottom: 36 },

  header:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 0, gap: 12, marginBottom: 44 },
  headerRight:{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10, justifyContent: 'flex-end', maxWidth: 160 },
  brand:      { fontFamily: fonts.bold, fontSize: 22, color: T, letterSpacing: -0.6 },
  stepLabel:  { fontSize: 13, fontFamily: fonts.medium, color: M },

  hero:    { marginBottom: 40, gap: 12 },
  heading: { fontSize: 40, fontFamily: fonts.bold, color: T, letterSpacing: -1.2, lineHeight: 46 },
  sub:     { fontSize: 15, fontFamily: fonts.regular, color: S, lineHeight: 22, letterSpacing: -0.1 },

  // Bio textarea
  textareaWrap: {
    borderWidth: 1.5, borderColor: BD, borderRadius: 16,
    backgroundColor: SX, padding: 18, minHeight: 130,
  },
  textareaFocused: { borderColor: B, backgroundColor: BG },
  textarea:  { fontFamily: fonts.regular, fontSize: 16, color: T, minHeight: 90, lineHeight: 23 },
  charCount: { fontSize: 12, fontFamily: fonts.regular, color: M, textAlign: 'right', marginTop: 8 },
  charCountWarn: { color: '#FF9500' },

  // Photo
  photoSection: { alignItems: 'center', gap: 20, marginBottom: 16 },
  photoRing: {
    width: 148, height: 148, borderRadius: 74,
    borderWidth: 2, borderColor: BD,
    overflow: 'hidden',
    position: 'relative',
  },
  photoImg:  { width: 148, height: 148, borderRadius: 74 },
  photoEmpty:{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: SX },
  cameraBadge: {
    position: 'absolute', bottom: 8, right: 8,
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: T,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2.5, borderColor: BG,
  },
  changeBtn:    { paddingHorizontal: 20, paddingVertical: 9, borderRadius: 20, borderWidth: 1.5, borderColor: BD },
  changeBtnTxt: { fontSize: 14, fontFamily: fonts.semiBold, color: T },
  photoHint:    { fontSize: 14, fontFamily: fonts.regular, color: M },

  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  // Shared button
  btn:     { height: 56, borderRadius: 16, backgroundColor: T, alignItems: 'center', justifyContent: 'center' },
  btnOff:  { opacity: 0.2 },
  btnInner:{ flexDirection: 'row', alignItems: 'center', gap: 8 },
  btnText: { color: BG, fontFamily: fonts.semiBold, fontSize: 16, letterSpacing: -0.2 },

  skipRow: { marginTop: 18, alignItems: 'center' },
  skipTxt: { fontSize: 14, fontFamily: fonts.regular, color: M },

  // Suggest footer
  suggestFooter: { paddingHorizontal: 28, paddingBottom: 24, gap: 14 },
  followedPill: {
    alignSelf: 'center',
    paddingHorizontal: 14, paddingVertical: 7,
    borderRadius: 20, backgroundColor: SX,
    borderWidth: 1, borderColor: BD,
  },
  followedTxt: { fontSize: 13, fontFamily: fonts.medium, color: S },
})

// ── Card styles ───────────────────────────────────────────────────────────────
const c = StyleSheet.create({
  grid:     { paddingHorizontal: 28, paddingBottom: 12 },
  row:      { justifyContent: 'space-between', marginBottom: CARD_GAP },

  card: {
    width: CARD_W,
    alignItems: 'center',
    paddingBottom: 14,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: BD,
    backgroundColor: BG,
    overflow: 'hidden',
  },

  avatarWrap:    { width: '100%', height: CARD_W * 0.75, marginBottom: 12, overflow: 'hidden' },
  avatar:        { width: '100%', height: '100%' },
  avatarFallback:{ backgroundColor: SX, alignItems: 'center', justifyContent: 'center' },
  avatarInitial: { fontSize: 40, fontFamily: fonts.bold, color: M },

  name:      { fontSize: 14, fontFamily: fonts.bold, color: T, letterSpacing: -0.2, textAlign: 'center', paddingHorizontal: 8 },
  followers: { fontSize: 12, fontFamily: fonts.regular, color: M, marginTop: 3, marginBottom: 12, textAlign: 'center' },

})
