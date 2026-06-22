import React, { useRef, useState } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, Alert, ActivityIndicator, Keyboard,
} from 'react-native'
import { Image } from 'expo-image'
import { LinearGradient } from 'expo-linear-gradient'
import { Ionicons } from '@expo/vector-icons'
import { useVideoPlayer, VideoView } from 'expo-video'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useNavigation } from '@react-navigation/native'
import * as ImagePicker from 'expo-image-picker'
import { fonts } from '../../theme'
import { createPost } from '../../services/post.service'
import { useFeedStore } from '../../store/feed.store'
import { useAuthStore } from '../../store/auth.store'
import { toast } from '../../utils/toast'
import { useT } from '../../i18n'

// ── Background palette (7 cores da paleta oficial Luxee) ─────────────────────
type BgKey = 'white' | 'cream' | 'gray' | 'black' | 'red' | 'coral' | 'peach'

const BG: Record<BgKey, { bg: string; fg: string }> = {
  white: { bg: '#FFFFFF', fg: '#1A1A1A' },
  cream: { bg: '#F7F7F7', fg: '#1A1A1A' },
  gray:  { bg: '#333333', fg: '#FFFFFF' },
  black: { bg: '#000000', fg: '#FFFFFF' },
  red:   { bg: '#CA2851', fg: '#FFFFFF' },
  coral: { bg: '#FF6766', fg: '#FFFFFF' },
  peach: { bg: '#FFB173', fg: '#1A1A1A' },
}

const BG_KEYS: BgKey[] = ['white', 'cream', 'gray', 'black', 'red', 'coral', 'peach']

type Media = { uri: string; type: 'image' | 'video' }

// ── Component ─────────────────────────────────────────────────────────────────
export default function CreateScreen() {
  const nav            = useNavigation()
  const insets         = useSafeAreaInsets()
  const { user }       = useAuthStore()
  const t              = useT()
  const setPendingPost = useFeedStore((s) => s.setPendingPost)
  const captionRef     = useRef<TextInput>(null)

  const [caption,         setCaption]         = useState('')
  const [bgKey,           setBgKey]           = useState<BgKey>('white')
  const [media,           setMedia]           = useState<Media | null>(null)
  const [loading,         setLoading]         = useState(false)
  const [includePartner,  setIncludePartner]  = useState(false)
  const [isAnnouncement,  setIsAnnouncement]  = useState(false)
  const [stickersEnabled, setStickersEnabled] = useState(false)

  const hasPartner = !!(user?.partnerId && user?.partnerName)
  const isAdmin    = user?.isAdmin === true
  const canPublish = !!caption.trim() || !!media
  const hasText    = !!caption.trim()
  const activeBg   = BG[bgKey]

  // Floating close button adapts to the current frame background
  const isDarkFrame  = !!media || bgKey === 'black' || bgKey === 'red'
  const closeIconClr = isDarkFrame ? '#fff' : '#1A1A1A'
  const closeBgClr   = isDarkFrame ? 'rgba(0,0,0,0.35)' : 'rgba(0,0,0,0.07)'

  const videoUri = media?.type === 'video' ? media.uri : null
  const player   = useVideoPlayer(videoUri, (p) => { p.loop = true; if (videoUri) p.play() })

  async function pickMedia() {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (status !== 'granted') {
      Alert.alert('Permissão necessária', 'Permite acesso à galeria nas definições.')
      return
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes:       ['images', 'videos'],
      quality:          0.85,
      videoMaxDuration: 90,
    })
    if (result.canceled || !result.assets[0]) return
    const asset = result.assets[0]
    if (asset.type === 'video' && asset.duration && asset.duration > 91_000) {
      Alert.alert('Vídeo demasiado longo', 'O máximo é 1 minuto e 30 segundos.')
      return
    }
    if (asset.fileSize && asset.fileSize > 50 * 1024 * 1024) {
      Alert.alert('Ficheiro demasiado grande', 'O máximo é 50 MB.')
      return
    }
    setMedia({ uri: asset.uri, type: asset.type === 'video' ? 'video' : 'image' })
    Keyboard.dismiss()
  }

  function getDeviceModel(): string {
    if (Platform.OS === 'ios') return 'iPhone'
    const brand = (Platform as any).constants?.Brand as string | undefined
    return brand ? brand.charAt(0).toUpperCase() + brand.slice(1).toLowerCase() : 'Android'
  }

  async function handlePublish() {
    if (!canPublish || loading) return
    Keyboard.dismiss()
    setLoading(true)
    try {
      const partnerId   = hasPartner && includePartner && !isAnnouncement ? user!.partnerId! : undefined
      const deviceModel = getDeviceModel()
      const bgColor     = `${activeBg.bg}|${activeBg.bg}`

      const newPost = media
        ? await createPost(
            media.uri,
            media.type === 'video' ? 'VIDEO' : 'IMAGE',
            caption.trim() || undefined,
            undefined,
            partnerId,
            isAnnouncement,
            deviceModel,
            stickersEnabled,
          )
        : await createPost(
            null,
            'TEXT',
            caption.trim(),
            bgColor,
            partnerId,
            isAnnouncement,
            deviceModel,
            stickersEnabled,
          )

      if (newPost) setPendingPost(newPost)
      setCaption('')
      setMedia(null)
      setBgKey('white')
      setIsAnnouncement(false)
      setStickersEnabled(false)
      setIncludePartner(false)
      toast.success(t.feed_published, isAnnouncement ? t.feed_announcement_sub : t.feed_published_sub)
      nav.navigate('Feed' as never)
    } catch (e: unknown) {
      const msg =
        (e as any)?.response?.status === 413
          ? 'Vídeo demasiado grande. Máximo 50 MB.'
          : e instanceof Error
            ? e.message
            : t.chat_retry
      toast.error(t.error, msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <KeyboardAvoidingView
      style={s.root}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      {/* ── Floating close ── */}
      <TouchableOpacity
        style={[s.closeBtn, { top: insets.top + 12, backgroundColor: closeBgClr }]}
        onPress={() => { Keyboard.dismiss(); (nav as any).jumpTo('Feed') }}
        hitSlop={{ top: 10, right: 10, bottom: 10, left: 10 }}
        activeOpacity={0.8}
      >
        <Ionicons name="close" size={21} color={closeIconClr} />
      </TouchableOpacity>

      {/* ── Frame — the live post preview ── */}
      <View style={[s.frame, !media && { backgroundColor: activeBg.bg }]}>

        {media ? (
          <>
            {media.type === 'video' ? (
              <VideoView
                player={player}
                style={StyleSheet.absoluteFill}
                contentFit="cover"
                nativeControls={false}
              />
            ) : (
              <Image
                source={{ uri: media.uri }}
                style={StyleSheet.absoluteFill}
                contentFit="cover"
              />
            )}

            {/* Caption gradient overlay */}
            {hasText && (
              <LinearGradient
                colors={['transparent', 'rgba(0,0,0,0.62)']}
                style={s.mediaCaption}
              >
                <Text style={s.mediaCaptionTxt} numberOfLines={3}>{caption}</Text>
              </LinearGradient>
            )}

            {/* Media controls — below the floating close button */}
            <View style={[s.mediaControls, { top: insets.top + 54 }]}>
              <TouchableOpacity
                style={s.clearBtn}
                onPress={() => setMedia(null)}
                activeOpacity={0.85}
              >
                <Ionicons name="close" size={15} color="#fff" />
              </TouchableOpacity>
              <TouchableOpacity
                style={s.changeBtn}
                onPress={pickMedia}
                activeOpacity={0.85}
              >
                <Ionicons name="swap-horizontal" size={13} color="#fff" />
                <Text style={s.changeBtnTxt}>Alterar</Text>
              </TouchableOpacity>
            </View>
          </>

        ) : hasText ? (
          // Text post — live preview on solid bg
          <View style={[s.textPreview, { paddingTop: insets.top + 56 }]}>
            <Text style={[s.textPreviewTxt, { color: activeBg.fg }]} numberOfLines={10}>
              {caption}
            </Text>
          </View>

        ) : (
          // Empty state
          <View style={[s.emptyState, { paddingTop: insets.top + 40 }]}>
            <TouchableOpacity style={s.addMediaBtn} onPress={pickMedia} activeOpacity={0.82}>
              <Ionicons name="add" size={26} color="#B8B8B8" />
            </TouchableOpacity>
            <Text style={s.emptyHint}>{'Adiciona uma foto ou vídeo\nou escreve algo abaixo'}</Text>
          </View>
        )}
      </View>

      {/* ── Panel ── */}
      <View style={[s.panel, { paddingBottom: Math.max(insets.bottom, 16) }]}>

        {/* Caption input */}
        <TextInput
          ref={captionRef}
          style={s.captionInput}
          placeholder={media ? 'Escreve uma legenda…' : 'Escreve algo…'}
          placeholderTextColor="#C4C4C4"
          value={caption}
          onChangeText={setCaption}
          multiline
          maxLength={280}
          textAlignVertical="top"
        />

        {/* Bg swatches + media link — only for text posts */}
        {!media && (
          <View style={s.swatchRow}>
            {BG_KEYS.map((key) => (
              <TouchableOpacity
                key={key}
                style={[s.swatchRing, bgKey === key && s.swatchRingActive]}
                onPress={() => setBgKey(key)}
                activeOpacity={0.8}
              >
                <View
                  style={[
                    s.swatchDot,
                    { backgroundColor: BG[key].bg },
                    key === 'white' && s.swatchDotBorder,
                  ]}
                />
              </TouchableOpacity>
            ))}

            <View style={s.swatchSep} />

            <TouchableOpacity style={s.mediaLink} onPress={pickMedia} activeOpacity={0.7}>
              <Ionicons name="image-outline" size={16} color="#A0A0A0" />
              <Text style={s.mediaLinkTxt}>Media</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Options row */}
        <View style={s.optRow}>
          <Ionicons name="time-outline" size={13} color="#C8C8C8" />
          <Text style={s.timerTxt}>{t.feed_visible_24h}</Text>

          <View style={{ flex: 1 }} />

          {hasPartner && !isAnnouncement && (
            <TouchableOpacity
              style={[s.chip, includePartner && s.chipOn]}
              onPress={() => setIncludePartner((v) => !v)}
              activeOpacity={0.8}
            >
              <Ionicons
                name={includePartner ? 'heart' : 'heart-outline'}
                size={12}
                color={includePartner ? '#fff' : '#CA2851'}
              />
              <Text style={[s.chipTxt, includePartner && s.chipTxtOn]}>
                {user!.partnerName}
              </Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={[s.chip, stickersEnabled && s.chipOn]}
            onPress={() => setStickersEnabled((v) => !v)}
            activeOpacity={0.8}
          >
            <Text style={stickersEnabled ? s.chipStarOn : s.chipStar}>✦</Text>
            <Text style={[s.chipTxt, stickersEnabled && s.chipTxtOn]}>Objetos</Text>
          </TouchableOpacity>

          {isAdmin && (
            <TouchableOpacity
              style={[s.chip, isAnnouncement && s.chipAnnounce]}
              onPress={() => setIsAnnouncement((v) => !v)}
              activeOpacity={0.8}
            >
              <Ionicons
                name="megaphone-outline"
                size={12}
                color={isAnnouncement ? '#fff' : '#E67E22'}
              />
              <Text style={[s.chipTxt, isAnnouncement && s.chipTxtOn]}>Anúncio</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Publish */}
        <TouchableOpacity
          style={[s.publishBtn, (!canPublish || loading) && s.publishBtnOff]}
          onPress={handlePublish}
          disabled={!canPublish || loading}
          activeOpacity={0.88}
        >
          {loading
            ? <ActivityIndicator color="#fff" size="small" />
            : <Text style={s.publishBtnTxt}>Publicar</Text>
          }
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  )
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#fff' },

  // Floating close
  closeBtn: {
    position:       'absolute',
    left:           16,
    zIndex:         20,
    width:          34,
    height:         34,
    borderRadius:   17,
    alignItems:     'center',
    justifyContent: 'center',
  },

  // Frame — fills all space above the panel
  frame: {
    flex:     1,
    overflow: 'hidden',
  },

  // Empty state
  emptyState: {
    flex:           1,
    alignItems:     'center',
    justifyContent: 'center',
    gap:            14,
  },
  addMediaBtn: {
    width:           64,
    height:          64,
    borderRadius:    32,
    backgroundColor: '#F2F2F2',
    alignItems:      'center',
    justifyContent:  'center',
  },
  emptyHint: {
    fontFamily: fonts.regular,
    fontSize:   13,
    color:      '#C4C4C4',
    textAlign:  'center',
    lineHeight: 20,
  },

  // Text post live preview
  textPreview: {
    flex:              1,
    alignItems:        'center',
    justifyContent:    'center',
    paddingHorizontal: 36,
  },
  textPreviewTxt: {
    fontFamily:    fonts.semiBold,
    fontSize:      26,
    textAlign:     'center',
    lineHeight:    38,
    letterSpacing: -0.5,
  },

  // Media state — caption overlay
  mediaCaption: {
    position:          'absolute',
    bottom:            0,
    left:              0,
    right:             0,
    paddingHorizontal: 22,
    paddingTop:        72,
    paddingBottom:     28,
  },
  mediaCaptionTxt: {
    fontFamily:       fonts.semiBold,
    fontSize:         16,
    color:            '#fff',
    textAlign:        'center',
    lineHeight:       24,
    textShadowColor:  'rgba(0,0,0,0.45)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },

  // Media controls row (clear + change)
  mediaControls: {
    position:      'absolute',
    right:         14,
    flexDirection: 'row',
    alignItems:    'center',
    gap:           6,
  },
  clearBtn: {
    width:           30,
    height:          30,
    borderRadius:    15,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems:      'center',
    justifyContent:  'center',
  },
  changeBtn: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               5,
    backgroundColor:   'rgba(0,0,0,0.45)',
    borderRadius:      20,
    paddingHorizontal: 12,
    paddingVertical:   6,
  },
  changeBtnTxt: {
    fontFamily: fonts.semiBold,
    fontSize:   12,
    color:      '#fff',
  },

  // Panel
  panel: {
    backgroundColor:   '#fff',
    borderTopWidth:    StyleSheet.hairlineWidth,
    borderTopColor:    '#E8E8E8',
    paddingTop:        14,
    paddingHorizontal: 16,
    gap:               10,
  },

  // Caption input
  captionInput: {
    fontFamily:    fonts.medium,
    fontSize:      15,
    color:         '#1A1A1A',
    lineHeight:    22,
    minHeight:     40,
    maxHeight:     80,
    padding:       0,
    letterSpacing: -0.1,
  },

  // Swatch row
  swatchRow: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           8,
  },
  swatchRing: {
    width:        28,
    height:       28,
    borderRadius: 14,
    padding:      3,
    borderWidth:  1.5,
    borderColor:  'transparent',
  },
  swatchRingActive: {
    borderColor: '#1A1A1A',
  },
  swatchDot: {
    flex:         1,
    borderRadius: 9,
  },
  swatchDotBorder: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#D8D8D8',
  },
  swatchSep: {
    width:            1,
    height:           18,
    backgroundColor:  '#E8E8E8',
    marginHorizontal: 2,
  },
  mediaLink: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           5,
  },
  mediaLinkTxt: {
    fontFamily: fonts.medium,
    fontSize:   13,
    color:      '#A0A0A0',
  },

  // Options row
  optRow: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           6,
  },
  timerTxt: {
    fontFamily: fonts.regular,
    fontSize:   12,
    color:      '#C4C4C4',
    marginLeft: 3,
  },

  // Chips
  chip: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               4,
    paddingHorizontal: 9,
    paddingVertical:   5,
    borderRadius:      13,
    borderWidth:       1.5,
    borderColor:       '#E8E8E8',
  },
  chipOn:      { backgroundColor: '#CA2851', borderColor: '#CA2851' },
  chipAnnounce: { backgroundColor: '#E67E22', borderColor: '#E67E22' },
  chipTxt:     { fontFamily: fonts.semiBold, fontSize: 12, color: '#333' },
  chipTxtOn:   { color: '#fff' },
  chipStar:    { fontSize: 11, color: '#777' },
  chipStarOn:  { fontSize: 11, color: '#fff' },

  // Publish button
  publishBtn: {
    height:          52,
    borderRadius:    26,
    backgroundColor: '#1A1A1A',
    alignItems:      'center',
    justifyContent:  'center',
  },
  publishBtnOff: { opacity: 0.25 },
  publishBtnTxt: {
    fontFamily:    fonts.bold,
    fontSize:      16,
    color:         '#fff',
    letterSpacing: -0.3,
  },
})
