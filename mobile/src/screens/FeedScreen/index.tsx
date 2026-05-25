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
import { AppStackParams } from '../../navigation/AppNavigator'
import { markPostViewed, getViewedPostIds } from '../../db/database'
import { colors, fonts, spacing, gradients } from '../../theme'
import AvatarImage from '../../components/AvatarImage'
import SegmentedRing from '../../components/SegmentedRing'
import ActionBar from './ActionBar'
import PostInfo from './PostInfo'
import CommentSheet from '../../components/CommentSheet'

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window')
const RING_SIZE      = 62
const AVATAR_SIZE    = 50
const IMAGE_DURATION = 30000
const VIDEO_DURATION = 90000
const API_BASE       = 'http://192.168.43.184:3000'

type Nav = StackNavigationProp<AppStackParams>

interface UserGroup {
  user: Post['user']
  posts: Post[]
}

function resolveMedia(url: string) {
  return url.startsWith('http') ? url : `${API_BASE}${url}`
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
  const { posts, refresh } = useFeed()
  const nav       = useNavigation<Nav>()
  const { top }   = useSafeAreaInsets()
  const isFocused = useIsFocused()

  const [currentIndex, setCurrentIndex] = useState(0)
  const [commentPost, setCommentPost]   = useState<Post | null>(null)
  const [viewedIds, setViewedIds]       = useState<Set<string>>(new Set())
  // Exact pixel size of viewer (measured via onLayout for reliable clipping)
  const [viewerW, setViewerW] = useState(SCREEN_W)
  const [viewerH, setViewerH] = useState(SCREEN_H) // over-estimate clipped by overflow:hidden; updated precisely by onLayout

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

  // Load persisted viewed post IDs on mount
  useEffect(() => {
    getViewedPostIds().then(setViewedIds).catch(() => {})
  }, [])

  const player = useVideoPlayer(null, (p) => { p.loop = true; p.muted = false })

  // ── Data ──────────────────────────────────────────────────────────────────
  const userGroups = useMemo<UserGroup[]>(() => {
    const map = new Map<string, UserGroup>()
    posts.forEach((p) => {
      if (!map.has(p.user.id)) map.set(p.user.id, { user: p.user, posts: [] })
      map.get(p.user.id)!.posts.push(p)
    })
    return Array.from(map.values())
  }, [posts])

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
    setCurrentIndex((i) => (i < flatPosts.length - 1 ? i + 1 : 0))
  }, [flatPosts.length])

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
    if (p.mediaType === 'VIDEO') player.play()
    const totalDur = p.mediaType === 'VIDEO' ? VIDEO_DURATION : IMAGE_DURATION
    const remaining = Math.max(400, (1 - progressValueRef.current) * totalDur)
    progressRef.current = Animated.timing(progressAnim, {
      toValue: 1, duration: remaining, useNativeDriver: false,
    })
    progressRef.current.start(({ finished }) => { if (finished) goNextRef.current() })
  }

  // ── Main playback effect (new post or focus change) ───────────────────────
  useEffect(() => {
    progressRef.current?.stop()
    player.pause()
    progressAnim.setValue(0)
    progressValueRef.current = 0

    if (!post || !isFocused) return

    // Persist view
    if (!viewedIds.has(post.id)) {
      markPostViewed(post.id).catch(() => {})
      setViewedIds((prev) => new Set(prev).add(post.id))
    }

    // Don't start playback if comment sheet is open
    if (commentPost) return

    if (post.mediaType === 'VIDEO') {
      player.replace({ uri: resolveMedia(post.mediaUrl) })
      player.play()
    }

    const duration = post.mediaType === 'VIDEO' ? VIDEO_DURATION : IMAGE_DURATION
    progressRef.current = Animated.timing(progressAnim, {
      toValue: 1, duration, useNativeDriver: false,
    })
    progressRef.current.start(({ finished }) => { if (finished) goNext() })

    return () => { progressRef.current?.stop(); player.pause() }
  }, [currentIndex, isFocused])

  // ── Comment sheet pause / resume effect ──────────────────────────────────
  useEffect(() => {
    if (commentPost) {
      // Pause everything when comment sheet opens
      progressRef.current?.stop()
      player.pause()
    } else {
      // Resume from where we left off when sheet closes
      resumeFromCurrent()
    }
  }, [!!commentPost])

  // ── Refresh and reset on screen focus ────────────────────────────────────
  useFocusEffect(useCallback(() => {
    refresh()
    setCurrentIndex(0)
  }, []))

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
    player.pause()
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
      <View style={[s.header, { paddingTop: top + 10 }]}>
        <Text style={s.logo}>luxe</Text>
        <View style={s.headerRight}>
          <TouchableOpacity onPress={() => nav.navigate('Create' as any)} activeOpacity={0.75} style={s.headerBtn}>
            <Ionicons name="search-outline" size={24} color={colors.gray800} />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => nav.navigate('Profile', {})} activeOpacity={0.75} style={s.headerBtn}>
            <Ionicons name="person-outline" size={24} color={colors.gray800} />
          </TouchableOpacity>
        </View>
      </View>

      {/* ── User bubble row ────────────────────────────────────────────────── */}
      <FlatList
        ref={bubblesRef}
        horizontal
        data={userGroups}
        keyExtractor={(g) => g.user.id}
        showsHorizontalScrollIndicator={false}
        style={s.bubbleRow}
        contentContainerStyle={s.bubbleList}
        onScrollToIndexFailed={() => {}}
        ListHeaderComponent={
          <TouchableOpacity
            style={s.bubbleItem}
            onPress={() => nav.navigate('Create' as any)}
            activeOpacity={0.8}
          >
            <View style={s.ringWrap}>
              <View style={s.createCircle}>
                <Ionicons name="add" size={32} color={colors.white} />
              </View>
            </View>
            <Text style={s.bubbleName}>Criar</Text>
          </TouchableOpacity>
        }
        renderItem={({ item }) => {
          const isActive = post?.user.id === item.user.id
          return (
            <TouchableOpacity style={s.bubbleItem} onPress={() => jumpToUser(item)} activeOpacity={0.8}>
              <View style={[s.ringWrap, isActive && s.ringActive]}>
                <SegmentedRing
                  count={item.posts.length}
                  viewedCount={viewedCountFor(item)}
                  size={RING_SIZE}
                  strokeWidth={3}
                />
                <View style={s.avatarCenter}>
                  <AvatarImage uri={item.user.avatar} size={AVATAR_SIZE} />
                </View>
              </View>
              <Text style={[s.bubbleName, isActive && s.bubbleNameActive]} numberOfLines={1}>
                {item.user.name.split(' ')[0]}
              </Text>
            </TouchableOpacity>
          )
        }}
        ListEmptyComponent={
          <View style={s.noBubbles}>
            <Text style={s.noBubblesText}>Ainda não há publicações</Text>
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
          {/* ── Media: explicit pixel dimensions + hardware clipping ─────── */}
          <View
            style={s.mediaClip}
            // Force hardware compositing on Android → proper native clipping
            renderToHardwareTextureAndroid
          >
            {post.mediaType === 'VIDEO' ? (
              <VideoView
                player={player}
                style={videoStyle}
                contentFit="cover"
                nativeControls={false}
              />
            ) : (
              <Image
                key={post.id}
                source={{ uri: resolveMedia(post.mediaUrl) }}
                style={videoStyle}
                contentFit="cover"
              />
            )}
          </View>

          <LinearGradient colors={gradients.feedTop}    style={s.topGradient} />
          <LinearGradient colors={gradients.feedBottom} style={s.bottomGradient} />

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
          />
        </View>
      ) : (
        <View style={s.emptyViewer}>
          <Ionicons name="images-outline" size={52} color={colors.gray200} />
          <Text style={s.emptyText}>Nenhuma publicação</Text>
          <Text style={s.emptySub}>Siga pessoas para ver posts aqui</Text>
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
    paddingHorizontal: spacing.md, paddingBottom: 4,
    backgroundColor: colors.white,
  },
  logo:        { fontFamily: fonts.extraBold, fontSize: 26, color: colors.gray800, letterSpacing: -1 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  headerBtn:   { padding: 8 },

  bubbleRow:        { flexGrow: 0, flexShrink: 0 },
  bubbleList:       { paddingHorizontal: 14, paddingVertical: 5, gap: 12 },
  bubbleItem:       { alignItems: 'center', gap: 4, width: RING_SIZE },
  ringWrap:         { width: RING_SIZE, height: RING_SIZE, alignItems: 'center', justifyContent: 'center' },
  createCircle:     {
    width: AVATAR_SIZE, height: AVATAR_SIZE, borderRadius: AVATAR_SIZE / 2,
    backgroundColor: colors.primary,
    alignItems: 'center', justifyContent: 'center',
  },
  ringActive:       { transform: [{ scale: 1.06 }] },
  avatarCenter:     { position: 'absolute', alignItems: 'center', justifyContent: 'center' },
  bubbleName:       { color: colors.black, fontFamily: fonts.bold, fontSize: 11, textAlign: 'center' },
  bubbleNameActive: { color: colors.primary },
  noBubbles:        { paddingHorizontal: 20, paddingVertical: 30 },
  noBubblesText:    { color: colors.gray400, fontFamily: fonts.regular, fontSize: 13 },

  viewer: {
    flex: 1,
    backgroundColor: colors.black,
    overflow: 'hidden',
  },
  // Direct parent of VideoView/Image: explicit overflow + hardware layer = reliable clipping on both platforms
  mediaClip: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    overflow: 'hidden',
    backgroundColor: colors.black,
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

  leftTap:  { position: 'absolute', left: 0, top: 0, bottom: 0, width: SCREEN_W * 0.35, zIndex: 10 },
  rightTap: { position: 'absolute', left: SCREEN_W * 0.35, right: 80, top: 0, bottom: 0, zIndex: 10 },

  emptyViewer: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.sm },
  emptyText:   { color: colors.gray600, fontFamily: fonts.semiBold, fontSize: 16 },
  emptySub:    { color: colors.gray400, fontFamily: fonts.regular, fontSize: 13 },
})
