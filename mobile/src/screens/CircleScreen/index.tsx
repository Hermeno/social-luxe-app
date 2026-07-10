import React, { useState, useCallback, useEffect, useRef } from 'react'
import {
  View, Text, StyleSheet, TouchableOpacity, FlatList, Pressable,
  ActivityIndicator, Alert, RefreshControl, Animated, Dimensions,
} from 'react-native'
import { Image } from 'expo-image'
import { CameraView, useCameraPermissions } from 'expo-camera'
import * as Location from 'expo-location'
import { setStatusBarStyle } from 'expo-status-bar'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useFocusEffect } from '@react-navigation/native'
import { Ionicons } from '@expo/vector-icons'
import { colors, fonts } from '../../theme'
import AvatarImage from '../../components/AvatarImage'
import * as circleService from '../../services/circle.service'
import { CircleState, CircleCapture } from '../../services/circle.service'

const { width: W } = Dimensions.get('window')

// Grelha de círculos: 3 colunas, tudo redondo — a geometria É a identidade
const GRID_PAD = 20
const GRID_GAP = 14
const CELL     = Math.floor((W - GRID_PAD * 2 - GRID_GAP * 2) / 3)

// Obturador à Apple: anel branco fino + disco crimson que respira ao toque
const SHUTTER_OUTER = 78
const SHUTTER_INNER = 62

function timeLeft(endsAt: string): string {
  const ms = new Date(endsAt).getTime() - Date.now()
  if (ms <= 0) return 'fechado'
  const h = Math.floor(ms / 3_600_000)
  if (h >= 1) return `fecha em ${h}h`
  return `fecha em ${Math.max(1, Math.floor(ms / 60_000))}min`
}

// ── Um achado na grelha — foto redonda + autor ────────────────────────────────
function CaptureCircle({ capture, index }: { capture: CircleCapture; index: number }) {
  const scale = useRef(new Animated.Value(0.6)).current
  const op    = useRef(new Animated.Value(0)).current

  useEffect(() => {
    Animated.parallel([
      Animated.spring(scale, { toValue: 1, tension: 120, friction: 9, delay: index * 40, useNativeDriver: true }),
      Animated.timing(op,    { toValue: 1, duration: 260, delay: index * 40, useNativeDriver: true }),
    ]).start()
  }, [])

  return (
    <Animated.View style={[s.cell, { opacity: op, transform: [{ scale }] }]}>
      <View style={s.captureRing}>
        <Image source={{ uri: capture.mediaUrl }} style={s.captureImg} contentFit="cover" cachePolicy="disk" recyclingKey={capture.id} transition={120} />
      </View>
      <View style={s.captureAvatar}>
        <AvatarImage uri={capture.user.avatar} name={capture.user.name} size={22} borderWidth={0} borderColor="transparent" />
      </View>
      <Text style={s.captureName} numberOfLines={1}>{capture.user.name.split(' ')[0]}</Text>
    </Animated.View>
  )
}

// ── Verificação estilo captcha — "isto é o alvo?" ─────────────────────────────
function VerifyCard({
  target, item, remaining, onVote,
}: {
  target: string
  item: { id: string; mediaUrl: string }
  remaining: number
  onVote: (match: boolean) => void
}) {
  return (
    <View style={s.verifyCard}>
      <View style={s.verifyHeader}>
        <Text style={s.verifyTitle}>Isto é <Text style={s.verifyTarget}>{target.toLowerCase()}</Text>?</Text>
        <Text style={s.verifyCount}>{remaining} por verificar</Text>
      </View>
      <View style={s.verifyPhotoRing}>
        <Image source={{ uri: item.mediaUrl }} style={s.verifyPhoto} contentFit="cover" cachePolicy="disk" recyclingKey={item.id} transition={120} />
      </View>
      <View style={s.verifyActions}>
        <TouchableOpacity style={s.verifyNo} onPress={() => onVote(false)} activeOpacity={0.8}>
          <Ionicons name="close" size={22} color={colors.gray600} />
        </TouchableOpacity>
        <TouchableOpacity style={s.verifyYes} onPress={() => onVote(true)} activeOpacity={0.8}>
          <Ionicons name="checkmark" size={22} color={colors.white} />
        </TouchableOpacity>
      </View>
    </View>
  )
}

// ── Ecrã ──────────────────────────────────────────────────────────────────────
export default function CircleScreen() {
  const { top, bottom } = useSafeAreaInsets()
  const tabClear = 42 + Math.max(bottom, 8)   // barra de navegação flutuante

  const [permission, requestPermission] = useCameraPermissions()
  const camRef = useRef<CameraView>(null)

  const [state,      setState]      = useState<CircleState | null>(null)
  const [mode,       setMode]       = useState<'camera' | 'grid'>('camera')
  const [focused,    setFocused]    = useState(false)
  const [facing,     setFacing]     = useState<'back' | 'front'>('back')
  const [flash,      setFlash]      = useState<'off' | 'on'>('off')
  const [previewUri, setPreviewUri] = useState<string | null>(null)
  const [loading,    setLoading]    = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [shooting,   setShooting]   = useState(false)
  const [verifyQueue, setVerifyQueue] = useState<{ id: string; mediaUrl: string }[]>([])

  const stateRef = useRef<CircleState | null>(null)
  stateRef.current = state
  const sparkSentRef = useRef(false)

  // Anel do obturador respira enquanto a câmera está aberta
  const shutterPulse = useRef(new Animated.Value(1)).current
  const shutterPress = useRef(new Animated.Value(1)).current
  const hintOpacity  = useRef(new Animated.Value(0)).current

  useEffect(() => {
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(shutterPulse, { toValue: 1.06, duration: 1400, useNativeDriver: true }),
      Animated.timing(shutterPulse, { toValue: 1,    duration: 1400, useNativeDriver: true }),
    ]))
    loop.start()
    return () => loop.stop()
  }, [])

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    try {
      const fresh = await circleService.getCircle()
      setState(fresh)
      setVerifyQueue(fresh.toVerify)
      // Já entrou hoje → a câmera não tem propósito; mostra o círculo
      if (fresh.myCapture) setMode('grid')
    } catch {}
    setLoading(false)
    setRefreshing(false)
  }, [])

  // ── Spark: abrir a câmera avisa quem está perto (1x por visita ao ecrã) ────
  async function sendSpark() {
    if (sparkSentRef.current) return
    sparkSentRef.current = true
    try {
      let lat: number | undefined
      let lng: number | undefined
      const { status } = await Location.getForegroundPermissionsAsync()
      if (status === 'granted') {
        const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced })
        lat = loc.coords.latitude
        lng = loc.coords.longitude
      }
      const { notified } = await circleService.spark(lat, lng)
      if (notified > 0) {
        Animated.sequence([
          Animated.timing(hintOpacity, { toValue: 1, duration: 300, useNativeDriver: true }),
          Animated.delay(3200),
          Animated.timing(hintOpacity, { toValue: 0, duration: 400, useNativeDriver: true }),
        ]).start()
      }
    } catch {}
  }

  useFocusEffect(useCallback(() => {
    setFocused(true)
    load(stateRef.current !== null)
    return () => {
      setFocused(false)
      sparkSentRef.current = false
      setPreviewUri(null)
      setStatusBarStyle('light')
    }
  }, []))

  // Status bar acompanha o palco: câmera escura → ícones claros; grelha branca → escuros
  useEffect(() => {
    if (!focused) return
    setStatusBarStyle(mode === 'camera' || previewUri ? 'light' : 'dark')
  }, [focused, mode, previewUri])

  // Câmera pronta e autorizada → dispara o aviso aos próximos
  useEffect(() => {
    if (focused && mode === 'camera' && permission?.granted) sendSpark()
  }, [focused, mode, permission?.granted])

  // ── Disparo ────────────────────────────────────────────────────────────────
  async function handleShutter() {
    if (shooting || !camRef.current) return
    setShooting(true)
    Animated.sequence([
      Animated.timing(shutterPress, { toValue: 0.86, duration: 90,  useNativeDriver: true }),
      Animated.spring(shutterPress, { toValue: 1, tension: 200, friction: 6, useNativeDriver: true }),
    ]).start()
    try {
      const pic = await camRef.current.takePictureAsync({ quality: 0.8 })
      if (pic?.uri) setPreviewUri(pic.uri)
    } catch {}
    setShooting(false)
  }

  async function handleConfirm() {
    if (!state || !previewUri || submitting) return
    setSubmitting(true)
    try {
      await circleService.submitCapture(state.target.id, previewUri)
      setPreviewUri(null)
      await load(true)
      setMode('grid')
    } catch (e) {
      Alert.alert('Círculo', e instanceof Error ? e.message : 'Não foi possível enviar. Tenta de novo.')
    }
    setSubmitting(false)
  }

  function handleVote(match: boolean) {
    const item = verifyQueue[0]
    if (!item) return
    setVerifyQueue((q) => q.slice(1))            // otimista — a fila anda já
    circleService.voteCapture(item.id, match).catch(() => {})
  }

  const my = state?.myCapture ?? null

  /* ════ MODO CÂMERA ═══════════════════════════════════════════════════════ */
  if (mode === 'camera' && !my) {
    // Sem permissão → pedir com dignidade, nunca com um alert seco
    if (!permission?.granted) {
      return (
        <View style={[s.permScreen, { paddingTop: top }]}>
          <View style={s.permRing}><Text style={s.permEmoji}>⭕</Text></View>
          <Text style={s.permTitle}>A câmara é o Círculo</Text>
          <Text style={s.permSub}>
            Todos os dias, um alvo. Encontra-o no mundo real,{'\n'}fotografa, e entra no círculo de hoje.
          </Text>
          <TouchableOpacity style={s.permBtn} onPress={requestPermission} activeOpacity={0.85}>
            <Text style={s.permBtnTxt}>Permitir câmara</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setMode('grid')} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Text style={s.permSkip}>Ver o círculo de hoje</Text>
          </TouchableOpacity>
        </View>
      )
    }

    return (
      <View style={s.camScreen}>
        {focused && !previewUri && (
          <CameraView ref={camRef} style={StyleSheet.absoluteFill} facing={facing} flash={flash} />
        )}
        {previewUri && (
          <Image source={{ uri: previewUri }} style={StyleSheet.absoluteFill} contentFit="cover" />
        )}

        {/* ── Topo: fechar · alvo · flash ── */}
        <View style={[s.camTop, { paddingTop: top + 8 }]}>
          <TouchableOpacity
            style={s.camGlassBtn}
            onPress={() => (previewUri ? setPreviewUri(null) : setMode('grid'))}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            activeOpacity={0.8}
          >
            <Ionicons name="close" size={20} color="#fff" />
          </TouchableOpacity>

          <View style={s.camTargetPill}>
            <Text style={s.camTargetEmoji}>{state?.target.emoji ?? '⭕'}</Text>
            <Text style={s.camTargetTxt} numberOfLines={1}>{state?.target.title ?? '…'}</Text>
          </View>

          {!previewUri ? (
            <TouchableOpacity
              style={s.camGlassBtn}
              onPress={() => setFlash((f) => (f === 'off' ? 'on' : 'off'))}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              activeOpacity={0.8}
            >
              <Ionicons name={flash === 'on' ? 'flash' : 'flash-off'} size={17} color="#fff" />
            </TouchableOpacity>
          ) : (
            <View style={s.camGlassSpacer} />
          )}
        </View>

        {/* Aviso discreto: quem está perto foi chamado */}
        <Animated.View style={[s.sparkHint, { top: top + 64, opacity: hintOpacity }]} pointerEvents="none">
          <Text style={s.sparkHintTxt}>Quem está perto foi avisado ⭕</Text>
        </Animated.View>

        {/* ── Fundo: controlos ── */}
        {!previewUri ? (
          <View style={[s.camControls, { paddingBottom: tabClear + 22 }]}>
            <TouchableOpacity style={s.camSideBtn} onPress={() => setMode('grid')} activeOpacity={0.8}>
              <Ionicons name="ellipse-outline" size={22} color="#fff" />
              {state && state.liveCount > 0 && (
                <View style={s.camSideBadge}><Text style={s.camSideBadgeTxt}>{state.liveCount}</Text></View>
              )}
            </TouchableOpacity>

            <Pressable onPress={handleShutter} disabled={shooting}>
              <Animated.View style={[s.shutterOuter, { transform: [{ scale: Animated.multiply(shutterPulse, shutterPress) }] }]}>
                <View style={s.shutterInner}>
                  {shooting && <ActivityIndicator color={colors.white} />}
                </View>
              </Animated.View>
            </Pressable>

            <TouchableOpacity
              style={s.camSideBtn}
              onPress={() => setFacing((f) => (f === 'back' ? 'front' : 'back'))}
              activeOpacity={0.8}
            >
              <Ionicons name="camera-reverse-outline" size={22} color="#fff" />
            </TouchableOpacity>
          </View>
        ) : (
          <View style={[s.previewActions, { paddingBottom: tabClear + 22 }]}>
            <TouchableOpacity style={s.previewRetake} onPress={() => setPreviewUri(null)} activeOpacity={0.85} disabled={submitting}>
              <Text style={s.previewRetakeTxt}>Repetir</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.previewConfirm} onPress={handleConfirm} activeOpacity={0.85} disabled={submitting}>
              {submitting
                ? <ActivityIndicator color={colors.white} size="small" />
                : <Text style={s.previewConfirmTxt}>Entrar no círculo ⭕</Text>}
            </TouchableOpacity>
          </View>
        )}
      </View>
    )
  }

  /* ════ MODO GRELHA ═══════════════════════════════════════════════════════ */
  return (
    <View style={s.screen}>
      <View style={[s.header, { paddingTop: top + 18 }]}>
        <Text style={s.overline}>O CÍRCULO DE HOJE</Text>
        <View style={s.targetRow}>
          <View style={s.targetEmojiRing}>
            <Text style={s.targetEmoji}>{state?.target.emoji ?? '⭕'}</Text>
          </View>
          <View style={s.targetTextCol}>
            <Text style={s.targetTitle}>{state?.target.title ?? '…'}</Text>
            {state && (
              <Text style={s.targetMeta}>
                {state.liveCount} {state.liveCount === 1 ? 'pessoa' : 'pessoas'} no círculo · {timeLeft(state.target.endsAt)}
              </Text>
            )}
          </View>
        </View>
        <View style={s.divider} />
      </View>

      {loading && !state ? (
        <View style={s.center}><ActivityIndicator size="large" color={colors.primary} /></View>
      ) : (
        <FlatList
          data={state?.captures ?? []}
          keyExtractor={(c) => c.id}
          numColumns={3}
          columnWrapperStyle={s.gridRow}
          contentContainerStyle={[s.gridContent, { paddingBottom: bottom + 170 }]}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(true) }} tintColor={colors.primary} />
          }
          ListHeaderComponent={
            <>
              {verifyQueue.length > 0 && state && (
                <VerifyCard
                  target={state.target.title}
                  item={verifyQueue[0]}
                  remaining={verifyQueue.length}
                  onVote={handleVote}
                />
              )}
              {my && (
                <View style={s.myStrip}>
                  <View style={s.myThumbRing}>
                    <Image source={{ uri: my.mediaUrl }} style={s.myThumb} contentFit="cover" cachePolicy="disk" />
                  </View>
                  {my.status === 'LIVE' && (
                    <Text style={s.myTxt}>Estás no círculo <Text style={s.myTxtStrong}>✓</Text></Text>
                  )}
                  {my.status === 'PENDING' && (
                    <Text style={s.myTxt}>A comunidade está a verificar o teu achado…</Text>
                  )}
                  {my.status === 'REJECTED' && (
                    <Text style={s.myTxt}>Não era bem isto — volta amanhã ⭕</Text>
                  )}
                </View>
              )}
            </>
          }
          renderItem={({ item, index }) => <CaptureCircle capture={item} index={index} />}
          ListEmptyComponent={
            <View style={s.empty}>
              <View style={s.emptyRing} />
              <Text style={s.emptyTitle}>Ninguém encontrou ainda</Text>
              <Text style={s.emptySub}>Sê a primeira pessoa. Sai, procura, fotografa.</Text>
            </View>
          }
        />
      )}

      {/* Voltar à câmera — só faz sentido se ainda não entrei */}
      {state && !my && (
        <View style={[s.shutterWrap, { paddingBottom: tabClear + 24 }]} pointerEvents="box-none">
          <TouchableOpacity style={s.gridShutter} onPress={() => setMode('camera')} activeOpacity={0.85}>
            <Ionicons name="camera" size={24} color={colors.white} />
          </TouchableOpacity>
          <Text style={s.shutterHint}>Encontra e fotografa</Text>
        </View>
      )}
    </View>
  )
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.white },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  /* ── Câmera ── */
  camScreen: { flex: 1, backgroundColor: colors.black },
  camTop: {
    position: 'absolute', top: 0, left: 0, right: 0,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 14, gap: 10, zIndex: 10,
  },
  camGlassBtn: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: 'rgba(0,0,0,0.38)',
    alignItems: 'center', justifyContent: 'center',
  },
  camGlassSpacer: { width: 38, height: 38 },
  camTargetPill: {
    flexShrink: 1,
    flexDirection: 'row', alignItems: 'center', gap: 7,
    backgroundColor: 'rgba(0,0,0,0.45)',
    borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8,
  },
  camTargetEmoji: { fontSize: 15 },
  camTargetTxt: {
    color: '#fff', fontFamily: fonts.semiBold, fontSize: 13.5, letterSpacing: -0.2,
  },
  sparkHint: {
    position: 'absolute', left: 0, right: 0,
    alignItems: 'center', zIndex: 9,
  },
  sparkHintTxt: {
    color: '#fff', fontFamily: fonts.medium, fontSize: 11.5,
    backgroundColor: 'rgba(0,0,0,0.35)',
    borderRadius: 12, paddingHorizontal: 12, paddingVertical: 5,
    overflow: 'hidden',
  },

  camControls: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 44,
  },
  camSideBtn: {
    width: 46, height: 46, borderRadius: 23,
    borderWidth: 1.3, borderColor: 'rgba(255,255,255,0.55)',
    backgroundColor: 'rgba(0,0,0,0.25)',
    alignItems: 'center', justifyContent: 'center',
  },
  camSideBadge: {
    position: 'absolute', top: -5, right: -5,
    minWidth: 18, height: 18, borderRadius: 9, paddingHorizontal: 4,
    backgroundColor: colors.primary,
    alignItems: 'center', justifyContent: 'center',
  },
  camSideBadgeTxt: { color: '#fff', fontSize: 9.5, fontFamily: fonts.bold },

  shutterOuter: {
    width: SHUTTER_OUTER, height: SHUTTER_OUTER, borderRadius: SHUTTER_OUTER / 2,
    borderWidth: 4, borderColor: 'rgba(255,255,255,0.95)',
    alignItems: 'center', justifyContent: 'center',
  },
  shutterInner: {
    width: SHUTTER_INNER, height: SHUTTER_INNER, borderRadius: SHUTTER_INNER / 2,
    backgroundColor: colors.primary,
    alignItems: 'center', justifyContent: 'center',
  },

  /* ── Pré-visualização ── */
  previewActions: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 14, paddingHorizontal: 24,
  },
  previewRetake: {
    paddingHorizontal: 22, paddingVertical: 13,
    borderRadius: 26, borderWidth: 1.4, borderColor: 'rgba(255,255,255,0.75)',
  },
  previewRetakeTxt: { color: '#fff', fontFamily: fonts.semiBold, fontSize: 14.5 },
  previewConfirm: {
    flex: 1, maxWidth: 240,
    paddingVertical: 14, borderRadius: 26,
    backgroundColor: colors.primary,
    alignItems: 'center', justifyContent: 'center',
  },
  previewConfirmTxt: { color: '#fff', fontFamily: fonts.bold, fontSize: 14.5, letterSpacing: -0.2 },

  /* ── Permissão ── */
  permScreen: {
    flex: 1, backgroundColor: colors.white,
    alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 40, gap: 10,
  },
  permRing: {
    width: 84, height: 84, borderRadius: 42,
    borderWidth: 1.6, borderColor: colors.primary,
    alignItems: 'center', justifyContent: 'center', marginBottom: 8,
  },
  permEmoji: { fontSize: 34 },
  permTitle: { fontSize: 20, fontFamily: fonts.bold, color: colors.black, letterSpacing: -0.4 },
  permSub: { fontSize: 13.5, fontFamily: fonts.regular, color: colors.gray500, textAlign: 'center', lineHeight: 20 },
  permBtn: {
    marginTop: 14, backgroundColor: colors.primary,
    paddingHorizontal: 30, paddingVertical: 13, borderRadius: 26,
  },
  permBtnTxt: { color: '#fff', fontFamily: fonts.bold, fontSize: 14.5 },
  permSkip: { marginTop: 12, fontSize: 13, fontFamily: fonts.medium, color: colors.gray500 },

  /* ── Cabeçalho (grelha) ── */
  header: { paddingHorizontal: GRID_PAD, backgroundColor: colors.white },
  overline: {
    fontSize: 11, fontFamily: fonts.bold, color: colors.gray400,
    letterSpacing: 2.2, marginBottom: 14,
  },
  targetRow: { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 16 },
  targetEmojiRing: {
    width: 56, height: 56, borderRadius: 28,
    borderWidth: 1.6, borderColor: colors.primary,
    alignItems: 'center', justifyContent: 'center',
  },
  targetEmoji: { fontSize: 26 },
  targetTextCol: { flex: 1 },
  targetTitle: {
    fontSize: 22, fontFamily: fonts.bold, color: colors.black,
    letterSpacing: -0.4, lineHeight: 27,
  },
  targetMeta: { fontSize: 12.5, fontFamily: fonts.regular, color: colors.gray500, marginTop: 3 },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: 'rgba(0,0,0,0.10)', marginHorizontal: -GRID_PAD },

  /* ── Verificação ── */
  verifyCard: {
    marginTop: 16, marginBottom: 6,
    borderRadius: 20, borderWidth: 1, borderColor: 'rgba(0,0,0,0.08)',
    paddingVertical: 16, paddingHorizontal: 16,
    alignItems: 'center', backgroundColor: colors.white,
  },
  verifyHeader: { alignSelf: 'stretch', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  verifyTitle:  { fontSize: 14.5, fontFamily: fonts.medium, color: colors.black, letterSpacing: -0.2, flex: 1 },
  verifyTarget: { fontFamily: fonts.bold, color: colors.primary },
  verifyCount:  { fontSize: 11, fontFamily: fonts.medium, color: colors.gray400 },
  verifyPhotoRing: {
    width: 148, height: 148, borderRadius: 74, overflow: 'hidden',
    borderWidth: 1.6, borderColor: 'rgba(0,0,0,0.08)',
  },
  verifyPhoto: { width: '100%', height: '100%' },
  verifyActions: { flexDirection: 'row', gap: 18, marginTop: 14 },
  verifyNo: {
    width: 48, height: 48, borderRadius: 24,
    borderWidth: 1.4, borderColor: 'rgba(0,0,0,0.14)',
    alignItems: 'center', justifyContent: 'center',
  },
  verifyYes: {
    width: 48, height: 48, borderRadius: 24,
    backgroundColor: colors.primary,
    alignItems: 'center', justifyContent: 'center',
  },

  /* ── Minha captura ── */
  myStrip: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 14,
  },
  myThumbRing: {
    width: 44, height: 44, borderRadius: 22, overflow: 'hidden',
    borderWidth: 1.6, borderColor: colors.primary,
  },
  myThumb: { width: '100%', height: '100%' },
  myTxt: { flex: 1, fontSize: 13.5, fontFamily: fonts.medium, color: colors.gray600, letterSpacing: -0.1 },
  myTxtStrong: { color: colors.primary, fontFamily: fonts.bold },

  /* ── Grelha ── */
  gridContent: { paddingHorizontal: GRID_PAD, paddingTop: 8 },
  gridRow: { gap: GRID_GAP, marginTop: GRID_GAP },
  cell: { width: CELL, alignItems: 'center' },
  captureRing: {
    width: CELL, height: CELL, borderRadius: CELL / 2, overflow: 'hidden',
    borderWidth: 1.6, borderColor: 'rgba(0,0,0,0.08)',
  },
  captureImg: { width: '100%', height: '100%' },
  captureAvatar: {
    marginTop: -13,
    borderRadius: 13, borderWidth: 2, borderColor: colors.white,
    overflow: 'hidden',
  },
  captureName: { fontSize: 10.5, fontFamily: fonts.medium, color: colors.gray500, marginTop: 3, maxWidth: CELL },

  /* ── Vazio ── */
  empty: { alignItems: 'center', paddingTop: 60, gap: 6 },
  emptyRing: {
    width: 72, height: 72, borderRadius: 36,
    borderWidth: 1.6, borderColor: 'rgba(0,0,0,0.10)',
    marginBottom: 10,
  },
  emptyTitle: { fontSize: 16, fontFamily: fonts.semiBold, color: colors.black, letterSpacing: -0.3 },
  emptySub:   { fontSize: 13, fontFamily: fonts.regular, color: colors.gray500, textAlign: 'center', lineHeight: 19 },

  /* ── Obturador (grelha) ── */
  shutterWrap: {
    position: 'absolute', left: 0, right: 0, bottom: 0,
    alignItems: 'center', gap: 8,
  },
  gridShutter: {
    width: 64, height: 64, borderRadius: 32,
    backgroundColor: colors.primary,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: colors.primary, shadowOpacity: 0.35, shadowRadius: 14, shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
  shutterHint: { fontSize: 12, fontFamily: fonts.medium, color: colors.gray500 },
})
