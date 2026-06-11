import React, { useState, useRef } from 'react'
import {
  Text, TextInput, TouchableOpacity, StyleSheet,
  Alert, ActivityIndicator, View, Platform,
  ScrollView, KeyboardAvoidingView, Dimensions,
} from 'react-native'
import { Image } from 'expo-image'
import { LinearGradient } from 'expo-linear-gradient'
import * as Haptics from 'expo-haptics'
import * as ImagePicker from 'expo-image-picker'
import { Ionicons } from '@expo/vector-icons'
import { useNavigation } from '@react-navigation/native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { fonts } from '../../theme'
import { createPost } from '../../services/post.service'
import { useFeedStore } from '../../store/feed.store'
import { useAuthStore } from '../../store/auth.store'
import { toast } from '../../utils/toast'

const { width: W } = Dimensions.get('window')
const B   = '#4C8CE4'
const T   = '#1A1A1A'
const M   = '#ABABAB'
const BD  = '#E5E5EA'
const BG  = '#FFFFFF'

// Gradient pairs for color picker
const GRADIENTS: [string, string][] = [
  ['#FF6B35', '#E63946'],
  ['#7B2FBE', '#C77DFF'],
  ['#4C8CE4', '#5BC0EB'],
  ['#0A2463', '#1B4F72'],
  ['#1E8449', '#52C234'],
  ['#E67E22', '#F39C12'],
  ['#E74C3C', '#FF6B9D'],
  ['#1A1A2E', '#6C3483'],
  ['#00B4D8', '#0077B6'],
  ['#F72585', '#7209B7'],
  ['#06D6A0', '#1B9AAA'],
  ['#FFB347', '#FF6B6B'],
]

type Media = { uri: string }

export default function CreateScreen() {
  const nav             = useNavigation()
  const { top, bottom } = useSafeAreaInsets()
  const [caption,        setCaption]        = useState('')
  const [gradientIdx,    setGradientIdx]    = useState(0)
  const [media,          setMedia]          = useState<Media[]>([])
  const [loading,        setLoading]        = useState(false)
  const [includePartner, setIncludePartner] = useState(false)
  const [isAnnouncement, setIsAnnouncement] = useState(false)
  const textRef = useRef<TextInput>(null)

  const setPendingPost = useFeedStore((s) => s.setPendingPost)
  const { user } = useAuthStore()
  const hasPartner = !!(user?.partnerId && user?.partnerName)
  const isAdmin    = user?.isAdmin === true

  const gradient = GRADIENTS[gradientIdx]
  const canPublish = !!caption.trim() || media.length > 0

  async function addPhoto() {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (status !== 'granted') return Alert.alert('Permissão negada', 'Precisamos acesso à galeria.')
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: 'images', quality: 1 })
    if (!result.canceled && result.assets[0]) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
      setMedia((prev) => [...prev, { uri: result.assets[0].uri }])
    }
  }

  function removePhoto(idx: number) {
    setMedia((prev) => prev.filter((_, i) => i !== idx))
  }

  async function handlePublish() {
    if (!canPublish) return
    setLoading(true)
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    try {
      const partnerId = hasPartner && includePartner && !isAnnouncement ? user!.partnerId! : undefined
      const newPost = media.length > 0
        ? await createPost(media[0].uri, 'IMAGE', caption.trim() || undefined, undefined, partnerId, isAnnouncement)
        : await createPost(null, 'TEXT', caption.trim(), `${gradient[0]}|${gradient[1]}`, partnerId, isAnnouncement)
      if (newPost) setPendingPost(newPost)
      setCaption(''); setMedia([]); setGradientIdx(0); setIsAnnouncement(false)
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
      toast.success('Publicado!', isAnnouncement ? 'Anúncio enviado para todos' : 'Visível por 24 horas')
      nav.navigate('Feed' as never)
    } catch (e: unknown) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
      toast.error('Erro', e instanceof Error ? e.message : 'Tenta novamente')
    } finally { setLoading(false) }
  }

  return (
    <KeyboardAvoidingView style={s.screen} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>

      {/* Header */}
      <View style={[s.header, { paddingTop: top + 10 }]}>
        <TouchableOpacity
          onPress={() => nav.goBack()}
          style={s.closeBtn}
          hitSlop={{ top: 10, right: 10, bottom: 10, left: 10 }}
        >
          <Ionicons name="close" size={20} color={T} />
        </TouchableOpacity>

        <Text style={s.headerTitle}>Nova publicação</Text>

        <TouchableOpacity
          style={[s.publishPill, (!canPublish || loading) && s.publishPillOff]}
          onPress={handlePublish}
          disabled={!canPublish || loading}
          activeOpacity={0.85}
        >
          {loading
            ? <ActivityIndicator color="#fff" size="small" style={{ width: 52 }} />
            : <Text style={s.publishTxt}>Publicar</Text>
          }
        </TouchableOpacity>
      </View>

      {/* Color picker */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={s.colorScroll}
        contentContainerStyle={s.colorContent}
      >
        {GRADIENTS.map((g, i) => (
          <TouchableOpacity
            key={i}
            onPress={() => { setGradientIdx(i); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light) }}
            style={[s.colorCircleWrap, gradientIdx === i && s.colorCircleSelected]}
            activeOpacity={0.8}
          >
            <LinearGradient colors={g} style={s.colorCircle} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} />
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Main text card */}
      <TouchableOpacity
        style={s.cardWrap}
        activeOpacity={1}
        onPress={() => textRef.current?.focus()}
      >
        {media.length > 0 ? (
          <View style={s.cardMedia}>
            <Image source={{ uri: media[0].uri }} style={s.cardImg} contentFit="cover" />
          </View>
        ) : (
          <LinearGradient colors={gradient} style={s.card} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
            <TextInput
              ref={textRef}
              style={s.cardInput}
              placeholder="Escreve aqui..."
              placeholderTextColor="rgba(255,255,255,0.45)"
              value={caption}
              onChangeText={setCaption}
              multiline
              maxLength={280}
              textAlign="center"
              textAlignVertical="center"
              selectionColor="rgba(255,255,255,0.6)"
              autoFocus
            />
            <Text style={s.cardCount}>{caption.length}/280</Text>
          </LinearGradient>
        )}
      </TouchableOpacity>

      {/* Gallery strip */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={s.galleryScroll}
        contentContainerStyle={s.galleryContent}
      >
        <TouchableOpacity style={s.galleryAdd} onPress={addPhoto} activeOpacity={0.75}>
          <Ionicons name="add" size={22} color={M} />
        </TouchableOpacity>
        {media.map((m, i) => (
          <TouchableOpacity key={i} style={s.galleryThumb} onLongPress={() => removePhoto(i)} activeOpacity={0.85}>
            <Image source={{ uri: m.uri }} style={s.galleryImg} contentFit="cover" />
            <TouchableOpacity style={s.thumbRemove} onPress={() => removePhoto(i)} hitSlop={{ top: 6, right: 6, bottom: 6, left: 6 }}>
              <Ionicons name="close-circle" size={18} color={T} />
            </TouchableOpacity>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Toolbar */}
      <View style={[s.toolbar, { paddingBottom: bottom + 10 }]}>
        <TouchableOpacity style={s.toolBtn} onPress={() => textRef.current?.focus()} activeOpacity={0.7}>
          <Text style={s.toolBtnTxt}>Aa</Text>
        </TouchableOpacity>

        <TouchableOpacity style={s.toolBtn} activeOpacity={0.7}>
          <Ionicons name="happy-outline" size={22} color={T} />
        </TouchableOpacity>

        <TouchableOpacity style={s.toolBtn} activeOpacity={0.7}>
          <Text style={s.toolBtnTxt}>#</Text>
        </TouchableOpacity>

        <TouchableOpacity style={s.toolBtn} activeOpacity={0.7}>
          <Text style={s.toolBtnTxt}>@</Text>
        </TouchableOpacity>

        <View style={s.toolSpacer} />

        {hasPartner && !isAnnouncement && (
          <TouchableOpacity
            style={[s.partnerChip, includePartner && s.partnerChipOn]}
            onPress={() => setIncludePartner((v) => !v)}
            activeOpacity={0.8}
          >
            <Ionicons name={includePartner ? 'heart' : 'heart-outline'} size={14} color={includePartner ? '#fff' : B} />
            <Text style={[s.partnerChipTxt, includePartner && s.partnerChipTxtOn]}>
              {includePartner ? user!.partnerName : `+ ${user!.partnerName}`}
            </Text>
          </TouchableOpacity>
        )}

        {isAdmin && (
          <TouchableOpacity
            style={[s.partnerChip, isAnnouncement && s.announcementChip]}
            onPress={() => setIsAnnouncement((v) => !v)}
            activeOpacity={0.8}
          >
            <Ionicons name="megaphone-outline" size={14} color={isAnnouncement ? '#fff' : '#E67E22'} />
            <Text style={[s.partnerChipTxt, isAnnouncement && s.partnerChipTxtOn]}>Anúncio</Text>
          </TouchableOpacity>
        )}

        <View style={s.badge24h}>
          <Ionicons name="time-outline" size={13} color={M} />
          <Text style={s.badge24hTxt}>Visível 24h</Text>
        </View>
      </View>

    </KeyboardAvoidingView>
  )
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: BG },

  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingBottom: 12,
    borderBottomWidth: 1, borderBottomColor: BD,
  },
  closeBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: '#F4F4F6',
    alignItems: 'center', justifyContent: 'center',
  },
  headerTitle: { flex: 1, textAlign: 'center', fontFamily: fonts.bold, fontSize: 16, color: T, marginLeft: -36 },
  publishPill: {
    backgroundColor: B, borderRadius: 20,
    paddingHorizontal: 18, paddingVertical: 8,
    ...Platform.select({
      ios: { shadowColor: B, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.4, shadowRadius: 10 },
      android: { elevation: 4 },
    }),
  },
  publishPillOff: { opacity: 0.35 },
  publishTxt:     { fontFamily: fonts.semiBold, fontSize: 14, color: '#fff' },

  colorScroll:   { flexGrow: 0, maxHeight: 56 },
  colorContent:  { paddingHorizontal: 16, paddingVertical: 10, gap: 10, flexDirection: 'row', alignItems: 'center' },
  colorCircleWrap: {
    width: 40, height: 40, borderRadius: 20,
    padding: 2, borderWidth: 2, borderColor: 'transparent',
  },
  colorCircleSelected: { borderColor: T },
  colorCircle: { width: '100%', height: '100%', borderRadius: 18 },

  cardWrap: { flex: 1, marginHorizontal: 16, marginVertical: 8 },
  card: {
    flex: 1, borderRadius: 28,
    alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 28, paddingVertical: 32,
  },
  cardInput: {
    width: '100%',
    fontFamily: fonts.semiBold, fontSize: 26, color: '#fff',
    textAlign: 'center', lineHeight: 38, letterSpacing: -0.3,
    minHeight: 80,
  },
  cardCount: {
    position: 'absolute', bottom: 14, right: 18,
    fontSize: 11, fontFamily: fonts.regular, color: 'rgba(255,255,255,0.45)',
  },

  cardMedia: { flex: 1, borderRadius: 28, overflow: 'hidden' },
  cardImg:   { width: '100%', height: '100%' },

  galleryScroll:  { flexGrow: 0, maxHeight: 68 },
  galleryContent: { paddingHorizontal: 16, paddingVertical: 10, gap: 8, flexDirection: 'row', alignItems: 'center' },
  galleryAdd: {
    width: 48, height: 48, borderRadius: 12,
    borderWidth: 1.5, borderColor: BD, borderStyle: 'dashed',
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#FAFAFA',
  },
  galleryThumb: { width: 48, height: 48, borderRadius: 12, overflow: 'hidden' },
  galleryImg:   { width: 48, height: 48 },
  thumbRemove: {
    position: 'absolute', top: -3, right: -3,
    backgroundColor: BG, borderRadius: 9,
  },

  toolbar: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingTop: 10,
    borderTopWidth: 1, borderTopColor: BD,
    gap: 2,
  },
  toolBtn:    { width: 38, height: 38, alignItems: 'center', justifyContent: 'center' },
  toolBtnTxt: { fontFamily: fonts.bold, fontSize: 17, color: T },
  toolSpacer: { flex: 1 },

  partnerChip: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 14,
    borderWidth: 1.5, borderColor: B,
  },
  partnerChipOn:    { backgroundColor: B, borderColor: B },
  announcementChip: { backgroundColor: '#E67E22', borderColor: '#E67E22' },
  partnerChipTxt:   { fontFamily: fonts.semiBold, fontSize: 12, color: B },
  partnerChipTxtOn: { color: '#fff' },

  badge24h:    { flexDirection: 'row', alignItems: 'center', gap: 4, marginLeft: 6 },
  badge24hTxt: { fontFamily: fonts.regular, fontSize: 12, color: M },
})
