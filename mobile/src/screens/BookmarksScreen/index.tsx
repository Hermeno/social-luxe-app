import React, { useEffect, useState } from 'react'
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  ActivityIndicator,
} from 'react-native'
import { Image } from 'expo-image'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useNavigation } from '@react-navigation/native'
import { Ionicons } from '@expo/vector-icons'
import { getBookmarks } from '../../services/bookmark.service'
import { Post } from '../../types'
import { colors, fonts, spacing } from '../../theme'
import { API_BASE } from '../../config'
import { getCache, setCache } from '../../db/database'
import { isConnected } from '../../services/netinfo.service'
import { useT } from '../../i18n'

const { width } = Dimensions.get('window')
const ITEM_SIZE = (width - 3) / 2

export default function BookmarksScreen() {
  const nav = useNavigation()
  const { top } = useSafeAreaInsets()
  const t = useT()
  const [posts, setPosts] = useState<Post[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    async function run() {
      const cached = await getCache<Post[]>('bookmarks')
      if (!cancelled && cached) { setPosts(cached); setLoading(false) }
      if (!isConnected()) { setLoading(false); return }
      try {
        const fresh = await getBookmarks()
        if (!cancelled) { setPosts(fresh); setLoading(false) }
        setCache('bookmarks', fresh).catch(() => {})
      } catch { if (!cancelled) setLoading(false) }
    }
    run()
    return () => { cancelled = true }
  }, [])

  function mediaUri(post: Post) {
    return post.mediaUrl ?? ''.startsWith('http') ? post.mediaUrl ?? '' : `${API_BASE}${post.mediaUrl ?? ''}`
  }

  return (
    <View style={[s.container, { paddingTop: top }]}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => nav.goBack()} style={s.backBtn}>
          <Ionicons name="chevron-back" size={26} color={colors.gray800} />
        </TouchableOpacity>
        <Text style={s.title}>{t.bm_title}</Text>
        <View style={{ width: 36 }} />
      </View>

      {loading ? (
        <View style={s.center}>
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      ) : posts.length === 0 ? (
        <View style={s.center}>
          <Ionicons name="bookmark-outline" size={56} color={colors.gray200} />
          <Text style={s.emptyText}>{t.bm_empty}</Text>
          <Text style={s.emptySubtext}>
            {t.bm_empty_sub}
          </Text>
        </View>
      ) : (
        <FlatList
          data={posts}
          keyExtractor={(p) => p.id}
          numColumns={2}
          columnWrapperStyle={s.row}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => (
            <TouchableOpacity style={s.item} activeOpacity={0.85}>
              <Image
                source={{ uri: mediaUri(item) }}
                style={s.thumb}
                contentFit="cover"
                cachePolicy="disk"
                recyclingKey={mediaUri(item)}
              />
              {item.mediaType === 'VIDEO' && (
                <View style={s.videoIcon}>
                  <Ionicons name="play-circle" size={28} color={colors.gray800} />
                </View>
              )}
            </TouchableOpacity>
          )}
        />
      )}
    </View>
  )
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.white },
  header:    {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
  },
  backBtn:   { width: 36 },
  title:     { color: colors.gray800, fontFamily: fonts.bold, fontSize: 20 },
  center:    { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md },
  emptyText: { color: colors.gray800, fontFamily: fonts.semiBold, fontSize: 18 },
  emptySubtext: { color: colors.gray400, fontFamily: fonts.regular, fontSize: 14, textAlign: 'center', paddingHorizontal: spacing.xl },
  row:       { gap: 2, marginBottom: 2 },
  item:      { position: 'relative' },
  thumb:     { width: ITEM_SIZE, height: ITEM_SIZE, backgroundColor: colors.gray100 },
  videoIcon: {
    position: 'absolute', top: '50%', left: '50%',
    transform: [{ translateX: -14 }, { translateY: -14 }],
  },
})
