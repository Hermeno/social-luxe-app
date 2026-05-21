import React, { useState, useEffect } from 'react'
import { View, Image, TouchableOpacity, StyleSheet } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { Post } from '../../types'
import { colors } from '../../theme'
import { useAuthStore } from '../../store/auth.store'
import * as postService from '../../services/post.service'
import * as friendshipService from '../../services/friendship.service'
import { FriendshipLevel } from '../../services/friendship.service'
import ActionItem from './ActionItem'
import FriendshipRing from '../../components/FriendshipRing'

interface Props { post: Post; onCommentPress: () => void }

function fmt(n: number) {
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`
  return String(n)
}

const RING_SIZE = 64
const AVATAR_SIZE = 50

export default function ActionBar({ post, onCommentPress }: Props) {
  const [liked, setLiked]           = useState(false)
  const [likeCount, setLikeCount]   = useState(post._count.likes)
  const [friendship, setFriendship] = useState<FriendshipLevel | null>(null)
  const { user } = useAuthStore()

  useEffect(() => {
    // Só busca nível se o post não é do próprio usuário
    if (!user || post.user.id === user.id) return
    friendshipService.getFriendshipLevel(post.user.id)
      .then(setFriendship)
      .catch(() => {})
  }, [post.user.id, user?.id])

  async function handleLike() {
    try {
      const res = await postService.likePost(post.id)
      setLiked(res.liked)
      setLikeCount((c) => res.liked ? c + 1 : c - 1)
    } catch {}
  }

  const avatarUri = post.user.avatar ??
    `https://ui-avatars.com/api/?name=${post.user.name}&background=FF4B6E&color=fff`

  const showRing = friendship?.isFriend && friendship.level > 0

  return (
    <View style={s.container}>
      {/* Avatar do autor com anel de amizade */}
      <TouchableOpacity style={s.avatarItem} onPress={() => {}} activeOpacity={0.85}>
        <View style={s.avatarWrap}>
          {showRing && (
            <FriendshipRing
              level={friendship!.level}
              tier={friendship!.tier}
              size={RING_SIZE}
              strokeWidth={3}
            />
          )}
          <Image source={{ uri: avatarUri }} style={s.avatar} />
          <View style={s.addBtn}>
            <Ionicons name="add" size={12} color={colors.white} />
          </View>
        </View>
      </TouchableOpacity>

      <ActionItem
        icon={liked ? 'heart' : 'heart-outline'}
        size={30}
        count={fmt(likeCount)}
        onPress={handleLike}
        circleStyle={liked ? s.circleActive : undefined}
        spinOnPress
      />
      <ActionItem icon="chatbubble-ellipses" size={28} count={fmt(post._count.comments)} onPress={onCommentPress} />
      <ActionItem icon="paper-plane"         size={28} count={fmt(post._count.shares)} />
      <ActionItem icon="musical-notes"       size={26} continuousSpin />
    </View>
  )
}

const s = StyleSheet.create({
  container:   { position: 'absolute', right: 14, bottom: 110, alignItems: 'center', gap: 18 },
  avatarItem:  { alignItems: 'center' },
  avatarWrap:  {
    width: RING_SIZE, height: RING_SIZE,
    alignItems: 'center', justifyContent: 'center',
    position: 'relative',
  },
  avatar:      {
    width: AVATAR_SIZE, height: AVATAR_SIZE,
    borderRadius: AVATAR_SIZE / 2,
    borderWidth: 2, borderColor: colors.white,
  },
  addBtn:      {
    position: 'absolute', bottom: 0, alignSelf: 'center',
    backgroundColor: colors.primary, borderRadius: 10,
    width: 20, height: 20,
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 1.5, borderColor: '#0D0D0D',
  },
  circleActive:{ backgroundColor: 'rgba(255,75,110,0.28)' },
})
