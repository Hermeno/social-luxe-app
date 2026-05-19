import React, { useState } from 'react'
import { View, Image, TouchableOpacity, StyleSheet } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { Post } from '../../types'
import { colors } from '../../theme'
import * as postService from '../../services/post.service'
import ActionItem from './ActionItem'

interface Props { post: Post; onCommentPress: () => void }

function fmt(n: number) {
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`
  return String(n)
}

export default function ActionBar({ post, onCommentPress }: Props) {
  const [liked, setLiked] = useState(false)
  const [likeCount, setLikeCount] = useState(post._count.likes)

  async function handleLike() {
    try {
      const res = await postService.likePost(post.id)
      setLiked(res.liked)
      setLikeCount((c) => res.liked ? c + 1 : c - 1)
    } catch {}
  }

  return (
    <View style={s.container}>
      <TouchableOpacity style={s.item} onPress={() => {}}>
        <View style={s.avatarWrap}>
          <Image source={{ uri: post.user.avatar ?? `https://ui-avatars.com/api/?name=${post.user.name}&background=FF4B6E&color=fff` }} style={s.avatar} />
          <View style={s.addBtn}><Ionicons name="add" size={12} color={colors.white} /></View>
        </View>
      </TouchableOpacity>
      <ActionItem icon={liked ? 'heart' : 'heart-outline'} size={28} count={fmt(likeCount)}
        onPress={handleLike} circleStyle={liked ? s.circleActive : undefined} />
      <ActionItem icon="chatbubble-ellipses" count={fmt(post._count.comments)} onPress={onCommentPress} />
      <ActionItem icon="paper-plane" count={fmt(post._count.shares)} />
      <ActionItem icon="musical-notes" size={24} />
    </View>
  )
}

const s = StyleSheet.create({
  container:   { position: 'absolute', right: 14, bottom: 110, alignItems: 'center', gap: 18 },
  item:        { alignItems: 'center', gap: 5 },
  avatarWrap:  { position: 'relative' },
  avatar:      { width: 52, height: 52, borderRadius: 26, borderWidth: 2.5, borderColor: colors.white },
  addBtn:      { position: 'absolute', bottom: -4, alignSelf: 'center', backgroundColor: colors.primary, borderRadius: 10, width: 20, height: 20, justifyContent: 'center', alignItems: 'center', borderWidth: 1.5, borderColor: colors.white },
  circleActive:{ backgroundColor: 'rgba(255,75,110,0.18)' },
})
