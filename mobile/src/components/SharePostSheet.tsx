import React, { useCallback, useEffect, useRef, useState } from 'react'
import {
  ActivityIndicator,
  Animated,
  Easing,
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import AvatarImage from './AvatarImage'
import Icon from './Icon'
import VerifiedBadge from './VerifiedBadge'
import useReducedMotionPreference from '../hooks/useReducedMotionPreference'
import { useT } from '../i18n'
import { getMyFollowing, type FollowUser } from '../services/follow.service'
import { sendMessage } from '../services/message.service'
import { getCache, setCache } from '../db/database'
import { isConnected } from '../services/netinfo.service'
import { colors, fonts, leading, radius, sheet, spacing, typography } from '../theme'
import type { Post } from '../types'
import { toast } from '../utils/toast'

/** O endereço do post. O `scheme` da app está declarado no `app.json`. */
export function postLink(postId: string) {
  return `luxee://post/${postId}`
}

/** Quatro por linha: um rosto de 64 cabe com folga em qualquer telefone. */
const COLUMNS = 4
const AVATAR = 64

interface Props {
  post: Post
  /** Corre no primeiro envio — é aí que a partilha conta. */
  onShared?: () => void
  onClose: () => void
}

/**
 * Um rosto na grelha. O toque é o envio — não há botão.
 *
 * A versão anterior tinha uma lista com um botão "Enviar" cheio ao lado de cada
 * nome: numa folha com quinze pessoas eram quinze rectângulos escuros empilhados,
 * e o que se via primeiro era a coluna de botões, não as caras. Numa grelha o
 * rosto é o alvo, que é como se escolhe uma pessoa — pela cara.
 *
 * O envio confirma-se no próprio rosto: encolhe ao toque, e o visto nasce em cima
 * dele com uma mola. Sem diálogo, sem a folha a fechar-se por baixo dos pés.
 */
function PersonCell({
  person, sent, sending, onPress, sentLabel, sendLabel, reduceMotion,
}: {
  person: FollowUser
  sent: boolean
  sending: boolean
  onPress: () => void
  sentLabel: string
  sendLabel: string
  reduceMotion: boolean
}) {
  const scale = useRef(new Animated.Value(1)).current
  const check = useRef(new Animated.Value(sent ? 1 : 0)).current

  useEffect(() => {
    if (!sent) return
    if (reduceMotion) { check.setValue(1); return }
    Animated.spring(check, { toValue: 1, speed: 16, bounciness: 12, useNativeDriver: true }).start()
  }, [check, reduceMotion, sent])

  function press(to: number) {
    if (reduceMotion) return
    Animated.spring(scale, { toValue: to, speed: 40, bounciness: 8, useNativeDriver: true }).start()
  }

  return (
    <Pressable
      style={s.cell}
      onPress={onPress}
      onPressIn={() => press(0.92)}
      onPressOut={() => press(1)}
      disabled={sent || sending}
      accessibilityRole="button"
      accessibilityLabel={`${sent ? sentLabel : sendLabel} ${person.name}`}
      accessibilityState={{ disabled: sent || sending }}
    >
      <Animated.View style={[s.face, { transform: [{ scale }] }]}>
        <AvatarImage uri={person.avatar} name={person.name} size={AVATAR} />

        {sending && (
          <View style={s.faceVeil}>
            <ActivityIndicator size="small" color={colors.white} />
          </View>
        )}

        {sent && (
          <Animated.View
            style={[
              s.check,
              { opacity: check, transform: [{ scale: check }] },
            ]}
          >
            <Icon name="check" size={14} color={colors.white} strokeWidth={2.4} absoluteStrokeWidth />
          </Animated.View>
        )}
      </Animated.View>

      <View style={s.cellNameLine}>
        <Text style={[s.cellName, sent && s.cellNameSent]} numberOfLines={1}>
          {sent ? sentLabel : person.name.split(' ')[0]}
        </Text>
        {!sent && person.isVerified && <VerifiedBadge size={11} />}
      </View>
    </Pressable>
  )
}

/**
 * Partilhar um post com quem segues, sem sair da app.
 *
 * A folha do sistema (`Share.share`) continua a existir para o mundo lá fora;
 * isto é o caminho de dentro, que é onde a partilha quase sempre acontece: a
 * pessoa a quem queres mostrar já está aqui.
 *
 * Envia para quem segues e não para todas as conversas de propósito. Quem segues
 * é uma lista que escolheste; o histórico de conversas inclui quem te escreveu
 * uma vez e nunca mais, e uma lista de partilha ordenada por acaso convida a
 * enganos.
 *
 * Cada rosto envia por si e a folha não fecha: partilhar com três pessoas são
 * três toques, não três aberturas. Depois de enviar, o rosto fica com o visto e
 * deixa de responder — tocar duas vezes mandaria a mesma coisa duas vezes, e uma
 * mensagem enviada não se desfaz.
 */
export default function SharePostSheet({ post, onShared, onClose }: Props) {
  const t = useT()
  const reduceMotion = useReducedMotionPreference()
  const { height: windowHeight } = useWindowDimensions()
  const { bottom } = useSafeAreaInsets()

  const [people, setPeople] = useState<FollowUser[]>([])
  const [loading, setLoading] = useState(true)
  const [sent, setSent] = useState<Set<string>>(new Set())
  const [sending, setSending] = useState<Set<string>>(new Set())
  const sharedRef = useRef(false)

  const sheetHeight = Math.min(Math.round(windowHeight * 0.72), windowHeight - 80)
  const sheetY = useRef(new Animated.Value(reduceMotion ? 0 : sheetHeight)).current
  const backdropOpacity = useRef(new Animated.Value(reduceMotion ? 1 : 0)).current
  const closingRef = useRef(false)

  useEffect(() => {
    if (reduceMotion) {
      sheetY.setValue(0)
      backdropOpacity.setValue(1)
      return
    }
    const animation = Animated.parallel([
      Animated.spring(sheetY, { toValue: 0, speed: 20, bounciness: 3, useNativeDriver: true }),
      Animated.timing(backdropOpacity, {
        toValue: 1,
        duration: 180,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ])
    animation.start()
    return () => animation.stop()
  }, [backdropOpacity, reduceMotion, sheetY])

  // Cache-first: quem segues muda devagar, e a folha tem de abrir com a lista já
  // lá em vez de com um vazio a rodar.
  useEffect(() => {
    let alive = true
    async function load() {
      const cached = await getCache<FollowUser[]>('share_following').catch(() => null)
      if (alive && cached && cached.length > 0) {
        setPeople(cached)
        setLoading(false)
      }
      if (!isConnected()) { if (alive) setLoading(false); return }
      try {
        const fresh = await getMyFollowing()
        if (!alive) return
        setPeople(fresh)
        setCache('share_following', fresh).catch(() => {})
      } catch {}
      if (alive) setLoading(false)
    }
    load()
    return () => { alive = false }
  }, [])

  const animateClose = useCallback(() => {
    if (closingRef.current) return
    closingRef.current = true
    if (reduceMotion) { onClose(); return }
    Animated.parallel([
      Animated.timing(sheetY, {
        toValue: sheetHeight,
        duration: 230,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(backdropOpacity, { toValue: 0, duration: 190, useNativeDriver: true }),
    ]).start(({ finished }) => {
      if (finished) onClose()
      else closingRef.current = false
    })
  }, [backdropOpacity, onClose, reduceMotion, sheetHeight, sheetY])

  const send = useCallback(async (person: FollowUser) => {
    if (sent.has(person.id) || sending.has(person.id)) return
    setSending((prev) => new Set([...prev, person.id]))
    try {
      const caption = post.caption?.trim()
      await sendMessage(person.id, `${caption ? `"${caption}"\n` : ''}${postLink(post.id)}`)
      setSent((prev) => new Set([...prev, person.id]))
      // A partilha conta uma vez por folha, não uma por destinatário: o que o
      // contador do post mede é quantas vezes foi partilhado, não para quantas
      // pessoas de uma vez.
      if (!sharedRef.current) {
        sharedRef.current = true
        onShared?.()
      }
    } catch {
      toast.error(t.share_fail)
    } finally {
      setSending((prev) => {
        const next = new Set(prev)
        next.delete(person.id)
        return next
      })
    }
  }, [onShared, post.caption, post.id, sending, sent, t.share_fail])

  return (
    <Modal transparent visible animationType="none" onRequestClose={animateClose} statusBarTranslucent>
      <View style={s.root}>
        <Animated.View style={[s.backdrop, { opacity: backdropOpacity }]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={animateClose} accessible={false} />
        </Animated.View>

        <Animated.View
          style={[
            s.sheet,
            { height: sheetHeight, paddingBottom: bottom, transform: [{ translateY: sheetY }] },
          ]}
        >
          <View style={s.grabber} />

          <View style={s.header}>
            <Text style={s.title}>{t.share_sheet_title}</Text>
          </View>

          {loading && people.length === 0 ? (
            <View style={s.state}>
              <ActivityIndicator color={sheet.inkMuted} />
            </View>
          ) : people.length === 0 ? (
            <View style={s.state}>
              <Text style={s.stateTitle}>{t.share_no_following}</Text>
              <Text style={s.stateSub}>{t.share_no_following_sub}</Text>
            </View>
          ) : (
            <FlatList
              data={people}
              key={`grid-${COLUMNS}`}
              numColumns={COLUMNS}
              keyExtractor={(person) => person.id}
              contentContainerStyle={s.gridContent}
              columnWrapperStyle={s.gridRow}
              showsVerticalScrollIndicator={false}
              renderItem={({ item }) => (
                <PersonCell
                  person={item}
                  sent={sent.has(item.id)}
                  sending={sending.has(item.id)}
                  onPress={() => send(item)}
                  sentLabel={t.share_sent}
                  sendLabel={t.share_send}
                  reduceMotion={reduceMotion}
                />
              )}
            />
          )}
        </Animated.View>
      </View>
    </Modal>
  )
}

const s = StyleSheet.create({
  root:     { flex: 1, justifyContent: 'flex-end' },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: colors.overlay },
  sheet: {
    width: '100%',
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    backgroundColor: colors.white,
    overflow: 'hidden',
  },
  grabber: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    marginTop: spacing.sm,
    borderRadius: radius.full,
    backgroundColor: sheet.lineStrong,
  },
  header: {
    minHeight: 48,
    paddingHorizontal: spacing.md,
    justifyContent: 'center',
  },
  title: {
    color: sheet.ink,
    fontFamily: fonts.bold,
    fontSize: typography.section,
    lineHeight: leading.section,
    letterSpacing: -0.35,
  },
  gridContent: { paddingHorizontal: spacing.md, paddingBottom: spacing.md },
  gridRow:     { gap: spacing.sm2, marginBottom: spacing.md },
  cell:        { flex: 1, alignItems: 'center', gap: spacing.xs2 },
  face:        { width: AVATAR, height: AVATAR },
  // Enquanto vai a caminho, o rosto fica por baixo de um véu em vez de a célula
  // desaparecer: continua a ver-se para quem se está a enviar.
  faceVeil: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.full,
    backgroundColor: colors.overlay,
  },
  // O visto encosta ao rosto e não o tapa: confirma sem esconder quem recebeu.
  check: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.full,
    backgroundColor: colors.primary,
    borderWidth: 2,
    borderColor: colors.white,
  },
  cellNameLine: { flexDirection: 'row', alignItems: 'center', gap: 2, maxWidth: '100%' },
  cellName: {
    flexShrink: 1,
    color: sheet.ink,
    fontFamily: fonts.medium,
    fontSize: typography.meta,
    lineHeight: leading.meta,
    textAlign: 'center',
    letterSpacing: -0.1,
  },
  cellNameSent: { color: colors.primary, fontFamily: fonts.semiBold },
  state: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.xl,
  },
  stateTitle: {
    color: sheet.ink,
    fontFamily: fonts.semiBold,
    fontSize: typography.body,
    lineHeight: leading.body,
    textAlign: 'center',
  },
  stateSub: {
    color: sheet.inkMuted,
    fontFamily: fonts.medium,
    fontSize: typography.secondary,
    lineHeight: leading.secondary,
    textAlign: 'center',
  },
})
