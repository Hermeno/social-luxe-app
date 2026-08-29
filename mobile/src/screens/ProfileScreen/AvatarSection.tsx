import React from 'react'
import { View, Pressable, StyleSheet } from 'react-native'
import { Image } from 'expo-image'
import { Ionicons } from '@expo/vector-icons'
import { colors } from '../../theme'
import BrandAvatarRing from '../../components/BrandAvatarRing'

const AVATAR_SIZE = 88
const OUTER_SIZE = 96

const AVAIL_COLOR: Record<string, string> = {
  'Disponível': colors.success,
  'Ocupado':    colors.warning,
  'Ausente':    '#9E9E9E',
}

interface Props { uri: string | null; availability?: string | null; onPress: () => void }

export default function AvatarSection({ uri, availability, onPress }: Props) {
  const dotColor = availability ? (AVAIL_COLOR[availability] ?? colors.success) : undefined
  return (
    <Pressable style={s.wrap} onPress={onPress}>
      <BrandAvatarRing size={OUTER_SIZE} strokeWidth={2.5} style={s.ring} />
      {uri ? (
        <Image source={{ uri }} style={s.avatar} contentFit="cover" cachePolicy="disk" recyclingKey={uri} transition={80} />
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
  wrap:       { position: 'relative', width: OUTER_SIZE, height: OUTER_SIZE, alignItems: 'center', justifyContent: 'center' },
  ring:       { position: 'absolute', top: 0, left: 0 },
  avatar:     { width: AVATAR_SIZE, height: AVATAR_SIZE, borderRadius: AVATAR_SIZE / 2 },
  placeholder:{ backgroundColor: colors.gray100, alignItems: 'center', justifyContent: 'center' },
  cam:        { position: 'absolute', bottom: 0, right: 0, width: 26, height: 26, borderRadius: 13, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: colors.white },
  dot:        { position: 'absolute', top: 3, right: 3, width: 14, height: 14, borderRadius: 7, borderWidth: 2, borderColor: colors.white },
})
