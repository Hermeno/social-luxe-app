import React, { useEffect, useRef, useState } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, Animated, FlatList,
  ActivityIndicator, SafeAreaView, Dimensions, Image,
} from 'react-native'
import * as ImagePicker from 'expo-image-picker'
import * as Haptics from 'expo-haptics'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { api } from '../../services/api'
import * as followService from '../../services/follow.service'
import { useAuthStore } from '../../store/auth.store'
import { fonts } from '../../theme'
import { API_BASE } from '../../config'

/* ─── constants ─────────────────────────────────────────── */
const PRIMARY  = '#4C8CE4'
const BG       = '#FFFFFF'
const INPUT_BG = '#F5F5F7'
const TEXT     = '#1A1A1A'
const MUTED    = '#9CA3AF'
const { width: W } = Dimensions.get('window')
const CARD_GAP  = 12
const CARD_W    = (W - 28 * 2 - CARD_GAP) / 2

/* ─── types ──────────────────────────────────────────────── */
interface SuggestedUser {
  id: string
  name: string
  avatar: string | null
  bio: string | null
  _count: { followers: number }
}

interface Props { onDone: () => void }

/* ─── step dots ─────────────────────────────────────────── */
function StepDots({ current }: { current: number }) {
  return (
    <View style={{ flexDirection: 'row', gap: 5 }}>
      {[0, 1, 2].map((i) => (
        <View key={i} style={{
          width: i === current ? 18 : 6, height: 6,
          borderRadius: 3,
          backgroundColor: i === current ? PRIMARY : '#E5E5E5',
        }} />
      ))}
    </View>
  )
}

/* ─── step 1: bio ───────────────────────────────────────── */
function SetBioStep({ onNext, onSkip }: { onNext: (bio: string) => void; onSkip: () => void }) {
  const [bio, setBio] = useState('')
  const [saving, setSaving] = useState(false)
  const btnScale = useRef(new Animated.Value(1)).current

  function animateBtn(cb: () => void) {
    Animated.sequence([
      Animated.spring(btnScale, { toValue: 0.96, useNativeDriver: true, speed: 60 }),
      Animated.spring(btnScale, { toValue: 1, useNativeDriver: true, speed: 40, bounciness: 6 }),
    ]).start(cb)
  }

  async function handleSave() {
    if (!bio.trim()) { onSkip(); return }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    animateBtn(async () => {
      setSaving(true)
      try {
        await api.put('/users/profile', { bio: bio.trim() })
      } catch {}
      setSaving(false)
      onNext(bio.trim())
    })
  }

  return (
    <KeyboardAvoidingView style={s.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={s.inner}>
        <View style={s.topRow}>
          <Text style={s.brand}>luxe</Text>
          <View style={s.topRight}>
            <StepDots current={0} />
            <TouchableOpacity onPress={onSkip} hitSlop={{ top: 12, right: 12, bottom: 12, left: 12 }}>
              <Text style={s.skip}>Saltar</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={s.headWrap}>
          <Text style={s.heading}>Fala sobre ti</Text>
          <Text style={s.sub}>Uma pequena bio para as pessoas te conhecerem melhor.</Text>
        </View>

        <TextInput
          style={[s.input, s.bioInput]}
          placeholder="A tua bio..."
          placeholderTextColor={MUTED}
          value={bio}
          onChangeText={setBio}
          multiline
          maxLength={160}
          textAlignVertical="top"
          autoFocus
        />

        <Text style={s.charCount}>{bio.length}/160</Text>

        <View style={s.spacer} />

        <Animated.View style={{ transform: [{ scale: btnScale }] }}>
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
      </View>
    </KeyboardAvoidingView>
  )
}

/* ─── step 2: photo ─────────────────────────────────────── */
function SetPhotoStep({ onNext, onSkip }: { onNext: () => void; onSkip: () => void }) {
  const [avatarUri, setAvatarUri] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const { loadUser } = useAuthStore()
  const btnScale = useRef(new Animated.Value(1)).current
  const photoScale = useRef(new Animated.Value(1)).current

  function animateBtn(cb: () => void) {
    Animated.sequence([
      Animated.spring(btnScale, { toValue: 0.96, useNativeDriver: true, speed: 60 }),
      Animated.spring(btnScale, { toValue: 1, useNativeDriver: true, speed: 40, bounciness: 6 }),
    ]).start(cb)
  }

  async function pickPhoto() {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (status !== 'granted') return
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.85,
    })
    if (result.canceled || !result.assets[0]) return
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    setAvatarUri(result.assets[0].uri)
    Animated.sequence([
      Animated.spring(photoScale, { toValue: 0.92, useNativeDriver: true, speed: 50 }),
      Animated.spring(photoScale, { toValue: 1, useNativeDriver: true, speed: 30, bounciness: 8 }),
    ]).start()
  }

  async function handleSave() {
    if (!avatarUri) { onSkip(); return }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    animateBtn(async () => {
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
    <View style={s.screen}>
      <View style={s.inner}>
        <View style={s.topRow}>
          <Text style={s.brand}>luxe</Text>
          <View style={s.topRight}>
            <StepDots current={1} />
            <TouchableOpacity onPress={onSkip} hitSlop={{ top: 12, right: 12, bottom: 12, left: 12 }}>
              <Text style={s.skip}>Saltar</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={s.headWrap}>
          <Text style={s.heading}>A tua foto</Text>
          <Text style={s.sub}>Coloca uma foto para o teu perfil ser reconhecido.</Text>
        </View>

        <View style={s.photoCenter}>
          <TouchableOpacity onPress={pickPhoto} activeOpacity={0.85}>
            <Animated.View style={[s.photoCircle, { transform: [{ scale: photoScale }] }]}>
              {avatarUri ? (
                <Image source={{ uri: avatarUri }} style={s.photoImg} />
              ) : (
                <View style={s.photoPlaceholder}>
                  <Text style={s.photoIcon}>📷</Text>
                  <Text style={s.photoHint}>Toca para escolher</Text>
                </View>
              )}
            </Animated.View>
          </TouchableOpacity>

          {avatarUri && (
            <TouchableOpacity onPress={pickPhoto} style={s.changePhotoBtn}>
              <Text style={s.changePhotoText}>Alterar foto</Text>
            </TouchableOpacity>
          )}
        </View>

        <View style={s.spacer} />

        <Animated.View style={{ transform: [{ scale: btnScale }] }}>
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
      </View>
    </View>
  )
}

/* ─── step 3: suggested profiles ───────────────────────── */
function SuggestedStep({ onDone }: { onDone: () => void }) {
  const [users, setUsers]         = useState<SuggestedUser[]>([])
  const [loading, setLoading]     = useState(true)
  const [followed, setFollowed]   = useState<Set<string>>(new Set())
  const [finishing, setFinishing] = useState(false)
  const btnScale = useRef(new Animated.Value(1)).current
  // per-card scale animations
  const cardScales = useRef<Record<string, Animated.Value>>({})

  useEffect(() => {
    api.get('/users/suggested')
      .then((r) => {
        const list: SuggestedUser[] = (r.data.data ?? r.data).slice(0, 10)
        list.forEach((u) => {
          if (!cardScales.current[u.id]) cardScales.current[u.id] = new Animated.Value(1)
        })
        setUsers(list)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  function getScale(userId: string) {
    if (!cardScales.current[userId]) cardScales.current[userId] = new Animated.Value(1)
    return cardScales.current[userId]
  }

  async function toggleFollow(userId: string) {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    const scale = getScale(userId)
    Animated.sequence([
      Animated.spring(scale, { toValue: 0.88, useNativeDriver: true, speed: 80 }),
      Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 40, bounciness: 10 }),
    ]).start()
    try {
      const res = await followService.toggleFollow(userId)
      setFollowed((prev) => {
        const next = new Set(prev)
        res.following ? next.add(userId) : next.delete(userId)
        return next
      })
    } catch {}
  }

  function animateBtn(cb: () => void) {
    Animated.sequence([
      Animated.spring(btnScale, { toValue: 0.96, useNativeDriver: true, speed: 60 }),
      Animated.spring(btnScale, { toValue: 1, useNativeDriver: true, speed: 40, bounciness: 6 }),
    ]).start(cb)
  }

  async function handleDone() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    animateBtn(async () => {
      setFinishing(true)
      await AsyncStorage.setItem('onboarding_done', '1')
      onDone()
    })
  }

  function renderCard({ item }: { item: SuggestedUser }) {
    const isFollowing = followed.has(item.id)
    const scale = getScale(item.id)
    
    return (
      <View style={s.card}>
        {/* Big photo */}
        <View style={s.cardPhoto}>
          {item.avatar ? (
            <Image
              source={{ uri: item.avatar.startsWith('http') ? item.avatar : `${API_BASE}${item.avatar}` }}
              style={s.cardImg}
              resizeMode="cover"
            />
          ) : (
            <View style={[s.cardImg, s.cardImgFallback]}>
              <Text style={s.cardInitial}>{item.name[0]?.toUpperCase() ?? '?'}</Text>
            </View>
          )}
        </View>

        {/* Info */}
        <View style={s.cardInfo}>
          <Text style={s.cardName} numberOfLines={1}>{item.name}</Text>
          <Text style={s.cardSub} numberOfLines={1}>
            {item.bio ?? `${item._count.followers} seguidores`}
          </Text>
        </View>

        {/* Follow button */}
        <Animated.View style={{ transform: [{ scale }], alignSelf: 'center', marginBottom: 12 }}>
          <TouchableOpacity
            style={[s.cardFollowBtn, isFollowing && s.cardFollowingBtn]}
            onPress={() => toggleFollow(item.id)}
            activeOpacity={1}
          >
            <Text style={[s.cardFollowText, isFollowing && s.cardFollowingText]}>
              {isFollowing ? 'A seguir' : 'Seguir'}
            </Text>
          </TouchableOpacity>
        </Animated.View>
      </View>
    )
  }

  return (
    <SafeAreaView style={s.screen}>
      <View style={s.suggestHeader}>
        <Text style={s.brand}>luxe</Text>
        <StepDots current={2} />
      </View>

      <View style={s.suggestHeadWrap}>
        <Text style={s.heading}>Quem seguir?</Text>
        <Text style={s.sub}>Segue perfis para personalizar o teu feed.</Text>
      </View>

      {loading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={PRIMARY} />
        </View>
      ) : (
        <FlatList
          data={users}
          keyExtractor={(u) => u.id}
          numColumns={2}
          columnWrapperStyle={s.cardRow}
          contentContainerStyle={s.cardList}
          showsVerticalScrollIndicator={false}
          renderItem={renderCard}
        />
      )}

      <View style={s.suggestFooter}>
        <Animated.View style={{ transform: [{ scale: btnScale }] }}>
          <TouchableOpacity
            style={[s.btn, finishing && s.btnOff]}
            onPress={handleDone}
            disabled={finishing}
            activeOpacity={1}
          >
            {finishing
              ? <ActivityIndicator color="#fff" />
              : <Text style={s.btnText}>Entrar no Luxe</Text>
            }
          </TouchableOpacity>
        </Animated.View>
      </View>
    </SafeAreaView>
  )
}

/* ─── main onboarding ───────────────────────────────────── */
export default function OnboardingScreen({ onDone }: Props) {
  const [step, setStep] = useState<0 | 1 | 2>(0)

  if (step === 0) {
    return (
      <SetBioStep
        onNext={() => setStep(1)}
        onSkip={() => setStep(1)}
      />
    )
  }
  if (step === 1) {
    return (
      <SetPhotoStep
        onNext={() => setStep(2)}
        onSkip={() => setStep(2)}
      />
    )
  }
  return <SuggestedStep onDone={onDone} />
}

/* ─── styles ─────────────────────────────────────────────── */
const s = StyleSheet.create({
  screen:   { flex: 1, backgroundColor: BG },
  inner:    { flex: 1, paddingHorizontal: 28, paddingTop: 64, paddingBottom: 40 },

  topRow:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 52 },
  topRight: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  brand:    { fontSize: 22, fontFamily: fonts.bold, color: PRIMARY, letterSpacing: -0.3 },
  skip:     { fontSize: 14, fontFamily: fonts.regular, color: MUTED },

  headWrap: { marginBottom: 32, gap: 8 },
  heading:  { fontSize: 28, fontFamily: fonts.semiBold, color: TEXT, letterSpacing: -0.5, lineHeight: 34 },
  sub:      { fontSize: 14, fontFamily: fonts.regular, color: MUTED, lineHeight: 20 },

  /* bio */
  input:     { backgroundColor: INPUT_BG, borderRadius: 14, paddingHorizontal: 18, paddingVertical: 18, fontSize: 16, fontFamily: fonts.regular, color: TEXT },
  bioInput:  { height: 130, paddingTop: 18 },
  charCount: { marginTop: 8, fontSize: 12, fontFamily: fonts.regular, color: MUTED, textAlign: 'right' },

  /* photo */
  photoCenter:      { alignItems: 'center', marginTop: 12 },
  photoCircle:      { width: 140, height: 140, borderRadius: 70, overflow: 'hidden', backgroundColor: INPUT_BG },
  photoImg:         { width: 140, height: 140, borderRadius: 70 },
  photoPlaceholder: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 6 },
  photoIcon:        { fontSize: 36 },
  photoHint:        { fontSize: 13, fontFamily: fonts.regular, color: MUTED },
  changePhotoBtn:   { marginTop: 16 },
  changePhotoText:  { fontSize: 14, fontFamily: fonts.semiBold, color: PRIMARY },

  spacer: { flex: 1 },

  btn:     { backgroundColor: PRIMARY, borderRadius: 14, height: 56, alignItems: 'center', justifyContent: 'center' },
  btnOff:  { opacity: 0.45 },
  btnText: { color: '#fff', fontFamily: fonts.semiBold, fontSize: 16, letterSpacing: 0.1 },

  /* suggested */
  suggestHeader:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 28, paddingTop: 20, paddingBottom: 0 },
  suggestHeadWrap:{ paddingHorizontal: 28, marginTop: 28, marginBottom: 20, gap: 8 },
  suggestFooter:  { paddingHorizontal: 28, paddingBottom: 36, paddingTop: 12 },

  cardList: { paddingHorizontal: 28, paddingBottom: 12 },
  cardRow:  { justifyContent: 'space-between', marginBottom: CARD_GAP },

  card:        { width: CARD_W, backgroundColor: INPUT_BG, borderRadius: 16, overflow: 'hidden' },
  cardPhoto:   { width: CARD_W, height: CARD_W },
  cardImg:     { width: CARD_W, height: CARD_W },
  cardImgFallback: { backgroundColor: '#E5E5EA', alignItems: 'center', justifyContent: 'center' },
  cardInitial: { fontSize: 42, fontFamily: fonts.bold, color: MUTED },

  cardInfo:   { paddingHorizontal: 10, paddingTop: 10, paddingBottom: 6, gap: 2 },
  cardName:   { fontSize: 14, fontFamily: fonts.semiBold, color: TEXT },
  cardSub:    { fontSize: 12, fontFamily: fonts.regular, color: MUTED },

  cardFollowBtn:    { marginHorizontal: 10, paddingVertical: 7, borderRadius: 10, backgroundColor: PRIMARY, alignItems: 'center' },
  cardFollowingBtn: { backgroundColor: INPUT_BG },
  cardFollowText:   { fontSize: 13, fontFamily: fonts.semiBold, color: '#fff' },
  cardFollowingText:{ color: MUTED },
})
