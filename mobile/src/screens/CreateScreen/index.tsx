import React, { useState, useRef } from 'react'
import {
  Text, TextInput, TouchableOpacity, StyleSheet,
  Alert, ActivityIndicator, View, Dimensions,
  KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native'
import * as Haptics from 'expo-haptics'
import * as ImagePicker from 'expo-image-picker'
import { Ionicons } from '@expo/vector-icons'
import { useNavigation } from '@react-navigation/native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { fonts } from '../../theme'
import MediaPreview from './MediaPreview'
import { createPost } from '../../services/post.service'
import { useFeedStore } from '../../store/feed.store'
import { useAuthStore } from '../../store/auth.store'
import { toast } from '../../utils/toast'

const { width: W, height: H } = Dimensions.get('window')
const PRIMARY = '#4C8CE4'

const TEXT_BG_COLORS = [
  '#FF4B6E',  // rosa luxe
  '#4C8CE4',  // azul
  '#1A1A2E',  // navy
  '#6C3483',  // roxo
  '#1E8449',  // verde
  '#E67E22',  // laranja
  '#17202A',  // preto
  '#B7950B',  // dourado
]

type Tab   = 'photo' | 'text'
type Media = { uri: string }

export default function CreateScreen() {
  const nav        = useNavigation()
  const { top, bottom } = useSafeAreaInsets()
  const [tab,     setTab]     = useState<Tab>('photo')
  const [media,   setMedia]   = useState<Media | null>(null)
  const [caption, setCaption] = useState('')
  const [textBg,  setTextBg]  = useState(TEXT_BG_COLORS[0])
  const [loading,        setLoading]        = useState(false)
  const [includePartner, setIncludePartner] = useState(false)
  const textRef = useRef<TextInput>(null)

  const setPendingPost = useFeedStore((s) => s.setPendingPost)
  const { user } = useAuthStore()
  const hasPartner = !!(user?.partnerId && user?.partnerName)

  async function pickPhoto() {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (status !== 'granted') return Alert.alert('Permissão negada', 'Precisamos acesso à galeria.')
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: 'images', quality: 1 })
    if (!result.canceled && result.assets[0]) setMedia({ uri: result.assets[0].uri })
  }

  async function handlePublish() {
    if (tab === 'photo' && !media) return Alert.alert('', 'Escolhe uma foto primeiro')
    if (tab === 'text'  && !caption.trim()) return Alert.alert('', 'Escreve alguma coisa')
    setLoading(true)
    try {
      const partnerId = hasPartner && includePartner ? user!.partnerId! : undefined
      const newPost = tab === 'photo'
        ? await createPost(media!.uri, 'IMAGE', caption.trim() || undefined, undefined, partnerId)
        : await createPost(null, 'TEXT', caption.trim(), textBg, partnerId)
      if (newPost) setPendingPost(newPost)
      setMedia(null); setCaption(''); setTextBg(TEXT_BG_COLORS[0])
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
      toast.success('Publicado!', 'Visível por 24 horas')
      nav.navigate('Feed' as never)
    } catch (e: unknown) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
      toast.error('Erro', e instanceof Error ? e.message : 'Tenta novamente')
    } finally { setLoading(false) }
  }

  const canPublish = tab === 'photo' ? !!media : !!caption.trim()

  return (
    <KeyboardAvoidingView style={s.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      {/* ── Top bar ───────────────────────────────────────────────── */}
      <View style={[s.topBar, { paddingTop: top + 4 }]}>
        <TouchableOpacity onPress={() => nav.goBack()} style={s.backBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Ionicons name="chevron-back" size={26} color="#1A1A1A" />
        </TouchableOpacity>

        <View style={s.tabs}>
          <TouchableOpacity onPress={() => { setTab('photo'); setMedia(null) }} style={[s.tab, tab === 'photo' && s.tabActive]}>
            <Text style={[s.tabText, tab === 'photo' && s.tabTextActive]}>Foto</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => { setTab('text'); setTimeout(() => textRef.current?.focus(), 100) }} style={[s.tab, tab === 'text' && s.tabActive]}>
            <Text style={[s.tabText, tab === 'text' && s.tabTextActive]}>Texto</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          onPress={handlePublish}
          disabled={!canPublish || loading}
          style={[s.publishBtn, (!canPublish || loading) && s.publishOff]}
        >
          {loading
            ? <ActivityIndicator color="#fff" size="small" />
            : <Text style={s.publishText}>Publicar</Text>
          }
        </TouchableOpacity>
      </View>

      {/* ── Photo tab ─────────────────────────────────────────────── */}
      {tab === 'photo' && (
        <ScrollView contentContainerStyle={s.photoContent} keyboardShouldPersistTaps="handled">
          {media ? (
            <MediaPreview uri={media.uri} type="image" onRemove={() => setMedia(null)} />
          ) : (
            <TouchableOpacity style={s.photoPlaceholder} onPress={pickPhoto} activeOpacity={0.7}>
              <View style={s.photoIconWrap}>
                <Ionicons name="image-outline" size={36} color="#C0C0C8" />
              </View>
              <Text style={s.photoLabel}>Toca para escolher uma foto</Text>
              <Text style={s.photoSub}>da tua galeria</Text>
            </TouchableOpacity>
          )}

          {/* Caption — clean, no border, just a line */}
          <View style={s.captionWrap}>
            <TextInput
              style={s.captionInput}
              placeholder="Escreve uma legenda..."
              placeholderTextColor="#C0C0C8"
              value={caption}
              onChangeText={setCaption}
              multiline
              maxLength={200}
            />
          </View>

          {/* Partner toggle — only if has an accepted partner */}
          {hasPartner && (
            <TouchableOpacity
              style={[s.partnerToggle, includePartner && s.partnerToggleActive]}
              onPress={() => setIncludePartner((v) => !v)}
              activeOpacity={0.8}
            >
              <Ionicons
                name={includePartner ? 'heart' : 'heart-outline'}
                size={16}
                color={includePartner ? '#fff' : PRIMARY}
              />
              <Text style={[s.partnerToggleText, includePartner && s.partnerToggleTextActive]}>
                {includePartner ? `Com ${user!.partnerName}` : `Incluir ${user!.partnerName}`}
              </Text>
            </TouchableOpacity>
          )}

          <View style={s.badge24h}>
            <Ionicons name="time-outline" size={12} color={PRIMARY} />
            <Text style={s.badge24hText}>Esta publicação expira em 24h</Text>
          </View>
        </ScrollView>
      )}

      {/* ── Text tab — o utilizador escreve DENTRO da cor ─────────── */}
      {tab === 'text' && (
        <View style={s.textTabWrap}>
          {/* Card colorida — input directo dentro dela */}
          <TouchableOpacity
            style={[s.textCard, { backgroundColor: textBg }]}
            activeOpacity={1}
            onPress={() => textRef.current?.focus()}
          >
            <TextInput
              ref={textRef}
              style={s.textCardInput}
              placeholder="Escreve aqui..."
              placeholderTextColor="rgba(255,255,255,0.45)"
              value={caption}
              onChangeText={setCaption}
              multiline
              maxLength={280}
              autoFocus
              textAlign="center"
              textAlignVertical="center"
              selectionColor="rgba(255,255,255,0.6)"
            />
            <Text style={s.charCount}>{caption.length}/280</Text>
          </TouchableOpacity>

          {/* Selector de cor — na parte de baixo */}
          <View style={[s.colorBar, { paddingBottom: bottom + 16 }]}>
            <Text style={s.colorBarLabel}>COR DE FUNDO</Text>
            <View style={s.colorRow}>
              {TEXT_BG_COLORS.map((c) => (
                <TouchableOpacity
                  key={c}
                  onPress={() => { setTextBg(c); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light) }}
                  activeOpacity={0.8}
                  style={[s.colorDot, { backgroundColor: c }, textBg === c && s.colorDotActive]}
                />
              ))}
            </View>
          </View>
        </View>
      )}
    </KeyboardAvoidingView>
  )
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#fff' },

  /* top bar */
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#EAEAEA',
    gap: 12,
  },
  backBtn: { padding: 4 },

  tabs:          { flex: 1, flexDirection: 'row', justifyContent: 'center', gap: 4 },
  tab:           { paddingHorizontal: 18, paddingVertical: 7 },
  tabActive:     { borderBottomWidth: 2, borderBottomColor: PRIMARY },
  tabText:       { fontSize: 14, fontFamily: fonts.semiBold, color: '#ABABAB' },
  tabTextActive: { color: '#1A1A1A' },

  publishBtn:  { backgroundColor: PRIMARY, paddingHorizontal: 18, paddingVertical: 8, borderRadius: 8 },
  publishOff:  { opacity: 0.35 },
  publishText: { color: '#fff', fontFamily: fonts.semiBold, fontSize: 14 },

  /* photo tab */
  photoContent: { paddingBottom: 40 },
  photoPlaceholder: {
    margin: 20,
    height: W - 40,
    borderRadius: 6,
    backgroundColor: '#FAFAFA',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    borderWidth: 1,
    borderColor: '#EAEAEA',
    borderStyle: 'dashed',
  },
  photoIconWrap: {
    width: 64, height: 64, borderRadius: 32,
    backgroundColor: '#F0F0F3',
    alignItems: 'center', justifyContent: 'center',
  },
  photoLabel: { fontSize: 15, fontFamily: fonts.semiBold, color: '#444' },
  photoSub:   { fontSize: 13, fontFamily: fonts.regular, color: '#ABABAB' },

  captionWrap: {
    marginHorizontal: 20,
    marginTop: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#EAEAEA',
  },
  captionInput: {
    paddingVertical: 14,
    fontSize: 15, fontFamily: fonts.regular, color: '#1A1A1A',
    minHeight: 52,
  },

  partnerToggle: {
    flexDirection: 'row', alignItems: 'center', gap: 7,
    marginHorizontal: 20, marginTop: 14,
    borderWidth: 1.5, borderColor: PRIMARY, borderRadius: 20,
    paddingHorizontal: 14, paddingVertical: 8, alignSelf: 'flex-start',
  },
  partnerToggleActive: { backgroundColor: PRIMARY, borderColor: PRIMARY },
  partnerToggleText:   { fontSize: 13, fontFamily: fonts.semiBold, color: PRIMARY },
  partnerToggleTextActive: { color: '#fff' },

  badge24h:     { flexDirection: 'row', alignItems: 'center', gap: 5, marginHorizontal: 20, marginTop: 14 },
  badge24hText: { fontSize: 12, fontFamily: fonts.regular, color: PRIMARY },

  /* text tab */
  textTabWrap: { flex: 1 },

  textCard: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    paddingVertical: 40,
  },
  textCardInput: {
    width: '100%',
    fontSize: 26,
    fontFamily: fonts.semiBold,
    color: '#fff',
    textAlign: 'center',
    lineHeight: 38,
    letterSpacing: -0.3,
    minHeight: 80,
  },
  charCount: {
    position: 'absolute',
    bottom: 16,
    right: 16,
    fontSize: 11,
    fontFamily: fonts.regular,
    color: 'rgba(255,255,255,0.45)',
  },

  colorBar: {
    backgroundColor: '#fff',
    paddingTop: 16,
    paddingHorizontal: 20,
    borderTopWidth: 1,
    borderTopColor: '#EAEAEA',
    gap: 12,
  },
  colorBarLabel: {
    fontSize: 11,
    fontFamily: fonts.semiBold,
    color: '#ABABAB',
    letterSpacing: 1,
  },
  colorRow: { flexDirection: 'row', gap: 10 },
  colorDot: { width: 34, height: 34, borderRadius: 17 },
  colorDotActive: { borderWidth: 3, borderColor: '#1A1A1A' },
})
