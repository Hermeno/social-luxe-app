import React from 'react'
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { colors, spacing, radius } from '../../theme'

interface Props { value: string; onChange: (t: string) => void; onSend: () => void; paddingBottom: number }

export default function ChatInputBar({ value, onChange, onSend, paddingBottom }: Props) {
  return (
    <View style={[s.row, { paddingBottom }]}>
      <TouchableOpacity><Text style={s.emoji}>😊</Text></TouchableOpacity>
      <TouchableOpacity><Text style={s.at}>@</Text></TouchableOpacity>
      <TextInput style={s.input} placeholder="Escreva sua mensagem..." placeholderTextColor={colors.gray400}
        value={value} onChangeText={onChange} />
      <TouchableOpacity style={s.send} onPress={onSend}>
        <Ionicons name="send" size={18} color={colors.white} />
      </TouchableOpacity>
    </View>
  )
}

const s = StyleSheet.create({
  row:   { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.md, paddingTop: spacing.sm, borderTopWidth: 1, borderColor: colors.gray200, gap: spacing.sm },
  emoji: { fontSize: 22 },
  at:    { fontSize: 18, color: colors.gray800, fontWeight: '600' as const },
  input: { flex: 1, backgroundColor: colors.gray100, borderRadius: radius.full, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, fontSize: 14, color: colors.gray800 },
  send:  { backgroundColor: colors.dark, width: 38, height: 38, borderRadius: 19, justifyContent: 'center', alignItems: 'center' },
})
