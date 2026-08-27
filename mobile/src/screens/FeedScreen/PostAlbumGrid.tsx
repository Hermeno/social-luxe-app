import React, { useState } from 'react'
import { View, Text, StyleSheet, Pressable, ViewStyle } from 'react-native'
import { Image } from 'expo-image'
import { API_BASE } from '../../config'
import { colors, fonts, leading, typography } from '../../theme'
import { useT } from '../../i18n'

const GAP = 3
const EMOJI_FRAC = 0.14

type Overlay = { emoji: string; x: number; y: number }

function resolve(url: string) {
  return url.startsWith('http') || url.startsWith('file') ? url : `${API_BASE}${url}`
}

// Uma célula da colagem: foto + emojis fixados (posição em fração do lado da célula)
function AlbumCell({
  url, overlays, more, onPress, style, label,
}: {
  url: string
  overlays?: Overlay[]
  more?: number
  onPress?: () => void
  style: ViewStyle | ViewStyle[]
  /** O que o leitor de ecrã anuncia — "foto 2 de 4". */
  label?: string
}) {
  const [size, setSize] = useState({ w: 0, h: 0 })
  const es = size.w * EMOJI_FRAC
  return (
    <Pressable
      style={[style, s.cell]}
      onPress={onPress}
      accessibilityRole="imagebutton"
      accessibilityLabel={label}
      onLayout={(e) => setSize({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}
    >
      <Image source={{ uri: resolve(url) }} style={StyleSheet.absoluteFill} contentFit="cover" cachePolicy="disk" recyclingKey={url} transition={140} />
      {size.w > 0 && (overlays ?? []).map((o, k) => (
        <Text key={k} style={{ position: 'absolute', left: o.x * size.w - es / 2, top: o.y * size.h - es / 2, fontSize: es }}>
          {o.emoji}
        </Text>
      ))}
      {more != null && more > 0 && (
        <View style={s.moreOverlay}><Text style={s.moreTxt}>+{more}</Text></View>
      )}
    </Pressable>
  )
}

interface Props {
  urls: string[]
  overlays?: Overlay[][]   // emojis por foto, paralelo a urls
  onOpen?: (index: number) => void
}

// Colagem estilo Facebook, full-bleed no visualizador da feed.
// Layouts: 2 = lado a lado · 3 = 1 grande + 2 · 4 = 2×2 · 5+ = 2×2 com "+N".
export default function PostAlbumGrid({ urls, overlays, onOpen }: Props) {
  const t = useT()
  const n = urls.length
  const ov = (i: number) => overlays?.[i]
  const lbl = (i: number) =>
    t.feed_album_photo.replace('{i}', String(i + 1)).replace('{n}', String(n))

  if (n === 2) {
    return (
      <View style={s.root}>
        <View style={s.rowFill}>
          <AlbumCell url={urls[0]} overlays={ov(0)} onPress={() => onOpen?.(0)} label={lbl(0)} style={s.flex1} />
          <View style={{ width: GAP }} />
          <AlbumCell url={urls[1]} overlays={ov(1)} onPress={() => onOpen?.(1)} label={lbl(1)} style={s.flex1} />
        </View>
      </View>
    )
  }

  if (n === 3) {
    return (
      <View style={s.root}>
        <AlbumCell url={urls[0]} overlays={ov(0)} onPress={() => onOpen?.(0)} label={lbl(0)} style={s.flex2} />
        <View style={{ height: GAP }} />
        <View style={s.rowHalf}>
          <AlbumCell url={urls[1]} overlays={ov(1)} onPress={() => onOpen?.(1)} label={lbl(1)} style={s.flex1} />
          <View style={{ width: GAP }} />
          <AlbumCell url={urls[2]} overlays={ov(2)} onPress={() => onOpen?.(2)} label={lbl(2)} style={s.flex1} />
        </View>
      </View>
    )
  }

  // 4 e 5+ → 2×2 (a 4ª leva "+N" quando há mais)
  return (
    <View style={s.root}>
      <View style={s.rowHalf}>
        <AlbumCell url={urls[0]} overlays={ov(0)} onPress={() => onOpen?.(0)} label={lbl(0)} style={s.flex1} />
        <View style={{ width: GAP }} />
        <AlbumCell url={urls[1]} overlays={ov(1)} onPress={() => onOpen?.(1)} label={lbl(1)} style={s.flex1} />
      </View>
      <View style={{ height: GAP }} />
      <View style={s.rowHalf}>
        <AlbumCell url={urls[2]} overlays={ov(2)} onPress={() => onOpen?.(2)} label={lbl(2)} style={s.flex1} />
        <View style={{ width: GAP }} />
        <AlbumCell url={urls[3]} overlays={ov(3)} more={n > 4 ? n - 4 : undefined} onPress={() => onOpen?.(3)} label={lbl(3)} style={s.flex1} />
      </View>
    </View>
  )
}

const s = StyleSheet.create({
  root:    { ...StyleSheet.absoluteFillObject, backgroundColor: colors.black },
  rowFill: { flex: 1, flexDirection: 'row' },
  rowHalf: { flex: 1, flexDirection: 'row' },
  flex1:   { flex: 1 },
  flex2:   { flex: 2 },
  cell:    { overflow: 'hidden', backgroundColor: colors.feedSurface },
  moreOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center', justifyContent: 'center',
  },
  // `fontWeight` era o único da Feed: a família já traz o peso, e um '700'
  // solto ignora a Jakarta e cai no sistema.
  moreTxt: { color: colors.white, fontFamily: fonts.medium, fontSize: typography.display, lineHeight: leading.display },
})
