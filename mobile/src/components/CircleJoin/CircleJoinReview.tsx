import React, { useEffect, useState } from 'react'
import {
  ActivityIndicator, Alert, Modal, Pressable, ScrollView, StyleSheet, Text, View,
  useWindowDimensions,
} from 'react-native'
import { Image } from 'expo-image'
import { Ionicons } from '@expo/vector-icons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import AvatarImage from '../AvatarImage'
import BrandAvatarRing from '../BrandAvatarRing'
import { useT } from '../../i18n'
import { ALL_MOMENTS, useCircleJoinStore } from '../../store/circleJoin.store'
import type { CircleJoinRequest } from '../../services/circle.service'
import { colors, fonts, radius, spacing } from '../../theme'
import { resolveMediaUrl } from '../../utils/media'
import { toast } from '../../utils/toast'

/** A fotografia do pedido nunca passa desta altura — o resto da folha tem de caber. */
const PHOTO_MAX_H = 380
/** O selo, em pequeno, ao lado do título: o anel que quem entrar vai levar. */
const SEAL = 18

/**
 * Onde o anfitrião decide quem entra depois.
 *
 * Um pedido é uma pessoa e uma fotografia: vê-se as duas, inteiras, antes de
 * decidir. Aceitar põe a fotografia no Círculo com o anel tracejado; recusar
 * apaga-a. Não há terceira opção nem "ver depois" — um pedido que fica à espera
 * dois dias caduca sozinho.
 */
export default function CircleJoinReview() {
  const t = useT()
  const { bottom } = useSafeAreaInsets()
  const { width } = useWindowDimensions()
  const momentId = useCircleJoinStore((state) => state.reviewMomentId)
  const incoming = useCircleJoinStore((state) => state.incoming)
  const closeReview = useCircleJoinStore((state) => state.closeReview)
  const decide = useCircleJoinStore((state) => state.decide)
  const [busy, setBusy] = useState<string | null>(null)

  const requests = momentId === null
    ? []
    : momentId === ALL_MOMENTS
      ? incoming
      : incoming.filter((request) => request.momentId === momentId)

  // Decidido o último, a folha fecha sozinha: não sobra nada para ver nela.
  useEffect(() => {
    if (momentId !== null && requests.length === 0 && !busy) closeReview()
  }, [busy, closeReview, momentId, requests.length])

  async function handle(request: CircleJoinRequest, accept: boolean) {
    if (busy) return
    setBusy(request.id)
    try {
      await decide(request.id, accept)
      if (accept) toast.success(t.circleJoin_accepted, request.requester.name)
    } catch (err: any) {
      Alert.alert(t.circle_errTitle, err?.response?.data?.message || t.circleJoin_decideFailed)
    } finally {
      setBusy(null)
    }
  }

  const photoW = Math.min(width - spacing.md * 2 - 2, 420)

  return (
    <Modal
      visible={momentId !== null}
      transparent
      animationType="slide"
      onRequestClose={closeReview}
      statusBarTranslucent
    >
      <View style={s.root}>
        <Pressable style={s.backdrop} onPress={closeReview} accessible={false} />
        <View style={[s.sheet, { paddingBottom: bottom + spacing.md }]}>
          <View style={s.handle} />
          <View style={s.header}>
            <View style={s.headerText}>
              <View style={s.titleRow}>
                <BrandAvatarRing size={SEAL} strokeWidth={1.5} dashed />
                <Text style={s.title}>{t.circleJoin_reviewTitle}</Text>
              </View>
              <Text style={s.sub}>{t.circleJoin_reviewSub}</Text>
            </View>
            <Pressable
              onPress={closeReview}
              style={({ pressed }) => [s.close, pressed && s.pressed]}
              accessibilityRole="button"
              accessibilityLabel={t.circle_close}
              hitSlop={6}
            >
              <Ionicons name="close" size={19} color="#fff" />
            </Pressable>
          </View>

          <ScrollView
            style={s.list}
            contentContainerStyle={s.listContent}
            showsVerticalScrollIndicator={false}
          >
            {requests.map((request) => {
              const aspect = request.photoWidth && request.photoHeight
                ? request.photoWidth / request.photoHeight
                : 3 / 4
              const photoH = Math.min(PHOTO_MAX_H, photoW / aspect)
              const deciding = busy === request.id
              return (
                <View key={request.id} style={s.card}>
                  <View style={s.person}>
                    <AvatarImage uri={request.requester.avatar} name={request.requester.name} size={36} />
                    <Text style={s.name} numberOfLines={1}>{request.requester.name}</Text>
                  </View>
                  <Image
                    source={{ uri: resolveMediaUrl(request.mediaUrl) }}
                    style={[s.photo, { width: photoW, height: photoH }]}
                    contentFit="cover"
                    cachePolicy="disk"
                    transition={140}
                    accessibilityLabel={request.requester.name}
                  />
                  <View style={s.actions}>
                    <Pressable
                      onPress={() => handle(request, false)}
                      disabled={!!busy}
                      style={({ pressed }) => [s.decline, pressed && s.pressed, !!busy && !deciding && s.dim]}
                      accessibilityRole="button"
                      accessibilityLabel={`${t.circleJoin_decline} ${request.requester.name}`}
                    >
                      <Text style={s.declineText}>{t.circleJoin_decline}</Text>
                    </Pressable>
                    <Pressable
                      onPress={() => handle(request, true)}
                      disabled={!!busy}
                      style={({ pressed }) => [s.accept, pressed && s.pressed, !!busy && !deciding && s.dim]}
                      accessibilityRole="button"
                      accessibilityLabel={`${t.circleJoin_accept} ${request.requester.name}`}
                      accessibilityState={{ busy: deciding }}
                    >
                      {deciding
                        ? <ActivityIndicator color="#fff" />
                        : <Text style={s.acceptText}>{t.circleJoin_accept}</Text>}
                    </Pressable>
                  </View>
                </View>
              )
            })}
          </ScrollView>
        </View>
      </View>
    </Modal>
  )
}

const s = StyleSheet.create({
  root: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.46)' },
  sheet: {
    maxHeight: '88%',
    backgroundColor: colors.feedSurface,
    borderTopLeftRadius: 28, borderTopRightRadius: 28,
    paddingTop: 10,
    borderWidth: 1, borderBottomWidth: 0, borderColor: 'rgba(255,255,255,0.1)',
  },
  handle: {
    width: 38, height: 4, borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.2)', alignSelf: 'center', marginBottom: 14,
  },
  header: {
    flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm2,
    paddingHorizontal: spacing.md, marginBottom: spacing.sm2,
  },
  headerText: { flex: 1, gap: 4 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  title: { color: '#fff', fontFamily: fonts.bold, fontSize: 18, letterSpacing: -0.3 },
  sub: { color: 'rgba(255,255,255,0.62)', fontFamily: fonts.regular, fontSize: 12.5, lineHeight: 18 },
  close: {
    width: 38, height: 38, borderRadius: radius.full,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  list: { flexGrow: 0 },
  listContent: { paddingHorizontal: spacing.md, gap: spacing.lg, paddingBottom: spacing.xs },
  card: { gap: spacing.sm2 },
  person: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm2 },
  name: { flex: 1, color: '#fff', fontFamily: fonts.semiBold, fontSize: 15 },
  photo: {
    alignSelf: 'center', borderRadius: radius.lg, borderCurve: 'continuous',
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  actions: { flexDirection: 'row', gap: 10 },
  decline: {
    flex: 1, minHeight: 46, borderRadius: radius.full,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  declineText: { color: '#fff', fontFamily: fonts.bold, fontSize: 14 },
  accept: {
    flex: 1, minHeight: 46, borderRadius: radius.full,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.primary,
    borderWidth: 1, borderColor: 'rgba(194,70,230,0.72)',
  },
  acceptText: { color: '#fff', fontFamily: fonts.bold, fontSize: 14 },
  pressed: { opacity: 0.76, transform: [{ scale: 0.98 }] },
  dim: { opacity: 0.44 },
})
