import React, { useEffect, useState } from 'react'
import {
  View,
  Text,
  FlatList,
  Image,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  Modal,
  ActivityIndicator,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native'
import { Ionicons } from '@expo/vector-icons'
import { getUserHighlights, Highlight, HighlightPost } from '../../services/highlight.service'
import { useAuthStore } from '../../store/auth.store'
import { AppStackParams } from '../../navigation/AppNavigator'
import { colors, fonts, spacing, radius } from '../../theme'
import { API_BASE } from '../../config'

type Route = RouteProp<AppStackParams, 'Highlights'>

const { width } = Dimensions.get('window')
const ITEM_SIZE = (width - spacing.md * 2 - spacing.sm) / 2

function mediaUri(url: string) {
  return url.startsWith('http') ? url : `${API_BASE}${url}`
}

export default function HighlightsScreen() {
  const nav = useNavigation()
  const route = useRoute<Route>()
  const { userId } = route.params
  const { user } = useAuthStore()
  const { top } = useSafeAreaInsets()
  const [highlights, setHighlights] = useState<Highlight[]>([])
  const [loading, setLoading] = useState(true)
  const [viewerVisible, setViewerVisible] = useState(false)
  const [activeHighlight, setActiveHighlight] = useState<Highlight | null>(null)
  const [activePostIndex, setActivePostIndex] = useState(0)

  const isOwn = user?.id === userId

  useEffect(() => {
    getUserHighlights(userId)
      .then(setHighlights)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [userId])

  function openHighlight(h: Highlight) {
    setActiveHighlight(h)
    setActivePostIndex(0)
    setViewerVisible(true)
  }

  return (
    <View style={[s.container, { paddingTop: top }]}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => nav.goBack()} style={s.backBtn}>
          <Ionicons name="chevron-back" size={26} color={colors.gray800} />
        </TouchableOpacity>
        <Text style={s.title}>Destaques</Text>
        <View style={{ width: 36 }} />
      </View>

      {loading ? (
        <View style={s.center}>
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      ) : (
        <FlatList
          data={highlights}
          keyExtractor={(h) => h.id}
          numColumns={2}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={s.grid}
          columnWrapperStyle={s.gridRow}
          ListEmptyComponent={
            <View style={s.center}>
              <Ionicons name="images-outline" size={56} color={colors.gray200} />
              <Text style={s.emptyText}>Nenhum destaque</Text>
            </View>
          }
          ListFooterComponent={
            isOwn ? (
              <TouchableOpacity style={s.createBtn} activeOpacity={0.8}>
                <Ionicons name="add-circle-outline" size={28} color={colors.primary} />
                <Text style={s.createText}>Novo Destaque</Text>
              </TouchableOpacity>
            ) : null
          }
          renderItem={({ item }) => {
            const cover = item.coverUrl ?? item.posts[0]?.mediaUrl
            return (
              <TouchableOpacity style={s.item} onPress={() => openHighlight(item)} activeOpacity={0.8}>
                {cover ? (
                  <Image source={{ uri: mediaUri(cover) }} style={s.cover} resizeMode="cover" />
                ) : (
                  <View style={[s.cover, s.coverPlaceholder]}>
                    <Ionicons name="images-outline" size={32} color={colors.gray200} />
                  </View>
                )}
                <Text style={s.highlightTitle} numberOfLines={1}>{item.title}</Text>
                <Text style={s.postCount}>{item.posts.length} posts</Text>
              </TouchableOpacity>
            )
          }}
        />
      )}

      <Modal visible={viewerVisible} animationType="slide" presentationStyle="fullScreen">
        <View style={s.viewer}>
          <View style={[s.viewerHeader, { paddingTop: top + 8 }]}>
            <TouchableOpacity onPress={() => setViewerVisible(false)}>
              <Ionicons name="close" size={28} color={colors.gray800} />
            </TouchableOpacity>
            <Text style={s.viewerTitle}>{activeHighlight?.title}</Text>
            <View style={{ width: 28 }} />
          </View>
          {activeHighlight && (
            <FlatList
              data={activeHighlight.posts}
              keyExtractor={(p) => p.id}
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              onMomentumScrollEnd={(e) => {
                setActivePostIndex(Math.round(e.nativeEvent.contentOffset.x / width))
              }}
              renderItem={({ item }: { item: HighlightPost }) => (
                <View style={s.viewerSlide}>
                  <Image
                    source={{ uri: mediaUri(item.mediaUrl) }}
                    style={s.viewerMedia}
                    resizeMode="contain"
                  />
                  {item.caption && (
                    <Text style={s.viewerCaption}>{item.caption}</Text>
                  )}
                </View>
              )}
            />
          )}
          <View style={s.viewerDots}>
            {activeHighlight?.posts.map((_, i) => (
              <View
                key={i}
                style={[s.dot, i === activePostIndex && s.dotActive]}
              />
            ))}
          </View>
        </View>
      </Modal>
    </View>
  )
}

const s = StyleSheet.create({
  container:        { flex: 1, backgroundColor: colors.white },
  header:           {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
  },
  backBtn:          { width: 36 },
  title:            { color: colors.gray800, fontFamily: fonts.bold, fontSize: 20 },
  center:           { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md, paddingTop: 60 },
  emptyText:        { color: colors.gray400, fontFamily: fonts.medium, fontSize: 16 },
  grid:             { padding: spacing.md, paddingBottom: 40 },
  gridRow:          { gap: spacing.sm, marginBottom: spacing.sm },
  item:             { width: ITEM_SIZE, gap: 6 },
  cover:            { width: ITEM_SIZE, height: ITEM_SIZE, borderRadius: radius.md },
  coverPlaceholder: { backgroundColor: colors.gray100, alignItems: 'center', justifyContent: 'center' },
  highlightTitle:   { color: colors.gray800, fontFamily: fonts.semiBold, fontSize: 13 },
  postCount:        { color: colors.gray400, fontFamily: fonts.regular, fontSize: 11 },
  createBtn:        {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingVertical: spacing.md, paddingHorizontal: spacing.sm,
  },
  createText:       { color: colors.primary, fontFamily: fonts.semiBold, fontSize: 15 },
  viewer:           { flex: 1, backgroundColor: '#000' },
  viewerHeader:     {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.md, paddingBottom: spacing.sm,
  },
  viewerTitle:      { color: colors.white, fontFamily: fonts.semiBold, fontSize: 17 },
  viewerSlide:      { width, flex: 1, justifyContent: 'center', alignItems: 'center' },
  viewerMedia:      { width, height: '80%' },
  viewerCaption:    {
    position: 'absolute', bottom: 60, left: spacing.md, right: spacing.md,
    color: colors.white, fontFamily: fonts.regular, fontSize: 14,
    textAlign: 'center', backgroundColor: 'rgba(0,0,0,0.4)',
    borderRadius: radius.sm, padding: 8,
  },
  viewerDots:       {
    flexDirection: 'row', justifyContent: 'center', gap: 6,
    paddingBottom: 40,
  },
  dot:              { width: 6, height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.3)' },
  dotActive:        { backgroundColor: colors.white },
})
