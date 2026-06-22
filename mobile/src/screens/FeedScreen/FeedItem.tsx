import React, { useEffect, useRef, useState } from 'react'
import { View, StyleSheet, Dimensions, TouchableWithoutFeedback, Animated } from 'react-native'
import { useVideoPlayer, VideoView } from 'expo-video'
import { LinearGradient } from 'expo-linear-gradient'
import { Ionicons } from '@expo/vector-icons'
import { Post } from '../../types'
import { colors, gradients } from '../../theme'
import ActionBar from './ActionBar'
import PostInfo from './PostInfo'
import Travel from '../../components/Travel'
import * as postService from '../../services/post.service'
import { API_BASE } from '../../config'

const { width, height } = Dimensions.get('window')

interface Props {
  post: Post
  isActive: boolean
  onCommentPress: (post: Post) => void
}

export default function FeedItem({ post, isActive, onCommentPress }: Props) {
  const uri = post.mediaUrl ?? ''.startsWith('http') ? post.mediaUrl ?? '' : `${API_BASE}${post.mediaUrl ?? ''}`

  const player = useVideoPlayer(
    post.mediaType === 'VIDEO' ? { uri } : null,
    (p) => { p.loop = true; p.muted = false }
  )

  // Double-tap to like
  const lastTap   = useRef(0)
  const heartAnim = useRef(new Animated.Value(0)).current
  const heartScale = useRef(new Animated.Value(0.3)).current
  const [liked, setLiked] = useState(false)

  useEffect(() => {
    if (post.mediaType !== 'VIDEO') return
    if (isActive) player.play()
    else player.pause()
  }, [isActive])

  function handleTap() {
    const now = Date.now()
    if (now - lastTap.current < 300) {
      // Double tap — show heart + like
      triggerHeartBurst()
      if (!liked) {
        setLiked(true)
        postService.likePost(post.id).catch(() => {})
      }
    }
    lastTap.current = now
  }

  function triggerHeartBurst() {
    heartAnim.setValue(1)
    heartScale.setValue(0.3)
    Animated.parallel([
      Animated.spring(heartScale, { toValue: 1, useNativeDriver: true, speed: 18, bounciness: 16 }),
      Animated.sequence([
        Animated.delay(500),
        Animated.timing(heartAnim, { toValue: 0, duration: 350, useNativeDriver: true }),
      ]),
    ]).start()
  }

  return (
    <TouchableWithoutFeedback onPress={handleTap}>
      <View style={s.container}>
        {post.mediaType === 'VIDEO' ? (
          <VideoView player={player} style={s.media} contentFit="cover" nativeControls={false} />
        ) : (
          <View style={s.imageContainer}>
            <Animated.Image source={{ uri }} style={s.media} resizeMode="cover" />
          </View>
        )}

        {/* Gradients */}
        <LinearGradient colors={gradients.feedTop}    style={s.topGradient} />
        <LinearGradient colors={gradients.feedBottom} style={s.bottomGradient} />

        {/* Double-tap heart burst */}
        <Animated.View
          style={[s.heartWrap, { opacity: heartAnim, transform: [{ scale: heartScale }] }]}
          pointerEvents="none"
        >
          <Ionicons name="heart" size={100} color="rgba(255,255,255,0.92)" />
        </Animated.View>

        {/* Travel path + objects overlay — lazy, only when active */}
        <Travel post={post} isActive={isActive} />

        <PostInfo post={post} isActive={isActive} />
        <ActionBar post={post} onCommentPress={() => onCommentPress(post)} liked={liked} onLikeChange={setLiked} />
      </View>
    </TouchableWithoutFeedback>
  )
}

const s = StyleSheet.create({
  container:      { width, height, backgroundColor: colors.black },
  imageContainer: { flex: 1, backgroundColor: colors.black, justifyContent: 'center' },
  media:          { width, height },
  topGradient:    { position: 'absolute', top: 0,    left: 0, right: 0, height: 180 },
  bottomGradient: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 320 },
  heartWrap:      {
    position: 'absolute',
    alignSelf: 'center',
    top: '38%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 12,
  },
})
