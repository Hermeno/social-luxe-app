import React from 'react'
import { View, Text, Image, TouchableOpacity, StyleSheet } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { Comment } from '../../types'
import { colors, spacing } from '../../theme'

interface Props {
  comment: Comment
  onReply?: (comment: Comment) => void
}

function timeAgo(date: string) {
  const diff = Date.now() - new Date(date).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 60) return `${m}m`
  if (m < 1440) return `${Math.floor(m / 60)}h`
  return `${Math.floor(m / 1440)}d`
}

export default function CommentItem({ comment, onReply }: Props) {
  const avatarUri = comment.user.avatar ??
    `https://ui-avatars.com/api/?name=${comment.user.name}&background=FF4B6E&color=fff&size=64`

  return (
    <View style={s.container}>
      <Image source={{ uri: avatarUri }} style={s.avatar} />
      <View style={s.body}>
        <Text style={s.name}>{comment.user.name}</Text>
        <Text style={s.text}>{comment.content}</Text>
        <View style={s.meta}>
          <Text style={s.time}>{timeAgo(comment.createdAt)}</Text>
          <TouchableOpacity onPress={() => onReply?.(comment)}>
            <Text style={s.reply}>Responder</Text>
          </TouchableOpacity>
        </View>
        {comment.replies?.map((r) => (
          <CommentItem key={r.id} comment={r} />
        ))}
      </View>
      <View style={s.likeCol}>
        <Ionicons name="heart-outline" size={16} color={colors.gray400} />
      </View>
    </View>
  )
}

const s = StyleSheet.create({
  container: { flexDirection: 'row', paddingVertical: spacing.sm, paddingHorizontal: spacing.md, gap: spacing.sm },
  avatar: { width: 36, height: 36, borderRadius: 18 },
  body: { flex: 1, gap: 3 },
  name: { fontSize: 12, fontWeight: '600' as const, color: colors.gray800 },
  text: { fontSize: 14, color: colors.gray800, lineHeight: 18 },
  meta: { flexDirection: 'row', gap: spacing.md },
  time: { fontSize: 11, color: colors.gray400 },
  reply: { fontSize: 11, color: colors.gray600, fontWeight: '600' as const },
  likeCol: { alignItems: 'center', paddingTop: 4 },
})
