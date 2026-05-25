import React, { useState } from 'react'
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { colors, spacing, radius } from '../../theme'
import VoiceRecorder from '../../components/VoiceRecorder'
import VoicePlayer from '../../components/VoicePlayer'
import * as msgService from '../../services/message.service'

interface Props {
  value: string
  onChange: (t: string) => void
  onSend: () => void
  paddingBottom: number
  otherUserId: string
}

export default function ChatInputBar({ value, onChange, onSend, paddingBottom, otherUserId }: Props) {
  const [voiceMode, setVoiceMode]         = useState(false)
  const [pendingVoice, setPendingVoice]   = useState<string | null>(null)
  const [sendingVoice, setSendingVoice]   = useState(false)

  async function handleSendVoice() {
    if (!pendingVoice) return
    setSendingVoice(true)
    try {
      await msgService.sendVoiceMessage(otherUserId, pendingVoice)
      setPendingVoice(null)
      setVoiceMode(false)
    } catch {}
    setSendingVoice(false)
  }

  if (voiceMode) {
    return (
      <View style={[s.row, { paddingBottom }]}>
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
    )
  }

  return (
    <View style={[s.row, { paddingBottom }]}>
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
  )
}

const s = StyleSheet.create({
  row:     { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.md, paddingTop: spacing.sm, borderTopWidth: 1, borderColor: colors.gray200, gap: spacing.sm },
  emoji:   { fontSize: 22 },
  input:   { flex: 1, backgroundColor: colors.gray100, borderRadius: radius.full, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, fontSize: 14, color: colors.gray800, maxHeight: 100 },
  send:       { backgroundColor: colors.dark, width: 38, height: 38, borderRadius: 19, justifyContent: 'center', alignItems: 'center' },
  iconBtn:    { padding: 4 },
  playerWrap: { flex: 1 },
})
