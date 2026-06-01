import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react'
import {
  View,
  Text,
  TextInput,
  FlatList,
  TouchableOpacity,
  Pressable,
  StyleSheet,
  Dimensions,
  Animated,
} from 'react-native'
import { Image } from 'expo-image'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useNavigation } from '@react-navigation/native'
import { StackNavigationProp } from '@react-navigation/stack'
import { useFocusEffect, useIsFocused } from '@react-navigation/native'
import { LinearGradient } from 'expo-linear-gradient'
import { Ionicons } from '@expo/vector-icons'
import { useVideoPlayer, VideoView } from 'expo-video'
import { Post } from '../../types'
import { useFeed } from '../../hooks/useFeed'
import { useFeedStore } from '../../store/feed.store'
import { AppStackParams } from '../../navigation/AppNavigator'
import { markPostViewed, getViewedPostIds } from '../../db/database'
import { getOrDownload, prefetchMedia } from '../../db/mediaCache'
import { colors, fonts, spacing, gradients } from '../../theme'
import AvatarImage from '../../components/AvatarImage'
import SegmentedRing from '../../components/SegmentedRing'
import ActionBar from './ActionBar'
import PostInfo from './PostInfo'
import CommentSheet from '../../components/CommentSheet'
import { API_BASE } from '../../config'

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window')
const RING_SIZE      = 72
const AVATAR_SIZE    = 58
const IMAGE_DURATION = 30000

type Nav = StackNavigationProp<AppStackParams>

interface UserGroup {
  user: Post['user']
  posts: Post[]
}

function resolveMedia(url: string) {
  return url.startsWith('http') ? url : `${API_BASE}${url}`
}

// ─── Bubble Item ──────────────────────────────────────────────────────────────
function BubbleItem({
  item,
  isActive,
  viewedCount,
  index,
  onPress,
}: {
  item: UserGroup
  isActive: boolean
  viewedCount: number
  index: number
  onPress: () => void
}) {
  const unviewedCount = item.posts.length - viewedCount

  const opacity    = useRef(new Animated.Value(0)).current
  const entryY     = useRef(new Animated.Value(14)).current
  const scaleAnim  = useRef(new Animated.Value(1)).current
  const spinAnim   = useRef(new Animated.Value(0)).current
  // Entrance stagger
  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 280, delay: index * 55, useNativeDriver: true }),
      Animated.spring(entryY,  { toValue: 0, speed: 18, bounciness: 7, delay: index * 55, useNativeDriver: true } as any),
    ]).start()
  }, [])

  // Active scale pulse
  useEffect(() => {
    Animated.spring(scaleAnim, {
      toValue: isActive ? 1.08 : 1,
      useNativeDriver: true,
      speed: 20, bounciness: 8,
    }).start()
  }, [isActive])

  function handlePress() {
    spinAnim.setValue(0)
    Animated.sequence([
      Animated.timing(spinAnim, { toValue: 1, duration: 180, useNativeDriver: true }),
      Animated.spring(spinAnim, { toValue: 0, speed: 22, bounciness: 10, useNativeDriver: true }),
    ]).start()
    onPress()
  }

  const rotate = spinAnim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '20deg'] })

  return (
    <Animated.View style={{ opacity, transform: [{ translateY: entryY }] }}>
      <TouchableOpacity style={s.bubbleItem} onPress={handlePress} activeOpacity={0.75}>

        {/* Ring + badge container */}
        <View style={s.ringContainer}>
          <Animated.View style={[s.ringWrap, { transform: [{ scale: scaleAnim }, { rotate }] }]}>
            <SegmentedRing
              count={item.posts.length}
              viewedCount={viewedCount}
              size={RING_SIZE}
              strokeWidth={3}
            />
            <View style={s.avatarCenter}>
              <AvatarImage uri={item.user.avatar} size={AVATAR_SIZE} />
            </View>
          </Animated.View>

        </View>

        <Text style={s.bubbleName} numberOfLines={1}>
          {item.user.name.split(' ')[0]}
        </Text>
      </TouchableOpacity>
    </Animated.View>
  )
}

// ─── Progress Bars ────────────────────────────────────────────────────────────
function ProgressBars({ count, current, progress }: {
  count: number; current: number; progress: Animated.Value
}) {
  return (
    <View style={s.progressRow}>
      {Array.from({ length: count }, (_, i) => (
        <View key={i} style={s.progressTrack}>
          {i < current ? (
            <View style={s.progressFull} />
          ) : i === current ? (
            <Animated.View
              style={[s.progressFill, {
                width: progress.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }),
              }]}
            />
          ) : null}
        </View>
      ))}
    </View>
  )
}

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function FeedScreen() {
  const { posts, refresh, loadMore, prependPost, removePost, updatePost } = useFeed()
  const nav       = useNavigation<Nav>()
  const { top }   = useSafeAreaInsets()
  const isFocused = useIsFocused()

  // Consume a post published from CreateScreen → prepend instantly
  const pendingPost    = useFeedStore((s) => s.pendingPost)
  const setPendingPost = useFeedStore((s) => s.setPendingPost)
  useEffect(() => {
    if (!pendingPost) return
    prependPost(pendingPost)
    setCurrentIndex(0)
    setPendingPost(null)
  }, [pendingPost])

  const [currentIndex, setCurrentIndex] = useState(0)
  const [commentPost, setCommentPost]   = useState<Post | null>(null)
  const [viewedIds, setViewedIds]       = useState<Set<string>>(new Set())
  const [searchMode, setSearchMode]     = useState(false)
  const [searchQuery, setSearchQuery]   = useState('')
  const [viewerW, setViewerW] = useState(SCREEN_W)
  const [viewerH, setViewerH] = useState(SCREEN_H)

  // Thumbnail → full-media crossfade opacity
  const mediaOpacity = useRef(new Animated.Value(0)).current

  const progressAnim     = useRef(new Animated.Value(0)).current
  const progressRef      = useRef<Animated.CompositeAnimation | null>(null)
  const progressValueRef = useRef(0)   // always tracks current animated value
  const pressStartRef    = useRef(0)
  const bubblesRef       = useRef<FlatList>(null)

  // Keep refs in sync for callbacks that can't depend on state
  const postRef      = useRef<Post | undefined>(undefined)
  const isFocusedRef = useRef(isFocused)
  isFocusedRef.current = isFocused

  // Track progress value continuously
  useEffect(() => {
    const id = progressAnim.addListener(({ value }) => { progressValueRef.current = value })
    return () => progressAnim.removeListener(id)
  }, [])

  // Safe wrapper — expo-video player can be released by native side during tab switches
  const safePlayer = useCallback((fn: () => void) => {
    try { fn() } catch { /* player already released — ignore */ }
  }, [])

  // Load persisted viewed post IDs on mount
  useEffect(() => {
    getViewedPostIds().then(setViewedIds).catch(() => {})
  }, [])

  const player = useVideoPlayer(null, (p) => { p.loop = false; p.muted = false })
  // Stores the actual loaded video duration (seconds → ms) so progress and resume use the real length
  const videoDurRef = useRef(0)

  // ── Data ──────────────────────────────────────────────────────────────────
  const userGroups = useMemo<UserGroup[]>(() => {
    const map = new Map<string, UserGroup>()
    posts.forEach((p) => {
      if (!map.has(p.user.id)) map.set(p.user.id, { user: p.user, posts: [] })
      map.get(p.user.id)!.posts.push(p)
    })
    return Array.from(map.values())
  }, [posts])

  const filteredGroups = useMemo(
    () => searchQuery.trim()
      ? userGroups.filter((g) => g.user.name.toLowerCase().includes(searchQuery.toLowerCase()))
      : userGroups,
    [userGroups, searchQuery],
  )

  const flatPosts = useMemo(() => {
    const seen = new Set<string>()
    return userGroups.flatMap((g) => g.posts).filter((p) => {
      if (seen.has(p.id)) return false
      seen.add(p.id)
      return true
    })
  }, [userGroups])

  const post = flatPosts[currentIndex]
  postRef.current = post

  // Total posts not yet viewed — shown as badge on Home icon in ActionBar
  const newPostsCount = useMemo(
    () => flatPosts.filter((p) => !viewedIds.has(p.id)).length,
    [flatPosts, viewedIds],
  )

  function viewedCountFor(group: UserGroup): number {
    return group.posts.filter((p) => viewedIds.has(p.id)).length
  }

  const currentGroupFirstIdx = useMemo(
    () => (post ? flatPosts.findIndex((p) => p.user.id === post.user.id) : 0),
    [post, flatPosts],
  )
  const currentGroup       = post ? userGroups.find((g) => g.user.id === post.user.id) : undefined
  const currentPostInGroup = currentIndex - currentGroupFirstIdx

  const goNext = useCallback(() => {
    setCurrentIndex((i) => {
      // Stop at last post — no wrap-around
      if (i >= flatPosts.length - 1) return i
      if (flatPosts.length - i <= 3) loadMore()
      return i + 1
    })
  }, [flatPosts.length, loadMore])

  const goPrev = useCallback(() => {
    setCurrentIndex((i) => (i > 0 ? i - 1 : 0))
  }, [])
  const goNextRef = useRef(goNext)
  goNextRef.current = goNext

  function jumpToUser(group: UserGroup) {
    const idx = flatPosts.findIndex((p) => p.user.id === group.user.id)
    if (idx >= 0) setCurrentIndex(idx)
  }

  // ── Playback helpers ──────────────────────────────────────────────────────

  // Resume from current progress value (used by hold-release and comment-close)
  function resumeFromCurrent() {
    const p = postRef.current
    if (!p || !isFocusedRef.current || commentPost) return
    if (p.mediaType === 'VIDEO') safePlayer(() => player.play())
    const totalDur = p.mediaType === 'VIDEO' ? (videoDurRef.current || IMAGE_DURATION) : IMAGE_DURATION
    const remaining = Math.max(400, (1 - progressValueRef.current) * totalDur)
    progressRef.current = Animated.timing(progressAnim, {
      toValue: 1, duration: remaining, useNativeDriver: false,
    })
    progressRef.current.start(({ finished }) => { if (finished) goNextRef.current() })
  }

  // ── Main playback effect (new post or focus change) ───────────────────────
  useEffect(() => {
    progressRef.current?.stop()
    safePlayer(() => player.pause())
    progressAnim.setValue(0)
    progressValueRef.current = 0
    // Reset crossfade — thumbnail shows while full media loads
    mediaOpacity.setValue(0)

    if (!post || !isFocused) return

    // Persist view
    if (!viewedIds.has(post.id)) {
      markPostViewed(post.id).catch(() => {})
      setViewedIds((prev) => new Set(prev).add(post.id))
    }

    if (commentPost) return

    function startProgress(durationMs: number) {
      progressRef.current = Animated.timing(progressAnim, {
        toValue: 1, duration: durationMs, useNativeDriver: false,
      })
      progressRef.current.start(({ finished }) => { if (finished) goNextRef.current() })
    }

    function revealMedia() {
      Animated.timing(mediaOpacity, { toValue: 1, duration: 300, useNativeDriver: true }).start()
    }

    // TEXT posts: show immediately, run timer like an image
    if (post.mediaType === 'TEXT') {
      mediaOpacity.setValue(1)
      startProgress(IMAGE_DURATION)
      return () => { progressRef.current?.stop() }
    }

    if (post.mediaType === 'VIDEO') {
      videoDurRef.current = 0
      let started   = false
      let cancelled = false

      const remoteUrl = resolveMedia(post.mediaUrl ?? '')
      const mountDelay = setTimeout(async () => {
        if (cancelled) return
        // Use local cached file if available, stream from Cloudinary otherwise
        const localPath = await getOrDownload(remoteUrl)
        if (cancelled) return
        safePlayer(() => player.replace({ uri: localPath ?? remoteUrl }))
      }, 60)

      const sub = (player as any).addListener('statusChange', ({ status }: { status: string }) => {
        if (started || cancelled) return
        if (status === 'readyToPlay' && player.duration > 0) {
          started = true
          const dur = Math.round(player.duration * 1000)
          videoDurRef.current = dur
          safePlayer(() => player.play())
          revealMedia()      // ← crossfade in the video
          startProgress(dur)
        }
      })

      return () => {
        cancelled = true
        clearTimeout(mountDelay)
        sub?.remove?.()
        progressRef.current?.stop()
        safePlayer(() => player.pause())
      }
    }

    // Image: reveal immediately (expo-image loads fast from disk cache)
    // onLoadEnd in the Image component also calls revealMedia
    startProgress(IMAGE_DURATION)
    return () => { progressRef.current?.stop() }
  }, [currentIndex, isFocused])

  // ── Comment sheet pause / resume effect ──────────────────────────────────
  useEffect(() => {
    if (commentPost) {
      progressRef.current?.stop()
      safePlayer(() => player.pause())
    } else {
      resumeFromCurrent()
    }
  }, [!!commentPost])

  // ── Refresh and reset on screen focus ────────────────────────────────────
  // Use a ref so useFocusEffect always calls the latest refresh (no stale closure)
  const refreshRef = useRef(refresh)
  refreshRef.current = refresh

  useFocusEffect(useCallback(() => {
    refreshRef.current()
    // Only reset index when NOT arriving from a publish (pendingPost handles that)
    if (!useFeedStore.getState().pendingPost) setCurrentIndex(0)
  }, []))

  // Prefetch next 2 posts' media into device storage
  useEffect(() => {
    const urls = flatPosts
      .slice(currentIndex + 1, currentIndex + 3)
      .filter((p) => p.mediaType === 'VIDEO')
      .map((p) => resolveMedia(p.mediaUrl ?? ''))
    if (urls.length > 0) prefetchMedia(urls)
  }, [currentIndex])

  // Keep active bubble in view
  useEffect(() => {
    if (!post) return
    const groupIdx = userGroups.findIndex((g) => g.user.id === post.user.id)
    if (groupIdx >= 0) {
      bubblesRef.current?.scrollToIndex({ index: groupIdx, animated: true, viewPosition: 0.5 })
    }
  }, [currentIndex])

  // ── Hold-to-pause handlers ────────────────────────────────────────────────
  function handlePressIn() {
    pressStartRef.current = Date.now()
    progressRef.current?.stop()
    safePlayer(() => player.pause())
  }

  function handlePressOut(navigate: () => void) {
    const held = Date.now() - pressStartRef.current
    if (held < 220) {
      navigate()         // Short tap → navigate (useEffect resets everything)
    } else {
      resumeFromCurrent() // Long hold → resume from current position
    }
  }

  // ── Viewer dimensions measured for reliable native clipping ───────────────
  const videoStyle = useMemo(
    () => viewerH > 0
      ? { width: viewerW, height: viewerH }   // exact pixels — no overflow possible
      : { width: '100%' as const, height: '100%' as const },
    [viewerW, viewerH],
  )

  return (
    <View style={s.container}>
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      {searchMode ? (
        <View style={[s.searchBar, { paddingTop: top + 10 }]}>
          <View style={s.searchField}>
            <Ionicons name="search" size={16} color={colors.gray400} />
            <TextInput
              autoFocus
              placeholder="Pesquisar pessoas..."
              placeholderTextColor={colors.gray400}
              value={searchQuery}
              onChangeText={setSearchQuery}
              style={s.searchFieldInput}
            />
          </View>
          <TouchableOpacity
            onPress={() => { setSearchMode(false); setSearchQuery('') }}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Text style={s.searchCancel}>Cancelar</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={[s.header, { paddingTop: top + 8 }]}>
          <TouchableOpacity onPress={() => setSearchMode(true)} activeOpacity={0.7} style={s.headerSideBtn}>
            <Ionicons name="search-outline" size={22} color={colors.gray800} />
          </TouchableOpacity>
          <Text style={s.logo}>luxe</Text>
          <TouchableOpacity onPress={() => nav.navigate('Profile', {})} activeOpacity={0.7} style={s.headerSideBtn}>
            <Ionicons name="person-outline" size={22} color={colors.gray800} />
          </TouchableOpacity>
        </View>
      )}

      {/* ── User bubble row ────────────────────────────────────────────────── */}
      <FlatList
        ref={bubblesRef}
        horizontal
        data={filteredGroups}
        keyExtractor={(g) => g.user.id}
        showsHorizontalScrollIndicator={false}
        style={s.bubbleRow}
        contentContainerStyle={s.bubbleList}
        onScrollToIndexFailed={() => {}}
        ListHeaderComponent={
          !searchMode ? (
            <TouchableOpacity
              style={s.bubbleItem}
              onPress={() => nav.navigate('Create' as any)}
              activeOpacity={0.75}
            >
              <View style={s.ringContainer}>
                <View style={s.createRing}>
                  <View style={s.createCircle}>
                    <Ionicons name="add" size={28} color={colors.white} />
                  </View>
                </View>
              </View>
              <Text style={s.bubbleName}>Criar</Text>
            </TouchableOpacity>
          ) : null
        }
        renderItem={({ item, index }) => (
          <BubbleItem
            item={item}
            isActive={post?.user.id === item.user.id}
            viewedCount={viewedCountFor(item)}
            index={index}
            onPress={() => {
              jumpToUser(item)
              setSearchMode(false)
              setSearchQuery('')
            }}
          />
        )}
        ListEmptyComponent={
          <View style={s.noBubbles}>
            <Text style={s.noBubblesText}>
              {searchQuery ? 'Nenhum resultado' : 'Ainda não há publicações'}
            </Text>
          </View>
        }
      />

      {/* ── Inline Viewer ──────────────────────────────────────────────────── */}
      {post ? (
        <View
          style={s.viewer}
          onLayout={(e) => {
            setViewerW(e.nativeEvent.layout.width)
            setViewerH(e.nativeEvent.layout.height)
          }}
        >
          {/* ── Media: thumbnail → full-media crossfade ──────────────────── */}
          <View style={s.mediaClip} renderToHardwareTextureAndroid>

            {post.mediaType === 'TEXT' ? (
              /* TEXT post — full-screen colour card */
              <View style={[s.absLayer, s.textCard, { backgroundColor: post.bgColor ?? '#FF4B6E' }]}>
                <Text style={s.textCardContent}>{post.caption}</Text>
              </View>
            ) : (
              <>
                {/* Layer 1: blurred thumbnail — mesma proporção da imagem final */}
                <Image
                  source={{ uri: post.thumbnailUrl ?? resolveMedia(post.mediaUrl ?? '') }}
                  style={s.absLayer}
                  contentFit={post.mediaType === 'VIDEO' ? 'cover' : 'contain'}
                  cachePolicy="disk"
                  recyclingKey={`thumb-${post.id}`}
                />

                {/* Layer 2: media completa — vídeo cover, imagem contain (sem forçar) */}
                <Animated.View style={[s.absLayer, { opacity: mediaOpacity }]}>
                  {post.mediaType === 'VIDEO' ? (
                    <VideoView
                      player={player}
                      style={StyleSheet.absoluteFill}
                      contentFit="cover"
                      nativeControls={false}
                    />
                  ) : (
                    <Image
                      key={post.id}
                      source={{ uri: resolveMedia(post.mediaUrl ?? '') }}
                      style={s.absLayer}
                      contentFit="contain"
                      cachePolicy="disk"
                      recyclingKey={post.id}
                      onLoadEnd={() => {
                        Animated.timing(mediaOpacity, {
                          toValue: 1, duration: 200, useNativeDriver: true,
                        }).start()
                      }}
                    />
                  )}
                </Animated.View>
              </>
            )}

          </View>

          {post.mediaType !== 'TEXT' && (
            <>
              <LinearGradient colors={gradients.feedTop}    style={s.topGradient} />
              <LinearGradient colors={gradients.feedBottom} style={s.bottomGradient} />
            </>
          )}

          {currentGroup && (
            <View style={s.progressWrap} pointerEvents="none">
              <ProgressBars
                count={currentGroup.posts.length}
                current={currentPostInGroup}
                progress={progressAnim}
              />
            </View>
          )}

          {/* Tap zones: Pressable for press-in / press-out (hold-to-pause) */}
          <Pressable
            style={s.leftTap}
            onPressIn={handlePressIn}
            onPressOut={() => handlePressOut(goPrev)}
          />
          <Pressable
            style={s.rightTap}
            onPressIn={handlePressIn}
            onPressOut={() => handlePressOut(goNext)}
          />

          <PostInfo key={`info-${post.id}`} post={post} isActive />
          <ActionBar
            key={`bar-${post.id}`}
            post={post}
            onCommentPress={() => setCommentPost(post)}
            newPostsCount={newPostsCount}
            onDeleted={(id) => { removePost(id); setCurrentIndex((i) => Math.max(0, i - 1)) }}
            onEdited={(id, caption) => updatePost(id, caption)}
          />
        </View>
      ) : (
        <View style={s.emptyViewer}>
          <View style={s.emptyIconWrap}>
            <Ionicons name="people-outline" size={48} color="#4C8CE4" />
          </View>
          <Text style={s.emptyTitle}>O teu feed está vazio</Text>
          <Text style={s.emptySub}>Segue pessoas para ver as publicações delas aqui.</Text>
          <TouchableOpacity
            style={s.emptyBtn}
            onPress={() => nav.navigate('Search')}
            activeOpacity={0.85}
          >
            <Ionicons name="search" size={18} color="#fff" />
            <Text style={s.emptyBtnText}>Encontrar pessoas a seguir</Text>
          </TouchableOpacity>
        </View>
      )}

      {commentPost && (
        <CommentSheet post={commentPost} onClose={() => setCommentPost(null)} />
      )}
    </View>
  )
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.white },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingBottom: 10,
    backgroundColor: colors.white,
  },
  logo:          { fontFamily: fonts.extraBold, fontSize: 26, color: colors.gray800, letterSpacing: -1.2 },
  headerSideBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerRight:   { flexDirection: 'row', alignItems: 'center', gap: 6 },
  headerBtn:     { padding: 4 },
  headerIconGroup: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.gray100,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.gray200,
    overflow: 'hidden',
  },
  headerGroupBtn:     { paddingHorizontal: 13, paddingVertical: 9 },
  headerGroupDivider: { width: 1, height: 18, backgroundColor: colors.gray200 },

  searchBar: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: spacing.md, paddingBottom: 8, gap: 12,
    backgroundColor: colors.white,
  },
  searchField: {
    flex: 1, flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.gray100, borderRadius: 12,
    paddingHorizontal: 12, paddingVertical: 9, gap: 8,
  },
  searchFieldInput: {
    flex: 1, fontFamily: fonts.regular, fontSize: 15,
    color: colors.gray800, padding: 0,
  },
  searchCancel: { fontFamily: fonts.semiBold, fontSize: 15, color: colors.primary },
  headerIconWrap: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: colors.gray800,
    alignItems: 'center', justifyContent: 'center',
  },

  ringContainer: {
    width: RING_SIZE, height: RING_SIZE,
    alignItems: 'center', justifyContent: 'center',
  },


  bubbleRow:    { flexGrow: 0, flexShrink: 0, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.gray200 },
  bubbleList:   { paddingHorizontal: 16, paddingTop: 6, paddingBottom: 10, gap: 14 },
  bubbleItem:   { alignItems: 'center', gap: 5, width: RING_SIZE },
  ringWrap:     { width: RING_SIZE, height: RING_SIZE, alignItems: 'center', justifyContent: 'center' },

  // "Criar" button — mesma dimensão que os avatares com anel
  createRing: {
    width: RING_SIZE, height: RING_SIZE,
    borderRadius: RING_SIZE / 2,
    borderWidth: 1.5,
    borderColor: colors.gray200,
    borderStyle: 'dashed',
    alignItems: 'center', justifyContent: 'center',
  },
  createCircle: {
    width: AVATAR_SIZE, height: AVATAR_SIZE, borderRadius: AVATAR_SIZE / 2,
    backgroundColor: colors.primary,
    alignItems: 'center', justifyContent: 'center',
  },

  avatarCenter:     { position: 'absolute', alignItems: 'center', justifyContent: 'center' },
  bubbleName:       { color: '#1A1A1A', fontFamily: fonts.medium, fontSize: 11, textAlign: 'center', letterSpacing: -0.1 },
  bubbleNameActive: { color: colors.primary },
  noBubbles:        { paddingHorizontal: 20, paddingVertical: 30 },
  noBubblesText:    { color: colors.gray400, fontFamily: fonts.regular, fontSize: 13 },

  viewer: {
    flex: 1,
    backgroundColor: colors.black,
    overflow: 'hidden',
  },
  mediaClip: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    overflow: 'hidden',
    backgroundColor: colors.black,
  },
  // Fills the mediaClip container — used by both thumbnail and full-media layers
  absLayer: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
  },
  textCard: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 36,
    paddingVertical: 60,
  },
  textCardContent: {
    fontSize: 30,
    fontFamily: fonts.semiBold,
    color: '#fff',
    textAlign: 'center',
    lineHeight: 42,
    letterSpacing: -0.5,
    textShadowColor: 'rgba(0,0,0,0.2)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 6,
  },
  topGradient:    { position: 'absolute', top: 0, left: 0, right: 0, height: 120 },
  bottomGradient: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 320 },

  progressWrap:  { position: 'absolute', top: 12, left: 0, right: 0, zIndex: 20 },
  progressRow:   { flexDirection: 'row', paddingHorizontal: 10, gap: 3 },
  progressTrack: {
    flex: 1, height: 2.5,
    backgroundColor: 'rgba(255,255,255,0.35)',
    borderRadius: 2, overflow: 'hidden',
  },
  progressFull:  { flex: 1, backgroundColor: colors.white },
  progressFill:  { height: '100%', backgroundColor: colors.white },

  leftTap:  { position: 'absolute', left: 0, top: 0, bottom: 155, width: SCREEN_W * 0.35, zIndex: 10 },
  rightTap: { position: 'absolute', left: SCREEN_W * 0.35, right: 80, top: 0, bottom: 155, zIndex: 10 },

  emptyViewer:  { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 36, gap: 14 },
  emptyIconWrap:{ width: 88, height: 88, borderRadius: 44, backgroundColor: 'rgba(255,75,110,0.1)', alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  emptyTitle:   { fontSize: 20, fontFamily: fonts.semiBold, color: colors.gray800, letterSpacing: -0.4, textAlign: 'center' },
  emptySub:     { fontSize: 14, fontFamily: fonts.regular, color: colors.gray400, textAlign: 'center', lineHeight: 20 },
  emptyBtn:     { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8, backgroundColor: '#4C8CE4', paddingHorizontal: 24, paddingVertical: 14, borderRadius: 14 },
  emptyBtnText: { color: '#fff', fontFamily: fonts.semiBold, fontSize: 15 },
})
