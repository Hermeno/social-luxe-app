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
import { Search, MessageCircle, User } from 'lucide-react-native'
import SpeechBadge from '../../components/SpeechBadge'
import { useVideoPlayer, VideoView } from 'expo-video'
import { Post } from '../../types'
import { useFeed } from '../../hooks/useFeed'
import { useFeedStore } from '../../store/feed.store'
import { useOnlineStore } from '../../store/online.store'
import { useNotificationStore } from '../../store/notification.store'
import { useMessageBadgeStore } from '../../store/messageBadge.store'
import { AppStackParams } from '../../navigation/AppNavigator'
import { markPostViewed, getViewedPostIds } from '../../db/database'
import * as postService from '../../services/post.service'
import { getOrDownload, prefetchMedia } from '../../db/mediaCache'
import { colors, fonts, spacing, gradients } from '../../theme'
import AvatarImage from '../../components/AvatarImage'
import SegmentedRing from '../../components/SegmentedRing'
import ActionBar from './ActionBar'
import PostInfo from './PostInfo'
import CommentSheet from '../../components/CommentSheet'
import { API_BASE } from '../../config'

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window')
const RING_SIZE      = 65
const AVATAR_SIZE    = 54
const IMAGE_DURATION = 30000

type Nav = StackNavigationProp<AppStackParams>

interface UserGroup {
  user: Post['user']
  posts: Post[]
}

function resolveMedia(url: string) {
  return url.startsWith('http') ? url : `${API_BASE}${url}`
}

// ─── Ripple rings (online presence — contained inside the avatar circle) ────
const NUM_RINGS       = 3
const RIPPLE_DURATION = 1800
const RIPPLE_STAGGER  = 520

// Waves start from the centre and expand to fill the circle.
// The avatar container must have overflow:'hidden' to clip them to the circle.
function RippleRings({ size }: { size: number }) {
  const anims = [
    useRef(new Animated.Value(0)).current,
    useRef(new Animated.Value(0)).current,
    useRef(new Animated.Value(0)).current,
  ]

  useEffect(() => {
    const TOTAL = RIPPLE_DURATION + (NUM_RINGS - 1) * RIPPLE_STAGGER
    const loops = anims.map((anim, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(i * RIPPLE_STAGGER),
          Animated.timing(anim, { toValue: 1, duration: RIPPLE_DURATION, useNativeDriver: true }),
          Animated.timing(anim, { toValue: 0, duration: 0,              useNativeDriver: true }),
          Animated.delay((NUM_RINGS - 1 - i) * RIPPLE_STAGGER),
        ]),
      ),
    )
    loops.forEach((l) => l.start())
    return () => loops.forEach((l) => l.stop())
  }, [])

  return (
    <>
      {anims.map((anim, i) => {
        // Scale 0→1: starts as invisible point in centre, expands to fill the circle
        const scale = anim.interpolate({ inputRange: [0, 1], outputRange: [0, 1] })
        // Opacity: flashes in quickly, then fades out
        const opacity = anim.interpolate({
          inputRange: [0, 0.1, 0.5, 1],
          outputRange: [0, 0.95, 0.65, 0],
        })
        return (
          <Animated.View
            key={i}
            style={{
              position: 'absolute',
              width: size, height: size,
              borderRadius: size / 2,
              // Filled semi-transparent white — sits on top of photo
              backgroundColor: 'rgba(255,255,255,0.92)',
              opacity,
              transform: [{ scale }],
            }}
          />
        )
      })}
    </>
  )
}

// ─── Bubble Item ──────────────────────────────────────────────────────────────
function BubbleItem({
  item,
  isActive,
  viewedCount,
  index,
  onPress,
  onNamePress,
}: {
  item: UserGroup
  isActive: boolean
  viewedCount: number
  index: number
  onPress: () => void
  onNamePress: () => void
}) {
  const isOnlineUser  = useOnlineStore((s) => s.isOnline(item.user.id))
  const unviewedCount = item.posts.length - viewedCount

  const opacity    = useRef(new Animated.Value(0)).current
  const entryY     = useRef(new Animated.Value(14)).current
  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 280, delay: index * 55, useNativeDriver: true }),
      Animated.spring(entryY,  { toValue: 0, speed: 18, bounciness: 7, delay: index * 55, useNativeDriver: true } as any),
    ]).start()
  }, [])

  return (
    <Animated.View style={[s.bubbleItem, { opacity, transform: [{ translateY: entryY }] }]}>
      {/* Ring — toca para ver posts */}
      <TouchableOpacity onPress={onPress} activeOpacity={0.75}>
        <View style={s.ringContainer}>
          <View style={s.ringWrap}>
            <SegmentedRing
              count={item.posts.length}
              viewedCount={viewedCount}
              size={RING_SIZE}
              strokeWidth={2}
            />
            {/* Avatar + ripple contained inside the circle */}
            <View style={s.avatarCenter}>
              <View style={{ width: AVATAR_SIZE, height: AVATAR_SIZE, borderRadius: AVATAR_SIZE / 2, overflow: 'hidden' }}>
                <AvatarImage uri={item.user.avatar} size={AVATAR_SIZE} />
                {/* Ripple inside the circle — clipped by overflow:hidden */}
                {isOnlineUser && (
                  <View style={StyleSheet.absoluteFillObject} pointerEvents="none">
                    <RippleRings size={AVATAR_SIZE} />
                  </View>
                )}
              </View>
            </View>
          </View>

          {/* ONLINE badge below the avatar */}
          {isOnlineUser && (
            <View style={s.onlineBadgeWrap}>
              <View style={s.onlineBadge}>
                <Text style={s.onlineBadgeText}>ONLINE</Text>
              </View>
            </View>
          )}
        </View>
      </TouchableOpacity>

      {/* Nome — toca para ver perfil */}
      <TouchableOpacity onPress={onNamePress} activeOpacity={0.6} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
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
  const { posts, refresh, loadMore, prependPost, removePost, updatePost, incrementView } = useFeed()
  const nav                = useNavigation<Nav>()
  const { top, bottom }    = useSafeAreaInsets()
  const isFocused          = useIsFocused()
  const messageBadge = useMessageBadgeStore((s) => s.totalUnread)

  // Consume a post published from CreateScreen → prepend instantly
  const pendingPost       = useFeedStore((s) => s.pendingPost)
  const setPendingPost    = useFeedStore((s) => s.setPendingPost)
  const setNewPostsCount  = useFeedStore((s) => s.setNewPostsCount)
  const jumpToPostId      = useFeedStore((s) => s.jumpToPostId)
  const setJumpToPostId   = useFeedStore((s) => s.setJumpToPostId)

  useEffect(() => {
    if (!pendingPost) return
    prependPost(pendingPost)
    // currentIndex is derived from currentPostId — no manual correction needed
    setPendingPost(null)
  }, [pendingPost])

  const jumpToPostIdRef = useRef(jumpToPostId)
  jumpToPostIdRef.current = jumpToPostId

  // Track current post by ID so flatPosts reorders never cause a flash
  const [currentPostId, setCurrentPostId] = useState<string | null>(null)
  const [commentPost, setCommentPost]   = useState<Post | null>(null)
  const [viewedIds, setViewedIds]       = useState<Set<string>>(new Set())
  const [searchMode, setSearchMode]     = useState(false)
  const [searchQuery, setSearchQuery]   = useState('')
  const [viewerW, setViewerW] = useState(SCREEN_W)
  const [viewerH, setViewerH] = useState(SCREEN_H)
  const [imgH,    setImgH]    = useState<number | null>(null)
  const [commentDelta, setCommentDelta] = useState(0)

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

  const filteredGroups = useMemo(() => {
    const base = searchQuery.trim()
      ? userGroups.filter((g) => g.user.name.toLowerCase().includes(searchQuery.toLowerCase()))
      : userGroups

    // Unviewed users first, fully-viewed users at the end
    return [...base].sort((a, b) => {
      const aAllViewed = a.posts.every((p) => viewedIds.has(p.id))
      const bAllViewed = b.posts.every((p) => viewedIds.has(p.id))
      if (aAllViewed === bAllViewed) return 0
      return aAllViewed ? 1 : -1
    })
  }, [userGroups, searchQuery, viewedIds])

  const flatPosts = useMemo(() => {
    const seen = new Set<string>()
    return userGroups.flatMap((g) => g.posts).filter((p) => {
      if (seen.has(p.id)) return false
      seen.add(p.id)
      return true
    })
  }, [userGroups])

  // Derived synchronously — when flatPosts rebuilds (socket prepend, refresh, etc.)
  // the index is always correct in the same render, never one frame behind
  const currentIndex = useMemo(() => {
    if (!currentPostId || flatPosts.length === 0) return 0
    const idx = flatPosts.findIndex((p) => p.id === currentPostId)
    return idx >= 0 ? idx : 0
  }, [currentPostId, flatPosts])

  // Initialise to first post once feed loads, and keep in sync when feed resets
  const prevFlatLenRef = useRef(0)
  useEffect(() => {
    if (prevFlatLenRef.current === 0 && flatPosts.length > 0) {
      setCurrentPostId(flatPosts[0].id)
    }
    prevFlatLenRef.current = flatPosts.length
  }, [flatPosts.length])

  // Navigate to a specific index
  const flatPostsRef = useRef(flatPosts)
  flatPostsRef.current = flatPosts
  function navigateTo(idx: number) {
    const fp = flatPostsRef.current
    const clamped = Math.max(0, Math.min(idx, fp.length - 1))
    setCurrentPostId(fp[clamped]?.id ?? null)
  }

  const post = flatPosts[currentIndex]
  postRef.current = post

  const newPostsCount = useMemo(
    () => flatPosts.filter((p) => !viewedIds.has(p.id)).length,
    [flatPosts, viewedIds],
  )
  useEffect(() => { setNewPostsCount(newPostsCount) }, [newPostsCount])

  // Jump to post requested from another screen (profile grid → feed)
  useEffect(() => {
    const id = jumpToPostIdRef.current
    if (!id) return
    if (flatPosts.length === 0) return
    const idx = flatPosts.findIndex((p) => p.id === id)
    if (idx >= 0) {
      navigateTo(idx)
      setJumpToPostId(null)
    }
    // If post not in feed yet, leave jumpToPostId set — will retry when flatPosts updates
  }, [jumpToPostId, flatPosts])

  function viewedCountFor(group: UserGroup): number {
    return group.posts.filter((p) => viewedIds.has(p.id)).length
  }

  const currentGroupFirstIdx = useMemo(
    () => (post ? flatPosts.findIndex((p) => p.user.id === post.user.id) : 0),
    [post, flatPosts],
  )
  const currentGroup       = post ? userGroups.find((g) => g.user.id === post.user.id) : undefined
  const currentPostInGroup = currentIndex - currentGroupFirstIdx

  const currentIndexRef = useRef(currentIndex)
  currentIndexRef.current = currentIndex

  const goNext = useCallback(() => {
    const i = currentIndexRef.current
    const fp = flatPostsRef.current
    if (i >= fp.length - 1) return
    if (fp.length - i <= 3) loadMore()
    navigateTo(i + 1)
  }, [loadMore])

  const goPrev = useCallback(() => {
    navigateTo(currentIndexRef.current > 0 ? currentIndexRef.current - 1 : 0)
  }, [])

  const goNextRef = useRef(goNext)
  goNextRef.current = goNext

  function jumpToUser(group: UserGroup) {
    const idx = flatPosts.findIndex((p) => p.user.id === group.user.id)
    if (idx >= 0) navigateTo(idx)
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
    mediaOpacity.setValue(0)
    setImgH(null)
    setCommentDelta(0)

    if (!post || !isFocused) return

    // Persist view — local cache + server counter + optimistic update
    if (!viewedIds.has(post.id)) {
      markPostViewed(post.id).catch(() => {})
      postService.addView(post.id).catch(() => {})
      incrementView(post.id)
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

    // Image: expo-image handles its own fade via transition prop — just start progress
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
    // Only reset index when NOT arriving from a publish or a profile post jump
    const st = useFeedStore.getState()
    if (!st.pendingPost && !st.jumpToPostId) navigateTo(0)
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
            <Search size={15} strokeWidth={2} color={colors.gray400} />
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
        <View style={[s.header, { paddingTop: top + 10 }]}>
          <Text style={s.logo}>luxee</Text>

          {/* ── Icon pill ──────────────────────────────────────────── */}
          <View style={s.pill}>
            {/* Search */}
            <TouchableOpacity
              onPress={() => setSearchMode(true)}
              activeOpacity={0.65}
              style={s.pillBtn}
              hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
            >
              <Search size={20} strokeWidth={1.8} color={colors.gray800} />
            </TouchableOpacity>

            {/* Profile */}
            <TouchableOpacity
              onPress={() => nav.navigate('Profile', {})}
              activeOpacity={0.65}
              style={s.pillBtn}
              hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
            >
              <User size={20} strokeWidth={1.8} color={colors.gray800} />
            </TouchableOpacity>

          </View>
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
        onEndReachedThreshold={0.5}
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
            onNamePress={() => nav.navigate('Profile', { userId: item.user.id })}
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
              <View style={[s.absLayer, s.textCard, { backgroundColor: post.bgColor ?? '#FF4B6E' }]}>
                <Text style={s.textCardContent}>{post.caption}</Text>
              </View>
            ) : post.mediaType === 'VIDEO' ? (
              <>
                {/* Poster frame enquanto o vídeo carrega */}
                {post.thumbnailUrl ? (
                  <Image
                    source={{ uri: post.thumbnailUrl }}
                    style={s.absLayer}
                    contentFit="cover"
                    cachePolicy="disk"
                    recyclingKey={`thumb-${post.id}`}
                  />
                ) : null}
                <Animated.View style={[s.absLayer, { opacity: mediaOpacity }]}>
                  <VideoView
                    player={player}
                    style={StyleSheet.absoluteFill}
                    contentFit="cover"
                    nativeControls={false}
                  />
                </Animated.View>
              </>
            ) : (
              <Image
                key={post.id}
                source={{ uri: resolveMedia(post.mediaUrl ?? '') }}
                style={s.absLayer}
                contentFit="contain"
                cachePolicy="disk"
                recyclingKey={post.id}
                transition={150}
              />
            )}

          </View>

          {post.mediaType !== 'TEXT' && (
            <LinearGradient colors={gradients.feedTop} style={s.topGradient} pointerEvents="none" />
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

          {post.isAnnouncement && (
            <View style={s.announcementBadge} pointerEvents="none">
              <Ionicons name="megaphone-outline" size={13} color="#fff" />
              <Text style={s.announcementBadgeText}>anúncio oficial · luxee</Text>
            </View>
          )}

          {/* Tap zones: Pressable for press-in / press-out (hold-to-pause) */}
          <Pressable
            style={[s.leftTap,  { bottom: bottom + 100 }]}
            onPressIn={handlePressIn}
            onPressOut={() => handlePressOut(goPrev)}
          />
          <Pressable
            style={[s.rightTap, { bottom: bottom + 100 }]}
            onPressIn={handlePressIn}
            onPressOut={() => handlePressOut(goNext)}
          />

          <ActionBar
            post={post}
            onCommentPress={() => setCommentPost(post)}
            newPostsCount={newPostsCount}
            commentCount={(post._count?.comments ?? 0) + commentDelta}
            onDeleted={(id) => { removePost(id); navigateTo(Math.max(0, currentIndex - 1)) }}
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
            onPress={() => (nav as any).navigate('Messages')}
            activeOpacity={0.85}
          >
            <Ionicons name="search" size={18} color="#fff" />
            <Text style={s.emptyBtnText}>Encontrar pessoas a seguir</Text>
          </TouchableOpacity>
        </View>
      )}

      {commentPost && (
        <CommentSheet
          post={commentPost}
          onClose={() => setCommentPost(null)}
          onCommentAdded={() => setCommentDelta((d) => d + 1)}
        />
      )}

      {/* ── Floating chat FAB — right side, below action icons ───────────── */}
      {post && (
        <>
          <TouchableOpacity
            style={[s.fab, { bottom: bottom + 54 }]}
            onPress={() => (nav as any).navigate('Messages')}
            activeOpacity={0.85}
          >
            <Ionicons name="chatbubble-outline" size={26} color="#fff" style={s.mirrorX} />
          </TouchableOpacity>
          {/* Badge as sibling of FAB — no clipping from parent bounds */}
          <View style={[s.fabBadgePos, { bottom: bottom + 98 }]} pointerEvents="none">
            <SpeechBadge count={messageBadge} />
          </View>
        </>
      )}
    </View>
  )
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.white },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingBottom: 12,
    backgroundColor: colors.white,
  },
  logo: { fontFamily: fonts.semiBold, fontSize: 24, color: colors.gray800, letterSpacing: -0.8 },

  /* icon pill */
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  pillBtn: {
    paddingHorizontal: 10,
    paddingVertical: 7,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pillDivider: {
    width: 1,
    height: 18,
    backgroundColor: colors.gray200,
    marginHorizontal: 2,
  },
  pillChatBtn: {
    paddingLeft: 10,
    paddingRight: 14,
    paddingVertical: 7,
  },
  chatIconWrap: {
    position: 'relative',
  },
  chatBadge: {
    position: 'absolute',
    top: -5,
    right: -6,
    minWidth: 15,
    height: 15,
    borderRadius: 8,
    backgroundColor: '#FF3B30',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
    borderWidth: 1.5,
    borderColor: colors.white,
  },
  chatBadgeTxt: {
    fontSize: 8,
    fontFamily: fonts.extraBold,
    color: colors.white,
    lineHeight: 10,
  },

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
    overflow: 'visible',
  },
  onlineBadgeWrap: {
    position: 'absolute',
    bottom: -9,
    left: 0, right: 0,
    alignItems: 'center',
  },
  onlineBadge: {
    backgroundColor: '#22C55E',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderWidth: 1.5,
    borderColor: colors.white,
  },
  onlineBadgeText: {
    color: colors.white,
    fontSize: 8,
    fontFamily: fonts.bold,
    letterSpacing: 0.6,
  },


  bubbleRow:  { flexGrow: 0, flexShrink: 0 },
  bubbleList: { paddingHorizontal: 12, paddingTop: 6, paddingBottom: 10, gap: 8 },
  bubbleItem: { alignItems: 'center', gap: 6, width: RING_SIZE },
  ringWrap:   { width: RING_SIZE, height: RING_SIZE, alignItems: 'center', justifyContent: 'center' },

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
  topGradient:    { position: 'absolute', top: 0, left: 0, right: 0, height: 80 },

  progressWrap:  { position: 'absolute', top: 12, left: 0, right: 0, zIndex: 20 },

  announcementBadge: {
    position: 'absolute', top: 54, left: 16, zIndex: 21,
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: 'rgba(230,126,34,0.88)',
    paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: 20,
  },
  announcementBadgeText: {
    color: '#fff', fontSize: 12,
    fontFamily: fonts.semiBold, letterSpacing: 0.2,
  },
  progressRow:   { flexDirection: 'row', paddingHorizontal: 10, gap: 3 },
  progressTrack: {
    flex: 1, height: 2.5,
    backgroundColor: 'rgba(255,255,255,0.35)',
    borderRadius: 2, overflow: 'hidden',
  },
  progressFull:  { flex: 1, backgroundColor: colors.white },
  progressFill:  { height: '100%', backgroundColor: colors.white },

  leftTap:  { position: 'absolute', left: 0, top: 0, width: SCREEN_W * 0.35, zIndex: 10 },
  rightTap: { position: 'absolute', left: SCREEN_W * 0.35, right: 80, top: 0, zIndex: 10 },

  emptyViewer:  { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 36, gap: 14 },
  emptyIconWrap:{ width: 88, height: 88, borderRadius: 44, backgroundColor: 'rgba(255,75,110,0.1)', alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  emptyTitle:   { fontSize: 20, fontFamily: fonts.semiBold, color: colors.gray800, letterSpacing: -0.4, textAlign: 'center' },
  emptySub:     { fontSize: 14, fontFamily: fonts.regular, color: colors.gray400, textAlign: 'center', lineHeight: 20 },
  emptyBtn:     { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8, backgroundColor: '#4C8CE4', paddingHorizontal: 24, paddingVertical: 14, borderRadius: 14 },
  emptyBtnText: { color: '#fff', fontFamily: fonts.semiBold, fontSize: 15 },

  // Floating chat FAB — right side, below ActionBar column
  fab: {
    position: 'absolute',
    right: 16,
    width: 56, height: 56,
    borderRadius: 28,
    backgroundColor: colors.primary,
    alignItems: 'center', justifyContent: 'center',
    zIndex: 30,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  // Badge sibling of FAB — bottom: fabBottom + fabHeight - overlap (bottom+54+56-12=bottom+98)
  fabBadgePos: {
    position: 'absolute',
    right: 16,
    width: 56,
    alignItems: 'center',
    zIndex: 31,
    elevation: 10,
  },
  mirrorX: { transform: [{ scaleX: -1 }] },
})
