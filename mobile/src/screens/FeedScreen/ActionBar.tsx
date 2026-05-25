import React, { useState, useEffect } from 'react'
import { View, TouchableOpacity, StyleSheet, Share, Modal, Alert, Text } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { Post } from '../../types'
import { colors } from '../../theme'
import { useNavigation } from '@react-navigation/native'
import { StackNavigationProp } from '@react-navigation/stack'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { AppStackParams } from '../../navigation/AppNavigator'
import * as postService from '../../services/post.service'
import { ReactionType } from '../../services/reaction.service'
import ActionItem from './ActionItem'
import ReactionPicker from '../../components/ReactionPicker'
import AvatarImage from '../../components/AvatarImage'
import { useNotificationStore } from '../../store/notification.store'
import { useFriendsStore } from '../../store/friends.store'

interface Props {
  post: Post
  onCommentPress: () => void
  liked?: boolean
  onLikeChange?: (liked: boolean) => void
}

function fmt(n: number) {
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`
  return String(n)
}

const RING_SIZE   = 64
const AVATAR_SIZE = 50

const TAB_ITEMS = [
  { icon: 'home-outline',       screen: 'Feed'     },
  { icon: 'chatbubble-outline', screen: 'Messages' },
  { icon: 'people-outline',     screen: 'Friends'  },
] as const

export default function ActionBar({ post, onCommentPress, liked: likedProp = false, onLikeChange }: Props) {
  const nav           = useNavigation<StackNavigationProp<AppStackParams>>()
  const { bottom }    = useSafeAreaInsets()
  const [liked, setLiked]             = useState(likedProp)
  const [likeCount, setLikeCount]     = useState(post._count.likes)
  const [shareCount, setShareCount]   = useState(post._count.shares)
  const [currentReaction, setCurrentReaction] = useState<ReactionType | undefined>()
  const [showReactions, setShowReactions]     = useState(false)
  const messageBadge   = useNotificationStore((s) =>
    s.notifications.filter((n) => n.type === 'message' && !n.read).length
  )
  const followersBadge = useFriendsStore((s) => s.newFollowersBadge)

  useEffect(() => { setLiked(likedProp) }, [likedProp])

  async function handleLike() {
    const wasLiked = liked
    const prevCount = likeCount
    // Optimistic update — instant feedback
    setLiked(!wasLiked)
    setLikeCount((c) => wasLiked ? c - 1 : c + 1)
    onLikeChange?.(!wasLiked)
    try {
      const res = await postService.likePost(post.id)
      setLiked(res.liked)
      setLikeCount((c) => {
        const diff = res.liked ? 1 : -1
        // reconcile: if server disagrees with optimistic, adjust
        return res.liked !== !wasLiked ? prevCount + diff : c
      })
      onLikeChange?.(res.liked)
    } catch {
      // Rollback on error
      setLiked(wasLiked)
      setLikeCount(prevCount)
      onLikeChange?.(wasLiked)
    }
  }

  async function handleShare() {
    try {
      await postService.sharePost(post.id)
      setShareCount((c) => c + 1)
    } catch {}
    Share.share({ message: `Confira este post no Luxe!` }).catch(() => {})
  }

  return (
    <>
      {/* ── Unified vertical pill: post actions + nav icons ──────────────── */}
      <View style={[s.pill, { bottom: bottom + 52 }]}>

        {/* Author avatar */}
        <TouchableOpacity
          style={s.avatarItem}
          onPress={() => nav.navigate('Profile', { userId: post.user.id })}
          activeOpacity={0.85}
        >
          <View style={s.avatarWrap}>
            <AvatarImage uri={post.user.avatar} size={AVATAR_SIZE} borderColor={colors.white} borderWidth={2} />
            <View style={s.addBtn}>
              <Ionicons name="add" size={12} color={colors.white} />
            </View>
          </View>
        </TouchableOpacity>

        {/* Post actions */}
        <ActionItem
          icon={liked ? 'heart' : 'heart-outline'}
          size={30}
          count={fmt(likeCount)}
          onPress={handleLike}
          onLongPress={() => setShowReactions(true)}
          circleStyle={liked ? s.circleActive : undefined}
          spinOnPress
        />
        <ActionItem
          icon="chatbubble-ellipses"
          size={28}
          count={fmt(post._count.comments)}
          onPress={onCommentPress}
        />
        <ActionItem
          icon="paper-plane"
          size={28}
          count={fmt(shareCount)}
          onPress={handleShare}
        />

        {/* Separator */}
        <View style={s.separator} />

        {/* Tab navigation icons */}
        {TAB_ITEMS.map(({ icon, screen }) => {
          const badge = screen === 'Messages' ? messageBadge : screen === 'Friends' ? followersBadge : 0
          return (
            <TouchableOpacity
              key={screen}
              style={s.navItem}
              onPress={() => (nav as any).navigate(screen)}
              activeOpacity={0.7}
            >
              <Ionicons name={icon} size={24} color="rgba(255,255,255,0.9)" />
              {badge > 0 && (
                <View style={s.badge}>
                  <Text style={s.badgeTxt}>{badge > 9 ? '9+' : badge}</Text>
                </View>
              )}
            </TouchableOpacity>
          )
        })}
      </View>

      {showReactions && (
        <Modal transparent animationType="none" visible onRequestClose={() => setShowReactions(false)}>
          <ReactionPicker
            postId={post.id}
            currentReaction={currentReaction}
            onClose={() => setShowReactions(false)}
          />
        </Modal>
      )}
    </>
  )
}

const s = StyleSheet.create({
  pill: {
    position: 'absolute',
    right: 10,
    alignItems: 'center',
    gap: 4,
    paddingVertical: 8,
    paddingHorizontal: 6,
  },
  avatarItem: { alignItems: 'center', marginBottom: 4 },
  avatarWrap: {
    width: RING_SIZE, height: RING_SIZE,
    alignItems: 'center', justifyContent: 'center',
    position: 'relative',
  },
  addBtn: {
    position: 'absolute', bottom: 0, alignSelf: 'center',
    backgroundColor: colors.primary, borderRadius: 10,
    width: 20, height: 20,
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 1.5, borderColor: 'rgba(0,0,0,0.6)',
  },
  separator: {
    width: 28,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.2)',
    marginVertical: 4,
  },
  navItem: {
    width: 44, height: 44,
    alignItems: 'center', justifyContent: 'center',
  },
  badge: {
    position: 'absolute', top: -2, right: -4,
    minWidth: 16, height: 16, borderRadius: 8,
    backgroundColor: colors.primary,
    alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 3,
    borderWidth: 1.5, borderColor: 'rgba(0,0,0,0.5)',
  },
  badgeTxt: { color: colors.white, fontSize: 9, fontWeight: '800' },
  circleActive: { backgroundColor: 'rgba(255,75,110,0.28)' },
})
