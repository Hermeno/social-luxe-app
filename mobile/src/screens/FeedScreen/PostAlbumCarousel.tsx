import React, { useState } from 'react'
import {
  View, Text, StyleSheet, Pressable, FlatList,
  NativeSyntheticEvent, NativeScrollEvent,
} from 'react-native'
import { Image } from 'expo-image'
import { resolveMediaUrl } from '../../utils/media'
import { colors, radius, spacing } from '../../theme'
import { useT } from '../../i18n'
import { feedFill, feedLine } from './tokens'

const EMOJI_FRAC = 0.14

type Overlay = { emoji: string; x: number; y: number }

// Uma foto do carrossel — full-bleed, com os emojis fixados por cima.
function Slide({
  url, overlays, width, height, size, onPress, label,
}: {
  url: string
  overlays?: Overlay[]
  width: number
  height: number
  /** Dimensões vindas do servidor. Sem elas o slide fica cheio, como antes. */
  size?: { w: number | null; h: number | null }
  onPress?: () => void
  /** O que o leitor de ecrã anuncia — "foto 2 de 5". */
  label?: string
}) {
  const serverAspect = size?.w && size?.h ? size.w / size.h : null
  const [loadedMedia, setLoadedMedia] = useState<{ url: string; aspect: number } | null>(null)
  const measuredAspect = loadedMedia?.url === url ? loadedMedia.aspect : null
  const aspect = measuredAspect
    ?? (serverAspect && Number.isFinite(serverAspect) && serverAspect > 0 ? serverAspect : null)
  const imgHeight = aspect ? Math.min(width / aspect, height) : height
  const imgWidth = aspect ? Math.min(width, height * aspect) : width
  const imgTop = (height - imgHeight) / 2
  const imgLeft = (width - imgWidth) / 2
  const es = imgWidth * EMOJI_FRAC

  return (
    <Pressable
      style={{ width, height }}
      onPress={onPress}
      accessibilityRole="imagebutton"
      accessibilityLabel={label}
    >
      <Image
        source={{ uri: resolveMediaUrl(url) }}
        style={{
          position: 'absolute', left: imgLeft, width: imgWidth,
          top: imgTop, height: imgHeight,
        }}
        contentFit="contain"
        cachePolicy="disk"
        recyclingKey={url}
        transition={0}
        onLoad={(e) => {
          const { width: w, height: h } = e.source ?? {}
          if (w && h && Number.isFinite(w / h) && w / h > 0) {
            setLoadedMedia({ url, aspect: w / h })
          }
        }}
      />
      {/* Os emojis seguem a caixa da IMAGEM, não a do slide. Antes seguiam o
          slide inteiro e saíam do sítio sempre que havia faixas. */}
      {imgHeight > 0 && (overlays ?? []).map((o, k) => (
        <Text key={k} style={{ position: 'absolute', left: imgLeft + o.x * imgWidth - es / 2, top: imgTop + o.y * imgHeight - es / 2, fontSize: es }}>
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
  const t = useT()
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
          removeClippedSubviews={false}
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          keyExtractor={(u, i) => `${i}_${u}`}
          getItemLayout={(_, i) => ({ length: w, offset: w * i, index: i })}
          onMomentumScrollEnd={onScrollEnd}
          renderItem={({ item, index: i }) => (
            <Slide
              url={item}
              overlays={overlays?.[i]}
              width={w}
              height={box.h}
              size={sizes?.[i]}
              onPress={() => onOpen?.(i)}
              label={t.feed_album_photo.replace('{i}', String(i + 1)).replace('{n}', String(n))}
            />
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
    gap: spacing.xs2,
  },
  dot: {
    width: 5, height: 5, borderRadius: radius.full,
    backgroundColor: feedLine.strong,
    shadowColor: '#000', shadowOpacity: 0.35, shadowRadius: 2, shadowOffset: { width: 0, height: 0 },
  },
  dotOn: {
    width: 6, height: 6, borderRadius: radius.full,
    backgroundColor: feedFill.solid,
  },
})
