import React, { useEffect, useState } from 'react'
import {
  View, Text, StyleSheet, Pressable, FlatList,
  NativeSyntheticEvent, NativeScrollEvent,
} from 'react-native'
import { Image } from 'expo-image'
import { API_BASE } from '../../config'
import { colors } from '../../theme'

const EMOJI_FRAC = 0.14

type Overlay = { emoji: string; x: number; y: number }

function resolve(url: string) {
  return url.startsWith('http') || url.startsWith('file') ? url : `${API_BASE}${url}`
}

// Uma foto do carrossel — full-bleed, com os emojis fixados por cima.
function Slide({
  url, overlays, width, height, size, onPress,
}: {
  url: string
  overlays?: Overlay[]
  width: number
  height: number
  /** Dimensões vindas do servidor. Sem elas o slide fica cheio, como antes. */
  size?: { w: number | null; h: number | null }
  onPress?: () => void
}) {
  // A altura vem sempre da proporção da foto, nunca da altura do slide. Quando
  // o servidor a manda (`size`), acerta logo no primeiro desenho. Quando não —
  // álbuns anteriores à migração — a foto carrega INVISÍVEL e só se revela já
  // no tamanho certo, para nunca se ver o tamanho errado a encolher.
  const serverAspect = size?.w && size?.h ? size.w / size.h : null
  const [loadedAspect, setLoadedAspect] = useState<number | null>(null)

  // A FlatList reaproveita este slide para outra foto — sem isto ficava com a
  // proporção da anterior.
  useEffect(() => { setLoadedAspect(null) }, [url])

  const aspect    = serverAspect ?? loadedAspect
  const imgHeight = aspect ? Math.min(width / aspect, height) : height
  const imgTop    = aspect ? (height - imgHeight) / 2 : 0
  const es = width * EMOJI_FRAC

  return (
    <Pressable style={{ width, height }} onPress={onPress}>
      <Image
        source={{ uri: resolve(url) }}
        style={{
          position: 'absolute', left: 0, right: 0,
          top: imgTop, height: imgHeight,
          opacity: aspect ? 1 : 0,
        }}
        contentFit="cover"
        cachePolicy="disk"
        recyclingKey={url}
        transition={140}
        onLoad={(e) => {
          if (serverAspect) return
          const { width: w, height: h } = e.source ?? {}
          if (w && h) setLoadedAspect(w / h)
        }}
      />
      {/* Os emojis seguem a caixa da IMAGEM, não a do slide. Antes seguiam o
          slide inteiro e saíam do sítio sempre que havia faixas. */}
      {imgHeight > 0 && (overlays ?? []).map((o, k) => (
        <Text key={k} style={{ position: 'absolute', left: o.x * width - es / 2, top: imgTop + o.y * imgHeight - es / 2, fontSize: es }}>
          {o.emoji}
        </Text>
      ))}
    </Pressable>
  )
}

interface Props {
  urls: string[]
  sizes?: { w: number | null; h: number | null }[]   // paralelo a urls
  overlays?: Overlay[][]   // emojis por foto, paralelo a urls
  onOpen?: (index: number) => void
  dotsBottom?: number      // distância dos pontinhos ao fundo (limpa a barra do autor)
}

// Carrossel estilo Instagram — desliza esquerda↔direita, pontinhos em baixo.
export default function PostAlbumCarousel({ urls, sizes, overlays, onOpen, dotsBottom = 14 }: Props) {
  // Mede-se aqui uma vez e passa-se aos slides. Cada slide a medir-se a si
  // próprio criava um impasse: sem altura não desenhava, sem desenhar não media.
  const [box, setBox]     = useState({ w: 0, h: 0 })
  const [index, setIndex] = useState(0)
  const w = box.w
  const n = urls.length

  function onScrollEnd(e: NativeSyntheticEvent<NativeScrollEvent>) {
    if (w > 0) setIndex(Math.round(e.nativeEvent.contentOffset.x / w))
  }

  return (
    <View
      style={s.root}
      onLayout={(e) => setBox({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}
    >
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
            <Slide url={item} overlays={overlays?.[i]} width={w} height={box.h} size={sizes?.[i]} onPress={() => onOpen?.(i)} />
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
  root: { ...StyleSheet.absoluteFillObject, backgroundColor: colors.feedSurface },
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
