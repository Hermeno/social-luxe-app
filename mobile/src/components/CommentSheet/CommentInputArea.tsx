import React from 'react'
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { Comment } from '../../types'
import { colors, fonts } from '../../theme'
import { useT } from '../../i18n'
import { useAuthStore } from '../../store/auth.store'
import AvatarImage from '../AvatarImage'

interface Props {
  text: string
  onChange: (t: string) => void
  onSend: () => void
  sending: boolean
  replyTo: Comment | null
  onCancelReply: () => void
  bottomInset?: number
  inputRef?: React.RefObject<TextInput | null>
}

export default function CommentInputArea({
  text, onChange, onSend, sending, replyTo, onCancelReply,
  bottomInset = 0, inputRef,
}: Props) {
  const t  = useT()
  const me = useAuthStore((s) => s.user)
  const canSend = text.trim().length > 0 && !sending

  return (
    <View style={[s.wrap, { paddingBottom: Math.max(bottomInset, 10) }]}>
      {/* A quem estou a responder — some com um toque */}
      {replyTo && (
        <View style={s.replyRow}>
          <View style={s.replyBar} />
          <Text style={s.replyTxt} numberOfLines={1}>
            {t.comment_reply_to} <Text style={s.replyName}>{replyTo.user.name}</Text>
          </Text>
          <TouchableOpacity onPress={onCancelReply} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Ionicons name="close" size={15} color="rgba(0,0,0,0.35)" />
          </TouchableOpacity>
        </View>
      )}

      <View style={s.row}>
        <AvatarImage uri={me?.avatar ?? null} name={me?.name ?? ''} size={30} />

        <View style={s.field}>
          <TextInput
            ref={inputRef as any}
            style={s.input}
            placeholder={t.comment_ph}
            placeholderTextColor="rgba(0,0,0,0.32)"
            value={text}
            onChangeText={onChange}
            multiline
            maxLength={500}
          />
        </View>

        {/* O botão só ganha cor quando há algo para enviar */}
        <TouchableOpacity
          style={[s.send, canSend ? s.sendOn : s.sendOff]}
          onPress={onSend}
          disabled={!canSend}
          activeOpacity={0.8}
        >
          {sending
            ? <ActivityIndicator size="small" color="#fff" />
            : <Ionicons name="arrow-up" size={18} color={canSend ? '#fff' : 'rgba(0,0,0,0.3)'} />}
        </TouchableOpacity>
      </View>
    </View>
  )
}

const s = StyleSheet.create({
  wrap: {
    backgroundColor: colors.white,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(0,0,0,0.09)',
    paddingTop: 10,
    paddingHorizontal: 14,
    gap: 9,
  },

  replyRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingLeft: 2,
  },
  replyBar:  { width: 2.5, height: 16, borderRadius: 2, backgroundColor: colors.primary },
  replyTxt:  { flex: 1, fontFamily: fonts.regular, fontSize: 12, color: 'rgba(0,0,0,0.45)' },
  replyName: { fontFamily: fonts.semiBold, color: colors.black },

  row: { flexDirection: 'row', alignItems: 'flex-end', gap: 9 },

  field: {
    flex: 1,
    backgroundColor: '#F7F7F7',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    minHeight: 38,
    justifyContent: 'center',
  },
  input: {
    fontFamily: fonts.regular, fontSize: 14.5, color: '#333',
    padding: 0, maxHeight: 96,
  },

  send: {
    width: 34, height: 34, borderRadius: 17,
    alignItems: 'center', justifyContent: 'center',
  },
  sendOn:  { backgroundColor: colors.primary },
  sendOff: { backgroundColor: '#F0F0F0' },
})
