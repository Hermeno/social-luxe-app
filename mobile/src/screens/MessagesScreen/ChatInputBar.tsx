import React, { useState } from 'react'
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native'
import * as Haptics from 'expo-haptics'
import { Ionicons } from '@expo/vector-icons'
import { colors, spacing, radius, fonts } from '../../theme'
import VoiceRecorder from '../../components/VoiceRecorder'
import VoicePlayer from '../../components/VoicePlayer'
import * as msgService from '../../services/message.service'

interface ReplyPreview {
  senderName: string
  content: string | null
}

interface Props {
  value: string
  onChange: (t: string) => void
  onSend: () => void
  paddingBottom: number
  otherUserId: string
  replyingTo: ReplyPreview | null
  onCancelReply: () => void
}

export default function ChatInputBar({ value, onChange, onSend, paddingBottom, otherUserId, replyingTo, onCancelReply }: Props) {
  const [voiceMode, setVoiceMode]         = useState(false)
  const [pendingVoice, setPendingVoice]   = useState<string | null>(null)
  const [sendingVoice, setSendingVoice]   = useState(false)

  async function handleSendVoice() {
    if (!pendingVoice) return
    setSendingVoice(true)
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
      await msgService.sendVoiceMessage(otherUserId, pendingVoice)
      setPendingVoice(null)
      setVoiceMode(false)
    } catch {}
    setSendingVoice(false)
  }

  if (voiceMode) {
    return (
      <View style={[s.wrapper, { paddingBottom }]}>
        <View style={s.row}>
          {pendingVoice ? (
            <>
              <View style={s.playerWrap}>
                <VoicePlayer uri={pendingVoice} />
              </View>
              <TouchableOpacity style={s.iconBtn} onPress={() => setPendingVoice(null)}>
                <Ionicons name="trash-outline" size={20} color={colors.gray600} />
              </TouchableOpacity>
              <TouchableOpacity style={s.send} onPress={handleSendVoice} disabled={sendingVoice}>
                <Ionicons name="send" size={18} color={colors.white} />
              </TouchableOpacity>
            </>
          ) : (
            <>
              <View style={s.playerWrap}>
                <VoiceRecorder onRecordingComplete={setPendingVoice} />
              </View>
              <TouchableOpacity style={s.iconBtn} onPress={() => setVoiceMode(false)}>
                <Ionicons name="close" size={22} color={colors.gray600} />
              </TouchableOpacity>
            </>
          )}
        </View>
      </View>
    )
  }

  return (
    <View style={[s.wrapper, { paddingBottom }]}>
      {/* Reply preview bar */}
      {replyingTo && (
        <View style={s.replyBar}>
          <View style={s.replyBarInner}>
            <Text style={s.replyBarName}>{replyingTo.senderName}</Text>
            <Text style={s.replyBarContent} numberOfLines={1}>
              {replyingTo.content ?? '🎤 Voz'}
            </Text>
          </View>
          <TouchableOpacity onPress={onCancelReply} hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}>
            <Ionicons name="close-circle" size={18} color={colors.gray400} />
          </TouchableOpacity>
        </View>
      )}
      <View style={s.row}>
        <TouchableOpacity><Text style={s.emoji}>😊</Text></TouchableOpacity>
        <TouchableOpacity onPress={() => setVoiceMode(true)}>
          <Ionicons name="mic-outline" size={22} color={colors.gray600} />
        </TouchableOpacity>
        <TextInput
          style={s.input}
          placeholder="Escreva sua mensagem..."
          placeholderTextColor={colors.gray400}
          value={value}
          onChangeText={onChange}
          multiline
        />
        <TouchableOpacity style={s.send} onPress={onSend}>
          <Ionicons name="send" size={18} color={colors.white} />
        </TouchableOpacity>
      </View>
    </View>
  )
}

const s = StyleSheet.create({
  wrapper:     { borderTopWidth: 1, borderColor: colors.gray200 },
  row:         { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.md, paddingTop: spacing.sm, gap: spacing.sm },
  emoji:       { fontSize: 22 },
  input:       { flex: 1, backgroundColor: colors.gray100, borderRadius: radius.full, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, fontSize: 14, color: colors.gray800, maxHeight: 100 },
  send:        { backgroundColor: colors.dark, width: 38, height: 38, borderRadius: 19, justifyContent: 'center', alignItems: 'center' },
  iconBtn:     { padding: 4 },
  playerWrap:  { flex: 1 },
  // Reply bar
  replyBar:    { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.md, paddingVertical: 8, gap: 8, backgroundColor: '#F8F8F8' },
  replyBarInner: { flex: 1, borderLeftWidth: 3, borderLeftColor: colors.primary, paddingLeft: 8 },
  replyBarName:  { fontSize: 12, fontFamily: fonts.semiBold, color: colors.primary },
  replyBarContent: { fontSize: 12, fontFamily: fonts.regular, color: colors.gray600 },
})
