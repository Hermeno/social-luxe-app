import React, { useEffect, useState, useRef } from 'react'
import {
  View, Text, TouchableOpacity, FlatList, StyleSheet,
  Animated, Dimensions, KeyboardAvoidingView, Platform,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { Post, Comment } from '../../types'
import { useComments } from '../../hooks/useComments'
import CommentItem from './CommentItem'
import CommentInputArea from './CommentInputArea'
import { colors, spacing } from '../../theme'

const { height } = Dimensions.get('window')
interface Props { post: Post; onClose: () => void; onCommentAdded?: () => void }

export default function CommentSheet({ post, onClose, onCommentAdded }: Props) {
  const { comments, loading, sending, load, send } = useComments(post.id)
  const [text, setText] = useState('')
  const [replyTo, setReplyTo] = useState<Comment | null>(null)
  const slideAnim = useRef(new Animated.Value(height)).current
  const { bottom } = useSafeAreaInsets()

  useEffect(() => {
    load()
    Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, damping: 20 }).start()
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
    <KeyboardAvoidingView
      style={s.overlay}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={0}
    >
      <TouchableOpacity style={s.backdrop} onPress={handleClose} activeOpacity={1} />
      <Animated.View style={[s.sheet, { transform: [{ translateY: slideAnim }] }]}>
        <View style={s.header}>
          <Text style={s.title}><Text style={s.count}>{fmt(post._count.comments)}</Text> Comentários</Text>
          <TouchableOpacity onPress={handleClose}>
            <Ionicons name="close" size={22} color={colors.gray800} />
          </TouchableOpacity>
        </View>
        <View style={s.handle} />
        <FlatList
          data={comments}
          keyExtractor={(c) => c.id}
          renderItem={({ item }) => <CommentItem comment={item} onReply={setReplyTo} />}
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
    </KeyboardAvoidingView>
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
