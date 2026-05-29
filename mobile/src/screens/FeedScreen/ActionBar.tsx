import React, { useState, useEffect } from 'react'
import { View, TouchableOpacity, StyleSheet, Share, Modal, Text } from 'react-native'
import * as Haptics from 'expo-haptics'
import { Ionicons } from '@expo/vector-icons'
import { Post } from '../../types'
import { colors, fonts } from '../../theme'
import { useNavigation } from '@react-navigation/native'
import { StackNavigationProp } from '@react-navigation/stack'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { AppStackParams } from '../../navigation/AppNavigator'
import * as postService from '../../services/post.service'
import { ReactionType } from '../../services/reaction.service'
import ActionItem from './ActionItem'
import ReactionPicker from '../../components/ReactionPicker'
import { useNotificationStore } from '../../store/notification.store'

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

const TAB_ITEMS = [
  { icon: 'home-outline',       screen: 'Feed'     },
  { icon: 'chatbubble-outline', screen: 'Messages' },
] as const

export default function ActionBar({ post, onCommentPress, liked: likedProp = false, onLikeChange }: Props) {
  const nav        = useNavigation<StackNavigationProp<AppStackParams>>()
  const { bottom } = useSafeAreaInsets()
  const [liked, setLiked]           = useState(likedProp)
  const [likeCount, setLikeCount]   = useState(post._count?.likes ?? 0)
  const [shareCount, setShareCount] = useState(post._count?.shares ?? 0)
  const [currentReaction, setCurrentReaction] = useState<ReactionType | undefined>()
  const [showReactions, setShowReactions]     = useState(false)

  const messageBadge = useNotificationStore((s) =>
    s.notifications.filter((n) => n.type === 'message' && !n.read).length
  )

  useEffect(() => { setLiked(likedProp) }, [likedProp])

  async function handleLike() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    const wasLiked = liked
    const prevCount = likeCount
    setLiked(!wasLiked)
    setLikeCount((c) => wasLiked ? c - 1 : c + 1)
    onLikeChange?.(!wasLiked)
    try {
      const res = await postService.likePost(post.id)
      setLiked(res.liked)
      setLikeCount((c) => (res.liked !== !wasLiked ? prevCount + (res.liked ? 1 : -1) : c))
      onLikeChange?.(res.liked)
    } catch {
      setLiked(wasLiked)
      setLikeCount(prevCount)
      onLikeChange?.(wasLiked)
    }
  }

  async function handleShare() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    postService.sharePost(post.id)
      .then(() => setShareCount((c) => c + 1))
      .catch(() => {})

    // Open native share sheet
    const caption = post.caption ? `"${post.caption}" — ` : ''
    Share.share({
      message: `${caption}Veja o post de ${post.user.name} no Luxe antes que expire! 🔥`,
      title: 'Luxe',
    }).catch(() => {})
  }

  return (
    <>
      <View style={[s.pill, { bottom: bottom + 52 }]}>
        {/* ── Post actions ────────────────────────────────────────────── */}
        <ActionItem
          icon={liked ? 'heart' : 'heart-outline'}
          size={28}
          count={fmt(likeCount)}
          onPress={handleLike}
          onLongPress={() => setShowReactions(true)}
          circleStyle={liked ? s.circleActive : undefined}
          spinOnPress
        />
        <ActionItem
          icon="chatbubble-ellipses"
          size={26}
          count={fmt(post._count?.comments ?? 0)}
          onPress={onCommentPress}
        />
        <ActionItem
          icon="paper-plane"
          size={26}
          count={fmt(shareCount)}
          onPress={handleShare}
        />
        <ActionItem
          icon="eye-outline"
          size={26}
          count={fmt(post._count?.views ?? 0)}
          onPress={() => {}}
        />

        {/* ── Separator ───────────────────────────────────────────────── */}
        <View style={s.separator} />

        {/* ── Tab navigation ──────────────────────────────────────────── */}
        {TAB_ITEMS.map(({ icon, screen }) => {
          const badge = screen === 'Messages' ? messageBadge : 0
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
  separator: {
    width: 28, height: 1,
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
  badgeTxt:    { color: colors.white, fontSize: 9, fontFamily: fonts.bold },
  circleActive:{ backgroundColor: 'rgba(255,75,110,0.28)' },
})
