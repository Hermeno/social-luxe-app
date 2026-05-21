import React from 'react'
import { View, Image, StyleSheet, Dimensions, TouchableOpacity, Text } from 'react-native'
import { VideoView, useVideoPlayer } from 'expo-video'
import { Ionicons } from '@expo/vector-icons'
import { colors, radius, fonts } from '../../theme'

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
      <TouchableOpacity style={s.removeBtn} onPress={onRemove} activeOpacity={0.8}>
        <View style={s.removeCircle}>
          <Ionicons name="close" size={18} color={colors.white} />
        </View>
      </TouchableOpacity>
      <View style={s.badge}>
        <Text style={s.badgeText}>{type === 'video' ? 'Vídeo' : 'Foto'}</Text>
      </View>
    </View>
  )
}

const s = StyleSheet.create({
  container:   { width, height: PREVIEW_H, backgroundColor: colors.black },
  media:       { width: '100%', height: '100%' },
  removeBtn:   { position: 'absolute', top: 14, right: 14 },
  removeCircle:{
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: 'rgba(0,0,0,0.65)',
    alignItems: 'center', justifyContent: 'center',
  },
  badge:       {
    position: 'absolute', bottom: 14, left: 14,
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderRadius: radius.sm, paddingHorizontal: 10, paddingVertical: 5,
  },
  badgeText:   { color: colors.white, fontFamily: fonts.semiBold, fontSize: 12 },
})
