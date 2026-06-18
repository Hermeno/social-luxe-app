import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react'
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  Pressable,
  StyleSheet,
  Dimensions,
  Animated,
  ActivityIndicator,
  InteractionManager,
} from 'react-native'
import { Image } from 'expo-image'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useNavigation } from '@react-navigation/native'
import { StackNavigationProp } from '@react-navigation/stack'
import { useFocusEffect } from '@react-navigation/native'
import { LinearGradient } from 'expo-linear-gradient'
import { Ionicons } from '@expo/vector-icons'
import { Search } from 'lucide-react-native'
import { useVideoPlayer, VideoView } from 'expo-video'
import { Post } from '../../types'
import { useFeed } from '../../hooks/useFeed'
import { useFeedStore } from '../../store/feed.store'
import { useAuthStore } from '../../store/auth.store'
import { AppStackParams } from '../../navigation/AppNavigator'
import { markPostViewed, getViewedPostIds, getCache, setCache } from '../../db/database'
import * as postService from '../../services/post.service'
import { useT } from '../../i18n'
import { getOrDownload, prefetchMedia } from '../../db/mediaCache'
import { colors, fonts } from '../../theme'
import AvatarImage from '../../components/AvatarImage'
import ActionBar from './ActionBar'
import PostInfo from './PostInfo'
import CommentSheet from '../../components/CommentSheet'
import FeedHeader, { FeedUserGroup as UserGroup } from './FeedHeader'
import { API_BASE } from '../../config'

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window')
const IMAGE_DURATION = 30000

type Nav = StackNavigationProp<AppStackParams>

function resolveMedia(url: string) {
  return url.startsWith('http') ? url : `${API_BASE}${url}`
}

// ─── Progress Bars ────────────────────────────────────────────────────────────
// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function FeedScreen() {
  const { posts, loading, refresh, loadMore, prependPost, removePost, updatePost, incrementView } = useFeed()
  const t = useT()
  const tAgo = (iso: string) => {
    const diff = Date.now() - new Date(iso).getTime()
    const m = Math.floor(diff / 60000)
    if (m < 1)  return t.time_now
    if (m < 60) return `${m}${t.time_m_ago}`
    const h = Math.floor(m / 60)
    if (h < 24) return `${h}${t.time_h_ago}`
    return `${Math.floor(h / 24)}${t.time_d_ago}`
  }
  const nav              = useNavigation<Nav>()
  const { top }          = useSafeAreaInsets()
  const user             = useAuthStore((s) => s.user)

  // Consume a post published from CreateScreen → prepend instantly
  const pendingPost       = useFeedStore((s) => s.pendingPost)
  const setPendingPost    = useFeedStore((s) => s.setPendingPost)
  const setNewPostsCount  = useFeedStore((s) => s.setNewPostsCount)
  const jumpToPostId      = useFeedStore((s) => s.jumpToPostId)
  const setJumpToPostId   = useFeedStore((s) => s.setJumpToPostId)
  const openSearch        = useFeedStore((s) => s.openSearch)
  const setOpenSearch     = useFeedStore((s) => s.setOpenSearch)

  useEffect(() => {
    if (!pendingPost) return
    prependPost(pendingPost)
    // currentIndex is derived from currentPostId — no manual correction needed
    setPendingPost(null)
  }, [pendingPost])

  // TabBar Search button → open search overlay
  useFocusEffect(useCallback(() => {
    if (openSearch) {
      setSearchMode(true)
      setOpenSearch(false)
    }
  }, [openSearch]))

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
  const [headerH, setHeaderH] = useState(0)
  // Per-post comment and like deltas — persists while FeedScreen stays mounted
  const [commentDeltas, setCommentDeltas] = useState<Record<string, number>>({})
  const [likedPostIds,  setLikedPostIds]  = useState<Set<string>>(new Set())

  // Persist likes: load on mount, save on change
  useEffect(() => {
    getCache<string[]>('liked_post_ids').then((ids) => {
      if (ids && ids.length > 0) setLikedPostIds(new Set(ids))
    }).catch(() => {})
  }, [])
  useEffect(() => {
    setCache('liked_post_ids', Array.from(likedPostIds)).catch(() => {})
  }, [likedPostIds])

  // Overlay opacity that COVERS the video (1 = thumbnail visible, 0 = video visible).
  // Starts at 1 so the thumbnail is shown while the video loads its first frame.
  // This inverted approach prevents black flashes: instead of fading the video in,
  // we fade the thumbnail overlay OUT once the video confirms it's playing.
  const thumbnailOverlayOpacity = useRef(new Animated.Value(1)).current

  const progressAnim     = useRef(new Animated.Value(0)).current
  const progressRef      = useRef<Animated.CompositeAnimation | null>(null)
  const progressValueRef = useRef(0)   // always tracks current animated value
  const pressStartRef    = useRef(0)
  const bubblesRef       = useRef<FlatList>(null)

  // Keep refs in sync for callbacks that can't depend on state
  const postRef      = useRef<Post | undefined>(undefined)
  const isFocusedRef = useRef(false)

  // Tracks the last post we set up playback for — used to distinguish
  // "new post" from "same post, focus regained" in the playback effect
  const prevPostIdRef = useRef<string | null>(null)

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

  // ── Stable FeedHeader callbacks ────────────────────────────────────────────
  const jumpToUserRef = useRef(jumpToUser)
  jumpToUserRef.current = jumpToUser

  const handleSearchOpen   = useCallback(() => setSearchMode(true), [])
  const handleSearchClose  = useCallback(() => { setSearchMode(false); setSearchQuery('') }, [])
  const handleSearchChange = useCallback((q: string) => setSearchQuery(q), [])
  const handleBubblePress  = useCallback((group: UserGroup) => {
    jumpToUserRef.current(group)
    setSearchMode(false)
    setSearchQuery('')
  }, [])
  const handleNamePress    = useCallback((userId: string) => nav.navigate('Profile', { userId }), [nav])
  const handleCreatePress  = useCallback(() => nav.navigate('Tabs', { screen: 'Create' }), [nav])

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

  const resumeFromCurrentRef = useRef(resumeFromCurrent)
  resumeFromCurrentRef.current = resumeFromCurrent

  // ── Main playback effect (new post or focus change) ───────────────────────
  useEffect(() => {
    const isNewPost = post?.id !== prevPostIdRef.current
    prevPostIdRef.current = post?.id ?? null

    progressRef.current?.stop()
    safePlayer(() => player.pause())

    // Only wipe media state when the post actually changed.
    // When the same post regains focus (e.g. returning from Profile), skip
    // the reset so there is no black flash before the media reappears.
    if (isNewPost) {
      progressAnim.setValue(0)
      progressValueRef.current = 0
      thumbnailOverlayOpacity.setValue(1)  // show thumbnail while new video loads
      setImgH(null)
    }

    if (!post || !isFocusedRef.current) return

    // Persist view — local cache + server counter + optimistic update
    if (!viewedIds.has(post.id)) {
      markPostViewed(post.id).catch(() => {})
      postService.addView(post.id).catch(() => {})
      incrementView(post.id)
      setViewedIds((prev) => new Set(prev).add(post.id))
    }

    if (commentPost) return

    // Same post, focus regained (e.g. returned from Profile) — just resume
    if (!isNewPost) {
      resumeFromCurrent()
      return
    }

    function startProgress(durationMs: number) {
      progressRef.current = Animated.timing(progressAnim, {
        toValue: 1, duration: durationMs, useNativeDriver: false,
      })
      progressRef.current.start(({ finished }) => { if (finished) goNextRef.current() })
    }

    // TEXT posts: no video overlay needed — show immediately, run timer like an image
    if (post.mediaType === 'TEXT') {
      startProgress(IMAGE_DURATION)
      return () => { progressRef.current?.stop() }
    }

    if (post.mediaType === 'VIDEO') {
      videoDurRef.current = 0
      let started   = false
      let cancelled = false

      // Fade out the thumbnail overlay after a short delay so iOS has time
      // to decode and render the first video frame before we reveal it.
      function revealMedia() {
        setTimeout(() => {
          if (cancelled || !isFocusedRef.current) return
          Animated.timing(thumbnailOverlayOpacity, { toValue: 0, duration: 250, useNativeDriver: true }).start()
        }, 80)
      }

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
          revealMedia()   // ← fade out the thumbnail overlay to reveal the video
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
  }, [currentIndex, post?.id])

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
    isFocusedRef.current = true
    refreshRef.current()

    const task = InteractionManager.runAfterInteractions(() => {
      if (!isFocusedRef.current) return
      resumeFromCurrentRef.current()

      // For videos: the overlay was set to 1 when we navigated away (see cleanup below).
      // Give iOS 150 ms to decode and render the first frame after player.play(),
      // then fade the thumbnail overlay out. This prevents the black-frame flash.
      if (postRef.current?.mediaType === 'VIDEO') {
        setTimeout(() => {
          if (!isFocusedRef.current) return
          Animated.timing(thumbnailOverlayOpacity, { toValue: 0, duration: 200, useNativeDriver: true }).start()
        }, 150)
      }
    })

    return () => {
      isFocusedRef.current = false
      task.cancel()
      progressRef.current?.stop()
      safePlayer(() => player.pause())
      // Snap the overlay back to 1 (show thumbnail) so that when the user
      // returns, the thumbnail covers the video while the player warms up.
      if (postRef.current?.mediaType === 'VIDEO') {
        thumbnailOverlayOpacity.setValue(1)
      }
    }
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

  // Estimated header height: measured via onLayout, falls back to safe-area calc
  const effectiveHeaderH = headerH || (top + 95)

  return (
    <View style={s.container}>

      {/* ── Bubbles strip — topo, fundo branco, parte do fluxo flex ─────────── */}
      <FeedHeader
        filteredGroups={filteredGroups}
        viewedIds={viewedIds}
        bubblesRef={bubblesRef}
        activeUserId={post?.user.id}
        searchMode={searchMode}
        searchQuery={searchQuery}
        onSearchClose={handleSearchClose}
        onSearchChange={handleSearchChange}
        onBubblePress={handleBubblePress}
        onNamePress={handleNamePress}
        onCreatePress={handleCreatePress}
        transparent={false}
      />

      {/* ── Viewer: preenche o espaço entre o header e a tab bar ───────────── */}
      {post ? (
        <View style={s.viewer}
          onLayout={(e) => {
            setViewerW(e.nativeEvent.layout.width)
            setViewerH(e.nativeEvent.layout.height)
          }}
        >
          {/* ── Media ──────────────────────────────────────────────────── */}
          <View style={s.mediaClip}>
            {post.mediaType === 'TEXT' ? (() => {
              const parts = post.bgColor?.split('|') ?? []
              const gc: [string, string] = parts.length === 2 ? [parts[0], parts[1]] : ['#FF6B35', '#E63946']
              return (
                <LinearGradient colors={gc} style={[s.absLayer, s.textCard]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
                  <Text style={s.textCardContent}>{post.caption}</Text>
                </LinearGradient>
              )
            })() : post.mediaType === 'VIDEO' ? (
              <>
                {post.thumbnailUrl ? (
                  <Image source={{ uri: post.thumbnailUrl }} style={s.absLayer} contentFit="cover" cachePolicy="disk" recyclingKey={`thumb-bg-${post.id}`} />
                ) : null}
                <VideoView player={player} style={StyleSheet.absoluteFill} contentFit="cover" nativeControls={false} />
                <Animated.View style={[s.absLayer, { opacity: thumbnailOverlayOpacity }]} pointerEvents="none">
                  {post.thumbnailUrl ? (
                    <Image source={{ uri: post.thumbnailUrl }} style={s.absLayer} contentFit="cover" cachePolicy="disk" recyclingKey={`thumb-overlay-${post.id}`} />
                  ) : (
                    <View style={[s.absLayer, { backgroundColor: '#000' }]} />
                  )}
                </Animated.View>
              </>
            ) : (
              <Image key={post.id} source={{ uri: resolveMedia(post.mediaUrl ?? '') }} style={s.absLayer} contentFit="contain" cachePolicy="disk" recyclingKey={post.id} transition={150} />
            )}
          </View>

          {post.mediaType !== 'TEXT' && (
            <LinearGradient colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.72)']} style={s.bottomGradient} pointerEvents="none" />
          )}

          {/* User info + follow button + timer + energy bar */}
          <PostInfo
            key={post.id}
            post={post}
            isActive
            onExpired={() => {
              removePost(post.id)
              navigateTo(Math.max(0, currentIndex - 1))
            }}
          />

          {post.isAnnouncement && (
            <View style={s.announcementBadge} pointerEvents="none">
              <Ionicons name="megaphone-outline" size={13} color="#fff" />
              <Text style={s.announcementBadgeText}>{t.feed_announcement}</Text>
            </View>
          )}

          {/* Tap zones */}
          <Pressable style={s.leftTap}  onPressIn={handlePressIn} onPressOut={() => handlePressOut(goPrev)} />
          <Pressable style={s.rightTap} onPressIn={handlePressIn} onPressOut={() => handlePressOut(goNext)} />

          <ActionBar
            post={post}
            onCommentPress={() => setCommentPost(post)}
            newPostsCount={newPostsCount}
            liked={likedPostIds.has(post.id)}
            onLikeChange={(l) => setLikedPostIds((s) => { const n = new Set(s); l ? n.add(post.id) : n.delete(post.id); return n })}
            commentCount={(post._count?.comments ?? 0) + (commentDeltas[post.id] ?? 0)}
            onDeleted={(id) => { removePost(id); navigateTo(Math.max(0, currentIndex - 1)) }}
            onEdited={(id, caption) => updatePost(id, caption)}
          />
        </View>
      ) : (
        <View style={s.emptyViewer}>
          {loading ? (
            <ActivityIndicator size="large" color={colors.primary} />
          ) : (
            <>
              <Ionicons name="sparkles-outline" size={42} color={colors.primaryMid} />
              <Text style={s.emptyTitle}>{t.feed_empty_title}</Text>
              <Text style={s.emptySub}>{t.feed_empty_sub}</Text>
            </>
          )}
        </View>
      )}

      {commentPost && (
        <CommentSheet
          post={commentPost}
          onClose={() => setCommentPost(null)}
          onCommentAdded={() => setCommentDeltas((d) => ({ ...d, [commentPost!.id]: (d[commentPost!.id] ?? 0) + 1 }))}
        />
      )}

    </View>
  )
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.white },

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
  bottomGradient: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 200 },

  progressWrap:  { position: 'absolute', left: 16, right: 80, zIndex: 22 },

  viewerUserInfo: {
    position: 'absolute', left: 16, right: 80, bottom: 16, zIndex: 22,
  },
  viewerUserRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  viewerUserText: { flex: 1, minWidth: 0 },
  viewerUserName: {
    color: '#fff', fontFamily: fonts.semiBold, fontSize: 14,
    letterSpacing: -0.3, flexShrink: 1,
    textShadowColor: 'rgba(0,0,0,0.4)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  viewerUserAge: {
    color: 'rgba(255,255,255,0.6)', fontFamily: fonts.regular, fontSize: 12, marginTop: 1,
  },
  deviceBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 3,
  },
  deviceBadgeTxt: {
    color: 'rgba(255,255,255,0.55)', fontFamily: fonts.medium, fontSize: 11, letterSpacing: 0.1,
  },
  viewerCaption: {
    color: 'rgba(255,255,255,0.88)', fontFamily: fonts.regular,
    fontSize: 13, lineHeight: 18, letterSpacing: -0.1,
    marginTop: 7, marginLeft: 46,
  },

  announcementBadge: {
    position: 'absolute', left: 16, top: 16, zIndex: 21,
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

  leftTap:  { position: 'absolute', left: 0, top: 0, bottom: 72, width: SCREEN_W * 0.35, zIndex: 10 },
  rightTap: { position: 'absolute', left: SCREEN_W * 0.35, right: 80, top: 0, bottom: 72, zIndex: 10 },

  emptyViewer:  { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 36, gap: 14 },
  emptyTitle:   { fontSize: 18, fontFamily: fonts.semiBold, color: colors.gray800, letterSpacing: -0.3, textAlign: 'center', marginTop: 4 },
  emptySub:     { fontSize: 14, fontFamily: fonts.regular, color: colors.gray400, textAlign: 'center', lineHeight: 20 },



})
