import React, { useState } from 'react'
import {
  View, Text, StyleSheet, Pressable, FlatList,
  NativeSyntheticEvent, NativeScrollEvent,
} from 'react-native'
import { Image } from 'expo-image'
import { API_BASE } from '../../config'

const EMOJI_FRAC = 0.14

type Overlay = { emoji: string; x: number; y: number }

function resolve(url: string) {
  return url.startsWith('http') || url.startsWith('file') ? url : `${API_BASE}${url}`
}

// Uma foto do carrossel — full-bleed, com os emojis fixados por cima.
function Slide({
  url, overlays, width, onPress,
}: {
  url: string
  overlays?: Overlay[]
  width: number
  onPress?: () => void
}) {
  const [size, setSize] = useState({ w: 0, h: 0 })
  const es = size.w * EMOJI_FRAC
  return (
    <Pressable
      style={{ width }}
      onPress={onPress}
      onLayout={(e) => setSize({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}
    >
      <Image
        source={{ uri: resolve(url) }}
        style={StyleSheet.absoluteFill}
        contentFit="contain"
        cachePolicy="disk"
        recyclingKey={url}
        transition={140}
      />
      {size.w > 0 && (overlays ?? []).map((o, k) => (
        <Text key={k} style={{ position: 'absolute', left: o.x * size.w - es / 2, top: o.y * size.h - es / 2, fontSize: es }}>
          {o.emoji}
        </Text>
      ))}
    </Pressable>
  )
}

interface Props {
  urls: string[]
  overlays?: Overlay[][]   // emojis por foto, paralelo a urls
  onOpen?: (index: number) => void
  dotsBottom?: number      // distância dos pontinhos ao fundo (limpa a barra do autor)
}

// Carrossel estilo Instagram — desliza esquerda↔direita, pontinhos em baixo.
export default function PostAlbumCarousel({ urls, overlays, onOpen, dotsBottom = 14 }: Props) {
  const [w, setW]         = useState(0)
  const [index, setIndex] = useState(0)
  const n = urls.length

  function onScrollEnd(e: NativeSyntheticEvent<NativeScrollEvent>) {
    if (w > 0) setIndex(Math.round(e.nativeEvent.contentOffset.x / w))
  }

  return (
    <View style={s.root} onLayout={(e) => setW(e.nativeEvent.layout.width)}>
      {w > 0 && (
        <FlatList
          data={urls}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          keyExtractor={(u, i) => `${i}_${u}`}
          getItemLayout={(_, i) => ({ length: w, offset: w * i, index: i })}
          onMomentumScrollEnd={onScrollEnd}
          renderItem={({ item, index: i }) => (
            <Slide url={item} overlays={overlays?.[i]} width={w} onPress={() => onOpen?.(i)} />
          )}
        />
      )}

      {/* Pontinhos — em baixo, centrados, com sombra para lerem em fotos claras */}
      {n > 1 && (
        <View style={[s.dots, { bottom: dotsBottom }]} pointerEvents="none">
          {urls.map((_, i) => (
            <View key={i} style={[s.dot, i === index && s.dotOn]} />
          ))}
        </View>
      )}
    </View>
  )
}

const s = StyleSheet.create({
  root: { ...StyleSheet.absoluteFillObject, backgroundColor: '#000' },
  dots: {
    position: 'absolute',
    left: 0, right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 5,
  },
  dot: {
    width: 5, height: 5, borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.45)',
    shadowColor: '#000', shadowOpacity: 0.35, shadowRadius: 2, shadowOffset: { width: 0, height: 0 },
  },
  dotOn: {
    width: 6, height: 6, borderRadius: 3,
    backgroundColor: '#fff',
  },
})
