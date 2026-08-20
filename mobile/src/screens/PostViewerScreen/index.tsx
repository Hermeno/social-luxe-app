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
import { API_BASE } from '../../config'

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window')
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
  const { posts, startIndex, collectiveCaptureIndex } = route.params
  const { top } = useSafeAreaInsets()

  const [index, setIndex]             = useState(startIndex)
  const [captureIndex, setCaptureIndex] = useState(collectiveCaptureIndex ?? 0)
  const [liked, setLiked]             = useState(false)
  const [commentPost, setCommentPost] = useState<Post | null>(null)
  const [optionsOpen, setOptionsOpen] = useState(false)
  // Measured container size for reliable native clipping
  const [containerW, setContainerW] = useState(SCREEN_W)
  const [containerH, setContainerH] = useState(SCREEN_H) // starts at full screen; refined by onLayout
  const [displayLoad, setDisplayLoad] = useState<{
    key: string
    aspect: number | null
    failed: boolean
  }>({ key: '', aspect: null, failed: false })

  const progressAnim     = useRef(new Animated.Value(0)).current
  const progressRef      = useRef<Animated.CompositeAnimation | null>(null)
  const progressValueRef = useRef(0)
  const pressStartRef    = useRef(0)

  const post     = posts[index]
  const captures = Array.isArray(post.collectiveMoment?.captures)
    ? post.collectiveMoment.captures
    : []
  const participants = Array.isArray(post.collectiveMoment?.participants)
    ? post.collectiveMoment.participants
    : []
  const collectiveMode = collectiveCaptureIndex != null && captures.length > 0
  const safeCaptureIndex = collectiveMode
    ? Math.max(0, Math.min(captureIndex, captures.length - 1))
    : 0
  const capture = collectiveMode ? captures[safeCaptureIndex] : null
  const captureAuthor = capture
    ? participants.find((participant) => participant.id === capture.userId)
    : null
  // `mediaUrls` já chega com a transformação de exibição do servidor. O URL
  // guardado no snapshot é apenas o fallback imutável de autoria.
  const displayMediaUrl = capture
    ? post.mediaUrls?.[capture.mediaIndex ?? safeCaptureIndex] ?? capture.mediaUrl
    : post.mediaUrl ?? ''
  const displaySize = capture
    ? post.mediaSizes?.[capture.mediaIndex ?? safeCaptureIndex]
    : { w: post.mediaWidth, h: post.mediaHeight }
  const serverDisplayAspect = displaySize?.w && displaySize?.h
    ? displaySize.w / displaySize.h
    : null
  const displayKey = `${post.id}:${capture?.id ?? displayMediaUrl}`
  // O estado de carga só vale para a mídia que o produziu. Ao mudar de
  // captura, o frame anterior não pode deslocar overlays nem mostrar fallback.
  const displayAspect = displayLoad.key === displayKey ? displayLoad.aspect : null
  const displayFailed = displayLoad.key === displayKey && displayLoad.failed
  const postRef  = useRef(post)
  postRef.current = post

  const player = useVideoPlayer(null, (p) => { p.loop = true; p.muted = false })

  const safePlayer = useCallback((fn: () => void) => {
    try { fn() } catch { /* player already released */ }
  }, [])

  // Track animated progress value
  useEffect(() => {
    const id = progressAnim.addListener(({ value }) => { progressValueRef.current = value })
    return () => progressAnim.removeListener(id)
  }, [])

  const goNext = useCallback((): boolean => {
    if (collectiveMode && captures.length > 1) {
      setCaptureIndex((safeCaptureIndex + 1) % captures.length)
      return true
    }
    if (index < posts.length - 1) {
      setIndex((i) => i + 1)
      setLiked(false)
    } else {
      nav.goBack()
    }
    return true
  }, [collectiveMode, safeCaptureIndex, captures.length, index, posts.length, nav])
  const goNextRef = useRef(goNext)
  goNextRef.current = goNext

  const goPrev = useCallback((): boolean => {
    if (collectiveMode && captures.length > 1) {
      setCaptureIndex((safeCaptureIndex - 1 + captures.length) % captures.length)
      return true
    }
    if (index > 0) {
      setIndex((i) => i - 1)
      setLiked(false)
      return true
    }
    return false
  }, [collectiveMode, safeCaptureIndex, captures.length, index])

  // Resume from current progress position
  function resumeFromCurrent() {
    const p = postRef.current
    if (!p || commentPost || optionsOpen) return
    if (p.mediaType === 'VIDEO') safePlayer(() => player.play())
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
    safePlayer(() => player.pause())
    progressAnim.setValue(0)
    progressValueRef.current = 0

    markPostViewed(post.id).catch(() => {})
    if (commentPost || optionsOpen) return

    if (post.mediaType === 'VIDEO') {
      safePlayer(() => player.replace({ uri: resolveMedia(post.mediaUrl ?? '') }))
      safePlayer(() => player.play())
    }

    const duration = post.mediaType === 'VIDEO' ? VIDEO_DURATION : IMAGE_DURATION
    progressRef.current = Animated.timing(progressAnim, {
      toValue: 1, duration, useNativeDriver: false,
    })
    progressRef.current.start(({ finished }) => { if (finished) goNext() })

    return () => { progressRef.current?.stop(); safePlayer(() => player.pause()) }
  }, [index, safeCaptureIndex, collectiveMode, displayMediaUrl])

  // Folhas de comentários/opções mandam no player e na linha de progresso.
  useEffect(() => {
    if (commentPost || optionsOpen) {
      progressRef.current?.stop()
      safePlayer(() => player.pause())
    } else {
      resumeFromCurrent()
    }
  }, [!!commentPost, optionsOpen])

  // Hold-to-pause
  function handlePressIn() {
    pressStartRef.current = Date.now()
    progressRef.current?.stop()
    safePlayer(() => player.pause())
  }

  function handlePressOut(navigate: () => boolean) {
    const held = Date.now() - pressStartRef.current
    if (held < 220) {
      // Na primeira mídia, tocar à esquerda não navega. Retomar evita deixar
      // a barra e o avanço automático permanentemente pausados nesse caso.
      if (!navigate()) resumeFromCurrent()
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

  const containedImageRect = useMemo(() => {
    const aspect = serverDisplayAspect ?? displayAspect
    if (!aspect || containerW <= 0 || containerH <= 0) {
      return { left: 0, top: 0, width: containerW, height: containerH }
    }
    const width = Math.min(containerW, containerH * aspect)
    const height = width / aspect
    return {
      left: (containerW - width) / 2,
      top: (containerH - height) / 2,
      width,
      height,
    }
  }, [containerH, containerW, displayAspect, serverDisplayAspect])

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
          <>
            {!displayFailed ? (
              <Image
                key={displayKey}
                source={{ uri: resolveMedia(displayMediaUrl) }}
                style={videoStyle}
                contentFit="contain"
                cachePolicy="disk"
                recyclingKey={`${post.id}:${capture?.id ?? 'media'}`}
                transition={120}
                onLoad={(event) => {
                  const { width, height } = event.source ?? {}
                  if (width && height) {
                    setDisplayLoad({ key: displayKey, aspect: width / height, failed: false })
                  }
                }}
                onError={() => setDisplayLoad({ key: displayKey, aspect: null, failed: true })}
              />
            ) : (
              <View style={s.mediaFallback}>
                <Text style={s.mediaFallbackText}>Foto indisponível</Text>
              </View>
            )}

            {!displayFailed && capture && (serverDisplayAspect ?? displayAspect) && containedImageRect.width > 0 && (
              <View
                pointerEvents="none"
                style={[
                  s.captureOverlays,
                  {
                    left: containedImageRect.left,
                    top: containedImageRect.top,
                    width: containedImageRect.width,
                    height: containedImageRect.height,
                  },
                ]}
              >
                {(Array.isArray(capture.overlays) ? capture.overlays : []).map((overlay, overlayIndex) => {
                  const size = containedImageRect.width * 0.14
                  const x = Number.isFinite(overlay.x) ? Math.max(0, Math.min(1, overlay.x)) : 0.5
                  const y = Number.isFinite(overlay.y) ? Math.max(0, Math.min(1, overlay.y)) : 0.5
                  return (
                    <Text
                      key={`${capture.id}:overlay:${overlayIndex}`}
                      style={{
                        position: 'absolute',
                        left: x * containedImageRect.width - size / 2,
                        top: y * containedImageRect.height - size / 2,
                        fontSize: size,
                        lineHeight: size * 1.14,
                      }}
                    >
                      {overlay.emoji}
                    </Text>
                  )
                })}
              </View>
            )}
          </>
        )}
      </View>

      <LinearGradient colors={gradients.feedTop}    style={s.topGradient} />
      <LinearGradient colors={gradients.feedBottom} style={s.bottomGradient} />

      <View style={[s.topOverlay, { paddingTop: top + 6 }]} pointerEvents="box-none">
        <ProgressBars
          count={collectiveMode ? captures.length : posts.length}
          current={collectiveMode ? safeCaptureIndex : index}
          progress={progressAnim}
        />
        <View style={s.headerRow}>
          <AvatarImage
            uri={captureAuthor ? captureAuthor.avatar : post.user?.avatar}
            name={captureAuthor ? captureAuthor.name : post.user?.name}
            size={32}
            borderColor="rgba(255,255,255,0.8)"
            borderWidth={1.5}
          />
          <Text style={s.headerName}>{captureAuthor ? captureAuthor.name : post.user?.name ?? ''}</Text>
          <TouchableOpacity
            onPress={() => nav.goBack()}
            style={s.closeBtn}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            accessibilityRole="button"
            accessibilityLabel="Fechar"
          >
            <Ionicons name="close" size={26} color={colors.white} />
          </TouchableOpacity>
        </View>
      </View>

      <Pressable
        style={s.leftTap}
        onPressIn={handlePressIn}
        onPressOut={() => handlePressOut(goPrev)}
        accessibilityRole="button"
        accessibilityLabel={collectiveMode ? 'Fotografia anterior' : 'Publicação anterior'}
        accessibilityHint="Navega para o item anterior"
        onAccessibilityTap={() => { if (!goPrev()) resumeFromCurrent() }}
      />
      <Pressable
        style={s.rightTap}
        onPressIn={handlePressIn}
        onPressOut={() => handlePressOut(goNext)}
        accessibilityRole="button"
        accessibilityLabel={collectiveMode ? 'Próxima fotografia' : 'Próxima publicação'}
        accessibilityHint="Navega para o item seguinte"
        onAccessibilityTap={goNext}
      />

      <PostInfo
        key={`info-${post.id}`}
        post={post}
        isActive
      />
      <ActionBar
        key={`bar-${post.id}`}
        post={post}
        onCommentPress={() => setCommentPost(post)}
        liked={liked}
        onLikeChange={setLiked}
        onOptionsBlockingChange={setOptionsOpen}
        onProfileBlocked={() => nav.goBack()}
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
  mediaFallback: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.feedSurface,
  },
  mediaFallbackText: {
    color: 'rgba(255,255,255,0.7)',
    fontFamily: fonts.medium,
    fontSize: 13,
  },
  captureOverlays: { position: 'absolute' },
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
