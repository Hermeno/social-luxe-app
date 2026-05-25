import React, { useState, useEffect, useRef, useCallback } from 'react'
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  Animated,
  PanResponder,
} from 'react-native'
import AvatarImage from '../../components/AvatarImage'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native'
import { Ionicons } from '@expo/vector-icons'
import { useVideoPlayer, VideoView } from 'expo-video'
import { AppStackParams } from '../../navigation/AppNavigator'
import { StoryGroup, Story, storyUrl, viewStory } from '../../services/story.service'
import { colors, fonts } from '../../theme'

const { width, height } = Dimensions.get('window')
const STORY_DURATION = 4000

type Route = RouteProp<AppStackParams, 'StoryViewer'>

function timeAgo(date: string) {
  const diff = Date.now() - new Date(date).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 60) return `${m}m atrás`
  if (m < 1440) return `${Math.floor(m / 60)}h atrás`
  return `${Math.floor(m / 1440)}d atrás`
}

interface ProgressBarProps {
  count: number
  current: number
  progress: Animated.Value
}

function ProgressBar({ count, current, progress }: ProgressBarProps) {
  return (
    <View style={s.progressRow}>
      {Array.from({ length: count }).map((_, i) => (
        <View key={i} style={s.progressTrack}>
          {i < current ? (
            <View style={[s.progressFill, { width: '100%' }]} />
          ) : i === current ? (
            <Animated.View
              style={[
                s.progressFill,
                {
                  width: progress.interpolate({
                    inputRange: [0, 1],
                    outputRange: ['0%', '100%'],
                  }),
                },
              ]}
            />
          ) : null}
        </View>
      ))}
    </View>
  )
}

export default function StoryViewerScreen() {
  const nav = useNavigation()
  const route = useRoute<Route>()
  const { top } = useSafeAreaInsets()
  const { groups, startGroupIndex } = route.params

  const [groupIndex, setGroupIndex] = useState(startGroupIndex)
  const [storyIndex, setStoryIndex] = useState(0)
  const progressAnim = useRef(new Animated.Value(0)).current
  const progressRef = useRef<Animated.CompositeAnimation | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const group: StoryGroup | undefined = groups[groupIndex]
  const story: Story | undefined = group?.stories[storyIndex]

  const videoPlayer = useVideoPlayer(
    story?.mediaType === 'VIDEO' && story ? { uri: storyUrl(story) } : null,
    (p) => { p.loop = false },
  )

  const goNextStory = useCallback(() => {
    if (!group) return
    if (storyIndex < group.stories.length - 1) {
      setStoryIndex((i) => i + 1)
    } else if (groupIndex < groups.length - 1) {
      setGroupIndex((g) => g + 1)
      setStoryIndex(0)
    } else {
      nav.goBack()
    }
  }, [group, storyIndex, groupIndex, groups.length, nav])

  const goPrevStory = useCallback(() => {
    if (storyIndex > 0) {
      setStoryIndex((i) => i - 1)
    } else if (groupIndex > 0) {
      setGroupIndex((g) => g - 1)
      setStoryIndex(0)
    }
  }, [storyIndex, groupIndex])

  useEffect(() => {
    if (!story) return
    viewStory(story.id).catch(() => {})

    progressAnim.setValue(0)
    progressRef.current?.stop()

    if (story.mediaType === 'IMAGE') {
      progressRef.current = Animated.timing(progressAnim, {
        toValue: 1,
        duration: STORY_DURATION,
        useNativeDriver: false,
      })
      progressRef.current.start(({ finished }) => {
        if (finished) goNextStory()
      })
    } else {
      videoPlayer?.play()
    }

    return () => {
      progressRef.current?.stop()
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [story?.id])

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > 10,
      onPanResponderRelease: (_, g) => {
        if (g.dx < -50) {
          if (groupIndex < groups.length - 1) {
            setGroupIndex((i) => i + 1)
            setStoryIndex(0)
          } else {
            nav.goBack()
          }
        } else if (g.dx > 50) {
          if (groupIndex > 0) {
            setGroupIndex((i) => i - 1)
            setStoryIndex(0)
          }
        }
      },
    }),
  ).current

  if (!group || !story) return null

  return (
    <View style={s.container} {...panResponder.panHandlers}>
      {story.mediaType === 'VIDEO' ? (
        <VideoView
          player={videoPlayer}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          nativeControls={false}
        />
      ) : (
        <Image source={{ uri: storyUrl(story) }} style={StyleSheet.absoluteFill} resizeMode="cover" />
      )}

      <View style={[s.overlay, { paddingTop: top + 8 }]}>
        <ProgressBar
          count={group.stories.length}
          current={storyIndex}
          progress={progressAnim}
        />

        <View style={s.header}>
          <AvatarImage uri={group.user.avatar} size={38} borderColor={colors.white} borderWidth={1.5} />
          <View style={s.headerInfo}>
            <Text style={s.userName}>{group.user.name}</Text>
            <Text style={s.time}>{timeAgo(story.createdAt)}</Text>
          </View>
          <TouchableOpacity onPress={() => nav.goBack()} style={s.closeBtn}>
            <Ionicons name="close" size={26} color={colors.white} />
          </TouchableOpacity>
        </View>
      </View>

      <TouchableOpacity style={s.leftTap} onPress={goPrevStory} activeOpacity={1} />
      <TouchableOpacity style={s.rightTap} onPress={goNextStory} activeOpacity={1} />
    </View>
  )
}

const s = StyleSheet.create({
  container:   { flex: 1, backgroundColor: colors.black },
  overlay:     { ...StyleSheet.absoluteFillObject, zIndex: 10, pointerEvents: 'box-none' },
  progressRow: { flexDirection: 'row', paddingHorizontal: 8, gap: 4, marginBottom: 12 },
  progressTrack: {
    flex: 1, height: 2, backgroundColor: 'rgba(255,255,255,0.35)',
    borderRadius: 1, overflow: 'hidden',
  },
  progressFill: { height: '100%', backgroundColor: colors.white },
  header:      { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, gap: 10 },
  headerInfo:  { flex: 1 },
  userName:    { color: colors.white, fontFamily: fonts.semiBold, fontSize: 14 },
  time:        { color: 'rgba(255,255,255,0.6)', fontFamily: fonts.regular, fontSize: 11 },
  closeBtn:    { padding: 4 },
  leftTap:     { position: 'absolute', left: 0, top: 0, bottom: 0, width: width * 0.35, zIndex: 5 },
  rightTap:    { position: 'absolute', right: 0, top: 0, bottom: 0, width: width * 0.65, zIndex: 5 },
})
