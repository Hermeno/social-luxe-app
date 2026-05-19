import React from 'react'
import { View, Image, Pressable, StyleSheet } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { colors } from '../../theme'

const AVAIL_COLOR: Record<string, string> = {
  'Disponível': '#4CAF50',
  'Ocupado':    '#FF9800',
  'Ausente':    '#9E9E9E',
}

interface Props { uri: string | null; availability?: string | null; onPress: () => void }

export default function AvatarSection({ uri, availability, onPress }: Props) {
  const dotColor = availability ? (AVAIL_COLOR[availability] ?? '#4CAF50') : undefined
  return (
    <Pressable style={s.wrap} onPress={onPress}>
      {uri ? (
        <Image source={{ uri }} style={s.avatar} />
      ) : (
        <View style={[s.avatar, s.placeholder]}>
          <Ionicons name="person" size={36} color={colors.gray400} />
        </View>
      )}
      <View style={s.cam}>
        <Ionicons name="camera-outline" size={13} color={colors.white} />
      </View>
      {dotColor && <View style={[s.dot, { backgroundColor: dotColor }]} />}
    </Pressable>
  )
}

const s = StyleSheet.create({
  wrap:       { position: 'relative', width: 80, height: 80 },
  avatar:     { width: 80, height: 80, borderRadius: 40, borderWidth: 2, borderColor: colors.primary },
  placeholder:{ backgroundColor: colors.gray100, alignItems: 'center', justifyContent: 'center' },
  cam:        { position: 'absolute', bottom: 0, right: 0, width: 24, height: 24, borderRadius: 12, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: colors.white },
  dot:        { position: 'absolute', top: 2, right: 2, width: 14, height: 14, borderRadius: 7, borderWidth: 2, borderColor: colors.white },
})
