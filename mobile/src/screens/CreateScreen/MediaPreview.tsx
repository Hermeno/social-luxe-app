import React from 'react'
import { View, Image, StyleSheet, Dimensions, TouchableOpacity, Text } from 'react-native'
import { VideoView, useVideoPlayer } from 'expo-video'
import { Ionicons } from '@expo/vector-icons'
import { colors, radius } from '../../theme'

const { width } = Dimensions.get('window')
const PREVIEW_H = width * 1.2

interface Props {
  uri: string
  type: 'image' | 'video'
  onRemove: () => void
}

export default function MediaPreview({ uri, type, onRemove }: Props) {
  const player = useVideoPlayer(
    type === 'video' ? { uri } : null,
    (p) => { p.loop = true; p.play() }
  )

  return (
    <View style={s.container}>
      {type === 'video' ? (
        <VideoView player={player} style={s.media} contentFit="cover" nativeControls={false} />
      ) : (
        <Image source={{ uri }} style={s.media} resizeMode="cover" />
      )}
      <TouchableOpacity style={s.removeBtn} onPress={onRemove}>
        <Ionicons name="close-circle" size={28} color={colors.white} />
      </TouchableOpacity>
      <View style={s.badge}>
        <Text style={s.badgeText}>{type === 'video' ? 'Vídeo' : 'Foto'}</Text>
      </View>
    </View>
  )
}

const s = StyleSheet.create({
  container: { width, height: PREVIEW_H, backgroundColor: colors.black },
  media: { width: '100%', height: '100%' },
  removeBtn: { position: 'absolute', top: 12, right: 12 },
  badge: {
    position: 'absolute', bottom: 12, left: 12,
    backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: radius.sm, paddingHorizontal: 10, paddingVertical: 4,
  },
  badgeText: { color: colors.white, fontSize: 12, fontWeight: '600' },
})
