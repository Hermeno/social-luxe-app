import React, { useState } from 'react'
import { View, Text, TouchableOpacity, TextInput, StyleSheet } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { Comment } from '../../types'
import { colors, fonts, spacing } from '../../theme'
import { useT } from '../../i18n'
import { useAuthStore } from '../../store/auth.store'
import { confirm } from '../confirm'
import AvatarImage from '../AvatarImage'

interface Props {
  comment: Comment
  postOwnerId?: string
  onReply?: (comment: Comment) => void
  onToggleLike?: (id: string) => void
  onEdit?: (id: string, content: string) => void
  onDelete?: (id: string) => void
}

function timeAgo(date: string) {
  const diff = Date.now() - new Date(date).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'agora'
  if (m < 60) return `${m}m`
  if (m < 1440) return `${Math.floor(m / 60)}h`
  return `${Math.floor(m / 1440)}d`
}

export default function CommentItem({
  comment, postOwnerId, onReply, onToggleLike, onEdit, onDelete,
}: Props) {
  const t = useT()
  const me = useAuthStore((s) => s.user)
  const [editing, setEditing] = useState(false)
  const [draft,   setDraft]   = useState(comment.content)

  const isMine   = me?.id === comment.userId
  const canDelete = isMine || (!!postOwnerId && me?.id === postOwnerId)
  const pending   = comment.id.startsWith('temp-')

  async function handleDelete() {
    const okToDelete = await confirm({
      title: t.cmt_del_title, message: t.cmt_del_msg,
      confirmText: t.delete, cancelText: t.cancel,
      destructive: true, icon: 'trash-outline',
    })
    if (okToDelete) onDelete?.(comment.id)
  }

  function saveEdit() {
    const next = draft.trim()
    setEditing(false)
    if (next && next !== comment.content) onEdit?.(comment.id, next)
    else setDraft(comment.content)
  }

  return (
    <View style={s.container}>
      <AvatarImage uri={comment.user.avatar} name={comment.user.name} size={36} />

      <View style={s.body}>
        <Text style={s.name}>{comment.user.name}</Text>

        {editing ? (
          <View style={s.editWrap}>
            <TextInput
              style={s.editInput}
              value={draft}
              onChangeText={setDraft}
              multiline
              autoFocus
              maxLength={500}
              placeholderTextColor={colors.gray400}
            />
            <View style={s.editBtns}>
              <TouchableOpacity onPress={() => { setEditing(false); setDraft(comment.content) }}>
                <Text style={s.editCancel}>{t.cancel}</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={saveEdit}>
                <Text style={s.editSave}>{t.save}</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <Text style={s.text}>{comment.content}</Text>
        )}

        {!editing && (
          <View style={s.meta}>
            <Text style={s.time}>{timeAgo(comment.createdAt)}</Text>
            {!!comment.editedAt && <Text style={s.edited}>{t.cmt_edited}</Text>}

            {!pending && (
              <TouchableOpacity onPress={() => onReply?.(comment)} hitSlop={HIT}>
                <Text style={s.action}>{t.chat_reply}</Text>
              </TouchableOpacity>
            )}
            {isMine && !pending && (
              <TouchableOpacity onPress={() => { setDraft(comment.content); setEditing(true) }} hitSlop={HIT}>
                <Text style={s.action}>{t.edit}</Text>
              </TouchableOpacity>
            )}
            {canDelete && !pending && (
              <TouchableOpacity onPress={handleDelete} hitSlop={HIT}>
                <Text style={[s.action, s.danger]}>{t.delete}</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {comment.replies?.map((r) => (
          <CommentItem
            key={r.id}
            comment={r}
            postOwnerId={postOwnerId}
            onReply={onReply}
            onToggleLike={onToggleLike}
            onEdit={onEdit}
            onDelete={onDelete}
          />
        ))}
      </View>

      {/* Gosto — agora é mesmo um botão */}
      <TouchableOpacity
        style={s.likeCol}
        onPress={() => onToggleLike?.(comment.id)}
        disabled={pending}
        hitSlop={HIT}
        activeOpacity={0.7}
      >
        <Ionicons
          name={comment.likedByMe ? 'heart' : 'heart-outline'}
          size={16}
          color={comment.likedByMe ? colors.primary : colors.gray400}
        />
        {(comment.likeCount ?? 0) > 0 && (
          <Text style={[s.likeCount, comment.likedByMe && s.likeCountOn]}>{comment.likeCount}</Text>
        )}
      </TouchableOpacity>
    </View>
  )
}

const HIT = { top: 8, bottom: 8, left: 8, right: 8 }

const s = StyleSheet.create({
  container: { flexDirection: 'row', paddingVertical: spacing.sm, paddingHorizontal: spacing.md, gap: spacing.sm },
  body: { flex: 1, gap: 3 },
  name: { fontSize: 12, fontFamily: fonts.semiBold, color: colors.gray800 },
  text: { fontSize: 14, color: colors.gray800, lineHeight: 18 },

  meta:   { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginTop: 1 },
  time:   { fontSize: 11, color: colors.gray400 },
  edited: { fontSize: 11, color: colors.gray400, fontStyle: 'italic' },
  action: { fontSize: 11, color: colors.gray600, fontFamily: fonts.semiBold },
  danger: { color: '#FF3B30' },

  editWrap:  { gap: 6 },
  editInput: {
    fontSize: 14, color: colors.gray800, lineHeight: 18,
    backgroundColor: '#F4F4F6', borderRadius: 10,
    paddingHorizontal: 10, paddingVertical: 8, minHeight: 38,
  },
  editBtns:   { flexDirection: 'row', gap: spacing.md, justifyContent: 'flex-end' },
  editCancel: { fontSize: 12, color: colors.gray500, fontFamily: fonts.semiBold },
  editSave:   { fontSize: 12, color: colors.primary, fontFamily: fonts.semiBold },

  likeCol:      { alignItems: 'center', paddingTop: 4, gap: 2, minWidth: 26 },
  likeCount:    { fontSize: 10, color: colors.gray400, fontFamily: fonts.semiBold },
  likeCountOn:  { color: colors.primary },
})
