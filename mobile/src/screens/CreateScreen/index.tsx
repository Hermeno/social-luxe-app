import React, { useState, useRef } from 'react'
import {
  Text, TextInput, TouchableOpacity, StyleSheet,
  Alert, ActivityIndicator, View, Platform,
  ScrollView, KeyboardAvoidingView, Dimensions, Keyboard,
} from 'react-native'
import { Image } from 'expo-image'
import { LinearGradient } from 'expo-linear-gradient'
import * as ImagePicker from 'expo-image-picker'
import { Ionicons } from '@expo/vector-icons'
import { useNavigation } from '@react-navigation/native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useVideoPlayer, VideoView } from 'expo-video'
import { fonts } from '../../theme'
import { createPost } from '../../services/post.service'
import { useFeedStore } from '../../store/feed.store'
import { useAuthStore } from '../../store/auth.store'
import { toast } from '../../utils/toast'
import { useT } from '../../i18n'

const { width: W } = Dimensions.get('window')
const B   = '#CA2851'
const T   = '#1A1A1A'
const M   = '#ABABAB'
const BD  = '#E5E5EA'
const BG  = '#FFFFFF'

const GRADIENTS: [string, string][] = [
  ['#FF6B35', '#E63946'],
  ['#7B2FBE', '#C77DFF'],
  ['#CA2851', '#5BC0EB'],
  ['#0A2463', '#1B4F72'],
  ['#1E8449', '#52C234'],
  ['#E67E22', '#F39C12'],
  ['#E74C3C', '#FF6B9D'],
  ['#1A1A2E', '#6C3483'],
  ['#00B4D8', '#0077B6'],
  ['#F72585', '#7209B7'],
  ['#06D6A0', '#1B9AAA'],
  ['#FFB347', '#FF6B6B'],
  // dark / night
  ['#0D0D0D', '#1C1C3E'],
  ['#232526', '#414345'],
  ['#141E30', '#243B55'],
  ['#0F2027', '#2C5364'],
  // deep blue
  ['#000428', '#004E92'],
  ['#4568DC', '#B06AB3'],
  // electric / vivid
  ['#FC466B', '#3F5EFB'],
  ['#11998E', '#38EF7D'],
  // gold / warm
  ['#F7971E', '#FFD200'],
  // earth / dusk
  ['#2C3E50', '#FD746C'],
  ['#B24592', '#F15F79'],
  // soft / pastel
  ['#A8EDEA', '#FED6E3'],
]

type Media = { uri: string; type: 'image' | 'video' }

export default function CreateScreen() {
  const nav             = useNavigation()
  const { top, bottom } = useSafeAreaInsets()
  const [caption,        setCaption]        = useState('')
  const [gradientIdx,    setGradientIdx]    = useState(0)
  const [media,          setMedia]          = useState<Media[]>([])
  const [loading,          setLoading]          = useState(false)
  const [includePartner,   setIncludePartner]   = useState(false)
  const [isAnnouncement,   setIsAnnouncement]   = useState(false)
  const [stickersEnabled,  setStickersEnabled]  = useState(false)
  const textRef    = useRef<TextInput>(null)
  const videoUri   = media[0]?.type === 'video' ? media[0].uri : null
  const videoPlayer = useVideoPlayer(videoUri, (p) => { p.loop = true; p.muted = false; if (videoUri) p.play() })

  const setPendingPost = useFeedStore((s) => s.setPendingPost)
  const { user }       = useAuthStore()
  const t              = useT()
  const hasPartner = !!(user?.partnerId && user?.partnerName)
  const isAdmin    = user?.isAdmin === true
  const hasMedia   = media.length > 0

  const gradient   = GRADIENTS[gradientIdx]
  const canPublish = !!caption.trim() || hasMedia

  const MAX_UPLOAD_BYTES = 50 * 1024 * 1024

  async function addMedia(mediaTypes: ImagePicker.MediaType | ImagePicker.MediaType[]) {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (status !== 'granted') return Alert.alert(t.profile_perm_title, t.profile_perm_msg)
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes,
      quality: 0.85,
      videoMaxDuration: 90,
      videoExportPreset: ImagePicker.VideoExportPreset.MediumQuality,
    })
    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0]

      // Duration guard: 90 seconds max. On iOS the native picker already shows the trim
      // UI when videoMaxDuration=90, so this mainly catches Android gallery picks.
      if (asset.type === 'video' && asset.duration && asset.duration > 91_000) {
        const secs = Math.round(asset.duration / 1000)
        const mm   = Math.floor(secs / 60)
        const ss   = String(secs % 60).padStart(2, '0')
        Alert.alert(
          'Vídeo demasiado longo',
          `Máximo 1:30. Este vídeo tem ${mm}:${ss}.\n\nEscolhe um clipe mais curto.`,
        )
        return
      }

      if (asset.fileSize && asset.fileSize > MAX_UPLOAD_BYTES) {
        Alert.alert(
          'Ficheiro demasiado grande',
          `Máximo 50 MB. Este tem ${Math.round(asset.fileSize / 1024 / 1024)} MB.`,
        )
        return
      }

      const isVideo = asset.type === 'video'
      setMedia([{ uri: asset.uri, type: isVideo ? 'video' : 'image' }])
    }
  }

  function removeMedia(idx: number) {
    setMedia((prev) => prev.filter((_, i) => i !== idx))
  }

  function getDeviceModel(): string {
    if (Platform.OS === 'ios') return 'iPhone'
    const brand = (Platform as any).constants?.Brand as string | undefined
    if (!brand) return 'Android'
    return brand.charAt(0).toUpperCase() + brand.slice(1).toLowerCase()
  }

  async function handlePublish() {
    if (!canPublish) return
    setLoading(true)
    try {
      const partnerId   = hasPartner && includePartner && !isAnnouncement ? user!.partnerId! : undefined
      const deviceModel = getDeviceModel()
      const newPost = hasMedia
        ? await createPost(media[0].uri, media[0].type === 'video' ? 'VIDEO' : 'IMAGE', caption.trim() || undefined, undefined, partnerId, isAnnouncement, deviceModel, stickersEnabled)
        : await createPost(null, 'TEXT', caption.trim(), `${gradient[0]}|${gradient[1]}`, partnerId, isAnnouncement, deviceModel, stickersEnabled)
      if (newPost) setPendingPost(newPost)
      setCaption(''); setMedia([]); setGradientIdx(0); setIsAnnouncement(false); setStickersEnabled(false)
      toast.success(t.feed_published, isAnnouncement ? t.feed_announcement_sub : t.feed_published_sub)
      nav.navigate('Feed' as never)
    } catch (e: unknown) {
      const status = (e as any)?.response?.status
      const msg = status === 413
        ? 'Vídeo demasiado grande. Máximo 100 MB.'
        : e instanceof Error ? e.message : t.chat_retry
      toast.error(t.error, msg)
    } finally { setLoading(false) }
  }

  return (
    <KeyboardAvoidingView style={s.screen} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>

      {/* ── Header ─────────────────────────────────────────────────── */}
      <View style={[s.header, { paddingTop: top + 8 }]}>
        <TouchableOpacity
          onPress={() => { Keyboard.dismiss(); (nav as any).jumpTo('Feed') }}
          style={s.closeBtn}
          hitSlop={{ top: 10, right: 10, bottom: 10, left: 10 }}
        >
          <Ionicons name="chevron-back" size={26} color={T} />
        </TouchableOpacity>

        <Text style={s.headerTitle}>{t.feed_new_post}</Text>

        <TouchableOpacity
          style={[s.publishPill, (!canPublish || loading) && s.publishPillOff]}
          onPress={handlePublish}
          disabled={!canPublish || loading}
          activeOpacity={0.85}
        >
          {loading
            ? <ActivityIndicator color="#fff" size="small" style={{ width: 52 }} />
            : <Text style={s.publishTxt}>{t.feed_publish_btn}</Text>
          }
        </TouchableOpacity>
      </View>

      {/* ── Content ────────────────────────────────────────────────── */}
      {hasMedia ? (

        /* ── Media selected: preview + caption ───────────────────── */
        <>
          <ScrollView
            style={s.photoScroll}
            contentContainerStyle={s.photoScrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <View style={s.cardMedia}>
              {media[0].type === 'video' ? (
                <VideoView player={videoPlayer} style={s.cardImg} contentFit="cover" nativeControls={false} />
              ) : (
                <Image source={{ uri: media[0].uri }} style={s.cardImg} contentFit="cover" />
              )}
              {media[0].type === 'video' && (
                <View style={s.videoIndicator} pointerEvents="none">
                  <Ionicons name="videocam" size={14} color="#fff" />
                  <Text style={s.videoIndicatorTxt}>Vídeo</Text>
                </View>
              )}
              {/* Change media button — top-right corner of the preview */}
              <TouchableOpacity
                style={s.changeMediaBtn}
                onPress={() => addMedia(['images', 'videos'])}
                activeOpacity={0.85}
              >
                <Ionicons name="swap-horizontal" size={14} color="#fff" />
                <Text style={s.changeMediaTxt}>Alterar</Text>
              </TouchableOpacity>
            </View>

            <View style={s.captionCard}>
              <View style={s.captionRow}>
                <Ionicons name="pencil-outline" size={16} color={M} style={{ marginTop: 2 }} />
                <TextInput
                  ref={textRef}
                  style={s.captionInput}
                  placeholder={t.feed_caption_photo_ph}
                  placeholderTextColor={M}
                  value={caption}
                  onChangeText={setCaption}
                  multiline
                  maxLength={280}
                  textAlignVertical="top"
                />
              </View>
              <Text style={s.captionCount}>{caption.length}/280</Text>
            </View>

            <TouchableOpacity style={s.discardBtn} onPress={() => setMedia([])} activeOpacity={0.6}>
              <Ionicons name="close-circle-outline" size={15} color={M} />
              <Text style={s.discardTxt}>Remover e publicar só texto</Text>
            </TouchableOpacity>
          </ScrollView>
        </>

      ) : (

        /* ── No media: big picker cards + text post option ────────── */
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={s.noMediaContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Single media picker */}
          <View style={s.pickerRow}>
            <TouchableOpacity style={s.pickerCard} onPress={() => addMedia(['images', 'videos'])} activeOpacity={0.82}>
              <View style={s.pickerInner}>
                <View style={s.pickerIconBg}>
                  <Ionicons name="image" size={34} color="#555" />
                </View>
                <Text style={s.pickerTitle}>Foto ou Vídeo</Text>
                <Text style={s.pickerSub}>Escolher da galeria</Text>
              </View>
            </TouchableOpacity>
          </View>

          {/* Divider */}
          <View style={s.orRow}>
            <View style={s.orLine} />
            <Text style={s.orTxt}>ou escreve algo</Text>
            <View style={s.orLine} />
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
                onPress={() => { setGradientIdx(i) }}
                style={[s.colorCircleWrap, gradientIdx === i && s.colorCircleSelected]}
                activeOpacity={0.8}
              >
                <LinearGradient colors={g} style={s.colorCircle} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} />
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* Text gradient card — fixed height so it never gets squished behind keyboard */}
          <TouchableOpacity
            style={s.textCardWrap}
            activeOpacity={1}
            onPress={() => textRef.current?.focus()}
          >
            <LinearGradient colors={gradient} style={s.textCard} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
              <TextInput
                ref={textRef}
                style={s.textCardInput}
                placeholder={t.feed_write_ph}
                placeholderTextColor="rgba(255,255,255,0.45)"
                value={caption}
                onChangeText={setCaption}
                multiline
                maxLength={280}
                textAlign="center"
                textAlignVertical="center"
                selectionColor="rgba(255,255,255,0.6)"
              />
              <Text style={s.textCardCount}>{caption.length}/280</Text>
            </LinearGradient>
          </TouchableOpacity>

        </ScrollView>
      )}

      {/* ── Toolbar ────────────────────────────────────────────────── */}
      <View style={[s.toolbar, { paddingBottom: Math.max(bottom, 8) + 52 }]}>
        {!hasMedia && (
          <>
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
          </>
        )}

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

        <TouchableOpacity
          style={[s.partnerChip, stickersEnabled && s.stickerChip]}
          onPress={() => setStickersEnabled((v) => !v)}
          activeOpacity={0.8}
        >
          <Text style={{ fontSize: 13 }}>🎨</Text>
          <Text style={[s.partnerChipTxt, stickersEnabled && s.partnerChipTxtOn]}>
            {stickersEnabled ? 'Objetos ON' : 'Objetos'}
          </Text>
        </TouchableOpacity>

        <View style={s.badge24h}>
          <Ionicons name="time-outline" size={13} color={M} />
          <Text style={s.badge24hTxt}>{t.feed_visible_24h}</Text>
        </View>
      </View>

    </KeyboardAvoidingView>
  )
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: BG },

  /* ── Header ── */
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
      ios:     { shadowColor: B, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.4, shadowRadius: 10 },
      android: { elevation: 4 },
    }),
  },
  publishPillOff: { opacity: 0.35 },
  publishTxt:     { fontFamily: fonts.semiBold, fontSize: 14, color: '#fff' },

  /* ── No-media wrapper ── */
  noMediaContent: { paddingBottom: 24 },

  /* ── Big picker card ── */
  pickerRow: {
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 8,
  },
  pickerCard: {},
  pickerInner: {
    backgroundColor: '#FAFAFA',
    borderRadius: 22,
    borderWidth: 1.5,
    borderColor: '#E5E5EA',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 36,
    gap: 10,
  },
  pickerIconBg: {
    width: 68,
    height: 68,
    borderRadius: 18,
    backgroundColor: '#EBEBF0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pickerTitle: {
    fontFamily: fonts.bold,
    fontSize: 16,
    color: T,
    letterSpacing: -0.3,
  },
  pickerSub: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: M,
    letterSpacing: 0.1,
  },

  /* ── "ou" divider ── */
  orRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
  },
  orLine: { flex: 1, height: 1, backgroundColor: BD },
  orTxt:  { fontFamily: fonts.medium, fontSize: 13, color: M },

  /* ── Color picker ── */
  colorScroll:  { flexGrow: 0, maxHeight: 56 },
  colorContent: { paddingHorizontal: 16, paddingVertical: 10, gap: 10, flexDirection: 'row', alignItems: 'center' },
  colorCircleWrap: {
    width: 36, height: 36, borderRadius: 18,
    padding: 2, borderWidth: 2, borderColor: 'transparent',
  },
  colorCircleSelected: { borderColor: T },
  colorCircle: { width: '100%', height: '100%', borderRadius: 16 },

  /* ── Text gradient card ── */
  textCardWrap: { height: 220, marginHorizontal: 16, marginTop: 6, marginBottom: 8 },
  textCard: {
    flex: 1, borderRadius: 26,
    alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 28, paddingVertical: 24,
  },
  textCardInput: {
    width: '100%',
    fontFamily: fonts.semiBold, fontSize: 24, color: '#fff',
    textAlign: 'center', lineHeight: 36, letterSpacing: -0.3,
    minHeight: 72,
  },
  textCardCount: {
    position: 'absolute', bottom: 12, right: 16,
    fontSize: 11, fontFamily: fonts.regular, color: 'rgba(255,255,255,0.45)',
  },

  /* ── Media selected: photo scroll ── */
  photoScroll:        { flex: 1 },
  photoScrollContent: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 16 },
  cardMedia: {
    width: '100%',
    aspectRatio: 4 / 5,
    borderRadius: 24,
    overflow: 'hidden',
  },
  cardImg: { width: '100%', height: '100%' },
  videoIndicator: {
    position: 'absolute', top: 12, left: 12,
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: 'rgba(0,0,0,0.45)', borderRadius: 8,
    paddingHorizontal: 8, paddingVertical: 4,
  },
  videoIndicatorTxt: { fontFamily: fonts.semiBold, fontSize: 11, color: '#fff' },
  changeMediaBtn: {
    position: 'absolute', top: 12, right: 12,
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: 'rgba(0,0,0,0.48)', borderRadius: 20,
    paddingHorizontal: 12, paddingVertical: 6,
  },
  changeMediaTxt: { fontFamily: fonts.semiBold, fontSize: 12, color: '#fff' },

  captionCard: {
    marginTop: 12,
    backgroundColor: '#F5F5F8',
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: BD,
    minHeight: 80,
  },
  captionRow:   { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  captionInput: {
    flex: 1, fontFamily: fonts.medium, fontSize: 15, color: T,
    lineHeight: 22, minHeight: 48, padding: 0,
  },
  captionCount: { textAlign: 'right', fontFamily: fonts.regular, fontSize: 11, color: M, marginTop: 6 },

  discardBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 5, marginTop: 14, paddingVertical: 6,
  },
  discardTxt: { fontFamily: fonts.medium, fontSize: 13, color: M },

  /* ── Toolbar ── */
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
  stickerChip:      { backgroundColor: '#7B2FBE', borderColor: '#7B2FBE' },
  partnerChipTxt:   { fontFamily: fonts.semiBold, fontSize: 12, color: B },
  partnerChipTxtOn: { color: '#fff' },

  badge24h:    { flexDirection: 'row', alignItems: 'center', gap: 4, marginLeft: 6 },
  badge24hTxt: { fontFamily: fonts.regular, fontSize: 12, color: M },
})
