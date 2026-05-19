import React from 'react'
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { colors, spacing, radius } from '../../theme'

interface Props { onPickImage: () => void; onPickVideo: () => void }

export default function PickButtons({ onPickImage, onPickVideo }: Props) {
  return (
    <View style={s.row}>
      <TouchableOpacity style={s.btn} onPress={onPickImage}>
        <Ionicons name="image-outline" size={36} color={colors.primary} />
        <Text style={s.label}>Foto</Text>
      </TouchableOpacity>
      <TouchableOpacity style={s.btn} onPress={onPickVideo}>
        <Ionicons name="videocam-outline" size={36} color={colors.primary} />
        <Text style={s.label}>Vídeo</Text>
      </TouchableOpacity>
    </View>
  )
}

const s = StyleSheet.create({
  row:   { flexDirection: 'row', gap: spacing.md, padding: spacing.lg },
  btn:   { flex: 1, backgroundColor: colors.gray100, borderRadius: radius.lg, paddingVertical: 40, alignItems: 'center', gap: 8 },
  label: { fontSize: 14, fontWeight: '600', color: colors.gray600 },
})
