import React, { useEffect, useRef, useState, useCallback } from 'react'
import SuggestionsSheet from '../../components/SuggestionsSheet'
import { useMessagesStore } from '../../store/messages.store'
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView,
  KeyboardAvoidingView, Platform, Alert, ActivityIndicator, Keyboard, Pressable, BackHandler,
} from 'react-native'
import { Image } from 'expo-image'
import { LinearGradient } from 'expo-linear-gradient'
import { Ionicons } from '@expo/vector-icons'
import { useVideoPlayer, VideoView } from 'expo-video'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs'
import { useNavigation, useFocusEffect, useIsFocused } from '@react-navigation/native'
import { fonts } from '../../theme'
import { createPost, createAlbum } from '../../services/post.service'
import { createHalf } from '../../services/half.service'
import TargetPicker from './TargetPicker'
import PostAlbumGrid from '../FeedScreen/PostAlbumGrid'
import GalleryPicker, { PickedAsset } from '../../components/GalleryPicker'
import PhotoEditor from '../../components/PhotoEditor'
import { clearEditCache } from '../../components/PhotoEditor/render'
import { getMyUnions } from '../../services/union.service'
import { UNION_ENABLED } from '../../config/features'
import { Union } from '../../types'
import { useFeedStore } from '../../store/feed.store'
import { useAuthStore } from '../../store/auth.store'
import { useOverlayStore } from '../../store/overlay.store'
import { cachePosts, enqueueSyncOp } from '../../db/database'
import {
  buildLocalPost, clearOutboxMedia, makeTempPostId, persistOutboxMedia,
  type OutboxPost,
} from '../../db/outbox'
import { isConnected } from '../../services/netinfo.service'
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
  red:    { bg: '#FF7A1C', fg: '#FFFFFF' },
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

  // A TabBar pede a folha de sugestões; renderiza-se aqui em vez de saltar
  // para o Chat, para não tirar a pessoa de onde está.
  const isFocused = useIsFocused()
  const suggestionsRequested = useMessagesStore((st) => st.suggestionsRequested)
  const consumedSuggestionsRef = useRef(0)
  const [showSuggestions, setShowSuggestions] = useState(false)
  useEffect(() => {
    if (!isFocused || suggestionsRequested <= consumedSuggestionsRef.current) return
    consumedSuggestionsRef.current = suggestionsRequested
    setShowSuggestions(true)
  }, [isFocused, suggestionsRequested])

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
  const [editorOpen,       setEditorOpen]       = useState(false)
  const [loading,          setLoading]          = useState(false)
  const [includePartner,   setIncludePartner]   = useState(false)
  const [isAnnouncement,   setIsAnnouncement]   = useState(false)
  const [myUnion,          setMyUnion]          = useState<Union | null>(null)
  const [pickerOpen,       setPickerOpen]       = useState(false)

  useEffect(() => {
    if (!UNION_ENABLED) return
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

  // Vídeo novo entra sempre a tocar e audível; o estado visual acompanha o
  // setup do player quando se troca de ficheiro.
  useEffect(() => {
    if (!videoUri) return
    setPlaying(true)
    setMuted(false)
  }, [videoUri])

  // Nunca deixar som a tocar por baixo de outro ecrã
  useFocusEffect(useCallback(() => {
    return () => { try { player.pause() } catch {} }
  }, [player]))

  // Upload em curso é uma operação atómica: a barra desaparece, o voltar do
  // Android é consumido e uma camada transparente bloqueia o editor.
  useEffect(() => {
    if (!loading) return
    const { push, pop } = useOverlayStore.getState()
    push()
    const back = BackHandler.addEventListener('hardwareBackPress', () => true)
    return () => { back.remove(); pop() }
  }, [loading])

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

  // Editar antes de publicar. Vale para uma foto ou para o álbum inteiro — o
  // editor guarda uma edição por foto e devolve-as todas na mesma ordem.
  // Vídeo fica de fora: cortar e afinar um vídeo é outro problema.
  const editablePhotos: string[] = album ?? (media?.type === 'image' ? [media.uri] : [])
  const canEdit = editablePhotos.length > 0

  function openEditor() {
    if (!canEdit || loading) return
    Keyboard.dismiss()
    setEditorOpen(true)
  }

  // Vindo da galeria é diferente: são duas folhas em ecrã inteiro a trocar de
  // lugar, e no iOS a segunda não chega a aparecer se a primeira ainda está a
  // sair. Esperar que a galeria feche custa um piscar de olhos e evita um beco
  // sem saída onde não se vê nem uma nem outra.
  const editorTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => () => { if (editorTimer.current) clearTimeout(editorTimer.current) }, [])

  function openEditorAfterGallery() {
    if (editorTimer.current) clearTimeout(editorTimer.current)
    editorTimer.current = setTimeout(() => setEditorOpen(true), Platform.OS === 'ios' ? 380 : 160)
  }

  function handleEditorDone(uris: string[]) {
    setEditorOpen(false)
    if (uris.length === 0) return
    if (album) setAlbum(uris)
    else setMedia({ uri: uris[0], type: 'image' })
  }

  // Resultado da galeria própria.
  //
  // Escolher uma foto abre logo o editor: é lá que se corta e se afina, e sair
  // de lá traz a pessoa de volta a este ecrã, já com o botão de publicar à
  // frente. Vídeo salta o editor — cortar vídeo é outro problema.
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
      // O endpoint de álbum não recebe atribuição de parceiro nem anúncio.
      setIncludePartner(false)
      setIsAnnouncement(false)
      openEditorAfterGallery()
      return
    }

    // Uma só → foto ou vídeo
    const asset = assets[0]
    setAlbum(null)
    setMedia({ uri: asset.uri, type: asset.type })
    if (asset.type !== 'video') openEditorAfterGallery()
  }

  function getDeviceModel(): string {
    if (Platform.OS === 'ios') return 'iPhone'
    const brand = (Platform as any).constants?.Brand as string | undefined
    return brand ? brand.charAt(0).toUpperCase() + brand.slice(1).toLowerCase() : 'Android'
  }

  // Publicar sozinho é o caminho normal. A metade é uma escolha a mais — para
  // quem quer que a publicação só exista se outra pessoa entrar nela.
  //
  // Escondido a pedido do Herminio (2026-08-11). O fluxo continua inteiro por
  // baixo — `handleStartHalf`, o ecrã Halves e o serviço não foram tocados;
  // basta devolver isto a `!!media && !isAnnouncement` para o botão voltar.
  const canMakeHalf = false

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

  /**
   * Publicar sem rede. A publicação entra na feed já, marcada como pendente na
   * cache, e sai da fila mal a ligação volte. A media é copiada para uma pasta
   * durável primeiro — o URI da galeria vive na cache do sistema e pode
   * desaparecer antes do envio.
   */
  async function publishOffline(): Promise<boolean> {
    if (!user) return false

    const tempId = makeTempPostId()
    const sources = album ?? (media ? [media.uri] : [])
    const persisted: string[] = []
    try {
      for (let i = 0; i < sources.length; i++) {
        persisted.push(await persistOutboxMedia(sources[i], tempId, i))
      }
    } catch {
      await clearOutboxMedia(persisted)
      return false
    }

    const outbox: OutboxPost = {
      tempId,
      kind: album ? 'album' : media ? 'media' : 'text',
      mediaUris: persisted,
      mediaType: album ? 'IMAGE' : media ? (media.type === 'video' ? 'VIDEO' : 'IMAGE') : 'TEXT',
      caption: caption.trim() || undefined,
      bgColor: !media && !album ? `${activeBg.bg}|${activeBg.bg}` : undefined,
      partnerUserId: hasPartner && includePartner && !isAnnouncement ? otherMember!.id : undefined,
      isAnnouncement,
      deviceModel: getDeviceModel(),
    }

    const localPost = buildLocalPost(outbox, {
      id: user.id,
      name: user.name,
      username: user.username,
      avatar: user.avatar,
      viewsPublic: user.viewsPublic,
      showDevice: user.showDevice,
      statusLabel: user.statusLabel,
      lastSeen: user.lastSeen,
    })

    await cachePosts([localPost], 'pending')
    await enqueueSyncOp('post', tempId, 'create', outbox as unknown as object)
    setPendingPost(localPost)
    return true
  }

  async function publishAsPost() {
    setLoading(true)

    // Sem rede: guarda e sai. Bloquear a publicação por falta de ligação é
    // exatamente o que uma app offline-first não deve fazer.
    if (!isConnected()) {
      const queued = await publishOffline()
      setLoading(false)
      if (queued) {
        resetComposer()
        toast.success(t.create_queued_title, t.create_queued_sub)
        nav.navigate('Feed' as never)
      } else {
        toast.error(t.error, t.create_queued_fail)
      }
      return
    }

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
      toast.success(t.create_half_created, targetId ? t.create_half_waiting : t.create_half_open_waiting)
      nav.navigate('Halves' as never)
    } catch (e: unknown) {
      toast.error(t.error, publishError(e))
    } finally {
      setLoading(false)
    }
  }

  function publishError(e: unknown): string {
    if ((e as any)?.response?.status === 413) return t.create_video_too_large
    return (e as any)?.response?.data?.message ?? (e instanceof Error ? e.message : t.chat_retry)
  }

  function resetComposer() {
    // As fotos editadas já foram enviadas (ou copiadas para a caixa de saída,
    // que guarda as suas próprias cópias) — os ficheiros intermédios podem ir.
    clearEditCache()
    setCaption('')
    setMedia(null)
    setAlbum(null)
    setBgKey('gray')
    setIsAnnouncement(false)
    setIncludePartner(false)
  }

  return (
    <KeyboardAvoidingView
      style={s.root}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      {/* ── Linear header: no floating controls over the canvas ── */}
      <View
        style={[
          s.header,
          { paddingTop: insets.top },
          textMode ? { backgroundColor: activeBg.bg } : s.headerMedia,
        ]}
      >
        <TouchableOpacity
          style={s.headerAction}
          onPress={() => { Keyboard.dismiss(); (nav as any).jumpTo('Feed') }}
          disabled={loading}
          activeOpacity={0.65}
          accessibilityRole="button"
          accessibilityLabel={t.cancel}
          accessibilityState={{ disabled: loading }}
        >
          <Ionicons name="close" size={22} color="#fff" />
        </TouchableOpacity>

        <View style={s.headerIdentity} pointerEvents="none">
          <View style={s.brandSignal}>
            <View style={s.brandSignalLine} />
            <View style={s.brandSignalDot} />
          </View>
          <Text style={s.headerTitle}>{t.feed_create}</Text>
        </View>

        <TouchableOpacity
          style={[s.headerAction, s.headerActionEnd]}
          onPress={pickMedia}
          disabled={loading}
          activeOpacity={0.65}
          accessibilityRole="button"
          accessibilityLabel={textMode ? t.create_addMedia : t.create_change}
          accessibilityState={{ disabled: loading }}
        >
          <Ionicons
            name={textMode ? 'image-outline' : album ? 'images-outline' : 'swap-horizontal'}
            size={18}
            color="#fff"
          />
          <Text style={s.headerActionText}>{textMode ? t.create_media : t.create_change}</Text>
        </TouchableOpacity>
      </View>

      {/* ── Frame — the live post preview ── */}
      <View style={[s.frame, !media && !album && { backgroundColor: activeBg.bg }]}>

        {album ? (
          <>
            <PostAlbumGrid urls={album} />
            {hasText && (
              <LinearGradient
                colors={['transparent', 'rgba(0,0,0,0.62)']}
                style={s.mediaCaption}
                pointerEvents="none"
              >
                <Text style={s.mediaCaptionTxt} numberOfLines={3}>{caption}</Text>
              </LinearGradient>
            )}
            <View style={s.canvasRail}>
              <View style={s.canvasRailMeta}>
                <View style={s.canvasRailSignal} />
                <Text style={s.canvasRailText}>{album.length} {t.create_photos}</Text>
              </View>
              <TouchableOpacity
                style={s.canvasRailAction}
                onPress={openEditor}
                disabled={loading}
                activeOpacity={0.65}
                accessibilityRole="button"
                accessibilityLabel={t.pe_edit}
                accessibilityState={{ disabled: loading }}
              >
                <Ionicons name="options-outline" size={18} color="#fff" />
              </TouchableOpacity>
              <TouchableOpacity
                style={s.canvasRailAction}
                onPress={() => setAlbum(null)}
                disabled={loading}
                activeOpacity={0.65}
                accessibilityRole="button"
                accessibilityLabel={t.cancel}
                accessibilityState={{ disabled: loading }}
              >
                <Ionicons name="close" size={19} color="#fff" />
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
                <Pressable
                  style={StyleSheet.absoluteFill}
                  onPress={togglePlay}
                  disabled={loading}
                  accessibilityRole="button"
                  accessibilityLabel={playing ? t.create_pause : t.create_play}
                  accessibilityState={{ disabled: loading }}
                />

                {/* Símbolo central: só aparece em pausa, para não tapar o vídeo a tocar */}
                {!playing && (
                  <View style={s.playOverlay} pointerEvents="none">
                    <Ionicons name="play" size={38} color="#fff" style={{ marginLeft: 3 }} />
                    <View style={s.playSignal} />
                  </View>
                )}
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
                pointerEvents="none"
              >
                <Text style={s.mediaCaptionTxt} numberOfLines={3}>{caption}</Text>
              </LinearGradient>
            )}

            {/* One continuous utility rail; every action keeps a 48 px target. */}
            <View style={s.canvasRail}>
              <View style={s.canvasRailMeta}>
                <View style={s.canvasRailSignal} />
                <Text style={s.canvasRailText}>{t.create_media}</Text>
              </View>
              {media.type === 'video' && (
                <>
                  <TouchableOpacity
                    style={s.canvasRailAction}
                    onPress={togglePlay}
                    disabled={loading}
                    activeOpacity={0.65}
                    accessibilityRole="button"
                    accessibilityLabel={playing ? t.create_pause : t.create_play}
                    accessibilityState={{ disabled: loading }}
                  >
                    <Ionicons name={playing ? 'pause' : 'play'} size={18} color="#fff" />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={s.canvasRailAction}
                    onPress={toggleMute}
                    disabled={loading}
                    activeOpacity={0.65}
                    accessibilityRole="button"
                    accessibilityLabel={muted ? t.create_unmute : t.create_mute}
                    accessibilityState={{ disabled: loading }}
                  >
                    <Ionicons name={muted ? 'volume-mute' : 'volume-high'} size={18} color="#fff" />
                  </TouchableOpacity>
                </>
              )}
              {media.type === 'image' && (
                <TouchableOpacity
                  style={s.canvasRailAction}
                  onPress={openEditor}
                  disabled={loading}
                  activeOpacity={0.65}
                  accessibilityRole="button"
                  accessibilityLabel={t.pe_edit}
                  accessibilityState={{ disabled: loading }}
                >
                  <Ionicons name="options-outline" size={18} color="#fff" />
                </TouchableOpacity>
              )}
              <TouchableOpacity
                style={s.canvasRailAction}
                onPress={() => setMedia(null)}
                disabled={loading}
                activeOpacity={0.65}
                accessibilityRole="button"
                accessibilityLabel={t.cancel}
                accessibilityState={{ disabled: loading }}
              >
                <Ionicons name="close" size={19} color="#fff" />
              </TouchableOpacity>
            </View>
          </>

        ) : (
          // Sem media, a área de cor *é* o campo. Não há caixinha para procurar
          // nem botão "escrever": toca em qualquer sítio e escreve. E o que
          // escreves já está com o aspeto que vai ter depois de publicado.
          <View style={s.composeArea}>
            <TextInput
              ref={captionRef}
              style={s.bigInput}
              placeholder={t.create_writePh}
              placeholderTextColor="rgba(255,255,255,0.55)"
              value={caption}
              onChangeText={setCaption}
              multiline
              maxLength={280}
              textAlign="center"
              selectionColor="#fff"
              editable={!loading}
            />
            <View style={s.textCounter} pointerEvents="none">
              <View style={s.textCounterLine} />
              <Text style={s.textCounterText}>{caption.length}/280</Text>
            </View>
          </View>
        )}
      </View>

      {/* ── Paper panel: a single continuous surface divided by hairlines ── */}
      <View style={s.panel}>
        <ScrollView
          style={s.panelScroll}
          bounces={false}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          scrollEnabled={!loading}
        >
          {!textMode && (
            <View style={s.captionSection}>
              <View style={s.sectionHeader}>
                <Text style={s.sectionLabel}>{t.create_captionPh}</Text>
                <Text style={s.counter}>{caption.length}/280</Text>
              </View>
              <TextInput
                style={s.captionInput}
                value={caption}
                onChangeText={setCaption}
                multiline
                maxLength={280}
                textAlignVertical="top"
                selectionColor="#FF7A1C"
                editable={!loading}
              />
            </View>
          )}

          {textMode && (
            <View style={s.paletteSection}>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={s.swatchScrollContent}
                keyboardShouldPersistTaps="handled"
                scrollEnabled={!loading}
              >
                {BG_KEYS.map((key) => {
                  const selected = bgKey === key
                  return (
                    <TouchableOpacity
                      key={key}
                      style={s.swatchTarget}
                      onPress={() => setBgKey(key)}
                      disabled={loading}
                      activeOpacity={0.68}
                      accessibilityRole="button"
                      accessibilityState={{ selected, disabled: loading }}
                    >
                      <View style={[s.swatch, { backgroundColor: BG[key].bg }]} />
                      <View style={[s.swatchMarker, selected && s.swatchMarkerOn]} />
                    </TouchableOpacity>
                  )
                })}
              </ScrollView>
            </View>
          )}

          <View style={s.optionRow}>
            <Ionicons name="time-outline" size={19} color="#5C5C63" />
            <Text style={s.optionText}>{t.feed_visible_24h}</Text>
            <View style={s.optionMicroSignal}>
              <View style={s.optionMicroLine} />
              <View style={s.optionMicroDot} />
            </View>
          </View>

          {hasPartner && !isAnnouncement && !album && (
            <TouchableOpacity
              style={s.optionRow}
              onPress={() => setIncludePartner((v) => !v)}
              disabled={loading}
              activeOpacity={0.68}
              accessibilityRole="switch"
              accessibilityState={{ checked: includePartner, disabled: loading }}
            >
              <Ionicons
                name={includePartner ? 'heart' : 'heart-outline'}
                size={19}
                color={includePartner ? '#FF7A1C' : '#5C5C63'}
              />
              <Text style={s.optionText}>{otherMember!.name}</Text>
              <View style={[s.stateMark, includePartner && s.stateMarkOn]}>
                <View style={[s.stateMarkDot, includePartner && s.stateMarkDotOn]} />
              </View>
            </TouchableOpacity>
          )}

          {isAdmin && !album && (
            <TouchableOpacity
              style={s.optionRow}
              onPress={() => setIsAnnouncement((v) => !v)}
              disabled={loading}
              activeOpacity={0.68}
              accessibilityRole="switch"
              accessibilityState={{ checked: isAnnouncement, disabled: loading }}
            >
              <Ionicons
                name="megaphone-outline"
                size={19}
                color={isAnnouncement ? '#FF7A1C' : '#5C5C63'}
              />
              <Text style={s.optionText}>{t.create_announce}</Text>
              <View style={[s.stateMark, isAnnouncement && s.stateMarkOn]}>
                <View style={[s.stateMarkDot, isAnnouncement && s.stateMarkDotOn]} />
              </View>
            </TouchableOpacity>
          )}

          {canMakeHalf && (
            <TouchableOpacity
              style={s.optionRow}
              onPress={handleStartHalf}
              disabled={loading}
              activeOpacity={0.68}
              accessibilityRole="button"
              accessibilityState={{ disabled: loading }}
            >
              <Ionicons name="contrast-outline" size={19} color="#5C5C63" />
              <Text style={s.optionText}>{t.create_half}</Text>
              <Ionicons name="chevron-forward" size={17} color="#A8A8AF" />
            </TouchableOpacity>
          )}
        </ScrollView>

        <View style={[s.actionArea, { paddingBottom: tabBarHeight + 8 }]}>
          <TouchableOpacity
            style={[s.publishBtn, (!canPublish || loading) && s.publishBtnOff]}
            onPress={handlePublish}
            disabled={!canPublish || loading}
            activeOpacity={0.82}
            accessibilityRole="button"
            accessibilityLabel={t.create_publish}
            accessibilityState={{ disabled: !canPublish || loading, busy: loading }}
          >
            <View style={s.publishSignal} />
            {loading
              ? <ActivityIndicator color="#fff" size="small" />
              : <Text style={s.publishBtnTxt}>{t.create_publish}</Text>
            }
          </TouchableOpacity>
        </View>
      </View>

      <GalleryPicker
        visible={galleryOpen}
        onClose={() => setGalleryOpen(false)}
        onDone={handleGalleryDone}
        maxSelection={10}
      />

      {editorOpen && (
        <PhotoEditor
          visible={editorOpen}
          photos={editablePhotos}
          onCancel={() => setEditorOpen(false)}
          onDone={handleEditorDone}
        />
      )}

      <TargetPicker
        visible={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onPick={handlePickTarget}
      />

      {loading && <View style={s.interactionLock} pointerEvents="auto" />}

      {showSuggestions && <SuggestionsSheet onClose={() => setShowSuggestions(false)} />}
    </KeyboardAvoidingView>
  )
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#fff' },

  header: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.22)',
  },
  headerMedia: { backgroundColor: '#050506' },
  headerAction: {
    width: 104,
    height: 52,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  headerActionEnd: { justifyContent: 'flex-end' },
  headerActionText: {
    color: '#fff',
    fontFamily: fonts.medium,
    fontSize: 12,
    letterSpacing: 0.2,
  },
  headerIdentity: {
    flex: 1,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
  },
  brandSignal: { height: 4, flexDirection: 'row', alignItems: 'center', gap: 3 },
  brandSignalLine: { width: 18, height: 2, backgroundColor: '#FF7A1C' },
  brandSignalDot: { width: 3, height: 3, borderRadius: 1.5, backgroundColor: '#FF7A1C' },
  headerTitle: {
    color: '#fff',
    fontFamily: fonts.semiBold,
    fontSize: 14,
    letterSpacing: 0.45,
  },

  frame: {
    flex: 1,
    minHeight: 156,
    overflow: 'hidden',
    backgroundColor: '#050506',
  },
  composeArea: {
    flex: 1,
    paddingHorizontal: 24,
  },
  bigInput: {
    flex: 1,
    alignSelf: 'stretch',
    fontFamily: fonts.semiBold,
    fontSize: 26,
    lineHeight: 38,
    letterSpacing: -0.5,
    color: '#fff',
    paddingHorizontal: 0,
    paddingVertical: 24,
  },
  textCounter: {
    position: 'absolute',
    right: 16,
    bottom: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  textCounterLine: { width: 16, height: 2, backgroundColor: '#FF7A1C' },
  textCounterText: {
    color: 'rgba(255,255,255,0.72)',
    fontFamily: fonts.medium,
    fontSize: 11,
    fontVariant: ['tabular-nums'],
  },

  mediaCaption: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 22,
    paddingTop: 72,
    paddingBottom: 24,
  },
  mediaCaptionTxt: {
    fontFamily: fonts.semiBold,
    fontSize: 16,
    color: '#fff',
    textAlign: 'center',
    lineHeight: 24,
    textShadowColor: 'rgba(0,0,0,0.45)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },

  canvasRail: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 48,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(5,5,6,0.54)',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.2)',
  },
  canvasRailMeta: {
    flex: 1,
    minWidth: 0,
    height: 48,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  canvasRailSignal: { width: 18, height: 2, backgroundColor: '#FF7A1C' },
  canvasRailText: {
    color: '#fff',
    fontFamily: fonts.medium,
    fontSize: 12,
    letterSpacing: 0.2,
  },
  canvasRailAction: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderLeftWidth: StyleSheet.hairlineWidth,
    borderLeftColor: 'rgba(255,255,255,0.2)',
  },
  playOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playSignal: { width: 24, height: 2, marginTop: 10, backgroundColor: '#FF7A1C' },

  panel: {
    maxHeight: '58%',
    flexShrink: 0,
    backgroundColor: '#FAFAF8',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#D8D8D5',
  },
  panelScroll: { flexShrink: 1 },
  captionSection: {
    minHeight: 92,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#DEDEDA',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 5,
  },
  sectionLabel: {
    flex: 1,
    color: '#77777D',
    fontFamily: fonts.medium,
    fontSize: 11,
    letterSpacing: 0.45,
    textTransform: 'uppercase',
  },
  counter: {
    color: '#8D8D92',
    fontFamily: fonts.medium,
    fontSize: 11,
    fontVariant: ['tabular-nums'],
  },
  captionInput: {
    minHeight: 44,
    maxHeight: 78,
    padding: 0,
    fontFamily: fonts.medium,
    fontSize: 15,
    color: '#161618',
    lineHeight: 22,
    letterSpacing: -0.1,
  },
  paletteSection: {
    height: 64,
    justifyContent: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#DEDEDA',
  },
  swatchScrollContent: {
    alignItems: 'center',
    paddingHorizontal: 10,
    gap: 2,
  },
  swatchTarget: {
    width: 44,
    height: 63,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
  },
  swatch: {
    width: 22,
    height: 22,
    borderRadius: 2,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(0,0,0,0.18)',
  },
  swatchMarker: { width: 16, height: 2, backgroundColor: 'transparent' },
  swatchMarkerOn: { backgroundColor: '#FF7A1C' },

  optionRow: {
    minHeight: 52,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#DEDEDA',
  },
  optionText: {
    flex: 1,
    color: '#202023',
    fontFamily: fonts.medium,
    fontSize: 14,
    letterSpacing: -0.1,
  },
  optionMicroSignal: {
    width: 24,
    height: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 3,
  },
  optionMicroLine: { width: 14, height: 2, backgroundColor: '#FF7A1C' },
  optionMicroDot: { width: 3, height: 3, borderRadius: 1.5, backgroundColor: '#FF7A1C' },
  stateMark: {
    width: 24,
    height: 12,
    justifyContent: 'flex-end',
    borderBottomWidth: 2,
    borderBottomColor: '#C9C9C6',
  },
  stateMarkOn: { borderBottomColor: '#FF7A1C' },
  stateMarkDot: {
    position: 'absolute',
    left: 0,
    bottom: -3,
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#C9C9C6',
  },
  stateMarkDotOn: { left: 20, backgroundColor: '#FF7A1C' },

  actionArea: {
    paddingHorizontal: 16,
    paddingTop: 12,
    backgroundColor: '#FAFAF8',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#CFCFCC',
  },
  publishBtn: {
    height: 52,
    borderRadius: 12,
    backgroundColor: '#1A1A1A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  publishSignal: {
    position: 'absolute',
    left: 16,
    width: 18,
    height: 2,
    backgroundColor: '#FF7A1C',
  },
  publishBtnOff: { opacity: 0.3 },
  publishBtnTxt: {
    fontFamily: fonts.bold,
    fontSize: 16,
    color: '#fff',
    letterSpacing: -0.3,
  },
  interactionLock: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 100,
    backgroundColor: 'transparent',
  },
})
