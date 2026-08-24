import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ActivityIndicator,
  Animated,
  Easing,
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
  type LayoutChangeEvent,
} from 'react-native'
import { Image } from 'expo-image'
import { LinearGradient } from 'expo-linear-gradient'
import { useNavigation } from '@react-navigation/native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import AvatarImage from '../../components/AvatarImage'
import FeedIcon from '../../components/FeedIcon'
import Icon from '../../components/Icon'
import { API_BASE } from '../../config'
import { getCache, setCache } from '../../db/database'
import useReducedMotionPreference from '../../hooks/useReducedMotionPreference'
import { useT } from '../../i18n'
import { isConnected } from '../../services/netinfo.service'
import { getUserPosts } from '../../services/user.service'
import { useFeedStore } from '../../store/feed.store'
import { colors, fonts, typography } from '../../theme'
import type { Post } from '../../types'
import { displayHandle } from '../../utils/handle'

const GRID_GAP = 1.5

function compactMetric(value: number): string {
  if (value >= 9_950_000) return `${Math.round(value / 1_000_000)}M`
  if (value >= 999_500) return `${(value / 1_000_000).toFixed(1).replace('.0', '')}M`
  if (value >= 9_950) return `${Math.round(value / 1_000)}K`
  if (value >= 1_000) return `${(value / 1_000).toFixed(1).replace('.0', '')}K`
  return String(value)
}

function resolveMedia(url: string | null | undefined): string | null {
  if (!url) return null
  if (url.startsWith('http') || url.startsWith('file://')) return url
  return `${API_BASE}${url}`
}

function videoGridFrame(mediaUrl: string | null | undefined, thumbnailUrl: string | null | undefined): string | null {
  if (mediaUrl?.includes('cloudinary.com') && mediaUrl.includes('/video/upload/')) {
    return mediaUrl.replace(
      '/video/upload/',
      '/video/upload/so_0,w_400,h_400,c_fill,q_auto:good,f_jpg/',
    )
  }
  return thumbnailUrl || null
}

function stillVisible(posts: Post[]): Post[] {
  const now = Date.now()
  return posts.filter((post) => (
    post.isAnnouncement
    || !post.expiresAt
    || new Date(post.expiresAt).getTime() > now
  ))
}

function PostTile({ post, size, label, likeLabel, commentLabel, onPress }: {
  post: Post
  size: number
  label: string
  likeLabel: string
  commentLabel: string
  onPress: () => void
}) {
  // A thumbnail do backend é um LQIP fortemente desfocado. Fotografias usam a
  // mídia nítida; vídeos Cloudinary recebem um frame JPEG próprio para a grelha.
  const mediaSource = post.mediaType === 'VIDEO'
    ? videoGridFrame(post.mediaUrl ?? post.mediaUrls?.[0], post.thumbnailUrl)
    : (post.mediaUrl ?? post.mediaUrls?.[0] ?? post.thumbnailUrl)
  const uri = resolveMedia(mediaSource)
  const gradientParts = post.bgColor?.split('|').filter(Boolean) ?? []
  const gradient: [string, string] = gradientParts.length >= 2
    ? [gradientParts[0], gradientParts[1]]
    : [gradientParts[0] ?? '#222930', gradientParts[0] ?? '#111519']
  const likes = post._count?.likes ?? 0
  const comments = post._count?.comments ?? 0
  const tileLabel = `${post.caption || label}. ${likes} ${likeLabel}. ${comments} ${commentLabel}`

  return (
    <TouchableOpacity
      style={[s.tile, { width: size, height: size }]}
      onPress={onPress}
      activeOpacity={0.84}
      accessibilityRole="button"
      accessibilityLabel={tileLabel}
    >
      {post.mediaType === 'TEXT' ? (
        <LinearGradient
          colors={gradient}
          style={[s.tileMedia, s.tileTextMedia]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          <Text style={s.tileText} numberOfLines={5}>{post.caption}</Text>
        </LinearGradient>
      ) : uri ? (
        <Image
          source={{ uri }}
          style={s.tileMedia}
          contentFit="cover"
          cachePolicy="disk"
          recyclingKey={`author-grid:${post.id}`}
          transition={90}
        />
      ) : (
        <View style={[s.tileMedia, s.tileFallback]}>
          <Icon name="image" size={20} color="#A8AAAD" strokeWidth={1.6} />
        </View>
      )}

      {post.mediaType === 'VIDEO' && (
        <View style={s.videoBadge} pointerEvents="none">
          <View style={s.playTriangle} />
        </View>
      )}

      <View style={s.tileStats} pointerEvents="none">
        <LinearGradient
          colors={['transparent', 'rgba(4,5,7,0.72)']}
          locations={[0, 1]}
          style={StyleSheet.absoluteFillObject}
        />
        <View style={s.tileStatsRow}>
          <View style={s.tileMetric}>
            <FeedIcon name="heart-solid" size={13} color="#FFFFFF" weight="regular" />
            <Text style={s.tileMetricText}>{compactMetric(likes)}</Text>
          </View>
          <View style={s.tileMetric}>
            <FeedIcon name="chat-solid" size={12} color="#FFFFFF" weight="regular" />
            <Text style={s.tileMetricText}>{compactMetric(comments)}</Text>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  )
}

interface Props {
  author: Post['user']
  onClose: () => void
}

export default memo(function AuthorPostsModal({ author, onClose }: Props) {
  const t = useT()
  const navigation = useNavigation<any>()
  const reduceMotion = useReducedMotionPreference()
  const { width: windowWidth, height: windowHeight } = useWindowDimensions()
  const { bottom } = useSafeAreaInsets()
  const showPostInFeed = useFeedStore((state) => state.showPostInFeed)
  const [posts, setPosts] = useState<Post[]>([])
  const [loading, setLoading] = useState(true)
  const [failed, setFailed] = useState(false)
  const [retry, setRetry] = useState(0)
  // A folha ocupa a largura inteira; usar essa largura já no primeiro frame
  // evita a grelha nascer em tiles de 1px à espera do onLayout.
  const [gridWidth, setGridWidth] = useState(windowWidth)
  const sheetHeight = Math.min(Math.round(windowHeight * 0.9), windowHeight - 18)
  const sheetY = useRef(new Animated.Value(reduceMotion ? 0 : sheetHeight)).current
  const backdropOpacity = useRef(new Animated.Value(reduceMotion ? 1 : 0)).current
  const closingRef = useRef(false)

  useEffect(() => {
    if (reduceMotion) {
      sheetY.setValue(0)
      backdropOpacity.setValue(1)
      return
    }
    const animation = Animated.parallel([
      Animated.spring(sheetY, {
        toValue: 0,
        speed: 20,
        bounciness: 3,
        useNativeDriver: true,
      }),
      Animated.timing(backdropOpacity, {
        toValue: 1,
        duration: 180,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ])
    animation.start()
    return () => animation.stop()
  }, [backdropOpacity, reduceMotion, sheetY])

  useEffect(() => {
    let active = true
    const cacheKey = `profile_posts:${author.id}`

    ;(async () => {
      setLoading(true)
      setFailed(false)
      const cached = stillVisible(await getCache<Post[]>(cacheKey).catch(() => null) ?? [])
      if (!active) return
      if (cached.length > 0) {
        setPosts(cached)
        setLoading(false)
      }

      if (!isConnected()) {
        if (cached.length === 0) setFailed(true)
        setLoading(false)
        return
      }

      try {
        const fresh = stillVisible(await getUserPosts(author.id))
        if (!active) return
        setPosts(fresh)
        setCache(cacheKey, fresh).catch(() => {})
      } catch {
        if (active && cached.length === 0) setFailed(true)
      } finally {
        if (active) setLoading(false)
      }
    })()

    return () => { active = false }
  }, [author.id, retry])

  const animateClose = useCallback((after?: () => void) => {
    if (closingRef.current) return
    closingRef.current = true
    const finish = () => {
      onClose()
      after?.()
    }
    if (reduceMotion) {
      finish()
      return
    }
    Animated.parallel([
      Animated.timing(sheetY, {
        toValue: sheetHeight,
        duration: 230,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(backdropOpacity, {
        toValue: 0,
        duration: 190,
        useNativeDriver: true,
      }),
    ]).start(({ finished }) => {
      if (finished) finish()
      else closingRef.current = false
    })
  }, [backdropOpacity, onClose, reduceMotion, sheetHeight, sheetY])

  const title = t.feed_author_posts.replace('{name}', author.name.split(' ')[0])
  const handle = displayHandle(author.username)
  const subtitle = posts.length === 1
    ? t.feed_author_post_count_one
    : t.feed_author_posts_count.replace('{count}', String(posts.length))
  const tileSize = useMemo(
    () => Math.max(1, Math.floor((gridWidth - GRID_GAP * 2) / 3)),
    [gridWidth],
  )

  function handleGridLayout(event: LayoutChangeEvent) {
    const width = event.nativeEvent.layout.width
    if (width > 0 && Math.abs(width - gridWidth) > 0.5) setGridWidth(width)
  }

  function openPost(post: Post) {
    showPostInFeed(post)
    animateClose(() => {
      requestAnimationFrame(() => {
        const ownState = navigation.getState?.()
        const stack = ownState?.type === 'stack' ? navigation : navigation.getParent?.()
        stack?.navigate?.('Tabs', { screen: 'Feed' })
      })
    })
  }

  return (
    <Modal
      visible
      transparent
      statusBarTranslucent
      animationType="none"
      onRequestClose={() => animateClose()}
    >
      <View style={s.modalRoot}>
        <Animated.View style={[s.backdrop, { opacity: backdropOpacity }]}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => animateClose()}
            accessible={false}
          />
        </Animated.View>

        <Animated.View
          style={[
            s.sheet,
            {
              height: sheetHeight,
              paddingBottom: Math.max(bottom, 8),
              transform: [{ translateY: sheetY }],
            },
          ]}
          accessibilityViewIsModal
          importantForAccessibility="yes"
        >
          <View style={s.handle} />

          <View style={s.topBar}>
            <TouchableOpacity
              style={s.topAction}
              onPress={() => animateClose()}
              activeOpacity={0.62}
              accessibilityRole="button"
              accessibilityLabel={t.circle_close}
            >
              <Icon name="arrow-left" size={20} color="#17181B" strokeWidth={2} />
            </TouchableOpacity>

            <View style={s.topCopy}>
              <Text style={s.topTitle} numberOfLines={1}>{handle || author.name}</Text>
              <Text style={s.topSubtitle}>{t.profile_publications}</Text>
            </View>

            <View style={s.topAction} pointerEvents="none" importantForAccessibility="no-hide-descendants">
              <FeedIcon name="author-posts" size={21} color="#17181B" weight="medium" />
            </View>
          </View>

          <View style={s.identityRow}>
            <View style={s.avatarRing}>
              <AvatarImage uri={author.avatar} name={author.name} size={46} borderWidth={0} borderColor="transparent" />
            </View>
            <View style={s.identityCopy}>
              <Text style={s.identityName} numberOfLines={1}>{author.name}</Text>
              <Text style={s.identityMeta} numberOfLines={1}>
                {author.statusLabel || (handle ? handle : title)}
              </Text>
            </View>
            <View style={s.postStat}>
              <Text style={s.postStatValue}>{loading && posts.length === 0 ? '—' : posts.length}</Text>
              <Text style={s.postStatLabel}>{t.profile_publications}</Text>
            </View>
          </View>

          <View style={s.gridTab}>
            <FeedIcon name="author-posts" size={19} color="#17181B" weight="medium" />
            <Text style={s.gridTabText}>{subtitle}</Text>
            <View style={s.gridTabAccent} />
          </View>

          <View style={s.gridWrap} onLayout={handleGridLayout}>
            {loading && posts.length === 0 ? (
              <View style={s.state}>
                <ActivityIndicator size="small" color={colors.primary} />
              </View>
            ) : failed && posts.length === 0 ? (
              <View style={s.state}>
                <Icon name="image" size={28} color="#929397" strokeWidth={1.5} />
                <Text style={s.stateText}>{t.feed_author_posts_load_fail}</Text>
                <TouchableOpacity style={s.retryButton} onPress={() => setRetry((value) => value + 1)} activeOpacity={0.76}>
                  <Text style={s.retryText}>{t.msg_try_again}</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <FlatList
                data={posts}
                keyExtractor={(post) => post.id}
                numColumns={3}
                renderItem={({ item }) => (
                  <PostTile
                    post={item}
                    size={tileSize}
                    label={title}
                    likeLabel={t.nf_likes}
                    commentLabel={t.nf_comments}
                    onPress={() => openPost(item)}
                  />
                )}
                columnWrapperStyle={s.gridRow}
                contentContainerStyle={posts.length === 0 ? s.emptyContent : s.gridContent}
                ListEmptyComponent={(
                  <View style={s.state}>
                    <Icon name="image" size={30} color="#ADAFB2" strokeWidth={1.5} />
                    <Text style={s.stateText}>{t.profile_no_posts}</Text>
                  </View>
                )}
                showsVerticalScrollIndicator={false}
                initialNumToRender={15}
                maxToRenderPerBatch={15}
                windowSize={5}
              />
            )}
          </View>
        </Animated.View>
      </View>
    </Modal>
  )
})

const s = StyleSheet.create({
  modalRoot: { flex: 1, justifyContent: 'flex-end' },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(5,7,9,0.68)',
  },
  sheet: {
    width: '100%',
    overflow: 'hidden',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    backgroundColor: '#FAFAF8',
    shadowColor: '#000',
    shadowOpacity: 0.28,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: -8 },
    elevation: 18,
  },
  handle: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    marginTop: 8,
    marginBottom: 3,
    borderRadius: 2,
    backgroundColor: '#D1D1CC',
  },
  topBar: {
    height: 52,
    paddingHorizontal: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  topAction: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  topCopy: { flex: 1, alignItems: 'center', paddingHorizontal: 6 },
  topTitle: {
    maxWidth: '100%',
    color: '#17181B',
    fontFamily: fonts.semiBold,
    fontSize: typography.body,
    lineHeight: 19,
    letterSpacing: -0.3,
  },
  topSubtitle: {
    marginTop: 1,
    color: '#85868A',
    fontFamily: fonts.medium,
    fontSize: typography.badge,
    lineHeight: 14,
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
  identityRow: {
    minHeight: 76,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
  },
  avatarRing: {
    width: 52,
    height: 52,
    padding: 2,
    borderRadius: 26,
    borderWidth: 1.5,
    borderColor: colors.primary,
  },
  identityCopy: { flex: 1, minWidth: 0 },
  identityName: {
    color: '#17181B',
    fontFamily: fonts.semiBold,
    fontSize: 17,
    lineHeight: 21,
    letterSpacing: -0.35,
  },
  identityMeta: {
    marginTop: 2,
    color: '#77787C',
    fontFamily: fonts.medium,
    fontSize: typography.meta,
    lineHeight: 16,
  },
  postStat: { minWidth: 66, alignItems: 'center' },
  postStatValue: {
    color: '#17181B',
    fontFamily: fonts.bold,
    fontSize: 19,
    lineHeight: 22,
    fontVariant: ['tabular-nums'],
  },
  postStatLabel: {
    marginTop: 1,
    color: '#7C7D81',
    fontFamily: fonts.medium,
    fontSize: typography.badge,
    lineHeight: 14,
  },
  gridTab: {
    height: 43,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#E1E1DD',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#DEDEDA',
  },
  gridTabText: {
    color: '#343538',
    fontFamily: fonts.semiBold,
    fontSize: typography.meta,
    lineHeight: 16,
    letterSpacing: -0.15,
  },
  gridTabAccent: {
    position: 'absolute',
    left: '50%',
    bottom: -StyleSheet.hairlineWidth,
    width: 34,
    height: 2,
    marginLeft: -17,
    borderRadius: 1,
    backgroundColor: colors.primary,
  },
  gridWrap: { flex: 1, backgroundColor: '#ECECE9' },
  gridContent: { paddingTop: GRID_GAP, paddingBottom: 20, gap: GRID_GAP },
  gridRow: { gap: GRID_GAP },
  tile: { overflow: 'hidden', backgroundColor: '#DFDFDB' },
  tileMedia: { width: '100%', height: '100%' },
  tileTextMedia: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: 28,
  },
  tileFallback: { alignItems: 'center', justifyContent: 'center' },
  tileText: {
    color: '#FFFFFF',
    fontFamily: fonts.semiBold,
    fontSize: typography.meta,
    lineHeight: 15,
    textAlign: 'center',
    paddingHorizontal: 7,
  },
  tileStats: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    left: 0,
    height: 38,
    justifyContent: 'flex-end',
    paddingHorizontal: 7,
    paddingBottom: 6,
  },
  tileStatsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  tileMetric: {
    minWidth: 30,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    shadowColor: '#000000',
    shadowOpacity: 0.42,
    shadowRadius: 2,
    shadowOffset: { width: 0, height: 1 },
  },
  tileMetricText: {
    color: '#FFFFFF',
    fontFamily: fonts.semiBold,
    fontSize: 10.5,
    lineHeight: 13,
    letterSpacing: -0.1,
    fontVariant: ['tabular-nums'],
    textShadowColor: 'rgba(0,0,0,0.42)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  videoBadge: {
    position: 'absolute',
    top: 7,
    right: 7,
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.48)',
  },
  playTriangle: {
    marginLeft: 2,
    width: 0,
    height: 0,
    borderTopWidth: 4,
    borderBottomWidth: 4,
    borderLeftWidth: 7,
    borderTopColor: 'transparent',
    borderBottomColor: 'transparent',
    borderLeftColor: '#FFFFFF',
  },
  state: {
    flex: 1,
    minHeight: 220,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    paddingHorizontal: 30,
    backgroundColor: '#FAFAF8',
  },
  stateText: {
    color: '#727378',
    fontFamily: fonts.medium,
    fontSize: typography.secondary,
    lineHeight: 19,
    textAlign: 'center',
  },
  retryButton: {
    minHeight: 42,
    paddingHorizontal: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 21,
    backgroundColor: '#17181B',
  },
  retryText: {
    color: '#FFFFFF',
    fontFamily: fonts.semiBold,
    fontSize: typography.secondary,
  },
  emptyContent: { flexGrow: 1, backgroundColor: '#FAFAF8' },
})
