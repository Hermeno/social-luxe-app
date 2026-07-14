import React from 'react'
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { colors, spacing, radius, fonts } from '../../theme'
import { useT } from '../../i18n'

interface Props { onPickImage: () => void; onPickVideo: () => void }

export default function PickButtons({ onPickImage, onPickVideo }: Props) {
  const t = useT()
  return (
    <View style={s.row}>
      <TouchableOpacity style={s.btn} onPress={onPickImage} activeOpacity={0.8}>
        <Ionicons name="image-outline" size={38} color={colors.primary} />
        <Text style={s.label}>{t.cr_photo}</Text>
      </TouchableOpacity>
      <TouchableOpacity style={s.btn} onPress={onPickVideo} activeOpacity={0.8}>
        <Ionicons name="videocam-outline" size={38} color={colors.primary} />
        <Text style={s.label}>{t.cr_video}</Text>
      </TouchableOpacity>
    </View>
  )
}

const s = StyleSheet.create({
  row:   { flexDirection: 'row', gap: spacing.md, padding: spacing.lg },
  btn:   {
    flex: 1,
    backgroundColor: '#1A1A1A',
    borderRadius: radius.lg,
    paddingVertical: 44,
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  label: { fontSize: 14, fontFamily: fonts.semiBold, color: 'rgba(255,255,255,0.7)' },
})
