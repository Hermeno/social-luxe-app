import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react'
import {
  View,
  Text,
  TouchableOpacity,
  Pressable,
  StyleSheet,
  Dimensions,
  Animated,
  ActivityIndicator,
  InteractionManager,
  Alert,
  PanResponder,
} from 'react-native'
import { Image } from 'expo-image'
import { useNavigation } from '@react-navigation/native'
import { StackNavigationProp } from '@react-navigation/stack'
import { useFocusEffect } from '@react-navigation/native'
import { LinearGradient } from 'expo-linear-gradient'
import { Ionicons } from '@expo/vector-icons'
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
import ActionBar from './ActionBar'
import PostInfo from './PostInfo'
import Travel from '../../components/Travel'
import CommentSheet from '../../components/CommentSheet'
import FeedHeader, { FeedUserGroup as UserGroup } from './FeedHeader'
import StickerLayer from './StickerLayer'
import StickerPicker, { StickerChoice } from './StickerPicker'
import { PostSticker } from '../../types'
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
  const { posts, loading, refresh, loadMore, prependPost, removePost, updatePost, incrementView, updatePostCounts } = useFeed()
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
  // Per-post comment and like deltas — persists while FeedScreen stays mounted
  const [commentDeltas, setCommentDeltas] = useState<Record<string, number>>({})
  const [likedPostIds,  setLikedPostIds]  = useState<Set<string>>(new Set())
  const [stickerPickerOpen,  setStickerPickerOpen]  = useState(false)
  const [pendingSticker, setPendingSticker] = useState<StickerChoice | null>(null)
  const [localStickers, setLocalStickers] = useState<Record<string, PostSticker[]>>({})
  const [voteState, setVoteState] = useState<Record<string, { voted: boolean; extraMs: number; loading: boolean }>>({})
  // Refs needed inside PanResponder (avoids stale closure in useMemo)
  const pendingStickerRef    = useRef(pendingSticker)
  pendingStickerRef.current  = pendingSticker
  const stickerPickerRef     = useRef(stickerPickerOpen)
  stickerPickerRef.current   = stickerPickerOpen
  // playerRef assigned below after `player` is declared (line ~213)
  const playerRef            = useRef<ReturnType<typeof useVideoPlayer> | null>(null)
  const pauseTimerRef        = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isHoldingRef         = useRef(false)

  // PanResponder — horizontal swipe navigates between posts.
  // NEVER claims on touch-start (onStartShouldSetPanResponder: false) so child
  // buttons (ActionBar, PostInfo) always win their own taps via the bubble phase.
  // Only claims once the user has made a clear horizontal movement (>20 px and
  // more horizontal than vertical), which a tap never triggers.
  const swipePanResponder = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => false,
    onMoveShouldSetPanResponder: (_, gs) =>
      !pendingStickerRef.current &&
      !stickerPickerRef.current &&
      Math.abs(gs.dx) > 20 &&
      Math.abs(gs.dx) > Math.abs(gs.dy) * 1.5,

    onPanResponderRelease: (_, gs) => {
      if (Math.abs(gs.dx) > 50 && Math.abs(gs.dx) > Math.abs(gs.dy)) {
        if (gs.dx > 0) goPrevRef.current()
        else           goNextRef.current()
      }
    },
  }), [])
  const likedLoadedRef = useRef(false)
  const likedSyncedFromServerRef = useRef(false)

  // Persist likes: load on mount, save on change (guard prevents the initial
  // empty-Set render from overwriting the cache before the async load resolves)
  useEffect(() => {
    getCache<string[]>('liked_post_ids').then((ids) => {
      likedLoadedRef.current = true
      if (ids && ids.length > 0) setLikedPostIds(new Set(ids))
    }).catch(() => { likedLoadedRef.current = true })
  }, [])
  useEffect(() => {
    if (!likedLoadedRef.current) return
    setCache('liked_post_ids', Array.from(likedPostIds)).catch(() => {})
  }, [likedPostIds])

  // Seed likedPostIds from server on first non-empty feed load (fixes fresh installs)
  useEffect(() => {
    if (likedSyncedFromServerRef.current || posts.length === 0) return
    likedSyncedFromServerRef.current = true
    const serverLiked = posts.filter((p) => p.userLiked).map((p) => p.id)
    if (serverLiked.length === 0) return
    setLikedPostIds((prev) => {
      const next = new Set(prev)
      serverLiked.forEach((id) => next.add(id))
      return next
    })
  }, [posts])

  // Overlay opacity that COVERS the video (1 = thumbnail visible, 0 = video visible).
  // Starts at 1 so the thumbnail is shown while the video loads its first frame.
  // This inverted approach prevents black flashes: instead of fading the video in,
  // we fade the thumbnail overlay OUT once the video confirms it's playing.
  const thumbnailOverlayOpacity = useRef(new Animated.Value(1)).current

  const progressAnim     = useRef(new Animated.Value(0)).current
  const progressRef      = useRef<Animated.CompositeAnimation | null>(null)
  const progressValueRef = useRef(0)   // always tracks current animated value
  const pressStartRef    = useRef(0)

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
  playerRef.current = player
  // Release the native player on unmount so Expo Go reload doesn't crash via stale JSI callback
  useEffect(() => {
    return () => {
      try { player.pause() } catch {}
      try { (player as any).release?.() } catch {}
    }
  }, [])
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

  const goPrevRef = useRef(goPrev)
  goPrevRef.current = goPrev

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

  const STICKER_LIMIT = 50

  // ── Sticker placement ─────────────────────────────────────────────────────
  async function handlePlaceSticker(x: number, y: number) {
    const choice = pendingSticker
    const p      = post
    if (!choice || !p) return
    const stickerCount = (localStickers[p.id] ?? p.stickers ?? []).length
    if (stickerCount >= STICKER_LIMIT) {
      setPendingSticker(null)
      resumeFromCurrent()
      Alert.alert('Limite atingido', 'Este post já tem 50 stickers.')
      return
    }
    setPendingSticker(null)
    resumeFromCurrent()

    const tempId = `temp-${Date.now()}`
    const tempSticker: PostSticker = {
      id: tempId, emoji: choice.emoji, type: choice.type, content: choice.content, x, y,
      user: { id: user?.id ?? '', name: user?.name ?? '', avatar: user?.avatar ?? null },
    }
    setLocalStickers((prev) => ({ ...prev, [p.id]: [...(prev[p.id] ?? p.stickers ?? []), tempSticker] }))

    try {
      const saved = await postService.addSticker(p.id, choice.emoji, x, y, choice.type, choice.content)
      setLocalStickers((prev) => ({
        ...prev,
        [p.id]: (prev[p.id] ?? []).map((s) => s.id === tempId ? saved : s),
      }))
    } catch {
      setLocalStickers((prev) => ({
        ...prev,
        [p.id]: (prev[p.id] ?? []).filter((s) => s.id !== tempId),
      }))
    }
  }

  function handleVoteToggle(postId: string) {
    const p = flatPostsRef.current.find((fp) => fp.id === postId)
    const currentVoted  = voteState[postId]?.voted  ?? (p?.hasVotedExtend ?? false)
    const currentExtraMs = voteState[postId]?.extraMs ?? 0
    const willVote = !currentVoted
    const deltaMs  = willVote ? 10 * 60_000 : -10 * 60_000

    setVoteState((prev) => ({
      ...prev,
      [postId]: { voted: willVote, extraMs: currentExtraMs + deltaMs, loading: true },
    }))

    postService.voteExtend(postId)
      .then((res) => {
        setVoteState((prev) => ({
          ...prev,
          [postId]: { ...prev[postId], voted: res.voted, loading: false },
        }))
      })
      .catch(() => {
        setVoteState((prev) => ({
          ...prev,
          [postId]: { voted: currentVoted, extraMs: currentExtraMs, loading: false },
        }))
      })
  }

  function handleRemoveSticker(stickerId: string) {
    const p = post
    if (!p) return
    setLocalStickers((prev) => ({
      ...prev,
      [p.id]: (prev[p.id] ?? p.stickers ?? []).filter((s) => s.id !== stickerId),
    }))
    postService.removeSticker(p.id, stickerId).catch(() => {})
  }

  const currentStickers = post
    ? (localStickers[post.id] ?? post.stickers ?? [])
    : []

  const currentVoteVoted   = post ? (voteState[post.id]?.voted   ?? (post.hasVotedExtend ?? false)) : false
  const currentVoteExtraMs = post ? (voteState[post.id]?.extraMs ?? 0) : 0
  const currentVoteLoading = post ? (voteState[post.id]?.loading ?? false) : false

  // ── Viewer dimensions measured for reliable native clipping ───────────────
  const videoStyle = useMemo(
    () => viewerH > 0
      ? { width: viewerW, height: viewerH }   // exact pixels — no overflow possible
      : { width: '100%' as const, height: '100%' as const },
    [viewerW, viewerH],
  )

  return (
    <View style={s.container}>

      {/* ── Current post viewer (slides with swipe gesture) ─────────────────── */}
      {/* ── Viewer: fills full screen from top to bottom ────────────────────── */}
      {post ? (
        <View
          style={s.viewer}
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
                <Animated.View style={[s.absLayer, s.videoOverlay, { opacity: thumbnailOverlayOpacity }]} pointerEvents="none">
                  {post.thumbnailUrl ? (
                    <Image source={{ uri: post.thumbnailUrl }} style={s.absLayer} contentFit="cover" cachePolicy="disk" recyclingKey={`thumb-overlay-${post.id}`} />
                  ) : null}
                  <View style={s.spinnerWrap}>
                    <ActivityIndicator size="large" color="rgba(255,255,255,0.75)" />
                  </View>
                </Animated.View>
              </>
            ) : (
              <Image key={post.id} source={{ uri: resolveMedia(post.mediaUrl ?? '') }} style={s.absLayer} contentFit="contain" cachePolicy="disk" recyclingKey={post.id} transition={150} />
            )}

            {/* Swipe capture: sits on top of all media (last in mediaClip = highest z).
                ActionBar/PostInfo are outside mediaClip so they always win their own taps.
                onStart=false means we never steal taps; onMove threshold means we only
                claim clear horizontal swipes — fingers on video/image can still swipe. */}
            {!pendingSticker && (
              <View style={s.absLayer} {...swipePanResponder.panHandlers} />
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
            commentCount={(post._count?.comments ?? 0) + (commentDeltas[post.id] ?? 0)}
            onExpired={() => {
              removePost(post.id)
              navigateTo(Math.max(0, currentIndex - 1))
            }}
            voted={currentVoteVoted}
            extraMs={currentVoteExtraMs}
            voteLoading={currentVoteLoading}
            onVoteToggle={() => handleVoteToggle(post.id)}
          />

          {post.isAnnouncement && (
            <View style={s.announcementBadge} pointerEvents="none">
              <Ionicons name="megaphone-outline" size={13} color="#fff" />
              <Text style={s.announcementBadgeText}>{t.feed_announcement}</Text>
            </View>
          )}

          {/* Sticker placement overlay — tap anywhere to place */}
          {pendingSticker && (
            <Pressable
              style={s.stickerPlacementOverlay}
              onPress={(e) => {
                const x = Math.max(2, Math.min(98, (e.nativeEvent.locationX / viewerW) * 100))
                const y = Math.max(2, Math.min(98, (e.nativeEvent.locationY / viewerH) * 100))
                handlePlaceSticker(x, y)
              }}
            >
              <View style={s.stickerPlacementDecoLayer} pointerEvents="none" />
              <View style={s.stickerDragHintWrap} pointerEvents="none">
                <Text style={s.stickerDragHintEmoji}>{pendingSticker.type === 'message' ? '💌' : pendingSticker.emoji}</Text>
                <Text style={s.stickerDragHintText}>Toque onde deseja colocar</Text>
              </View>
              <Pressable style={s.stickerPlacementCancel} onPress={() => { setPendingSticker(null); resumeFromCurrent() }}>
                <Text style={s.stickerPlacementCancelTxt}>Cancelar</Text>
              </Pressable>
            </Pressable>
          )}

          {/* StickerLayer INSIDE viewer, BEFORE ActionBar.
              Touch order (last child = first to receive tap in Fabric):
                ActionBar (last)  → buttons win  ✓
                StickerLayer      → sticker taps win over swipeView  ✓
                mediaClip/swipe   → falls through to swipe gesture  ✓ */}
          {post.stickersEnabled && (
            <StickerLayer
              postId={post.id}
              stickers={currentStickers}
              containerW={viewerW}
              containerH={viewerH}
              onLongPress={handleRemoveSticker}
              currentUserId={user?.id}
              postOwnerId={post.userId}
              onMessageOpen={() => {
                progressRef.current?.stop()
                safePlayer(() => player.pause())
              }}
              onMessageClose={() => resumeFromCurrent()}
            />
          )}

          {/* Travel path + caption + objects — lazy-loads when post becomes active */}
          <Travel post={post} isActive />

          <ActionBar
            post={post}
            onCommentPress={() => setCommentPost(post)}
            onStickerPress={() => {
                if ((localStickers[post.id] ?? post.stickers ?? []).length >= STICKER_LIMIT) {
                  Alert.alert('Limite atingido', 'Este post já tem 50 stickers.')
                  return
                }
                progressRef.current?.stop()
                safePlayer(() => player.pause())
                setStickerPickerOpen(true)
              }}
            newPostsCount={newPostsCount}
            liked={likedPostIds.has(post.id)}
            onLikeChange={(l) => {
              const wasLiked = likedPostIds.has(post.id)
              setLikedPostIds((s) => { const n = new Set(s); l ? n.add(post.id) : n.delete(post.id); return n })
              if (l !== wasLiked) {
                updatePostCounts(post.id, { likes: Math.max(0, (post._count?.likes ?? 0) + (l ? 1 : -1)) })
              }
            }}
            commentCount={(post._count?.comments ?? 0) + (commentDeltas[post.id] ?? 0)}
            onDeleted={(id) => { removePost(id); navigateTo(Math.max(0, currentIndex - 1)) }}
            onEdited={(id, caption) => updatePost(id, caption)}
            voted={currentVoteVoted}
            extraMs={currentVoteExtraMs}
            voteLoading={currentVoteLoading}
            onVoteToggle={() => handleVoteToggle(post.id)}
          />
        </View>
      ) : (
        <View style={s.emptyViewer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[s.emptyTitle, { color: 'rgba(255,255,255,0.75)' }]}>Preparando teu feed...</Text>
        </View>
      )}

      {/* ── Floating header — absolute overlay over the viewer ──────────────── */}
      <FeedHeader
        filteredGroups={filteredGroups}
        viewedIds={viewedIds}
        activeUserId={post?.user.id}
        searchMode={searchMode}
        searchQuery={searchQuery}
        onSearchClose={handleSearchClose}
        onSearchChange={handleSearchChange}
        onSearchPress={handleSearchOpen}
        onBubblePress={handleBubblePress}
        onCreatePress={handleCreatePress}
      />

      {commentPost && (
        <CommentSheet
          post={commentPost}
          onClose={() => setCommentPost(null)}
          onCommentAdded={() => setCommentDeltas((d) => ({ ...d, [commentPost!.id]: (d[commentPost!.id] ?? 0) + 1 }))}
        />
      )}

      <StickerPicker
        visible={stickerPickerOpen}
        onClose={() => {
          setStickerPickerOpen(false)
          // Resume only if user didn't select a sticker (pendingSticker would resume via placement flow)
          if (!pendingSticker) resumeFromCurrent()
        }}
        onSelect={(choice) => {
          setStickerPickerOpen(false)
          setPendingSticker(choice)
          // Keep paused — user is now in drag-and-drop placement mode
        }}
      />

    </View>
  )
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.black },

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
  videoOverlay: {
    backgroundColor: '#111',
  },
  spinnerWrap: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
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


  stickerPlacementOverlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    zIndex: 50,
  },
  stickerPlacementDecoLayer: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  stickerDragHintWrap: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    alignItems: 'center', justifyContent: 'center', gap: 10,
  },
  stickerDragHintEmoji: { fontSize: 64, textAlign: 'center' },
  stickerDragHintText: {
    color: '#fff', fontSize: 15, fontFamily: fonts.semiBold,
    textAlign: 'center', letterSpacing: -0.2,
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 4,
    backgroundColor: 'rgba(0,0,0,0.42)',
    borderRadius: 16, paddingHorizontal: 18, paddingVertical: 8,
  },
  stickerPlacementCancel: {
    position: 'absolute', bottom: 110,
    alignSelf: 'center',
    paddingHorizontal: 28, paddingVertical: 11,
    borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.18)',
  },
  stickerPlacementCancelTxt: {
    color: '#fff', fontFamily: fonts.semiBold, fontSize: 14,
  },

  emptyViewer:  { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 36, gap: 14 },
  emptyTitle:   { fontSize: 18, fontFamily: fonts.semiBold, color: colors.gray800, letterSpacing: -0.3, textAlign: 'center', marginTop: 4 },
  emptySub:     { fontSize: 14, fontFamily: fonts.regular, color: colors.gray400, textAlign: 'center', lineHeight: 20 },



})
