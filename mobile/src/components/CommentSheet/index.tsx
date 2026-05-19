import React, { useEffect, useState, useRef } from 'react'
import { View, Text, TouchableOpacity, FlatList, StyleSheet, Animated, Dimensions, KeyboardAvoidingView, Platform } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { Post, Comment } from '../../types'
import { useComments } from '../../hooks/useComments'
import CommentItem from './CommentItem'
import CommentInputArea from './CommentInputArea'
import { colors, spacing } from '../../theme'

const { height } = Dimensions.get('window')
interface Props { post: Post; onClose: () => void }

export default function CommentSheet({ post, onClose }: Props) {
  const { comments, loading, sending, load, send } = useComments(post.id)
  const [text, setText] = useState('')
  const [replyTo, setReplyTo] = useState<Comment | null>(null)
  const slideAnim = useRef(new Animated.Value(height)).current

  useEffect(() => {
    load()
    Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, damping: 20 }).start()
  }, [])

  function handleClose() {
    Animated.timing(slideAnim, { toValue: height, useNativeDriver: true, duration: 250 }).start(onClose)
  }

  async function handleSend() {
    await send(text, replyTo?.id)
    setText(''); setReplyTo(null)
  }

  const fmt = (n: number) => n >= 1000 ? `${(n / 1000).toFixed(0)}K` : String(n)

  return (
    <View style={s.overlay}>
      <TouchableOpacity style={s.backdrop} onPress={handleClose} activeOpacity={1} />
      <Animated.View style={[s.sheet, { transform: [{ translateY: slideAnim }] }]}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
          <View style={s.header}>
            <Text style={s.title}><Text style={s.count}>{fmt(post._count.comments)}</Text> Comentários</Text>
            <TouchableOpacity onPress={handleClose}>
              <Ionicons name="close" size={22} color={colors.gray800} />
            </TouchableOpacity>
          </View>
          <View style={s.handle} />
          <FlatList data={comments} keyExtractor={(c) => c.id}
            renderItem={({ item }) => <CommentItem comment={item} onReply={setReplyTo} />}
            showsVerticalScrollIndicator={false} />
          <CommentInputArea text={text} onChange={setText} onSend={handleSend}
            sending={sending} replyTo={replyTo} onCancelReply={() => setReplyTo(null)} />
        </KeyboardAvoidingView>
      </Animated.View>
    </View>
  )
}

const s = StyleSheet.create({
  overlay:  { ...StyleSheet.absoluteFillObject, zIndex: 100 },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.3)' },
  sheet:    { backgroundColor: colors.white, borderTopLeftRadius: 20, borderTopRightRadius: 20, height: height * 0.7, paddingBottom: 20 },
  handle:   { width: 40, height: 4, backgroundColor: colors.gray200, borderRadius: 2, alignSelf: 'center', marginBottom: spacing.sm },
  header:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  title:    { fontSize: 17, fontWeight: '600' as const, color: colors.gray800 },
  count:    { fontWeight: '800', color: colors.black },
})
