import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react'
import {
  View, Text, StyleSheet, TouchableOpacity, Pressable, ScrollView,
  ActivityIndicator, Alert, Animated, PanResponder,
} from 'react-native'
import { Image } from 'expo-image'
import { CameraView, useCameraPermissions } from 'expo-camera'
import * as Location from 'expo-location'
import { setStatusBarStyle } from 'expo-status-bar'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useFocusEffect, useNavigation } from '@react-navigation/native'
import { Ionicons } from '@expo/vector-icons'
import { colors, fonts } from '../../theme'
import AvatarImage from '../../components/AvatarImage'
import * as circle from '../../services/circle.service'
import { CircleMember, CircleSession, CircleUser, EmojiOverlay } from '../../services/circle.service'
import { useAuthStore } from '../../store/auth.store'
import { useFeedStore } from '../../store/feed.store'
import { getSocket } from '../../socket'
import { useT } from '../../i18n'

const NEARBY_REVEAL_MS = 35_000   // ao fim de ~35s sem ninguém → revela quem chamar

const SHUTTER_OUTER = 78
const SHUTTER_INNER = 62

const EMOJI_SET  = ['❤️', '🔥', '😂', '😍', '⭐️', '💯', '🙌', '👀', '✨', '😎', '🎯', '🌸', '👑', '🕶️']
const EMOJI_FRAC = 0.14
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))

type Placed = { id: string; emoji: string; x: number; y: number }

// Emoji arrastável sobre a pré-visualização
function PlacedEmoji({
  item, boundsW, boundsH, onCommit, onRemove,
}: {
  item: Placed; boundsW: number; boundsH: number
  onCommit: (id: string, x: number, y: number) => void
  onRemove: (id: string) => void
}) {
  const size      = boundsW * EMOJI_FRAC
  const startLeft = item.x * boundsW - size / 2
  const startTop  = item.y * boundsH - size / 2
  const pan       = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current

  const responder = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => false,
    onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > 3 || Math.abs(g.dy) > 3,
    onPanResponderMove: (_, g) => pan.setValue({ x: g.dx, y: g.dy }),
    onPanResponderRelease: (_, g) => {
      const cx = clamp((startLeft + g.dx + size / 2) / boundsW, 0.06, 0.94)
      const cy = clamp((startTop + g.dy + size / 2) / boundsH, 0.06, 0.94)
      pan.setValue({ x: 0, y: 0 })
      onCommit(item.id, cx, cy)
    },
  }), [startLeft, startTop, boundsW, boundsH, size])

  return (
    <Animated.View style={[em.placed, { left: startLeft, top: startTop, transform: pan.getTranslateTransform() }]} {...responder.panHandlers}>
      <Text style={{ fontSize: size }}>{item.emoji}</Text>
      <TouchableOpacity style={em.del} onPress={() => onRemove(item.id)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
        <Ionicons name="close" size={11} color="#fff" />
      </TouchableOpacity>
    </Animated.View>
  )
}

export default function CircleScreen() {
  const { top, bottom } = useSafeAreaInsets()
  const nav  = useNavigation<any>()
  const user = useAuthStore((s) => s.user)
  const t    = useT()
  const setPendingPost = useFeedStore((s) => s.setPendingPost)

  const [permission, requestPermission] = useCameraPermissions()
  const camRef = useRef<CameraView>(null)

  const [session,    setSession]    = useState<CircleSession | null>(null)
  const [members,    setMembers]    = useState<CircleMember[]>([])
  const [nearby,     setNearby]     = useState<CircleUser[]>([])
  const [calling,    setCalling]    = useState<Set<string>>(new Set())
  const [incoming,   setIncoming]   = useState<{ sessionId: string; hostName: string; hostAvatar: string | null } | null>(null)
  const [focused,    setFocused]    = useState(false)
  const [facing,     setFacing]     = useState<'back' | 'front'>('back')
  const [previewUri, setPreviewUri] = useState<string | null>(null)
  const [placed,     setPlaced]     = useState<Placed[]>([])
  const [previewBox, setPreviewBox] = useState({ w: 0, h: 0 })
  const [showNearby, setShowNearby] = useState(false)
  const [shooting,   setShooting]   = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [publishing, setPublishing] = useState(false)
  const [published,  setPublished]  = useState(false)

  const sessionRef = useRef<CircleSession | null>(null)
  sessionRef.current = session

  const shutterPress = useRef(new Animated.Value(1)).current

  const myId       = user?.id
  const isHost     = !!session && session.hostId === myId
  const others     = members.filter((m) => m.user.id !== myId && m.status === 'JOINED')
  const memberIds  = new Set(members.map((m) => m.user.id))
  const showable   = nearby.filter((u) => !memberIds.has(u.id))
  const photoCount = members.filter((m) => m.photoUrl).length
  const iHavePhoto = members.some((m) => m.user.id === myId && m.photoUrl)

  // ── Init: entra numa chamada pendente OU abre a minha sessão ────────────────
  const init = useCallback(async () => {
    let lat: number | undefined
    let lng: number | undefined
    try {
      const { status } = await Location.getForegroundPermissionsAsync()
      if (status === 'granted') {
        const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced })
        lat = loc.coords.latitude
        lng = loc.coords.longitude
      }
    } catch {}

    try {
      const inc = await circle.getIncoming()
      if (inc.call) {
        const st = await circle.joinCircle(inc.call.sessionId)
        setSession(st.session); setMembers(st.members); setNearby([])
        return
      }
    } catch {}

    try {
      const st = await circle.openCircle(lat, lng)
      setSession(st.session); setMembers(st.members); setNearby(st.nearby)
    } catch {}
  }, [])

  useFocusEffect(useCallback(() => {
    setFocused(true)
    setStatusBarStyle('light')
    setShowNearby(false)
    init()

    const revealTimer = setTimeout(() => setShowNearby(true), NEARBY_REVEAL_MS)

    const socket = getSocket()
    const onUpdate = ({ sessionId, members: m }: { sessionId: string; members: CircleMember[] }) => {
      if (sessionRef.current?.id === sessionId) setMembers(m)
    }
    const onCalled = (p: { sessionId: string; hostName: string; hostAvatar: string | null }) => {
      if (sessionRef.current?.id !== p.sessionId) setIncoming(p)
    }
    const onPublished = ({ sessionId }: { sessionId: string }) => {
      if (sessionRef.current?.id === sessionId) nav.navigate('Feed')
    }
    socket?.on('circle:update', onUpdate)
    socket?.on('circle:called', onCalled)
    socket?.on('circle:published', onPublished)

    return () => {
      setFocused(false)
      setStatusBarStyle('dark')
      clearTimeout(revealTimer)
      setPreviewUri(null)
      socket?.off('circle:update', onUpdate)
      socket?.off('circle:called', onCalled)
      socket?.off('circle:published', onPublished)
    }
  }, [init]))

  // ── Chamar um vizinho ───────────────────────────────────────────────────────
  async function handleCall(u: CircleUser) {
    if (!session || calling.has(u.id)) return
    setCalling((prev) => new Set(prev).add(u.id))
    try {
      await circle.callToCircle(session.id, u.id)
    } catch {
      setCalling((prev) => { const n = new Set(prev); n.delete(u.id); return n })
      Alert.alert(t.circle_errTitle, t.circle_callFail)
    }
  }

  // ── Entrar numa chamada recebida ────────────────────────────────────────────
  async function acceptIncoming() {
    if (!incoming) return
    try {
      const st = await circle.joinCircle(incoming.sessionId)
      setSession(st.session); setMembers(st.members); setNearby([]); setIncoming(null)
    } catch {
      Alert.alert(t.circle_errTitle, t.circle_sessionGone)
      setIncoming(null)
    }
  }

  // ── Disparo ─────────────────────────────────────────────────────────────────
  async function handleShutter() {
    if (shooting || !camRef.current) return
    setShooting(true)
    Animated.sequence([
      Animated.timing(shutterPress, { toValue: 0.86, duration: 90, useNativeDriver: true }),
      Animated.spring(shutterPress, { toValue: 1, tension: 200, friction: 6, useNativeDriver: true }),
    ]).start()
    try {
      const pic = await camRef.current.takePictureAsync({ quality: 0.8 })
      if (pic?.uri) { setPreviewUri(pic.uri); setPlaced([]) }
    } catch {}
    setShooting(false)
  }

  function addEmoji(emoji: string) {
    setPlaced((p) => [...p, { id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, emoji, x: 0.5, y: 0.4 }])
  }
  function commitEmoji(id: string, x: number, y: number) {
    setPlaced((p) => p.map((it) => (it.id === id ? { ...it, x, y } : it)))
  }
  function removeEmoji(id: string) {
    setPlaced((p) => p.filter((it) => it.id !== id))
  }

  async function confirmPhoto() {
    if (!session || !previewUri || submitting) return
    setSubmitting(true)
    try {
      const overlays: EmojiOverlay[] = placed.map(({ emoji, x, y }) => ({ emoji, x, y }))
      await circle.addCirclePhoto(session.id, previewUri, overlays)
      setPreviewUri(null)
      setPlaced([])
    } catch {
      Alert.alert(t.circle_errTitle, t.circle_photoFail)
    }
    setSubmitting(false)
  }

  async function handlePublish() {
    if (!session || publishing || published) return
    setPublishing(true)
    try {
      const post = await circle.publishCircle(session.id)
      setPublished(true)
      setPendingPost(post)
      nav.navigate('Feed')
    } catch (err) {
      Alert.alert(t.circle_errTitle, err instanceof Error ? err.message : t.circle_publishFail)
    }
    setPublishing(false)
  }

  // ── Permissão da câmara ─────────────────────────────────────────────────────
  if (!permission?.granted) {
    return (
      <View style={[s.permScreen, { paddingTop: top }]}>
        <View style={s.permRing}><Text style={s.permEmoji}>⭕</Text></View>
        <Text style={s.permTitle}>{t.circle_permTitle}</Text>
        <Text style={s.permSub}>
          {t.circle_permSub}
        </Text>
        <TouchableOpacity style={s.permBtn} onPress={requestPermission} activeOpacity={0.85}>
          <Text style={s.permBtnTxt}>{t.circle_permBtn}</Text>
        </TouchableOpacity>
      </View>
    )
  }

  return (
    <View style={s.screen}>
      {/* ── Câmara ao vivo (fundo, sempre a filmar) ── */}
      {focused && !previewUri && (
        <CameraView ref={camRef} style={StyleSheet.absoluteFill} facing={facing} />
      )}
      {previewUri && (
        <View
          style={StyleSheet.absoluteFill}
          onLayout={(ev) => setPreviewBox({ w: ev.nativeEvent.layout.width, h: ev.nativeEvent.layout.height })}
        >
          <Image source={{ uri: previewUri }} style={StyleSheet.absoluteFill} contentFit="cover" />
          {previewBox.h > 0 && placed.map((it) => (
            <PlacedEmoji key={it.id} item={it} boundsW={previewBox.w} boundsH={previewBox.h} onCommit={commitEmoji} onRemove={removeEmoji} />
          ))}
        </View>
      )}

      {/* ── Topo: quem está no círculo (chips) + virar câmara ── */}
      <View style={[s.top, { paddingTop: top + 10 }]} pointerEvents="box-none">
        <View style={s.memberRow}>
          {members.filter((m) => m.status === 'JOINED').map((m) => (
            <View key={m.user.id} style={s.memberChip}>
              <View style={[s.memberAvatar, m.photoUrl && s.memberAvatarDone]}>
                <AvatarImage uri={m.user.avatar} name={m.user.name} size={34} borderWidth={0} borderColor="transparent" />
              </View>
              {m.photoUrl && (
                <View style={s.memberCheck}><Ionicons name="checkmark" size={9} color="#fff" /></View>
              )}
            </View>
          ))}
          {members.filter((m) => m.status === 'JOINED').length > 0 && (
            <Text style={s.memberCount}>
              {others.length > 0 ? `${members.length} ${t.circle_inCircle}` : t.circle_onlyYou}
            </Text>
          )}
        </View>

        {!previewUri && (
          <TouchableOpacity style={s.flipBtn} onPress={() => setFacing((f) => (f === 'back' ? 'front' : 'back'))} activeOpacity={0.8}>
            <Ionicons name="camera-reverse-outline" size={20} color="#fff" />
          </TouchableOpacity>
        )}
      </View>

      {/* ── Chamada recebida (banner flutuante) ── */}
      {incoming && (
        <View style={[s.incoming, { top: top + 70 }]}>
          <View style={s.incomingAvatar}>
            <AvatarImage uri={incoming.hostAvatar} name={incoming.hostName} size={38} borderWidth={0} borderColor="transparent" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.incomingName} numberOfLines={1}>{incoming.hostName.split(' ')[0]} {t.circle_calledYou}</Text>
            <Text style={s.incomingSub}>{t.circle_calledSub}</Text>
          </View>
          <TouchableOpacity style={s.incomingBtn} onPress={acceptIncoming} activeOpacity={0.85}>
            <Text style={s.incomingBtnTxt}>{t.circle_join}</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* ── Painel flutuante: quem chamar (cards) — só o anfitrião, sobre a câmara ── */}
      {!previewUri && isHost && showNearby && showable.length > 0 && (
        <View style={s.nearbyPanel} pointerEvents="box-none">
          <Text style={s.nearbyHeading}>
            {others.length === 0 ? t.circle_nobody : t.circle_callMore}
          </Text>
          {others.length === 0 && (
            <Text style={s.nearbySub}>{t.circle_nobodySub}</Text>
          )}
          <ScrollView
            horizontal={false}
            style={s.nearbyScroll}
            contentContainerStyle={s.nearbyWrap}
            showsVerticalScrollIndicator={false}
          >
            {showable.map((u) => {
              const called = calling.has(u.id)
              return (
                <View key={u.id} style={s.card}>
                  <View style={s.cardAvatar}>
                    <AvatarImage uri={u.avatar} name={u.name} size={46} borderWidth={0} borderColor="transparent" />
                  </View>
                  <Text style={s.cardName} numberOfLines={1}>{u.name.split(' ')[0]}</Text>
                  <TouchableOpacity
                    style={[s.cardBtn, called && s.cardBtnCalled]}
                    onPress={() => handleCall(u)}
                    disabled={called}
                    activeOpacity={0.85}
                  >
                    <Text style={[s.cardBtnTxt, called && s.cardBtnTxtCalled]}>
                      {called ? t.circle_called : t.circle_call}
                    </Text>
                  </TouchableOpacity>
                </View>
              )
            })}
          </ScrollView>
        </View>
      )}

      {/* dica de espera antes de revelar os vizinhos */}
      {!previewUri && isHost && !showNearby && others.length === 0 && (
        <View style={s.waitHint} pointerEvents="none">
          <Text style={s.waitHintTxt}>{t.circle_waiting}</Text>
        </View>
      )}

      {/* ── Fundo: publicar (anfitrião) + obturador OU confirmar preview ── */}
      {!previewUri ? (
        <View style={[s.bottom, { paddingBottom: bottom + 78 }]} pointerEvents="box-none">
          {/* Qualquer participante publica o álbum no SEU feed */}
          {photoCount >= 1 && (
            <TouchableOpacity
              style={[s.publishBtn, published && s.publishBtnDone]}
              onPress={handlePublish}
              disabled={publishing || published}
              activeOpacity={0.88}
            >
              {publishing
                ? <ActivityIndicator color="#fff" size="small" />
                : published
                ? <Text style={s.publishTxt}>{t.circle_published}</Text>
                : <Text style={s.publishTxt}>{t.circle_publishMy} · {photoCount} {photoCount === 1 ? t.circle_photo : t.circle_photos}</Text>}
            </TouchableOpacity>
          )}
          <Pressable onPress={handleShutter} disabled={shooting}>
            <Animated.View style={[s.shutterOuter, { transform: [{ scale: shutterPress }] }]}>
              <View style={[s.shutterInner, iHavePhoto && s.shutterInnerDone]}>
                {shooting
                  ? <ActivityIndicator color="#fff" />
                  : iHavePhoto ? <Ionicons name="checkmark" size={26} color="#fff" /> : null}
              </View>
            </Animated.View>
          </Pressable>
          <Text style={s.shutterHint}>{iHavePhoto ? t.circle_takeAnother : t.circle_takePhoto}</Text>
        </View>
      ) : (
        <View style={[s.previewBottom, { paddingBottom: bottom + 34 }]}>
          {/* Barra de emojis — toca para adicionar, arrasta na foto para posicionar */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={s.emojiBar}
            contentContainerStyle={s.emojiBarContent}
            keyboardShouldPersistTaps="handled"
          >
            {EMOJI_SET.map((emo) => (
              <TouchableOpacity key={emo} style={s.emojiChip} onPress={() => addEmoji(emo)} activeOpacity={0.7}>
                <Text style={s.emojiChipTxt}>{emo}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <View style={s.previewActions}>
            <TouchableOpacity style={s.retake} onPress={() => { setPreviewUri(null); setPlaced([]) }} activeOpacity={0.85} disabled={submitting}>
              <Text style={s.retakeTxt}>{t.circle_retake}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.usePhoto} onPress={confirmPhoto} activeOpacity={0.85} disabled={submitting}>
              {submitting
                ? <ActivityIndicator color="#fff" size="small" />
                : <Text style={s.usePhotoTxt}>{t.circle_addToCircle}</Text>}
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  )
}

const em = StyleSheet.create({
  placed: { position: 'absolute' },
  del: {
    position: 'absolute', top: -6, right: -6,
    width: 20, height: 20, borderRadius: 10,
    backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.5)',
  },
})

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.black },

  /* ── Topo ── */
  top: {
    position: 'absolute', top: 0, left: 0, right: 0,
    flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between',
    paddingHorizontal: 14, zIndex: 10,
  },
  memberRow: { flex: 1, flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6 },
  memberChip: {},
  memberAvatar: {
    width: 34, height: 34, borderRadius: 17, overflow: 'hidden',
    borderWidth: 2, borderColor: 'rgba(255,255,255,0.7)',
  },
  memberAvatarDone: { borderColor: colors.primary },
  memberCheck: {
    position: 'absolute', bottom: -2, right: -2,
    width: 15, height: 15, borderRadius: 7.5, backgroundColor: colors.primary,
    alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: colors.black,
  },
  memberCount: {
    marginLeft: 4, color: '#fff', fontSize: 12, fontFamily: fonts.semiBold,
    textShadowColor: 'rgba(0,0,0,0.4)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 3,
  },
  flipBtn: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: 'rgba(0,0,0,0.38)', alignItems: 'center', justifyContent: 'center',
  },

  /* ── Chamada recebida ── */
  incoming: {
    position: 'absolute', left: 14, right: 14, zIndex: 20,
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: 'rgba(0,0,0,0.72)',
    borderRadius: 18, padding: 10,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)',
  },
  incomingAvatar: { width: 38, height: 38, borderRadius: 19, overflow: 'hidden' },
  incomingName: { color: '#fff', fontSize: 14, fontFamily: fonts.bold, letterSpacing: -0.2 },
  incomingSub: { color: 'rgba(255,255,255,0.7)', fontSize: 12, fontFamily: fonts.regular, marginTop: 1 },
  incomingBtn: { backgroundColor: colors.primary, borderRadius: 18, paddingHorizontal: 18, paddingVertical: 9 },
  incomingBtnTxt: { color: '#fff', fontSize: 13.5, fontFamily: fonts.bold },

  /* ── Painel de vizinhos (flutua sobre a câmara) ── */
  nearbyPanel: {
    position: 'absolute', left: 12, right: 12, bottom: 190, zIndex: 15,
    backgroundColor: 'rgba(0,0,0,0.44)',
    borderRadius: 22, paddingVertical: 14, paddingHorizontal: 12,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)',
  },
  nearbyHeading: { color: '#fff', fontSize: 15, fontFamily: fonts.bold, letterSpacing: -0.3, textAlign: 'center' },
  nearbySub: { color: 'rgba(255,255,255,0.72)', fontSize: 12.5, fontFamily: fonts.regular, textAlign: 'center', marginTop: 3, marginBottom: 4 },
  nearbyScroll: { maxHeight: 220, marginTop: 8 },
  nearbyWrap: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 10 },
  card: {
    width: 96, alignItems: 'center', gap: 6,
    backgroundColor: 'rgba(255,255,255,0.10)',
    borderRadius: 16, paddingVertical: 12, paddingHorizontal: 8,
  },
  cardAvatar: { width: 46, height: 46, borderRadius: 23, overflow: 'hidden' },
  cardName: { color: '#fff', fontSize: 12, fontFamily: fonts.semiBold, maxWidth: 80 },
  cardBtn: { backgroundColor: colors.primary, borderRadius: 14, paddingHorizontal: 16, paddingVertical: 6, marginTop: 2 },
  cardBtnCalled: { backgroundColor: 'rgba(255,255,255,0.18)' },
  cardBtnTxt: { color: '#fff', fontSize: 12, fontFamily: fonts.bold },
  cardBtnTxtCalled: { color: 'rgba(255,255,255,0.85)' },

  /* ── Dica de espera ── */
  waitHint: { position: 'absolute', left: 0, right: 0, top: '46%', alignItems: 'center', zIndex: 5 },
  waitHintTxt: {
    color: '#fff', fontSize: 13, fontFamily: fonts.medium,
    backgroundColor: 'rgba(0,0,0,0.35)', borderRadius: 14, paddingHorizontal: 14, paddingVertical: 7, overflow: 'hidden',
  },

  /* ── Fundo ── */
  bottom: { position: 'absolute', left: 0, right: 0, bottom: 0, alignItems: 'center', gap: 12, zIndex: 10 },
  publishBtn: {
    backgroundColor: colors.primary, borderRadius: 26, paddingHorizontal: 26, paddingVertical: 13,
    shadowColor: colors.primary, shadowOpacity: 0.4, shadowRadius: 14, shadowOffset: { width: 0, height: 6 }, elevation: 8,
  },
  publishBtnDone: { backgroundColor: 'rgba(255,255,255,0.2)' },
  publishTxt: { color: '#fff', fontSize: 14.5, fontFamily: fonts.bold, letterSpacing: -0.2 },
  shutterOuter: {
    width: SHUTTER_OUTER, height: SHUTTER_OUTER, borderRadius: SHUTTER_OUTER / 2,
    borderWidth: 4, borderColor: 'rgba(255,255,255,0.95)', alignItems: 'center', justifyContent: 'center',
  },
  shutterInner: {
    width: SHUTTER_INNER, height: SHUTTER_INNER, borderRadius: SHUTTER_INNER / 2,
    backgroundColor: 'rgba(255,255,255,0.25)', alignItems: 'center', justifyContent: 'center',
  },
  shutterInnerDone: { backgroundColor: colors.primary },
  shutterHint: { color: '#fff', fontSize: 12, fontFamily: fonts.medium, textShadowColor: 'rgba(0,0,0,0.4)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 3 },

  /* ── Pré-visualização ── */
  previewBottom: { position: 'absolute', bottom: 0, left: 0, right: 0, gap: 14, zIndex: 10 },
  emojiBar: { maxHeight: 52 },
  emojiBarContent: { paddingHorizontal: 16, gap: 8, alignItems: 'center' },
  emojiChip: {
    width: 42, height: 42, borderRadius: 21,
    backgroundColor: 'rgba(0,0,0,0.4)', alignItems: 'center', justifyContent: 'center',
  },
  emojiChipTxt: { fontSize: 22 },
  previewActions: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 14, paddingHorizontal: 24,
  },
  retake: { paddingHorizontal: 22, paddingVertical: 13, borderRadius: 26, borderWidth: 1.4, borderColor: 'rgba(255,255,255,0.75)' },
  retakeTxt: { color: '#fff', fontFamily: fonts.semiBold, fontSize: 14.5 },
  usePhoto: { flex: 1, maxWidth: 260, paddingVertical: 14, borderRadius: 26, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  usePhotoTxt: { color: '#fff', fontFamily: fonts.bold, fontSize: 14.5, letterSpacing: -0.2 },

  /* ── Permissão ── */
  permScreen: { flex: 1, backgroundColor: colors.black, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40, gap: 10 },
  permRing: { width: 84, height: 84, borderRadius: 42, borderWidth: 1.6, borderColor: colors.primary, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  permEmoji: { fontSize: 34 },
  permTitle: { fontSize: 20, fontFamily: fonts.bold, color: '#fff', letterSpacing: -0.4 },
  permSub: { fontSize: 13.5, fontFamily: fonts.regular, color: 'rgba(255,255,255,0.7)', textAlign: 'center', lineHeight: 20 },
  permBtn: { marginTop: 14, backgroundColor: colors.primary, paddingHorizontal: 30, paddingVertical: 13, borderRadius: 26 },
  permBtnTxt: { color: '#fff', fontFamily: fonts.bold, fontSize: 14.5 },
})
