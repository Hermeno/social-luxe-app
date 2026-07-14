import React from 'react'
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { Comment } from '../../types'
import { colors, spacing, radius } from '../../theme'
import { useT } from '../../i18n'

interface Props {
  text: string; onChange: (t: string) => void; onSend: () => void
  sending: boolean; replyTo: Comment | null; onCancelReply: () => void
  bottomInset?: number
}

export default function CommentInputArea({ text, onChange, onSend, sending, replyTo, onCancelReply, bottomInset = 0 }: Props) {
  const t = useT()
  return (
    <>
      {replyTo && (
        <View style={s.replyBanner}>
          <Text style={s.replyText}>{t.comment_reply_to} {replyTo.user.name}</Text>
          <TouchableOpacity onPress={onCancelReply}>
            <Ionicons name="close-circle" size={18} color={colors.gray400} />
          </TouchableOpacity>
        </View>
      )}
      <View style={[s.inputRow, { paddingBottom: Math.max(bottomInset, 10) }]}>
        <TouchableOpacity style={s.iconBtn}><Text style={s.emoji}>😊</Text></TouchableOpacity>
        <TouchableOpacity style={s.iconBtn}><Text style={s.emoji}>@</Text></TouchableOpacity>
        <TextInput
          style={s.input}
          placeholder={t.comment_ph}
          placeholderTextColor={colors.gray400}
          value={text}
          onChangeText={onChange}
          multiline
          returnKeyType="send"
          onSubmitEditing={onSend}
        />
        <TouchableOpacity style={[s.sendBtn, !text && s.sendDisabled]} onPress={onSend} disabled={sending || !text}>
          <Ionicons name="send" size={18} color={colors.white} />
        </TouchableOpacity>
      </View>
    </>
  )
}

const s = StyleSheet.create({
  inputRow:     { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderTopWidth: 1, borderColor: colors.gray200, gap: spacing.sm },
  iconBtn:      { padding: 4 },
  emoji:        { fontSize: 18 },
  input:        { flex: 1, backgroundColor: colors.gray100, borderRadius: radius.full, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, fontSize: 14, color: colors.gray800, maxHeight: 80 },
  sendBtn:      { backgroundColor: colors.dark, width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center' },
  sendDisabled: { opacity: 0.4 },
  replyBanner:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.md, paddingVertical: spacing.xs, backgroundColor: colors.gray100 },
  replyText:    { fontSize: 12, color: colors.gray600 },
})
