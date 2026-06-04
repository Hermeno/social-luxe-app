import React from 'react'
import { View, StyleSheet, ViewStyle } from 'react-native'
import { Image } from 'expo-image'
import { Ionicons } from '@expo/vector-icons'
import { colors } from '../theme'
import { API_BASE } from '../config'

interface Props {
  uri: string | null | undefined
  size?: number
  style?: ViewStyle
  borderColor?: string
  borderWidth?: number
}

export default function AvatarImage({ uri, size = 44, style, borderColor, borderWidth = 0 }: Props) {
  const radius = size / 2
  const resolvedUri = uri
    ? uri.startsWith('http') || uri.startsWith('file') ? uri : `${API_BASE}${uri}`
    : null

  const containerStyle = [
    s.container,
    {
      width: size,
      height: size,
      borderRadius: radius,
      borderColor: borderColor ?? 'transparent',
      borderWidth,
    },
    style,
  ]

  if (resolvedUri) {
    return (
      <Image
        source={{ uri: resolvedUri }}
        style={containerStyle as any}
        contentFit="cover"
        cachePolicy="disk"
        recyclingKey={resolvedUri}
        transition={80}
      />
    )
  }

  return (
    <View style={[containerStyle, s.placeholder]}>
      <Ionicons name="person" size={size * 0.45} color={colors.gray400} />
    </View>
  )
}

const s = StyleSheet.create({
  container:   { overflow: 'hidden' },
  placeholder: { backgroundColor: '#E8E8E8', alignItems: 'center', justifyContent: 'center' },
})
