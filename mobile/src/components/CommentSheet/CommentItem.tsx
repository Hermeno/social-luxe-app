import React, { useState } from 'react'
import { View, Text, TouchableOpacity, TextInput, StyleSheet } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { Comment } from '../../types'
import { colors, fonts } from '../../theme'
import { useT } from '../../i18n'
import { useAuthStore } from '../../store/auth.store'
import { confirm } from '../confirm'
import AvatarImage from '../AvatarImage'

const HIT = { top: 10, bottom: 10, left: 10, right: 10 }

interface Props {
  comment: Comment
  postOwnerId?: string
  depth?: number
  onReply?: (comment: Comment) => void
  onToggleLike?: (id: string) => void
  onEdit?: (id: string, content: string) => void
  onDelete?: (id: string) => void
}

function timeAgo(iso: string, justNow: string) {
  const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000)
  if (m < 1)    return justNow
  if (m < 60)   return `${m}m`
  if (m < 1440) return `${Math.floor(m / 60)}h`
  return `${Math.floor(m / 1440)}d`
}

export default function CommentItem({
  comment, postOwnerId, depth = 0,
  onReply, onToggleLike, onEdit, onDelete,
}: Props) {
  const t  = useT()
  const me = useAuthStore((s) => s.user)

  const [editing, setEditing] = useState(false)
  const [draft,   setDraft]   = useState(comment.content)

  const isMine    = me?.id === comment.userId
  const canDelete = isMine || (!!postOwnerId && me?.id === postOwnerId)
  const pending   = comment.id.startsWith('temp-')
  const likes     = comment.likeCount ?? 0

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
    <View style={[s.row, depth > 0 && s.nested]}>
      <AvatarImage uri={comment.user.avatar} name={comment.user.name} size={depth > 0 ? 28 : 34} />

      <View style={s.body}>
        {/* Bolha: nome e texto juntos, como uma unidade de leitura */}
        <View style={[s.bubble, pending && s.bubblePending]}>
          <Text style={s.name} numberOfLines={1}>{comment.user.name}</Text>

          {editing ? (
            <TextInput
              style={s.editInput}
              value={draft}
              onChangeText={setDraft}
              multiline
              autoFocus
              maxLength={500}
            />
          ) : (
            <Text style={s.text}>{comment.content}</Text>
          )}
        </View>

        {/* Ações: discretas, só texto, aparecem por baixo da bolha */}
        {editing ? (
          <View style={s.actions}>
            <TouchableOpacity onPress={() => { setEditing(false); setDraft(comment.content) }} hitSlop={HIT}>
              <Text style={s.action}>{t.cancel}</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={saveEdit} hitSlop={HIT}>
              <Text style={[s.action, s.actionStrong]}>{t.save}</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={s.actions}>
            <Text style={s.time}>{timeAgo(comment.createdAt, t.cmt_now)}</Text>
            {!!comment.editedAt && <Text style={s.time}>{t.cmt_edited}</Text>}

            {!pending && depth === 0 && (
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
                <Text style={[s.action, s.actionDanger]}>{t.delete}</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {comment.replies?.map((r) => (
          <CommentItem
            key={r.id}
            comment={r}
            postOwnerId={postOwnerId}
            depth={depth + 1}
            onReply={onReply}
            onToggleLike={onToggleLike}
            onEdit={onEdit}
            onDelete={onDelete}
          />
        ))}
      </View>

      {/* Gosto — coluna própria à direita, alinhada com a bolha */}
      <TouchableOpacity
        style={s.like}
        onPress={() => onToggleLike?.(comment.id)}
        disabled={pending}
        hitSlop={HIT}
        activeOpacity={0.6}
      >
        <Ionicons
          name={comment.likedByMe ? 'heart' : 'heart-outline'}
          size={15}
          color={comment.likedByMe ? colors.primary : 'rgba(0,0,0,0.28)'}
        />
        {likes > 0 && (
          <Text style={[s.likeCount, comment.likedByMe && s.likeCountOn]}>{likes}</Text>
        )}
      </TouchableOpacity>
    </View>
  )
}

const s = StyleSheet.create({
  row:    { flexDirection: 'row', gap: 10, paddingHorizontal: 16, paddingVertical: 7 },
  nested: { paddingHorizontal: 0, paddingRight: 0, marginTop: 8 },
  body:   { flex: 1, gap: 4 },

  // Bolha cinzenta muito clara — separa o comentário do branco sem pesar
  bubble: {
    backgroundColor: '#F7F7F7',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 9,
    gap: 2,
    alignSelf: 'flex-start',
    maxWidth: '100%',
  },
  bubblePending: { opacity: 0.55 },

  name: { fontFamily: fonts.semiBold, fontSize: 12.5, color: colors.black, letterSpacing: -0.1 },
  text: { fontFamily: fonts.regular, fontSize: 14, color: '#333', lineHeight: 19 },

  editInput: {
    fontFamily: fonts.regular, fontSize: 14, color: '#333', lineHeight: 19,
    padding: 0, minHeight: 20,
  },

  actions: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingLeft: 4 },
  time:    { fontFamily: fonts.regular, fontSize: 11.5, color: 'rgba(0,0,0,0.35)' },
  action:  { fontFamily: fonts.semiBold, fontSize: 11.5, color: 'rgba(0,0,0,0.45)' },
  actionStrong: { color: colors.primary },
  actionDanger: { color: 'rgba(255,59,48,0.85)' },

  like:        { alignItems: 'center', paddingTop: 12, gap: 2, width: 26 },
  likeCount:   { fontFamily: fonts.semiBold, fontSize: 10.5, color: 'rgba(0,0,0,0.35)' },
  likeCountOn: { color: colors.primary },
})
