import React, { useState, useEffect, useCallback, useRef } from 'react'
import {
  Modal, View, Text, StyleSheet, TouchableOpacity, FlatList,
  Pressable, ActivityIndicator, Dimensions, ScrollView,
} from 'react-native'
import { Image } from 'expo-image'
import * as MediaLibrary from 'expo-media-library'
import * as ImagePicker from 'expo-image-picker'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { colors, fonts } from '../theme'
import { useT } from '../i18n'

const { width: W } = Dimensions.get('window')
const COLS = 3
const GAP  = 2
const CELL = Math.floor((W - GAP * (COLS - 1)) / COLS)
const PAGE = 60

export interface PickedAsset { uri: string; type: 'image' | 'video' }

type GalleryGridItem =
  | { kind: 'camera'; id: '__camera__' }
  | { kind: 'asset'; id: string; asset: MediaLibrary.Asset }

interface Props {
  visible: boolean
  onClose: () => void
  onDone: (assets: PickedAsset[]) => void
  maxSelection?: number
}

function fmtDur(sec: number): string {
  const s = Math.round(sec)
  const m = Math.floor(s / 60)
  return `${m}:${String(s % 60).padStart(2, '0')}`
}

// Galeria própria da app (estilo WhatsApp) — nunca abre o explorador de ficheiros
export default function GalleryPicker({ visible, onClose, onDone, maxSelection = 10 }: Props) {
  const { top, bottom } = useSafeAreaInsets()
  const t = useT()
  const [perm, requestPerm] = MediaLibrary.usePermissions()

  const [assets,   setAssets]   = useState<MediaLibrary.Asset[]>([])
  const [loading,  setLoading]  = useState(false)
  const [selected, setSelected] = useState<string[]>([])   // ids, por ordem de escolha
  const [resolving, setResolving] = useState(false)
  const [albums,   setAlbums]   = useState<MediaLibrary.Album[]>([])
  const [albumId,  setAlbumId]  = useState<string | null>(null)   // null = Recentes (tudo)
  const loadGeneration = useRef(0)
  const loadingRef = useRef(false)
  const selectedAssetsRef = useRef<Map<string, MediaLibrary.Asset>>(new Map())

  // Onde a paginação vai e se ainda há mais. Refs e não estado: nada disto se
  // desenha, e como estado ficava preso dentro do `load` que a lista guardou.
  // Ao trocar de pasta, o `onEndReached` disparava com o cursor da pasta
  // anterior e pedia uma página sobreposta — as mesmas fotos outra vez, e o
  // React a queixar-se de chaves repetidas.
  const cursorRef  = useRef<string | undefined>(undefined)
  const hasMoreRef = useRef(true)

  const load = useCallback(async (reset = false) => {
    if (!reset && (loadingRef.current || !hasMoreRef.current)) return
    const generation = reset ? ++loadGeneration.current : loadGeneration.current
    loadingRef.current = true
    setLoading(true)
    try {
      const page = await MediaLibrary.getAssetsAsync({
        first:     PAGE,
        after:     reset ? undefined : cursorRef.current,
        album:     albumId ?? undefined,
        mediaType: [MediaLibrary.MediaType.photo, MediaLibrary.MediaType.video],
        sortBy:    [MediaLibrary.SortBy.creationTime],
      })
      if (generation !== loadGeneration.current) return
      // Mesmo com o cursor certo, o expo-media-library repete fotos entre
      // páginas quando várias partilham a data de criação. Uma foto só entra
      // na lista uma vez, venha ela de onde vier.
      setAssets((prev) => {
        const merged = reset ? page.assets : [...prev, ...page.assets]
        const seen = new Set<string>()
        return merged.filter((a) => {
          if (seen.has(a.id)) return false
          seen.add(a.id)
          return true
        })
      })
      cursorRef.current = page.endCursor
      hasMoreRef.current = page.hasNextPage
    } catch {}
    finally {
      if (generation === loadGeneration.current) {
        loadingRef.current = false
        setLoading(false)
      }
    }
  }, [albumId])

  // Pede permissão ao abrir
  useEffect(() => {
    if (!visible || perm?.status === 'granted') return
    requestPerm()
  }, [visible])

  // Carrega as pastas do telemóvel, ordenadas por quantidade.
  // O assetCount do álbum conta TUDO — músicas, documentos, o que lá estiver —
  // por isso pastas só com mp3 apareciam e abriam vazias. Contamos nós apenas
  // fotos e vídeos, e a pasta só entra na lista se tiver algum.
  useEffect(() => {
    if (!visible || perm?.status !== 'granted') return
    let cancelled = false

    MediaLibrary.getAlbumsAsync({ includeSmartAlbums: true })
      .then(async (list) => {
        const counted = await Promise.all(
          list.map(async (a) => {
            try {
              const page = await MediaLibrary.getAssetsAsync({
                album: a.id, first: 1,
                mediaType: [MediaLibrary.MediaType.photo, MediaLibrary.MediaType.video],
              })
              return { album: a, count: page.totalCount }
            } catch {
              return { album: a, count: 0 }
            }
          }),
        )
        if (cancelled) return
        setAlbums(
          counted
            .filter((c) => c.count > 0)
            .sort((a, b) => b.count - a.count)
            .map((c) => ({ ...c.album, assetCount: c.count })),
        )
      })
      .catch(() => {})

    return () => { cancelled = true }
  }, [visible, perm?.status])

  // (Re)carrega os itens quando abre ou quando muda de pasta
  useEffect(() => {
    if (!visible || perm?.status !== 'granted') return
    setAssets([])
    cursorRef.current = undefined
    hasMoreRef.current = true
    load(true)
  }, [visible, perm?.status, albumId])

  useEffect(() => {
    if (!visible) {
      loadGeneration.current += 1
      loadingRef.current = false
      selectedAssetsRef.current.clear()
      setLoading(false)
      setSelected([])
      setAlbumId(null)
    }
  }, [visible])

  function toggle(asset: MediaLibrary.Asset) {
    if (resolving) return
    setSelected((prev) => {
      if (prev.includes(asset.id)) {
        selectedAssetsRef.current.delete(asset.id)
        return prev.filter((id) => id !== asset.id)
      }

      // O compositor aceita um vídeo isolado ou um álbum só de fotografias.
      // Substituir explicitamente a seleção mantém o contador fiel ao resultado.
      if (asset.mediaType === MediaLibrary.MediaType.video) {
        selectedAssetsRef.current.clear()
        selectedAssetsRef.current.set(asset.id, asset)
        return [asset.id]
      }

      const hadVideo = prev.some((id) => (
        selectedAssetsRef.current.get(id)?.mediaType === MediaLibrary.MediaType.video
      ))
      const base = hadVideo ? [] : prev
      if (base.length >= maxSelection) return prev
      if (hadVideo) selectedAssetsRef.current.clear()
      selectedAssetsRef.current.set(asset.id, asset)
      return [...base, asset.id]
    })
  }

  async function confirm() {
    if (selected.length === 0 || resolving) return
    setResolving(true)
    try {
      const picked: PickedAsset[] = []
      for (const id of selected) {
        const a = selectedAssetsRef.current.get(id) ?? assets.find((candidate) => candidate.id === id)
        if (!a) continue
        // localUri (file://) é o que dá para publicar — o uri cru pode ser ph:// ou content://
        const info = await MediaLibrary.getAssetInfoAsync(a)
        picked.push({
          uri:  info.localUri ?? a.uri,
          type: a.mediaType === MediaLibrary.MediaType.video ? 'video' : 'image',
        })
      }
      onDone(picked)
    } catch {}
    setResolving(false)
  }

  async function openCamera() {
    if (resolving) return
    const cam = await ImagePicker.requestCameraPermissionsAsync()
    if (cam.status !== 'granted') return
    const res = await ImagePicker.launchCameraAsync({ mediaTypes: ['images', 'videos'], quality: 0.85, videoMaxDuration: 90 })
    if (res.canceled || !res.assets[0]) return
    const a = res.assets[0]
    onDone([{ uri: a.uri, type: a.type === 'video' ? 'video' : 'image' }])
  }

  const granted = perm?.status === 'granted'
  const gridItems: GalleryGridItem[] = [
    { kind: 'camera', id: '__camera__' },
    ...assets.map((asset) => ({ kind: 'asset' as const, id: asset.id, asset })),
  ]
  const close = () => { if (!resolving) onClose() }

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={close} presentationStyle="fullScreen">
      <View style={s.screen}>
        <View style={[s.header, { paddingTop: top }]}>
          <TouchableOpacity
            style={s.headerSide}
            onPress={close}
            disabled={resolving}
            activeOpacity={0.65}
            accessibilityRole="button"
            accessibilityLabel={t.cancel}
            accessibilityState={{ disabled: resolving }}
          >
            <Text style={s.cancel}>{t.cancel}</Text>
          </TouchableOpacity>
          <View style={s.headerIdentity} pointerEvents="none">
            <View style={s.brandSignal}>
              <View style={s.brandSignalLine} />
              <View style={s.brandSignalDot} />
            </View>
            <Text style={s.title}>
              {selected.length > 0
                ? `${selected.length} ${selected.length > 1 ? t.gal_selectedPl : t.gal_selected}`
                : t.gal_title}
            </Text>
          </View>
          {selected.length > 0 ? (
            <TouchableOpacity
              style={[s.headerSide, s.headerSideEnd]}
              onPress={confirm}
              disabled={resolving}
              activeOpacity={0.65}
              accessibilityRole="button"
              accessibilityLabel={t.gal_add}
              accessibilityState={{ disabled: resolving, busy: resolving }}
            >
              {resolving
                ? <ActivityIndicator color="#FF7A1C" size="small" />
                : <Text style={s.doneTxt}>{t.gal_add}</Text>}
            </TouchableOpacity>
          ) : <View style={s.headerSide} />}
        </View>

        {granted && (
          <View style={s.albumBarWrap}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={s.albumBar}
              keyboardShouldPersistTaps="handled"
              scrollEnabled={!resolving}
            >
              <TouchableOpacity
                style={s.albumTab}
                onPress={() => setAlbumId(null)}
                disabled={resolving}
                activeOpacity={0.68}
                accessibilityRole="button"
                accessibilityState={{ selected: albumId === null, disabled: resolving }}
              >
                <Ionicons name="time-outline" size={14} color={albumId === null ? '#FF7A1C' : '#77777D'} />
                <Text style={[s.albumTxt, albumId === null && s.albumTxtOn]}>{t.gal_recent}</Text>
                <View style={[s.albumMarker, albumId === null && s.albumMarkerOn]} />
              </TouchableOpacity>
              {albums.map((a) => (
                <TouchableOpacity
                  key={a.id}
                  style={s.albumTab}
                  onPress={() => setAlbumId(a.id)}
                  disabled={resolving}
                  activeOpacity={0.68}
                  accessibilityRole="button"
                  accessibilityLabel={a.title}
                  accessibilityState={{ selected: albumId === a.id, disabled: resolving }}
                >
                  <Ionicons name="folder-outline" size={14} color={albumId === a.id ? '#FF7A1C' : '#77777D'} />
                  <Text style={[s.albumTxt, albumId === a.id && s.albumTxtOn]} numberOfLines={1}>{a.title}</Text>
                  <Text style={s.albumCount}>{a.assetCount}</Text>
                  <View style={[s.albumMarker, albumId === a.id && s.albumMarkerOn]} />
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}

        {!granted ? (
          <View style={s.permWrap}>
            <View style={s.permSignal}>
              <View style={s.permSignalLine} />
              <View style={s.permSignalDot} />
            </View>
            <Ionicons name="images-outline" size={32} color="#FF7A1C" />
            <Text style={s.permTitle}>{t.gal_permTitle}</Text>
            <Text style={s.permSub}>{t.gal_permSub}</Text>
            <TouchableOpacity
              style={s.permBtn}
              onPress={() => requestPerm()}
              activeOpacity={0.82}
              accessibilityRole="button"
              accessibilityLabel={t.gal_permBtn}
            >
              <View style={s.permBtnSignal} />
              <Text style={s.permBtnTxt}>{t.gal_permBtn}</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <FlatList
            data={gridItems}
            keyExtractor={(item) => item.id}
            numColumns={COLS}
            contentContainerStyle={{ paddingBottom: bottom + 16 }}
            columnWrapperStyle={{ gap: GAP }}
            ItemSeparatorComponent={() => <View style={{ height: GAP }} />}
            onEndReached={() => load(false)}
            onEndReachedThreshold={0.6}
            showsVerticalScrollIndicator={false}
            scrollEnabled={!resolving}
            renderItem={({ item }) => {
              if (item.kind === 'camera') {
                return (
                  <TouchableOpacity
                    style={s.cameraTile}
                    onPress={openCamera}
                    disabled={resolving}
                    activeOpacity={0.72}
                    accessibilityRole="button"
                    accessibilityLabel={t.gal_camera}
                    accessibilityState={{ disabled: resolving }}
                  >
                    <View style={s.cameraSignal} />
                    <Ionicons name="camera" size={26} color="#fff" />
                    <Text style={s.cameraTxt}>{t.gal_camera}</Text>
                  </TouchableOpacity>
                )
              }
              const asset = item.asset
              const idx = selected.indexOf(asset.id)
              const isVideo = asset.mediaType === MediaLibrary.MediaType.video
              return (
                <Pressable
                  style={s.cell}
                  onPress={() => toggle(asset)}
                  disabled={resolving}
                  accessibilityRole="button"
                  accessibilityState={{ selected: idx >= 0, disabled: resolving }}
                >
                  <Image source={{ uri: asset.uri }} style={StyleSheet.absoluteFill} contentFit="cover" cachePolicy="memory-disk" recyclingKey={asset.id} />
                  {isVideo && (
                    <View style={s.durBadge}><Ionicons name="play" size={9} color="#fff" /><Text style={s.durTxt}>{fmtDur(asset.duration)}</Text></View>
                  )}
                  {idx >= 0 && <View style={s.selDim} />}
                  <View style={[s.selBadge, idx >= 0 && s.selBadgeOn]}>
                    {idx >= 0 && <Text style={s.selNum}>{idx + 1}</Text>}
                  </View>
                </Pressable>
              )
            }}
            ListFooterComponent={loading ? <ActivityIndicator color={colors.primary} style={{ paddingVertical: 20 }} /> : null}
          />
        )}
      </View>
    </Modal>
  )
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#FAFAF8' },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#D8D8D5',
  },
  headerSide: {
    width: 92,
    height: 52,
    paddingHorizontal: 16,
    justifyContent: 'center',
  },
  headerSideEnd: { alignItems: 'flex-end' },
  headerIdentity: {
    flex: 1,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
  },
  brandSignal: { height: 4, flexDirection: 'row', alignItems: 'center', gap: 3 },
  brandSignalLine: { width: 18, height: 2, backgroundColor: '#FF7A1C' },
  brandSignalDot: { width: 3, height: 3, borderRadius: 1.5, backgroundColor: '#FF7A1C' },
  cancel: { fontFamily: fonts.medium, fontSize: 14, color: '#5C5C63' },
  title: { fontFamily: fonts.semiBold, fontSize: 15, color: '#1A1A1A', letterSpacing: -0.2 },
  doneTxt: { color: '#FF7A1C', fontFamily: fonts.semiBold, fontSize: 14 },

  albumBarWrap: {
    height: 52,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#D8D8D5',
  },
  albumBar: { flexDirection: 'row', alignItems: 'stretch', paddingHorizontal: 4 },
  albumTab: {
    height: 51,
    maxWidth: 200,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    position: 'relative',
  },
  albumTxt: { fontFamily: fonts.medium, fontSize: 13, color: '#77777D', flexShrink: 1 },
  albumTxtOn: { color: '#1A1A1A', fontFamily: fonts.semiBold },
  albumCount: { fontFamily: fonts.medium, fontSize: 11, color: '#A0A0A5' },
  albumMarker: {
    position: 'absolute',
    left: 12,
    right: 12,
    bottom: 0,
    height: 2,
    backgroundColor: 'transparent',
  },
  albumMarkerOn: { backgroundColor: '#FF7A1C' },

  cameraTile: {
    width: CELL,
    height: CELL,
    backgroundColor: '#1A1A1A',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
  },
  cameraSignal: {
    position: 'absolute',
    top: 12,
    left: 12,
    width: 18,
    height: 2,
    backgroundColor: '#FF7A1C',
  },
  cameraTxt: { color: '#fff', fontFamily: fonts.semiBold, fontSize: 12 },

  cell: { width: CELL, height: CELL, backgroundColor: '#EDEDED' },
  durBadge: {
    position: 'absolute', bottom: 5, right: 5, flexDirection: 'row', alignItems: 'center', gap: 2,
    backgroundColor: 'rgba(0,0,0,0.62)', borderRadius: 2, paddingHorizontal: 4, paddingVertical: 1,
  },
  durTxt: { color: '#fff', fontSize: 9.5, fontFamily: fonts.semiBold },
  selDim: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(255,255,255,0.35)' },
  selBadge: {
    position: 'absolute', top: 6, right: 6, width: 22, height: 22, borderRadius: 2,
    borderWidth: 1.5, borderColor: '#fff', backgroundColor: 'rgba(0,0,0,0.18)',
    alignItems: 'center', justifyContent: 'center',
  },
  selBadgeOn: { backgroundColor: '#FF7A1C', borderColor: '#fff' },
  selNum: { color: '#fff', fontSize: 11, fontFamily: fonts.bold },

  permWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    gap: 10,
  },
  permSignal: { height: 4, flexDirection: 'row', alignItems: 'center', gap: 3, marginBottom: 8 },
  permSignalLine: { width: 24, height: 2, backgroundColor: '#FF7A1C' },
  permSignalDot: { width: 3, height: 3, borderRadius: 1.5, backgroundColor: '#FF7A1C' },
  permTitle: { fontFamily: fonts.bold, fontSize: 18, color: colors.black },
  permSub: { fontFamily: fonts.regular, fontSize: 13.5, color: colors.gray500, textAlign: 'center', lineHeight: 20 },
  permBtn: {
    width: '100%',
    maxWidth: 320,
    height: 48,
    marginTop: 14,
    borderRadius: 12,
    backgroundColor: '#1A1A1A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  permBtnSignal: {
    position: 'absolute',
    left: 16,
    width: 18,
    height: 2,
    backgroundColor: '#FF7A1C',
  },
  permBtnTxt: { color: '#fff', fontFamily: fonts.bold, fontSize: 14.5 },
})
