import React, { useEffect } from 'react'
import { Image, StyleSheet } from 'react-native'
import { useVideoPlayer, VideoView } from 'expo-video'
import { Post } from '../../types'

const API_BASE = 'http://192.168.43.184:3000'

function resolveMedia(url: string) {
  return url.startsWith('http') ? url : `${API_BASE}${url}`
}

interface Props {
  post: Post
  isActive: boolean
}

export default function PostMedia({ post, isActive }: Props) {
  const uri    = resolveMedia(post.mediaUrl)
  const player = useVideoPlayer(
    post.mediaType === 'VIDEO' ? { uri } : null,
    (p) => { p.loop = true; p.muted = false },
  )

  useEffect(() => {
    if (post.mediaType !== 'VIDEO') return
    if (isActive) {
      player?.play()
    } else {
      player?.pause()
    }
    return () => { player?.pause() }
  }, [isActive])

  if (post.mediaType === 'VIDEO') {
    return (
      <VideoView
        player={player!}
        style={StyleSheet.absoluteFill}
        contentFit="cover"
        nativeControls={false}
      />
    )
  }
  return <Image source={{ uri }} style={StyleSheet.absoluteFill} resizeMode="cover" />
}
