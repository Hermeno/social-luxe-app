import React, { useEffect, useState, useRef } from 'react'
import {
  View, Text, TouchableOpacity, FlatList, StyleSheet,
  Animated, Dimensions, Platform, Modal, Keyboard,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { Post, Comment } from '../../types'
import { useComments } from '../../hooks/useComments'
import CommentItem from './CommentItem'
import CommentInputArea from './CommentInputArea'
import { colors, spacing } from '../../theme'
import { useT } from '../../i18n'

const { height } = Dimensions.get('window')
interface Props { post: Post; onClose: () => void; onCommentAdded?: () => void }

export default function CommentSheet({ post, onClose, onCommentAdded }: Props) {
  const t = useT()
  const { comments, loading, sending, load, send, toggleLike, edit, remove } = useComments(post.id)
  const [text, setText] = useState('')
  const [replyTo, setReplyTo] = useState<Comment | null>(null)
  const slideAnim = useRef(new Animated.Value(height)).current
  const { bottom } = useSafeAreaInsets()

  useEffect(() => {
    load()
    Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, damping: 20 }).start()
  }, [])

  // O KeyboardAvoidingView com behavior="height" no Android edge-to-edge
  // redimensiona o overlay em ciclo — é isso que fazia a folha piscar depressa.
  // Medimos o teclado à mão, tal como no ChatScreen, e forçamos 0 ao fechar.
  const kbPad = useRef(new Animated.Value(0)).current
  useEffect(() => {
    const showEvt = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow'
    const hideEvt = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide'
    const onShow = (e: any) => Animated.timing(kbPad, {
      toValue: e?.endCoordinates?.height ?? 0,
      duration: e?.duration ?? 220, useNativeDriver: false,
    }).start()
    const onHide = (e: any) => Animated.timing(kbPad, {
      toValue: 0, duration: e?.duration ?? 180, useNativeDriver: false,
    }).start()
    const s1 = Keyboard.addListener(showEvt, onShow)
    const s2 = Keyboard.addListener(hideEvt, onHide)
    return () => { s1.remove(); s2.remove() }
  }, [])

  function handleClose() {
    Animated.timing(slideAnim, { toValue: height, useNativeDriver: true, duration: 250 }).start(onClose)
  }

  async function handleSend() {
    if (!text.trim()) return
    onCommentAdded?.()          // optimistic — increment immediately
    setText(''); setReplyTo(null)
    await send(text, replyTo?.id)
  }

  const fmt = (n: number) => n >= 1000 ? `${(n / 1000).toFixed(0)}K` : String(n)

  // KAV wraps the OUTER overlay so it can correctly measure its own position
  // relative to the screen (not inside a transformed Animated.View)
  return (
    <Modal
      visible
      transparent
      statusBarTranslucent
      animationType="none"
      onRequestClose={handleClose}
    >
      <Animated.View style={[s.overlay, { paddingBottom: kbPad }]}>
        <TouchableOpacity style={s.backdrop} onPress={handleClose} activeOpacity={1} />
        <Animated.View style={[s.sheet, { transform: [{ translateY: slideAnim }] }]}>
          <View style={s.header}>
            <Text style={s.title}><Text style={s.count}>{fmt(post._count.comments)}</Text> {t.comments_title}</Text>
            <TouchableOpacity onPress={handleClose}>
              <Ionicons name="close" size={22} color={colors.gray800} />
            </TouchableOpacity>
          </View>
          <View style={s.handle} />
          <FlatList
            data={comments}
            keyExtractor={(c) => c.id}
            renderItem={({ item }) => (
              <CommentItem
                comment={item}
                postOwnerId={post.userId}
                onReply={setReplyTo}
                onToggleLike={toggleLike}
                onEdit={edit}
                onDelete={remove}
              />
            )}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 8 }}
            keyboardShouldPersistTaps="handled"
          />
          <CommentInputArea
            text={text}
            onChange={setText}
            onSend={handleSend}
            sending={sending}
            replyTo={replyTo}
            onCancelReply={() => setReplyTo(null)}
            bottomInset={bottom}
          />
        </Animated.View>
      </Animated.View>
    </Modal>
  )
}

const s = StyleSheet.create({
  overlay:  { ...StyleSheet.absoluteFillObject, zIndex: 100, justifyContent: 'flex-end' },
  backdrop: { flex: 1, backgroundColor: 'transparent' },
  sheet:    { backgroundColor: colors.white, borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: height * 0.78 },
  handle:   { width: 40, height: 4, backgroundColor: colors.gray200, borderRadius: 2, alignSelf: 'center', marginBottom: spacing.sm },
  header:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  title:    { fontSize: 17, fontWeight: '600' as const, color: colors.gray800 },
  count:    { fontWeight: '800', color: colors.black },
})
