import React, { useCallback, useEffect, useRef, useState } from 'react'
import {
  ActivityIndicator, Alert, Modal, Pressable, StyleSheet, Text, View,
} from 'react-native'
import { CameraView, useCameraPermissions } from 'expo-camera'
import { Image } from 'expo-image'
import { Ionicons } from '@expo/vector-icons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { useT } from '../../i18n'
import * as circle from '../../services/circle.service'
import { useCircleJoinStore } from '../../store/circleJoin.store'
import { colors, fonts, radius, spacing } from '../../theme'
import { toast } from '../../utils/toast'

const SHUTTER = 74
const CAPTURE_QUALITY = 0.7

function firstName(name: string | null | undefined) {
  return (name ?? '').trim().split(/\s+/)[0] ?? ''
}

/**
 * A câmara de quem pede para entrar num Círculo já publicado.
 *
 * Só câmara, nunca galeria: entrar num Círculo é mostrar onde se está agora,
 * não escolher a melhor fotografia da semana. Aqui há prévia — ao contrário do
 * disparo do Círculo — porque esta fotografia vai ser vista por outra pessoa
 * antes de entrar, e quem a manda merece vê-la primeiro.
 */
export default function CircleJoinCamera() {
  const t = useT()
  const { top, bottom } = useSafeAreaInsets()
  const target = useCircleJoinStore((state) => state.joinTarget)
  const closeJoin = useCircleJoinStore((state) => state.closeJoin)
  const markSent = useCircleJoinStore((state) => state.markSent)
  const [permission, requestPermission] = useCameraPermissions()
  const camRef = useRef<CameraView>(null)
  const [facing, setFacing] = useState<'back' | 'front'>('back')
  const [ready, setReady] = useState(false)
  const [shooting, setShooting] = useState(false)
  const [photo, setPhoto] = useState<string | null>(null)
  const [sending, setSending] = useState(false)

  // Cada abertura começa do zero: nada da fotografia de um pedido anterior.
  useEffect(() => {
    if (!target) return
    setPhoto(null)
    setSending(false)
    setShooting(false)
    setReady(false)
  }, [target])

  const hostName = firstName(target?.hostName)
  const title = hostName
    ? t.circleJoin_cameraTitle.replace('{name}', hostName)
    : t.circleJoin_cameraTitleNoName

  const close = useCallback(() => {
    if (sending) return
    closeJoin()
  }, [closeJoin, sending])

  async function shoot() {
    if (!camRef.current || !ready || shooting) return
    setShooting(true)
    try {
      const pic = await camRef.current.takePictureAsync({ quality: CAPTURE_QUALITY })
      if (pic?.uri) setPhoto(pic.uri)
    } catch {
      Alert.alert(t.circle_errTitle, t.circle_captureFail)
    } finally {
      setShooting(false)
    }
  }

  async function send() {
    if (!target || !photo || sending) return
    setSending(true)
    try {
      const request = await circle.requestToJoinCircle(target.momentId, photo)
      markSent(target.momentId, request.id)
      closeJoin()
      toast.success(
        t.circleJoin_sent,
        t.circleJoin_sentSub.replace('{name}', hostName || t.circleJoin_hostFallback),
      )
    } catch (err: any) {
      Alert.alert(t.circle_errTitle, err?.response?.data?.message || t.circleJoin_failed)
      setSending(false)
    }
  }

  return (
    <Modal
      visible={!!target}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={close}
      statusBarTranslucent
    >
      <View style={s.screen}>
        {!permission?.granted ? (
          <View style={[s.permission, { paddingTop: top }]}>
            <Ionicons name="camera-outline" size={30} color="#fff" />
            <Text style={s.permissionText}>{t.circleJoin_permission}</Text>
            <Pressable
              onPress={() => { requestPermission().catch(() => {}) }}
              style={({ pressed }) => [s.primary, pressed && s.pressed]}
              accessibilityRole="button"
            >
              <Text style={s.primaryText}>{t.circle_permBtn}</Text>
            </Pressable>
          </View>
        ) : photo ? (
          <Image source={{ uri: photo }} style={StyleSheet.absoluteFill} contentFit="cover" />
        ) : (
          <CameraView
            ref={camRef}
            style={StyleSheet.absoluteFill}
            facing={facing}
            onCameraReady={() => setReady(true)}
            onMountError={() => setReady(false)}
          />
        )}

        {/* ── Topo: fechar, a quem se está a pedir, virar ── */}
        <View style={[s.top, { paddingTop: top + 10 }]} pointerEvents="box-none">
          <Pressable
            onPress={close}
            disabled={sending}
            style={({ pressed }) => [s.round, pressed && s.pressed]}
            accessibilityRole="button"
            accessibilityLabel={t.circle_close}
            hitSlop={6}
          >
            <Ionicons name="close" size={20} color="#fff" />
          </Pressable>
          <View style={s.titlePill}>
            <Text style={s.titleText} numberOfLines={1}>{title}</Text>
          </View>
          {!photo && permission?.granted ? (
            <Pressable
              onPress={() => {
                setReady(false)
                setFacing((value) => (value === 'back' ? 'front' : 'back'))
              }}
              style={({ pressed }) => [s.round, pressed && s.pressed]}
              accessibilityRole="button"
              accessibilityLabel={t.circle_flipCamera}
              hitSlop={6}
            >
              <Ionicons name="camera-reverse-outline" size={20} color="#fff" />
            </Pressable>
          ) : (
            <View style={s.roundSpacer} />
          )}
        </View>

        {/* ── Baixo: o que acontece a esta fotografia, e o disparo ou o envio ── */}
        {permission?.granted && (
          <View style={[s.card, { bottom: Math.max(bottom, 12) }]}>
            <Text style={s.hint}>{t.circleJoin_cameraHint}</Text>
            {photo ? (
              <View style={s.actions}>
                <Pressable
                  onPress={() => setPhoto(null)}
                  disabled={sending}
                  style={({ pressed }) => [s.secondary, pressed && s.pressed, sending && s.disabled]}
                  accessibilityRole="button"
                >
                  <Ionicons name="refresh" size={17} color="#fff" />
                  <Text style={s.secondaryText}>{t.circleJoin_retake}</Text>
                </Pressable>
                <Pressable
                  onPress={send}
                  disabled={sending}
                  style={({ pressed }) => [s.primary, s.primaryFlex, pressed && s.pressed]}
                  accessibilityRole="button"
                  accessibilityState={{ busy: sending }}
                >
                  {sending
                    ? <ActivityIndicator color="#fff" />
                    : (
                      <>
                        <Ionicons name="paper-plane-outline" size={17} color="#fff" />
                        <Text style={s.primaryText}>{t.circleJoin_send}</Text>
                      </>
                    )}
                </Pressable>
              </View>
            ) : (
              <Pressable
                onPress={shoot}
                disabled={!ready || shooting}
                style={({ pressed }) => [s.shutter, pressed && s.pressed, (!ready || shooting) && s.disabled]}
                accessibilityRole="button"
                accessibilityLabel={t.circle_takePhoto}
              >
                <View style={s.shutterInner}>
                  {shooting ? <ActivityIndicator color="#fff" /> : <Ionicons name="camera" size={22} color="#fff" />}
                </View>
              </Pressable>
            )}
          </View>
        )}
      </View>
    </Modal>
  )
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.black },
  permission: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    gap: spacing.md, paddingHorizontal: spacing.xl,
  },
  permissionText: {
    color: 'rgba(255,255,255,0.78)', fontFamily: fonts.regular, fontSize: 14,
    lineHeight: 20, textAlign: 'center',
  },
  top: {
    position: 'absolute', top: 0, left: 0, right: 0,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 14, gap: 10,
  },
  round: {
    width: 44, height: 44, borderRadius: radius.full,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(11,20,26,0.72)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)',
  },
  roundSpacer: { width: 44, height: 44 },
  titlePill: {
    flexShrink: 1, height: 34, paddingHorizontal: 14, borderRadius: radius.full,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(11,20,26,0.72)',
  },
  titleText: { color: '#fff', fontFamily: fonts.semiBold, fontSize: 13 },
  // O mesmo cartão flutuante da câmara do Círculo: quatro cantos redondos,
  // folga das bordas.
  card: {
    position: 'absolute', left: 12, right: 12,
    paddingTop: 14, paddingBottom: 16, paddingHorizontal: 16, gap: 14,
    alignItems: 'center',
    borderRadius: 28, borderCurve: 'continuous',
    backgroundColor: 'rgba(11,20,26,0.9)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.16)',
  },
  hint: {
    color: 'rgba(255,255,255,0.72)', fontFamily: fonts.regular, fontSize: 12.5,
    lineHeight: 18, textAlign: 'center',
  },
  shutter: {
    width: SHUTTER, height: SHUTTER, borderRadius: SHUTTER / 2,
    borderWidth: 4, borderColor: 'rgba(255,255,255,0.95)',
    alignItems: 'center', justifyContent: 'center',
  },
  shutterInner: {
    width: SHUTTER - 16, height: SHUTTER - 16, borderRadius: (SHUTTER - 16) / 2,
    backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center',
  },
  actions: { flexDirection: 'row', gap: 10, alignSelf: 'stretch' },
  primary: {
    minHeight: 46, paddingHorizontal: spacing.md, borderRadius: radius.full,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7,
    backgroundColor: colors.primary,
    borderWidth: 1, borderColor: 'rgba(194,70,230,0.72)',
  },
  primaryFlex: { flex: 1 },
  primaryText: { color: '#fff', fontFamily: fonts.bold, fontSize: 14 },
  secondary: {
    minHeight: 46, paddingHorizontal: spacing.md, borderRadius: radius.full,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7,
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  secondaryText: { color: '#fff', fontFamily: fonts.bold, fontSize: 14 },
  pressed: { opacity: 0.76, transform: [{ scale: 0.98 }] },
  disabled: { opacity: 0.44 },
})
