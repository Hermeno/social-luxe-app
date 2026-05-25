import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import {
  View,
  Animated,
  Pressable,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  Text,
} from 'react-native'
import { Image } from 'expo-image'
import { useRoute, useNavigation, RouteProp } from '@react-navigation/native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { LinearGradient } from 'expo-linear-gradient'
import { Ionicons } from '@expo/vector-icons'
import { useVideoPlayer, VideoView } from 'expo-video'
import { Post } from '../../types'
import { AppStackParams } from '../../navigation/AppNavigator'
import { colors, fonts, gradients } from '../../theme'
import { markPostViewed } from '../../db/database'
import ActionBar from '../FeedScreen/ActionBar'
import PostInfo from '../FeedScreen/PostInfo'
import CommentSheet from '../../components/CommentSheet'
import AvatarImage from '../../components/AvatarImage'

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window')
const API_BASE       = 'http://192.168.43.184:3000'
const IMAGE_DURATION = 30000
const VIDEO_DURATION = 90000

type Route = RouteProp<AppStackParams, 'PostViewer'>

function resolveMedia(url: string) {
  return url.startsWith('http') ? url : `${API_BASE}${url}`
}

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

export default function PostViewerScreen() {
  const nav   = useNavigation()
  const route = useRoute<Route>()
  const { posts, startIndex } = route.params
  const { top } = useSafeAreaInsets()

  const [index, setIndex]             = useState(startIndex)
  const [liked, setLiked]             = useState(false)
  const [commentPost, setCommentPost] = useState<Post | null>(null)
  // Measured container size for reliable native clipping
  const [containerW, setContainerW] = useState(SCREEN_W)
  const [containerH, setContainerH] = useState(SCREEN_H) // starts at full screen; refined by onLayout

  const progressAnim     = useRef(new Animated.Value(0)).current
  const progressRef      = useRef<Animated.CompositeAnimation | null>(null)
  const progressValueRef = useRef(0)
  const pressStartRef    = useRef(0)

  const post     = posts[index]
  const postRef  = useRef(post)
  postRef.current = post

  const player = useVideoPlayer(null, (p) => { p.loop = true; p.muted = false })

  // Track animated progress value
  useEffect(() => {
    const id = progressAnim.addListener(({ value }) => { progressValueRef.current = value })
    return () => progressAnim.removeListener(id)
  }, [])

  const goNext = useCallback(() => {
    if (index < posts.length - 1) {
      setIndex((i) => i + 1)
      setLiked(false)
    } else {
      nav.goBack()
    }
  }, [index, posts.length, nav])
  const goNextRef = useRef(goNext)
  goNextRef.current = goNext

  const goPrev = useCallback(() => {
    if (index > 0) {
      setIndex((i) => i - 1)
      setLiked(false)
    }
  }, [index])

  // Resume from current progress position
  function resumeFromCurrent() {
    const p = postRef.current
    if (!p || commentPost) return
    if (p.mediaType === 'VIDEO') player.play()
    const totalDur = p.mediaType === 'VIDEO' ? VIDEO_DURATION : IMAGE_DURATION
    const remaining = Math.max(400, (1 - progressValueRef.current) * totalDur)
    progressRef.current = Animated.timing(progressAnim, {
      toValue: 1, duration: remaining, useNativeDriver: false,
    })
    progressRef.current.start(({ finished }) => { if (finished) goNextRef.current() })
  }

  // Main playback effect — runs on new post
  useEffect(() => {
    progressRef.current?.stop()
    player.pause()
    progressAnim.setValue(0)
    progressValueRef.current = 0

    markPostViewed(post.id).catch(() => {})
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
  }, [index])

  // Pause when comment sheet opens, resume when it closes
  useEffect(() => {
    if (commentPost) {
      progressRef.current?.stop()
      player.pause()
    } else {
      resumeFromCurrent()
    }
  }, [!!commentPost])

  // Hold-to-pause
  function handlePressIn() {
    pressStartRef.current = Date.now()
    progressRef.current?.stop()
    player.pause()
  }

  function handlePressOut(navigate: () => void) {
    const held = Date.now() - pressStartRef.current
    if (held < 220) {
      navigate()
    } else {
      resumeFromCurrent()
    }
  }

  const videoStyle = useMemo(
    () => containerH > 0
      ? { width: containerW, height: containerH }
      : { width: '100%' as const, height: '100%' as const },
    [containerW, containerH],
  )

  return (
    <View
      style={s.container}
      onLayout={(e) => {
        setContainerW(e.nativeEvent.layout.width)
        setContainerH(e.nativeEvent.layout.height)
      }}
    >
      {/* Media: exact pixel dimensions + hardware layer = no overflow */}
      <View style={s.mediaClip} renderToHardwareTextureAndroid>
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

      <View style={[s.topOverlay, { paddingTop: top + 6 }]} pointerEvents="box-none">
        <ProgressBars count={posts.length} current={index} progress={progressAnim} />
        <View style={s.headerRow}>
          <AvatarImage uri={post.user.avatar} size={32} borderColor="rgba(255,255,255,0.8)" borderWidth={1.5} />
          <Text style={s.headerName}>{post.user.name}</Text>
          <TouchableOpacity onPress={() => nav.goBack()} style={s.closeBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Ionicons name="close" size={26} color={colors.white} />
          </TouchableOpacity>
        </View>
      </View>

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
        liked={liked}
        onLikeChange={setLiked}
      />

      {commentPost && (
        <CommentSheet post={commentPost} onClose={() => setCommentPost(null)} />
      )}
    </View>
  )
}

const s = StyleSheet.create({
  container: {
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
  topGradient:    { position: 'absolute', top: 0, left: 0, right: 0, height: 200 },
  bottomGradient: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 320 },
  topOverlay:     {
    position: 'absolute', top: 0, left: 0, right: 0,
    zIndex: 20, pointerEvents: 'box-none', gap: 10,
  },
  progressRow:   { flexDirection: 'row', paddingHorizontal: 10, gap: 3 },
  progressTrack: {
    flex: 1, height: 2.5,
    backgroundColor: 'rgba(255,255,255,0.35)',
    borderRadius: 2, overflow: 'hidden',
  },
  progressFull:  { flex: 1, backgroundColor: colors.white },
  progressFill:  { height: '100%', backgroundColor: colors.white },
  headerRow:     {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 12, gap: 10, marginTop: 6,
  },
  headerName:    {
    flex: 1, color: colors.white,
    fontFamily: fonts.semiBold, fontSize: 14,
    textShadowColor: 'rgba(0,0,0,0.4)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  closeBtn: { padding: 4 },
  leftTap:  { position: 'absolute', left: 0, top: 80, bottom: 120, width: SCREEN_W * 0.35, zIndex: 10 },
  rightTap: { position: 'absolute', left: SCREEN_W * 0.35, right: 80, top: 80, bottom: 120, zIndex: 10 },
})
