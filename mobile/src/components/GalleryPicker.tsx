import React, { useState, useEffect, useCallback } from 'react'
import {
  Modal, View, Text, StyleSheet, TouchableOpacity, FlatList,
  Pressable, ActivityIndicator, Dimensions, Platform, ScrollView,
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
  const [cursor,   setCursor]   = useState<string | undefined>(undefined)
  const [hasMore,  setHasMore]  = useState(true)
  const [loading,  setLoading]  = useState(false)
  const [selected, setSelected] = useState<string[]>([])   // ids, por ordem de escolha
  const [resolving, setResolving] = useState(false)
  const [albums,   setAlbums]   = useState<MediaLibrary.Album[]>([])
  const [albumId,  setAlbumId]  = useState<string | null>(null)   // null = Recentes (tudo)

  const load = useCallback(async (reset = false) => {
    if (loading) return
    if (!reset && !hasMore) return
    setLoading(true)
    try {
      const page = await MediaLibrary.getAssetsAsync({
        first:     PAGE,
        after:     reset ? undefined : cursor,
        album:     albumId ?? undefined,
        mediaType: [MediaLibrary.MediaType.photo, MediaLibrary.MediaType.video],
        sortBy:    [MediaLibrary.SortBy.creationTime],
      })
      setAssets((prev) => reset ? page.assets : [...prev, ...page.assets])
      setCursor(page.endCursor)
      setHasMore(page.hasNextPage)
    } catch {}
    setLoading(false)
  }, [loading, hasMore, cursor, albumId])

  // Pede permissão ao abrir
  useEffect(() => {
    if (!visible || perm?.status === 'granted') return
    requestPerm()
  }, [visible])

  // Carrega as pastas (álbuns) do telemóvel, ordenadas por quantidade
  useEffect(() => {
    if (!visible || perm?.status !== 'granted') return
    MediaLibrary.getAlbumsAsync({ includeSmartAlbums: true })
      .then((list) => setAlbums(list.filter((a) => a.assetCount > 0).sort((a, b) => b.assetCount - a.assetCount)))
      .catch(() => {})
  }, [visible, perm?.status])

  // (Re)carrega os itens quando abre ou quando muda de pasta
  useEffect(() => {
    if (!visible || perm?.status !== 'granted') return
    setAssets([]); setCursor(undefined); setHasMore(true)
    load(true)
  }, [visible, perm?.status, albumId])

  useEffect(() => {
    if (!visible) { setSelected([]); setAlbumId(null) }
  }, [visible])

  function toggle(asset: MediaLibrary.Asset) {
    setSelected((prev) => {
      if (prev.includes(asset.id)) return prev.filter((id) => id !== asset.id)
      if (prev.length >= maxSelection) return prev
      return [...prev, asset.id]
    })
  }

  async function confirm() {
    if (selected.length === 0 || resolving) return
    setResolving(true)
    try {
      const byId = new Map(assets.map((a) => [a.id, a]))
      const picked: PickedAsset[] = []
      for (const id of selected) {
        const a = byId.get(id)
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
    const cam = await ImagePicker.requestCameraPermissionsAsync()
    if (cam.status !== 'granted') return
    const res = await ImagePicker.launchCameraAsync({ mediaTypes: ['images', 'videos'], quality: 0.85, videoMaxDuration: 90 })
    if (res.canceled || !res.assets[0]) return
    const a = res.assets[0]
    onDone([{ uri: a.uri, type: a.type === 'video' ? 'video' : 'image' }])
  }

  const granted = perm?.status === 'granted'

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose} presentationStyle="fullScreen">
      <View style={s.screen}>
        {/* ── Cabeçalho ── */}
        <View style={[s.header, { paddingTop: top + 10 }]}>
          <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Text style={s.cancel}>{t.cancel}</Text>
          </TouchableOpacity>
          <Text style={s.title}>
            {selected.length > 0
              ? `${selected.length} ${selected.length > 1 ? t.gal_selectedPl : t.gal_selected}`
              : t.gal_title}
          </Text>
          <View style={{ width: 64 }} />
        </View>

        {/* ── Pastas (álbuns) — filtra a grelha por pasta ── */}
        {granted && (
          <View style={s.albumBarWrap}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={s.albumBar}
              keyboardShouldPersistTaps="handled"
            >
              <TouchableOpacity
                style={[s.albumChip, albumId === null && s.albumChipOn]}
                onPress={() => setAlbumId(null)}
                activeOpacity={0.8}
              >
                <Ionicons name="time-outline" size={13} color={albumId === null ? '#fff' : colors.gray600} />
                <Text style={[s.albumTxt, albumId === null && s.albumTxtOn]}>{t.gal_recent}</Text>
              </TouchableOpacity>
              {albums.map((a) => (
                <TouchableOpacity
                  key={a.id}
                  style={[s.albumChip, albumId === a.id && s.albumChipOn]}
                  onPress={() => setAlbumId(a.id)}
                  activeOpacity={0.8}
                >
                  <Ionicons name="folder-outline" size={13} color={albumId === a.id ? '#fff' : colors.gray600} />
                  <Text style={[s.albumTxt, albumId === a.id && s.albumTxtOn]} numberOfLines={1}>{a.title}</Text>
                  <Text style={[s.albumCount, albumId === a.id && s.albumTxtOn]}>{a.assetCount}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}

        {!granted ? (
          <View style={s.permWrap}>
            <View style={s.permIcon}><Ionicons name="images-outline" size={30} color={colors.primary} /></View>
            <Text style={s.permTitle}>{t.gal_permTitle}</Text>
            <Text style={s.permSub}>{t.gal_permSub}</Text>
            <TouchableOpacity style={s.permBtn} onPress={() => requestPerm()} activeOpacity={0.85}>
              <Text style={s.permBtnTxt}>{t.gal_permBtn}</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <FlatList
            data={assets}
            keyExtractor={(a) => a.id}
            numColumns={COLS}
            contentContainerStyle={{ paddingBottom: bottom + 90 }}
            columnWrapperStyle={{ gap: GAP }}
            ItemSeparatorComponent={() => <View style={{ height: GAP }} />}
            onEndReached={() => load(false)}
            onEndReachedThreshold={0.6}
            showsVerticalScrollIndicator={false}
            ListHeaderComponent={
              <View style={{ flexDirection: 'row', gap: GAP, marginBottom: GAP }}>
                <TouchableOpacity style={s.cameraTile} onPress={openCamera} activeOpacity={0.85}>
                  <Ionicons name="camera" size={26} color="#fff" />
                  <Text style={s.cameraTxt}>{t.gal_camera}</Text>
                </TouchableOpacity>
              </View>
            }
            renderItem={({ item }) => {
              const idx = selected.indexOf(item.id)
              const isVideo = item.mediaType === MediaLibrary.MediaType.video
              return (
                <Pressable style={s.cell} onPress={() => toggle(item)}>
                  <Image source={{ uri: item.uri }} style={StyleSheet.absoluteFill} contentFit="cover" cachePolicy="memory-disk" recyclingKey={item.id} />
                  {isVideo && (
                    <View style={s.durBadge}><Ionicons name="play" size={9} color="#fff" /><Text style={s.durTxt}>{fmtDur(item.duration)}</Text></View>
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

        {/* ── Confirmar ── */}
        {granted && selected.length > 0 && (
          <View style={[s.footer, { paddingBottom: bottom + 12 }]}>
            <TouchableOpacity style={s.doneBtn} onPress={confirm} disabled={resolving} activeOpacity={0.88}>
              {resolving
                ? <ActivityIndicator color="#fff" size="small" />
                : <Text style={s.doneTxt}>{t.gal_add}{selected.length > 1 ? ` ${selected.length} ${t.gal_addPhotos}` : ''}</Text>}
            </TouchableOpacity>
          </View>
        )}
      </View>
    </Modal>
  )
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.white },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(0,0,0,0.08)',
  },
  cancel: { fontFamily: fonts.medium, fontSize: 15, color: colors.gray600, width: 64 },
  title:  { fontFamily: fonts.bold, fontSize: 16, color: colors.black, letterSpacing: -0.3 },

  albumBarWrap: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(0,0,0,0.06)' },
  albumBar:     { flexDirection: 'row', gap: 8, paddingHorizontal: 12, paddingVertical: 10 },
  albumChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: 18,
    backgroundColor: '#F2F2F5', maxWidth: 180,
  },
  albumChipOn: { backgroundColor: colors.primary },
  albumTxt:    { fontFamily: fonts.semiBold, fontSize: 13, color: colors.gray600, flexShrink: 1 },
  albumTxtOn:  { color: '#fff' },
  albumCount:  { fontFamily: fonts.medium, fontSize: 11, color: colors.gray400 },

  cameraTile: {
    width: CELL, height: CELL, backgroundColor: '#1A1A1A',
    alignItems: 'center', justifyContent: 'center', gap: 4,
  },
  cameraTxt: { color: '#fff', fontFamily: fonts.semiBold, fontSize: 12 },

  cell: { width: CELL, height: CELL, backgroundColor: '#EDEDED' },
  durBadge: {
    position: 'absolute', bottom: 5, right: 5, flexDirection: 'row', alignItems: 'center', gap: 2,
    backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 4, paddingHorizontal: 4, paddingVertical: 1,
  },
  durTxt: { color: '#fff', fontSize: 9.5, fontFamily: fonts.semiBold },
  selDim: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(255,255,255,0.35)' },
  selBadge: {
    position: 'absolute', top: 6, right: 6, width: 22, height: 22, borderRadius: 11,
    borderWidth: 1.5, borderColor: '#fff', backgroundColor: 'rgba(0,0,0,0.18)',
    alignItems: 'center', justifyContent: 'center',
  },
  selBadgeOn: { backgroundColor: colors.primary, borderColor: '#fff' },
  selNum: { color: '#fff', fontSize: 11, fontFamily: fonts.bold },

  footer: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 16, paddingTop: 8, backgroundColor: colors.white },
  doneBtn: {
    height: 52, borderRadius: 26, backgroundColor: colors.primary,
    alignItems: 'center', justifyContent: 'center',
  },
  doneTxt: { color: '#fff', fontFamily: fonts.bold, fontSize: 16, letterSpacing: -0.3 },

  permWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 44, gap: 8 },
  permIcon: { width: 76, height: 76, borderRadius: 38, borderWidth: 1.6, borderColor: colors.primary, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  permTitle: { fontFamily: fonts.bold, fontSize: 18, color: colors.black },
  permSub: { fontFamily: fonts.regular, fontSize: 13.5, color: colors.gray500, textAlign: 'center', lineHeight: 20 },
  permBtn: { marginTop: 14, backgroundColor: colors.primary, paddingHorizontal: 28, paddingVertical: 13, borderRadius: 24 },
  permBtnTxt: { color: '#fff', fontFamily: fonts.bold, fontSize: 14.5 },
})
