import React, { useEffect, useState, useRef } from 'react'
import {
  View, Text, TouchableOpacity, FlatList, StyleSheet, Animated,
  Keyboard, Pressable, ActivityIndicator, TextInput,
  useWindowDimensions,
} from 'react-native'
import { KeyboardAvoidingView } from 'react-native-keyboard-controller'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { Post, Comment } from '../../types'
import { useComments } from '../../hooks/useComments'
import CommentItem from './CommentItem'
import CommentInputArea from './CommentInputArea'
import { colors, fonts } from '../../theme'
import { useT } from '../../i18n'
import { useOverlayStore } from '../../store/overlay.store'

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

export default function CommentSheet({ post, onClose, onCommentAdded }: Props) {
  const t = useT()
  const { bottom: safeBottom, top: safeTop } = useSafeAreaInsets()
  const { height: winH } = useWindowDimensions()

  const { comments, loading, sending, load, send, toggleLike, edit, remove } = useComments(post.id)

  const [text,    setText]    = useState('')
  const [replyTo, setReplyTo] = useState<Comment | null>(null)
  const inputRef = useRef<TextInput>(null)

  // ── Entrada ────────────────────────────────────────────────────────────────
  const slide   = useRef(new Animated.Value(1)).current   // 1 = fora, 0 = no sítio
  const fade    = useRef(new Animated.Value(0)).current

  // Enquanto a folha existir, a barra de separadores desaparece — senão pinta
  // por cima do campo de escrever (e no Android sobe com o teclado).
  useEffect(() => {
    const { push, pop } = useOverlayStore.getState()
    push()
    return pop
  }, [])

  useEffect(() => {
    load()
    Animated.parallel([
      Animated.spring(slide, { toValue: 0, useNativeDriver: true, damping: 22, stiffness: 220 }),
      Animated.timing(fade,  { toValue: 1, duration: 180, useNativeDriver: true }),
    ]).start()
  }, [])

  function close() {
    Keyboard.dismiss()
    Animated.parallel([
      Animated.timing(slide, { toValue: 1, duration: 200, useNativeDriver: true }),
      Animated.timing(fade,  { toValue: 0, duration: 160, useNativeDriver: true }),
    ]).start(onClose)
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
    onCommentAdded?.()
    setText(''); setReplyTo(null)
    await send(body, replyTo?.id)
  }

  function handleReply(c: Comment) {
    setReplyTo(c)
    inputRef.current?.focus()
  }

  const total = post._count.comments
  const title = total > 0
    ? `${total >= 1000 ? `${(total / 1000).toFixed(1)}K` : total} ${t.comments_title}`
    : t.comments_title

  return (
    <View style={s.overlay}>
      {/* Fundo: escurece o post e fecha ao toque */}
      <Animated.View style={[s.backdropFill, { opacity: fade }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={close} />
      </Animated.View>

      <KeyboardAvoidingView behavior="padding">
        <Animated.View
          style={[
            s.sheet,
            {
              height: sheetH,
              transform: [{ translateY: slide.interpolate({ inputRange: [0, 1], outputRange: [0, winH] }) }],
            },
          ]}
        >
        {/* Cabeçalho */}
        <View style={s.grabberWrap}><View style={s.grabber} /></View>
        <View style={s.header}>
          <Text style={s.title}>{title}</Text>
          <TouchableOpacity onPress={close} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
            <Ionicons name="close" size={21} color="rgba(0,0,0,0.45)" />
          </TouchableOpacity>
        </View>
        <View style={s.rule} />

        {/* Lista */}
        {loading && comments.length === 0 ? (
          <View style={s.center}>
            <ActivityIndicator color={colors.primary} />
          </View>
        ) : comments.length === 0 ? (
          <View style={s.center}>
            <Ionicons name="chatbubble-outline" size={26} color="rgba(0,0,0,0.16)" />
            <Text style={s.emptyTitle}>{t.cmt_empty_title}</Text>
            <Text style={s.emptySub}>{t.cmt_empty_sub}</Text>
          </View>
        ) : (
          <FlatList
            data={comments}
            keyExtractor={(c) => c.id}
            renderItem={({ item }) => (
              <CommentItem
                comment={item}
                postOwnerId={post.userId}
                onReply={handleReply}
                onToggleLike={toggleLike}
                onEdit={edit}
                onDelete={remove}
              />
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
        />
        </Animated.View>
      </KeyboardAvoidingView>
    </View>
  )
}

const s = StyleSheet.create({
  overlay:      { ...StyleSheet.absoluteFillObject, zIndex: 100, justifyContent: 'flex-end' },
  backdropFill: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.32)' },

  sheet: {
    backgroundColor: colors.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
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
  title: { fontFamily: fonts.semiBold, fontSize: 15.5, color: colors.black, letterSpacing: -0.2 },

  rule: { height: StyleSheet.hairlineWidth, backgroundColor: 'rgba(0,0,0,0.09)' },

  listContent: { paddingVertical: 6 },

  center: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    gap: 7, paddingHorizontal: 40, paddingBottom: 30,
  },
  emptyTitle: { fontFamily: fonts.semiBold, fontSize: 14, color: 'rgba(0,0,0,0.55)' },
  emptySub: {
    fontFamily: fonts.regular, fontSize: 12.5, color: 'rgba(0,0,0,0.35)',
    textAlign: 'center', lineHeight: 17,
  },
})
