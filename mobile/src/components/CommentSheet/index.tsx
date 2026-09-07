import React, { useEffect, useLayoutEffect, useState, useRef } from 'react'
import {
  View, Text, TouchableOpacity, FlatList, StyleSheet, Animated, Easing,
  Keyboard, Pressable, ActivityIndicator, TextInput,
  useWindowDimensions,
} from 'react-native'
import { KeyboardAvoidingView } from 'react-native-keyboard-controller'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import Icon from '../Icon'
import { Post, Comment } from '../../types'
import { useComments } from '../../hooks/useComments'
import CommentItem from './CommentItem'
import CommentInputArea from './CommentInputArea'
import { colors, fonts, radius } from '../../theme'
import { useT } from '../../i18n'
import { useOverlayStore } from '../../store/overlay.store'
import useReducedMotionPreference from '../../hooks/useReducedMotionPreference'
import AuthorAvatar from '../AuthorAvatar'
import FollowSplitButton, { type FollowDuration } from '../FollowSplitButton'
import { useAuthStore } from '../../store/auth.store'
import { useFollowStore } from '../../store/follow.store'
import { displayHandle } from '../../utils/handle'

// ─── CommentSheet ─────────────────────────────────────────────────────────────
// Folha branca de comentários.
//
// Sem <Modal> de propósito. No Android um Modal é uma janela separada, com o seu
// próprio tratamento de insets — e era daí que vinham as duas avarias antigas:
// a folha ora piscava, ora saltava para o topo deixando o teclado sozinho em
// baixo. Aqui é um overlay absoluto dentro do próprio ecrã, logo herda
// exatamente o mesmo comportamento de teclado do resto da app, e há um único
// sítio no mundo onde isso se decide.

interface Props {
  post: Post
  onClose: () => void
  onCommentAdded?: () => void
}

function AnimatedCommentRow({
  children, order, reduceMotion,
}: {
  children: React.ReactNode
  order: number
  reduceMotion: boolean
}) {
  const entry = useRef(new Animated.Value(reduceMotion ? 1 : 0)).current

  useEffect(() => {
    if (reduceMotion) { entry.setValue(1); return }
    entry.setValue(0)
    Animated.sequence([
      Animated.delay(Math.min(order, 7) * 34),
      Animated.parallel([
        Animated.timing(entry, { toValue: 1, duration: 210, useNativeDriver: true }),
      ]),
    ]).start()
  }, [entry, order, reduceMotion])

  return (
    <Animated.View
      style={!reduceMotion ? {
        opacity: entry,
        transform: [{ translateY: entry.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) }],
      } : undefined}
    >
      {children}
    </Animated.View>
  )
}

export default function CommentSheet({ post, onClose, onCommentAdded }: Props) {
  const t = useT()
  const reduceMotion = useReducedMotionPreference()
  const { bottom: safeBottom, top: safeTop } = useSafeAreaInsets()
  const { height: winH } = useWindowDimensions()

  const { comments, loading, sending, load, send, toggleLike, edit, remove } = useComments(post.id)

  const [text,    setText]    = useState('')
  const [replyTo, setReplyTo] = useState<Comment | null>(null)
  const [sentTick, setSentTick] = useState(0)
  const [followBusy, setFollowBusy] = useState(false)
  const inputRef = useRef<TextInput>(null)
  const myId = useAuthStore((st) => st.user?.id)

  // ── Entrada ────────────────────────────────────────────────────────────────
  // A folha nasce uma janela inteira abaixo do viewport. Assim o primeiro frame
  // já é transparente; não há uma superfície branca a ser redimensionada antes
  // de a animação começar.
  const sheetY = useRef(new Animated.Value(winH)).current
  const fade = useRef(new Animated.Value(0)).current
  const closingRef = useRef(false)

  // Enquanto a folha existir, a barra de separadores desaparece — senão pinta
  // por cima do campo de escrever (e no Android sobe com o teclado).
  useLayoutEffect(() => {
    const { push, pop } = useOverlayStore.getState()
    push()
    return pop
  }, [])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    sheetY.stopAnimation()
    fade.stopAnimation()
    if (reduceMotion) {
      sheetY.setValue(0)
      fade.setValue(1)
      return
    }
    Animated.parallel([
      Animated.spring(sheetY, {
        toValue: 0,
        damping: 26,
        stiffness: 240,
        mass: 0.9,
        useNativeDriver: true,
      }),
      Animated.timing(fade, {
        toValue: 1,
        duration: 190,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start()
    return () => {
      sheetY.stopAnimation()
      fade.stopAnimation()
    }
  }, [fade, reduceMotion, sheetY])

  function close() {
    if (closingRef.current) return
    closingRef.current = true
    if (reduceMotion) {
      Keyboard.dismiss()
      onClose()
      return
    }
    sheetY.stopAnimation()
    fade.stopAnimation()
    Animated.parallel([
      Animated.timing(sheetY, {
        toValue: winH,
        duration: 230,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(fade, {
        toValue: 0,
        duration: 190,
        easing: Easing.in(Easing.quad),
        useNativeDriver: true,
      }),
    ]).start(({ finished }) => {
      if (!finished) {
        closingRef.current = false
        return
      }
      // O teclado só muda a geometria depois de a folha ter saído. Fechá-lo no
      // início fazia `sheetH` crescer durante a animação e criava o flash branco.
      Keyboard.dismiss()
      onClose()
    })
  }

  // ── Teclado ────────────────────────────────────────────────────────────────
  // O KeyboardAvoidingView do keyboard-controller (no render) trata de levantar
  // a folha. Aqui só seguimos a altura para duas contas de layout: a que altura
  // a folha cabe, e se ainda é preciso deixar espaço para a barra de separadores.
  const [kbH, setKbH] = useState(0)
  const open = kbH > 0

  useEffect(() => {
    const s1 = Keyboard.addListener('keyboardDidShow', (e: any) => setKbH(e?.endCoordinates?.height ?? 0))
    const s2 = Keyboard.addListener('keyboardDidHide', () => setKbH(0))
    return () => { s1.remove(); s2.remove() }
  }, [])

  // A barra de separadores está escondida enquanto a folha estiver aberta, por
  // isso o campo só tem de respeitar a área segura do telemóvel.
  const inputPad = open ? 0 : safeBottom

  // A folha nunca pode ser mais alta do que o que sobra acima do teclado.
  const available = winH - kbH - safeTop - 52
  const sheetH    = Math.max(240, Math.min(winH * 0.76, available))

  async function handleSend() {
    const body = text.trim()
    if (!body) return
    const parentId = replyTo?.id
    setText('')
    const sent = await send(body, parentId)
    if (sent) {
      setReplyTo(null)
      setSentTick((value) => value + 1)
      onCommentAdded?.()
    } else {
      setText(body)
    }
  }

  function handleReply(c: Comment) {
    setReplyTo(c)
    inputRef.current?.focus()
  }

  const total = post._count.comments
  const title = total > 0
    ? `${total >= 1000 ? `${(total / 1000).toFixed(1)}K` : total} ${t.comments_title}`
    : t.comments_title

  // Quem publicou — fica no topo da folha para se saber de quem se está a falar
  // sem ter de fechar e voltar ao post.
  const author   = post.user
  const isMine   = myId === author?.id
  const following = useFollowStore((st) => (author ? st.followingIds.has(author.id) : false))

  async function handleFollowAuthor(duration: FollowDuration) {
    if (!author || followBusy) return
    setFollowBusy(true)
    try {
      await useFollowStore.getState().toggle(author.id, duration, { name: author.name, avatar: author.avatar })
    } catch {}
    setFollowBusy(false)
  }

  return (
    <View style={s.overlay}>
      {/* Fundo: escurece o post e fecha ao toque */}
      <Animated.View style={[s.backdropFill, { opacity: fade }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={close} />
      </Animated.View>

      <KeyboardAvoidingView style={s.keyboardLayer} behavior="padding">
        <Animated.View
          style={[
            s.sheet,
            {
              height: sheetH,
              transform: [{ translateY: sheetY }],
            },
          ]}
          renderToHardwareTextureAndroid
        >
        {/* Cabeçalho */}
        <View style={s.grabberWrap}><View style={s.grabber} /></View>
        <View style={s.header}>
          <Text style={s.title}>{title}</Text>
          <TouchableOpacity onPress={close} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
            <Icon name="close" size={21} color="rgba(0,0,0,0.45)" />
          </TouchableOpacity>
        </View>

        {/* Quem publicou. Só aparece se não for o teu próprio post — seguir-te
            a ti mesmo não existe, e o avatar sozinho não valia a linha. */}
        {!!author && !isMine && (
          <View style={s.authorBar}>
            <AuthorAvatar
              uri={author.avatar}
              name={author.name}
              avatarSize={30}
              ringWidth={1.75}
              gap={1}
              wellColor={colors.white}
            />
            <View style={s.authorInfo}>
              <Text style={s.authorName} numberOfLines={1}>{author.name}</Text>
              {!!author.username && (
                <Text style={s.authorHandle} numberOfLines={1}>{displayHandle(author.username)}</Text>
              )}
            </View>
            <FollowSplitButton
              following={following}
              loading={followBusy}
              onFollow={handleFollowAuthor}
              theme="light"
              variant="list"
            />
          </View>
        )}

        <View style={s.rule} />

        {/* Lista */}
        {loading && comments.length === 0 ? (
          <View style={s.center}>
            <ActivityIndicator color={colors.primary} />
          </View>
        ) : comments.length === 0 ? (
          <View style={s.center}>
            <Icon name="message" size={26} color="rgba(0,0,0,0.16)" />
            <Text style={s.emptyTitle}>{t.cmt_empty_title}</Text>
            <Text style={s.emptySub}>{t.cmt_empty_sub}</Text>
          </View>
        ) : (
          <FlatList
            data={comments}
            keyExtractor={(c) => c.id}
            renderItem={({ item, index }) => (
              <AnimatedCommentRow order={index} reduceMotion={reduceMotion}>
                <CommentItem
                  comment={item}
                  postOwnerId={post.userId}
                  onReply={handleReply}
                  onToggleLike={toggleLike}
                  onEdit={edit}
                  onDelete={remove}
                />
              </AnimatedCommentRow>
            )}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={s.listContent}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
          />
        )}

        <CommentInputArea
          text={text}
          onChange={setText}
          onSend={handleSend}
          sending={sending}
          replyTo={replyTo}
          onCancelReply={() => setReplyTo(null)}
          bottomInset={inputPad}
          inputRef={inputRef}
          sentSignal={sentTick}
        />
        </Animated.View>
      </KeyboardAvoidingView>
    </View>
  )
}

const s = StyleSheet.create({
  overlay:      { ...StyleSheet.absoluteFillObject, zIndex: 100, justifyContent: 'flex-end' },
  backdropFill: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.32)' },
  keyboardLayer: { width: '100%', justifyContent: 'flex-end' },

  sheet: {
    backgroundColor: colors.white,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    overflow: 'hidden',
  },

  grabberWrap: { alignItems: 'center', paddingTop: 8 },
  grabber: {
    width: 38, height: 4, borderRadius: 2,
    backgroundColor: 'rgba(0,0,0,0.14)',
  },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingTop: 12, paddingBottom: 12,
  },
  title: { fontFamily: fonts.medium, fontSize: 15.5, color: colors.black, letterSpacing: -0.16 },

  rule: { height: StyleSheet.hairlineWidth, backgroundColor: 'rgba(0,0,0,0.09)' },

  // Barra do autor do post, entre o título e a lista de comentários.
  authorBar: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 18, paddingBottom: 12,
  },
  authorInfo:   { flex: 1, minWidth: 0 },
  authorName:   { fontSize: 14.5, fontFamily: fonts.regular, color: colors.gray800, letterSpacing: -0.08 },
  authorHandle: { fontSize: 12, fontFamily: fonts.regular, color: colors.gray400, marginTop: 1 },

  listContent: { paddingVertical: 6 },

  center: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    gap: 7, paddingHorizontal: 40, paddingBottom: 30,
  },
  emptyTitle: { fontFamily: fonts.regular, fontSize: 14, color: 'rgba(0,0,0,0.55)' },
  emptySub: {
    fontFamily: fonts.regular, fontSize: 12.5, color: 'rgba(0,0,0,0.35)',
    textAlign: 'center', lineHeight: 17,
  },
})
