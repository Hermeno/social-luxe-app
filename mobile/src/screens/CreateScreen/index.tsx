import React, { useEffect, useRef, useState, useCallback } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView,
  KeyboardAvoidingView, Platform, Alert, ActivityIndicator, Keyboard, Pressable,
} from 'react-native'
import { Image } from 'expo-image'
import { LinearGradient } from 'expo-linear-gradient'
import { Ionicons } from '@expo/vector-icons'
import { useVideoPlayer, VideoView } from 'expo-video'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs'
import { useNavigation, useFocusEffect } from '@react-navigation/native'
import { fonts } from '../../theme'
import { createPost, createAlbum } from '../../services/post.service'
import { createHalf } from '../../services/half.service'
import TargetPicker from './TargetPicker'
import PostAlbumGrid from '../FeedScreen/PostAlbumGrid'
import GalleryPicker, { PickedAsset } from '../../components/GalleryPicker'
import { getMyUnions } from '../../services/union.service'
import { Union } from '../../types'
import { useFeedStore } from '../../store/feed.store'
import { useAuthStore } from '../../store/auth.store'
import { toast } from '../../utils/toast'
import { useT } from '../../i18n'

// ── Background palette — cores ricas onde o texto branco lê sempre bem
// (branco e creme removidos porque tornavam os ícones do feed invisíveis)
type BgKey =
  | 'gray' | 'black' | 'red' | 'coral' | 'peach'
  | 'wine' | 'ocean' | 'forest' | 'violet' | 'ember'

const BG: Record<BgKey, { bg: string; fg: string }> = {
  gray:   { bg: '#333333', fg: '#FFFFFF' },
  black:  { bg: '#000000', fg: '#FFFFFF' },
  red:    { bg: '#CA2851', fg: '#FFFFFF' },
  coral:  { bg: '#FF6766', fg: '#FFFFFF' },
  peach:  { bg: '#FFB173', fg: '#FFFFFF' },
  wine:   { bg: '#7A1F3D', fg: '#FFFFFF' },
  ocean:  { bg: '#1E3A5F', fg: '#FFFFFF' },
  forest: { bg: '#245C4C', fg: '#FFFFFF' },
  violet: { bg: '#4C3A82', fg: '#FFFFFF' },
  ember:  { bg: '#A34210', fg: '#FFFFFF' },
}

const BG_KEYS: BgKey[] = ['gray', 'black', 'red', 'coral', 'peach', 'wine', 'ocean', 'forest', 'violet', 'ember']

type Media = { uri: string; type: 'image' | 'video' }

// ── Component ─────────────────────────────────────────────────────────────────
export default function CreateScreen() {
  const nav            = useNavigation()
  const insets         = useSafeAreaInsets()
  const tabBarHeight   = useBottomTabBarHeight()
  const { user }       = useAuthStore()
  const t              = useT()
  const setPendingPost = useFeedStore((s) => s.setPendingPost)
  const captionRef     = useRef<TextInput>(null)

  const [caption,          setCaption]          = useState('')
  const [bgKey,            setBgKey]            = useState<BgKey>('gray')
  const [media,            setMedia]            = useState<Media | null>(null)
  const [album,            setAlbum]            = useState<string[] | null>(null)
  const [galleryOpen,      setGalleryOpen]      = useState(false)
  const [loading,          setLoading]          = useState(false)
  const [includePartner,   setIncludePartner]   = useState(false)
  const [isAnnouncement,   setIsAnnouncement]   = useState(false)
  const [myUnion,          setMyUnion]          = useState<Union | null>(null)
  const [pickerOpen,       setPickerOpen]       = useState(false)

  useEffect(() => {
    getMyUnions().then((unions) => setMyUnion(unions[0] ?? null)).catch(() => {})
  }, [])

  const otherMember   = myUnion ? (myUnion.memberA.id === user?.id ? myUnion.memberB : myUnion.memberA) : null
  const hasPartner = !!otherMember
  const isAdmin    = user?.isAdmin === true
  const canPublish = !!caption.trim() || !!media || !!album
  const hasText    = !!caption.trim()
  const activeBg   = BG[bgKey]
  // Modo texto: sem media → a página inteira fica com a cor selecionada e o texto é branco
  const textMode   = !media && !album

  // Floating close button adapts to the current frame background
  const isDarkFrame  = !!media || !!album || (textMode && bgKey !== 'peach')
  const closeIconClr = isDarkFrame ? '#fff' : '#1A1A1A'
  const closeBgClr   = isDarkFrame ? 'rgba(0,0,0,0.35)' : 'rgba(0,0,0,0.07)'

  const videoUri = media?.type === 'video' ? media.uri : null
  const player   = useVideoPlayer(videoUri, (p) => { p.loop = true; p.muted = false; if (videoUri) p.play() })

  // Estado real do leitor — seguimos o evento em vez de guardar o nosso próprio
  // booleano, senão o botão mente quando o vídeo acaba ou dá a volta ao loop.
  const [playing, setPlaying] = useState(true)
  const [muted,   setMuted]   = useState(false)
  useEffect(() => {
    const sub = player.addListener('playingChange', ({ isPlaying }) => setPlaying(isPlaying))
    return () => sub.remove()
  }, [player])

  // Vídeo novo entra sempre a tocar
  useEffect(() => { if (videoUri) setPlaying(true) }, [videoUri])

  // Nunca deixar som a tocar por baixo de outro ecrã
  useFocusEffect(useCallback(() => {
    return () => { try { player.pause() } catch {} }
  }, [player]))

  function togglePlay() {
    try { playing ? player.pause() : player.play() } catch {}
  }

  function toggleMute() {
    try { player.muted = !muted; setMuted(!muted) } catch {}
  }

  // Abre a galeria própria da app (nunca o explorador de ficheiros)
  function pickMedia() {
    Keyboard.dismiss()
    setGalleryOpen(true)
  }

  // Resultado da galeria própria
  function handleGalleryDone(assets: PickedAsset[]) {
    setGalleryOpen(false)
    if (assets.length === 0) return

    // Várias fotos → álbum (grelha na feed). Vídeos não entram no álbum.
    if (assets.length > 1) {
      const images = assets.filter((a) => a.type !== 'video').map((a) => a.uri)
      if (images.length < 2) {
        Alert.alert(t.create_albumTitle, t.create_albumMin)
        return
      }
      setAlbum(images.slice(0, 10))
      setMedia(null)
      return
    }

    // Uma só → foto ou vídeo
    const asset = assets[0]
    setAlbum(null)
    setMedia({ uri: asset.uri, type: asset.type })
  }

  function getDeviceModel(): string {
    if (Platform.OS === 'ios') return 'iPhone'
    const brand = (Platform as any).constants?.Brand as string | undefined
    return brand ? brand.charAt(0).toUpperCase() + brand.slice(1).toLowerCase() : 'Android'
  }

  // Publicar sozinho é o caminho normal. A metade é uma escolha a mais — para
  // quem quer que a publicação só exista se outra pessoa entrar nela.
  const canMakeHalf = !!media && !isAnnouncement

  function handlePublish() {
    if (!canPublish || loading) return
    Keyboard.dismiss()
    publishAsPost()
  }

  function handleStartHalf() {
    if (!canMakeHalf || loading) return
    Keyboard.dismiss()
    setPickerOpen(true)
  }

  async function publishAsPost() {
    setLoading(true)
    try {
      const partnerId   = hasPartner && includePartner && !isAnnouncement ? otherMember!.id : undefined
      const deviceModel = getDeviceModel()
      const bgColor     = `${activeBg.bg}|${activeBg.bg}`

      const newPost = album
        ? await createAlbum(album, caption.trim() || undefined, deviceModel)
        : media
        ? await createPost(
            media.uri,
            media.type === 'video' ? 'VIDEO' : 'IMAGE',
            caption.trim() || undefined,
            undefined,
            partnerId,
            isAnnouncement,
            deviceModel,
          )
        : await createPost(
            null,
            'TEXT',
            caption.trim(),
            bgColor,
            partnerId,
            isAnnouncement,
            deviceModel,
          )

      if (newPost) setPendingPost(newPost)
      resetComposer()
      toast.success(t.feed_published, isAnnouncement ? t.feed_announcement_sub : t.feed_published_sub)
      nav.navigate('Feed' as never)
    } catch (e: unknown) {
      toast.error(t.error, publishError(e))
    } finally {
      setLoading(false)
    }
  }

  // targetId null = metade aberta a qualquer ligação
  async function handlePickTarget(targetId: string | null) {
    setPickerOpen(false)
    if (!media) return
    setLoading(true)
    try {
      await createHalf(media.uri, caption.trim() || undefined, targetId ?? undefined)
      resetComposer()
      toast.success('Metade criada', targetId ? 'Agora falta a outra pessoa.' : 'Aberta — falta quem a complete.')
      nav.navigate('Halves' as never)
    } catch (e: unknown) {
      toast.error(t.error, publishError(e))
    } finally {
      setLoading(false)
    }
  }

  function publishError(e: unknown): string {
    if ((e as any)?.response?.status === 413) return 'Vídeo demasiado grande. Máximo 50 MB.'
    return (e as any)?.response?.data?.message ?? (e instanceof Error ? e.message : t.chat_retry)
  }

  function resetComposer() {
    setCaption('')
    setMedia(null)
    setAlbum(null)
    setBgKey('gray')
    setIsAnnouncement(false)
    setIncludePartner(false)
  }

  return (
    <KeyboardAvoidingView
      style={[s.root, textMode && { backgroundColor: activeBg.bg }]}
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
      <View style={[s.frame, !media && !album && { backgroundColor: activeBg.bg }]}>

        {album ? (
          <>
            <PostAlbumGrid urls={album} />
            {hasText && (
              <LinearGradient colors={['transparent', 'rgba(0,0,0,0.62)']} style={s.mediaCaption}>
                <Text style={s.mediaCaptionTxt} numberOfLines={3}>{caption}</Text>
              </LinearGradient>
            )}
            <View style={[s.mediaControls, { top: insets.top + 54 }]}>
              <TouchableOpacity style={s.clearBtn} onPress={() => setAlbum(null)} activeOpacity={0.85}>
                <Ionicons name="close" size={15} color="#fff" />
              </TouchableOpacity>
              <TouchableOpacity style={s.changeBtn} onPress={pickMedia} activeOpacity={0.85}>
                <Ionicons name="images-outline" size={13} color="#fff" />
                <Text style={s.changeBtnTxt}>{album.length} {t.create_photos}</Text>
              </TouchableOpacity>
            </View>
          </>

        ) : media ? (
          <>
            {media.type === 'video' ? (
              <>
                <VideoView
                  player={player}
                  style={StyleSheet.absoluteFill}
                  contentFit="cover"
                  nativeControls={false}
                />
                {/* Tocar em qualquer sítio do vídeo pausa — o alvo grande é o próprio vídeo */}
                <Pressable style={StyleSheet.absoluteFill} onPress={togglePlay} />

                {/* Símbolo central: só aparece em pausa, para não tapar o vídeo a tocar */}
                {!playing && (
                  <View style={s.playOverlay} pointerEvents="none">
                    <View style={s.playCircle}>
                      <Ionicons name="play" size={30} color="#fff" style={{ marginLeft: 3 }} />
                    </View>
                  </View>
                )}

                {/* Pausa e som, canto inferior direito */}
                <View style={[s.videoCtrls, { bottom: hasText ? 96 : 20 }]}>
                  <TouchableOpacity style={s.videoBtn} onPress={togglePlay} activeOpacity={0.8}>
                    <Ionicons name={playing ? 'pause' : 'play'} size={17} color="#fff" />
                  </TouchableOpacity>
                  <TouchableOpacity style={s.videoBtn} onPress={toggleMute} activeOpacity={0.8}>
                    <Ionicons name={muted ? 'volume-mute' : 'volume-high'} size={17} color="#fff" />
                  </TouchableOpacity>
                </View>
              </>
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
                <Text style={s.changeBtnTxt}>{t.create_change}</Text>
              </TouchableOpacity>
            </View>
          </>

        ) : hasText ? (
          // Text post — live preview on solid bg
          <View style={[s.textPreview, { paddingTop: insets.top + 56 }]}>
            <Text style={[s.textPreviewTxt, { color: '#fff' }]} numberOfLines={10}>
              {caption}
            </Text>
          </View>

        ) : (
          // Empty state — duas escolhas grandes e óbvias
          <View style={[s.emptyState, { paddingTop: insets.top + 30 }]}>
            <TouchableOpacity style={s.bigAdd} onPress={pickMedia} activeOpacity={0.85}>
              <View style={s.bigAddIcon}>
                <Ionicons name="images" size={30} color="#fff" />
              </View>
              <Text style={s.bigAddTitle}>{t.create_addMedia}</Text>
              <Text style={s.bigAddSub}>{t.create_addMediaSub}</Text>
            </TouchableOpacity>

            <View style={s.orRow}>
              <View style={s.orLine} />
              <Text style={s.orTxt}>{t.create_or}</Text>
              <View style={s.orLine} />
            </View>

            <TouchableOpacity style={s.writeBtn} onPress={() => captionRef.current?.focus()} activeOpacity={0.8}>
              <Ionicons name="create-outline" size={17} color="#fff" />
              <Text style={s.writeTxt}>{t.create_writeText}</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* ── Panel ── */}
      <View style={[s.panel, { paddingBottom: tabBarHeight + 8 }, textMode && s.panelText]}>

        {/* Caption input */}
        <TextInput
          ref={captionRef}
          style={[s.captionInput, textMode && { color: '#fff' }]}
          placeholder={media ? t.create_captionPh : t.create_writePh}
          placeholderTextColor={textMode ? 'rgba(255,255,255,0.6)' : '#C4C4C4'}
          value={caption}
          onChangeText={setCaption}
          multiline
          maxLength={280}
          textAlignVertical="top"
        />

        {/* Bg swatches + media link — only for text posts */}
        {textMode && (
          <View style={s.swatchRow}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={s.swatchScroll}
              contentContainerStyle={s.swatchScrollContent}
              keyboardShouldPersistTaps="handled"
            >
              {BG_KEYS.map((key) => (
                <TouchableOpacity
                  key={key}
                  style={[s.swatchRing, bgKey === key && s.swatchRingActiveLight]}
                  onPress={() => setBgKey(key)}
                  activeOpacity={0.8}
                >
                  <View style={[s.swatchDot, { backgroundColor: BG[key].bg }]} />
                </TouchableOpacity>
              ))}
            </ScrollView>

            <View style={s.swatchSepLight} />

            <TouchableOpacity style={s.mediaLink} onPress={pickMedia} activeOpacity={0.7}>
              <Ionicons name="image-outline" size={16} color="rgba(255,255,255,0.85)" />
              <Text style={s.mediaLinkTxtLight}>{t.create_media}</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Options row */}
        <View style={s.optRow}>
          <Ionicons name="time-outline" size={13} color={textMode ? 'rgba(255,255,255,0.7)' : '#C8C8C8'} />
          <Text style={[s.timerTxt, textMode && { color: 'rgba(255,255,255,0.7)' }]}>{t.feed_visible_24h}</Text>

          <View style={{ flex: 1 }} />

          {hasPartner && !isAnnouncement && (
            <TouchableOpacity
              style={[s.chip, textMode && s.chipLight, includePartner && s.chipOn]}
              onPress={() => setIncludePartner((v) => !v)}
              activeOpacity={0.8}
            >
              <Ionicons
                name={includePartner ? 'heart' : 'heart-outline'}
                size={12}
                color={includePartner ? '#fff' : textMode ? '#fff' : '#CA2851'}
              />
              <Text style={[s.chipTxt, textMode && s.chipTxtLight, includePartner && s.chipTxtOn]}>
                {otherMember!.name}
              </Text>
            </TouchableOpacity>
          )}

          {isAdmin && (
            <TouchableOpacity
              style={[s.chip, textMode && s.chipLight, isAnnouncement && s.chipOn]}
              onPress={() => setIsAnnouncement((v) => !v)}
              activeOpacity={0.8}
            >
              <Ionicons
                name="megaphone-outline"
                size={12}
                color={isAnnouncement ? '#fff' : textMode ? '#fff' : '#777'}
              />
              <Text style={[s.chipTxt, textMode && s.chipTxtLight, isAnnouncement && s.chipTxtOn]}>{t.create_announce}</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Publish */}
        <TouchableOpacity
          style={[s.publishBtn, textMode && s.publishBtnLight, (!canPublish || loading) && s.publishBtnOff]}
          onPress={handlePublish}
          disabled={!canPublish || loading}
          activeOpacity={0.88}
        >
          {loading
            ? <ActivityIndicator color={textMode ? '#1A1A1A' : '#fff'} size="small" />
            : <Text style={[s.publishBtnTxt, textMode && { color: '#1A1A1A' }]}>{t.create_publish}</Text>
          }
        </TouchableOpacity>

        {/* Metade — a publicação só existe se outra pessoa puser a dela */}
        {canMakeHalf && (
          <TouchableOpacity
            style={[s.halfBtn, textMode && s.halfBtnLight]}
            onPress={handleStartHalf}
            disabled={loading}
            activeOpacity={0.85}
          >
            <Ionicons name="contrast-outline" size={15} color={textMode ? '#fff' : '#1A1A1A'} />
            <Text style={[s.halfBtnTxt, textMode && { color: '#fff' }]}>Publicar como metade</Text>
          </TouchableOpacity>
        )}
      </View>

      <GalleryPicker
        visible={galleryOpen}
        onClose={() => setGalleryOpen(false)}
        onDone={handleGalleryDone}
        maxSelection={10}
      />

      <TargetPicker
        visible={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onPick={handlePickTarget}
      />
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
  // Big primary "add media" — no box, just the tappable content
  bigAdd: {
    alignItems:      'center',
    gap:             4,
    paddingVertical: 20,
  },
  bigAddIcon: {
    width:           72,
    height:          72,
    borderRadius:    36,
    backgroundColor: 'rgba(255,255,255,0.14)',
    borderWidth:     1.5,
    borderColor:     'rgba(255,255,255,0.45)',
    alignItems:      'center',
    justifyContent:  'center',
    marginBottom:    10,
  },
  bigAddTitle: { fontFamily: fonts.bold, fontSize: 16, color: '#fff', letterSpacing: -0.3 },
  bigAddSub:   { fontFamily: fonts.regular, fontSize: 13, color: 'rgba(255,255,255,0.7)' },

  orRow:  { flexDirection: 'row', alignItems: 'center', gap: 12, width: 180, marginTop: 4 },
  orLine: { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: 'rgba(255,255,255,0.28)' },
  orTxt:  { fontFamily: fonts.medium, fontSize: 12, color: 'rgba(255,255,255,0.65)' },

  writeBtn: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               7,
    paddingHorizontal: 18,
    paddingVertical:   11,
    borderRadius:      22,
    borderWidth:       1.5,
    borderColor:       'rgba(255,255,255,0.5)',
  },
  writeTxt: { fontFamily: fonts.semiBold, fontSize: 14, color: '#fff' },

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

  // ── Controlos de vídeo ──
  playOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center', justifyContent: 'center',
  },
  playCircle: {
    width: 68, height: 68, borderRadius: 34,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.85)',
  },
  videoCtrls: {
    position: 'absolute', right: 14,
    flexDirection: 'row', gap: 8,
  },
  videoBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center', justifyContent: 'center',
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
  // Modo texto: painel transparente para mostrar a cor da página, sem risca no topo
  panelText: { backgroundColor: 'transparent', borderTopColor: 'transparent' },

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
  swatchScroll:        { flex: 1 },
  swatchScrollContent: { alignItems: 'center', gap: 8, paddingRight: 4 },
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
  swatchRingActiveLight: {
    borderColor: '#fff',
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
  swatchSepLight: {
    width:            1,
    height:           18,
    backgroundColor:  'rgba(255,255,255,0.3)',
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
  mediaLinkTxtLight: {
    fontFamily: fonts.medium,
    fontSize:   13,
    color:      'rgba(255,255,255,0.85)',
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
  chipLight:   { borderColor: 'rgba(255,255,255,0.5)' },
  chipTxt:     { fontFamily: fonts.semiBold, fontSize: 12, color: '#333' },
  chipTxtOn:   { color: '#fff' },
  chipTxtLight:{ color: '#fff' },
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
  publishBtnLight: { backgroundColor: '#fff' },
  publishBtnOff: { opacity: 0.25 },
  halfBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7,
    height: 42, borderRadius: 21, marginTop: 8,
    borderWidth: StyleSheet.hairlineWidth, borderColor: '#DEDEE3',
  },
  halfBtnLight: { borderColor: 'rgba(255,255,255,0.45)' },
  halfBtnTxt: { fontFamily: fonts.semiBold, fontSize: 14, color: '#1A1A1A' },
  publishBtnTxt: {
    fontFamily:    fonts.bold,
    fontSize:      16,
    color:         '#fff',
    letterSpacing: -0.3,
  },
})
