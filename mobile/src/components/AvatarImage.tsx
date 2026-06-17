import React from 'react'
import { View, Text, StyleSheet, ViewStyle } from 'react-native'
import { Image } from 'expo-image'
import { colors, fonts } from '../theme'
import { API_BASE } from '../config'

interface Props {
  uri: string | null | undefined
  name?: string | null
  size?: number
  style?: ViewStyle
  borderColor?: string
  borderWidth?: number
}

function initials(name?: string | null): string {
  if (!name?.trim()) return '?'
  const words = name.trim().split(/\s+/)
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase()
  return (words[0][0] + words[1][0]).toUpperCase()
}

export default function AvatarImage({ uri, name, size = 44, style, borderColor, borderWidth = 0 }: Props) {
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
      <Text style={[s.initials, { fontSize: size * 0.35 }]}>{initials(name)}</Text>
    </View>
  )
}

const s = StyleSheet.create({
  container:   { overflow: 'hidden' },
  placeholder: { backgroundColor: '#D8E6FA', alignItems: 'center', justifyContent: 'center' },
  initials:    { fontFamily: fonts.bold, color: '#CA2851', letterSpacing: 0.5 },
})
