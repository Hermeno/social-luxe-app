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

import AuthorAvatar from '../../components/AuthorAvatar'
import FeedIcon from '../../components/FeedIcon'
import Icon from '../../components/Icon'
import { feedIcon, feedInk, FEED_STROKE } from './tokens'
import { API_BASE } from '../../config'
import { getCache, setCache } from '../../db/database'
import useReducedMotionPreference from '../../hooks/useReducedMotionPreference'
import { useT } from '../../i18n'
import { isConnected } from '../../services/netinfo.service'
import { getUserPosts } from '../../services/user.service'
import { useFeedStore } from '../../store/feed.store'
import { colors, fonts, leading, postGradientColors, radius, sheet as sheetInk, spacing, typography } from '../../theme'
import type { Post } from '../../types'
import { displayHandle } from '../../utils/handle'

/** Fundo de um post de texto sem cor própria — dois pretos, para a grelha
 *  não ficar com uma célula chapada. */
const TEXT_POST_FALLBACK: [string, string] = ['#222222', '#111111']

const GRID_GAP = 1.5

// Zero não se escreve: numa miniatura, um "0" ao lado do coração ocupa o mesmo
// espaço que um número verdadeiro e não diz nada que a ausência não diga melhor.
function compactMetric(value: number): string | null {
  if (value <= 0) return null
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
  const gradient = postGradientColors(post.bgColor, TEXT_POST_FALLBACK)
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
          <Icon name="image" size={feedIcon.control} color={sheetInk.inkFaint} strokeWidth={FEED_STROKE} absoluteStrokeWidth />
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
          {!!compactMetric(likes) && (
            <View style={s.tileMetric}>
              <FeedIcon name="heart-solid" size={feedIcon.inline} color={feedInk.primary} weight="regular" />
              <Text style={s.tileMetricText}>{compactMetric(likes)}</Text>
            </View>
          )}
          {!!compactMetric(comments) && (
            <View style={s.tileMetric}>
              <FeedIcon name="chat-solid" size={feedIcon.inline} color={feedInk.primary} weight="regular" />
              <Text style={s.tileMetricText}>{compactMetric(comments)}</Text>
            </View>
          )}
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
              <Icon name="arrow-left" size={feedIcon.control} color={sheetInk.ink} strokeWidth={FEED_STROKE} absoluteStrokeWidth />
            </TouchableOpacity>

            <View style={s.topCopy}>
              <Text style={s.topTitle} numberOfLines={1}>{handle || author.name}</Text>
              <Text style={s.topSubtitle}>{t.profile_publications}</Text>
            </View>

            <View style={s.topAction} pointerEvents="none" importantForAccessibility="no-hide-descendants">
              <FeedIcon name="author-posts" size={feedIcon.control} color={sheetInk.ink} weight="medium" />
            </View>
          </View>

          <View style={s.identityRow}>
            <AuthorAvatar
              uri={author.avatar}
              name={author.name}
              avatarSize={46}
              ringWidth={2}
              gap={1}
              wellColor={sheetInk.surface}
            />
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
            <FeedIcon name="author-posts" size={feedIcon.control} color={sheetInk.ink} weight="medium" />
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
                <Icon name="image" size={feedIcon.action} color={sheetInk.inkFaint} strokeWidth={FEED_STROKE} absoluteStrokeWidth />
                <Text style={s.stateText}>{t.feed_author_posts_load_fail}</Text>
                <TouchableOpacity
                  style={s.retryButton}
                  onPress={() => setRetry((value) => value + 1)}
                  activeOpacity={0.76}
                  accessibilityRole="button"
                  accessibilityLabel={t.msg_try_again}
                >
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
                    <Icon name="image" size={feedIcon.action} color={sheetInk.inkFaint} strokeWidth={FEED_STROKE} absoluteStrokeWidth />
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
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    backgroundColor: sheetInk.surface,
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
    marginTop: spacing.sm,
    marginBottom: spacing.xs,
    borderRadius: radius.full,
    backgroundColor: sheetInk.lineStrong,
  },
  topBar: {
    height: 52,
    paddingHorizontal: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
  },
  topAction: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  topCopy: { flex: 1, alignItems: 'center', paddingHorizontal: spacing.xs2 },
  topTitle: {
    maxWidth: '100%',
    color: sheetInk.ink,
    fontFamily: fonts.regular,
    fontSize: typography.body,
    lineHeight: leading.body,
    letterSpacing: -0.3,
  },
  topSubtitle: {
    marginTop: 1,
    color: sheetInk.inkMuted,
    fontFamily: fonts.regular,
    fontSize: typography.badge,
    lineHeight: leading.badge,
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
  identityRow: {
    minHeight: 76,
    paddingHorizontal: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm2,
  },
  identityCopy: { flex: 1, minWidth: 0 },
  identityName: {
    color: sheetInk.ink,
    fontFamily: fonts.regular,
    fontSize: typography.section,
    lineHeight: leading.section,
    letterSpacing: -0.35,
  },
  identityMeta: {
    marginTop: 2,
    color: sheetInk.inkMuted,
    fontFamily: fonts.regular,
    fontSize: typography.meta,
    lineHeight: leading.meta,
  },
  postStat: { minWidth: 66, alignItems: 'center' },
  postStatValue: {
    color: sheetInk.ink,
    fontFamily: fonts.regular,
    fontSize: typography.section,
    lineHeight: leading.section,
    fontVariant: ['tabular-nums'],
  },
  postStatLabel: {
    marginTop: 1,
    color: sheetInk.inkMuted,
    fontFamily: fonts.regular,
    fontSize: typography.badge,
    lineHeight: leading.badge,
  },
  gridTab: {
    height: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: sheetInk.line,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: sheetInk.line,
  },
  gridTabText: {
    color: sheetInk.inkSoft,
    fontFamily: fonts.regular,
    fontSize: typography.meta,
    lineHeight: leading.meta,
    letterSpacing: -0.15,
  },
  gridTabAccent: {
    position: 'absolute',
    left: '50%',
    bottom: -StyleSheet.hairlineWidth,
    width: 34,
    height: 2,
    marginLeft: -17,
    borderRadius: radius.full,
    backgroundColor: colors.primary,
  },
  gridWrap: { flex: 1, backgroundColor: sheetInk.surfaceSunk },
  gridContent: { paddingTop: GRID_GAP, paddingBottom: spacing.md2, gap: GRID_GAP },
  gridRow: { gap: GRID_GAP },
  tile: { overflow: 'hidden', backgroundColor: sheetInk.line },
  tileMedia: { width: '100%', height: '100%' },
  tileTextMedia: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: spacing.lg,
  },
  tileFallback: { alignItems: 'center', justifyContent: 'center' },
  tileText: {
    color: colors.white,
    fontFamily: fonts.regular,
    fontSize: typography.meta,
    lineHeight: leading.meta,
    textAlign: 'center',
    paddingHorizontal: spacing.sm,
  },
  tileStats: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    left: 0,
    height: 38,
    justifyContent: 'flex-end',
    paddingHorizontal: spacing.sm,
    paddingBottom: spacing.xs2,
  },
  tileStatsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm2,
  },
  tileMetric: {
    minWidth: 30,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    shadowColor: colors.black,
    shadowOpacity: 0.42,
    shadowRadius: 2,
    shadowOffset: { width: 0, height: 1 },
  },
  tileMetricText: {
    color: colors.white,
    fontFamily: fonts.regular,
    fontSize: typography.badge,
    lineHeight: leading.badge,
    letterSpacing: -0.1,
    fontVariant: ['tabular-nums'],
    textShadowColor: 'rgba(0,0,0,0.42)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  videoBadge: {
    position: 'absolute',
    top: spacing.sm,
    right: spacing.sm,
    width: 20,
    height: 20,
    borderRadius: radius.full,
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
    borderLeftColor: colors.white,
  },
  state: {
    flex: 1,
    minHeight: 220,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm2,
    paddingHorizontal: spacing.xl,
    backgroundColor: sheetInk.surface,
  },
  stateText: {
    color: sheetInk.inkMuted,
    fontFamily: fonts.regular,
    fontSize: typography.secondary,
    lineHeight: leading.secondary,
    textAlign: 'center',
  },
  retryButton: {
    minHeight: 44,
    paddingHorizontal: spacing.md2,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.full,
    backgroundColor: sheetInk.ink,
  },
  retryText: {
    color: colors.white,
    fontFamily: fonts.regular,
    fontSize: typography.secondary,
    lineHeight: leading.secondary,
  },
  emptyContent: { flexGrow: 1, backgroundColor: sheetInk.surface },
})
