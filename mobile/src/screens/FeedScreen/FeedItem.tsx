import React, { useEffect } from 'react'
import { View, Image, StyleSheet, Dimensions } from 'react-native'
import { useVideoPlayer, VideoView } from 'expo-video'
import { LinearGradient } from 'expo-linear-gradient'
import { Post } from '../../types'
import { colors, gradients } from '../../theme'
import ActionBar from './ActionBar'
import PostInfo from './PostInfo'

const { width, height } = Dimensions.get('window')
const API_BASE = 'http://192.168.43.184:3000'

interface Props {
  post: Post
  isActive: boolean
  onCommentPress: (post: Post) => void
}

export default function FeedItem({ post, isActive, onCommentPress }: Props) {
  const uri = post.mediaUrl.startsWith('http') ? post.mediaUrl : `${API_BASE}${post.mediaUrl}`

  const player = useVideoPlayer(
    post.mediaType === 'VIDEO' ? { uri } : null,
    (p) => { p.loop = true; p.muted = false }
  )

  useEffect(() => {
    if (post.mediaType !== 'VIDEO') return
    if (isActive) player.play()
    else player.pause()
  }, [isActive])

  return (
    <View style={s.container}>
      {post.mediaType === 'VIDEO' ? (
        <VideoView player={player} style={s.media} contentFit="cover" nativeControls={false} />
      ) : (
        <View style={s.imageContainer}>
          <Image source={{ uri }} style={s.media} resizeMode="cover" />
        </View>
      )}

      <LinearGradient colors={gradients.feedTop} style={s.topGradient} />
      <LinearGradient colors={gradients.feedBottom} style={s.bottomGradient} />

      <PostInfo post={post} />
      <ActionBar post={post} onCommentPress={() => onCommentPress(post)} />
    </View>
  )
}

const s = StyleSheet.create({
  container: { width, height, backgroundColor: colors.black },
  imageContainer: { flex: 1, backgroundColor: colors.black, justifyContent: 'center' },
  media: { width, height },
  topGradient: { position: 'absolute', top: 0, left: 0, right: 0, height: 120 },
  bottomGradient: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 200 },
})
