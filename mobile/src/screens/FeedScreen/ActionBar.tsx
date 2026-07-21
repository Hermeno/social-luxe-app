import React, { useState, useEffect, useRef } from 'react'
import {
  View, Text, TouchableOpacity, StyleSheet, Share, Modal, Animated,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Heart, RefreshCw } from 'lucide-react-native'
import { ChatIcon, PaperPlaneIcon } from '../../components/icons'

import { Post } from '../../types'
import { fonts } from '../../theme'
import * as postService from '../../services/post.service'
import { updateCachedPost } from '../../db/database'
import ReactionPicker from '../../components/ReactionPicker'
import { useT } from '../../i18n'

interface Props {
  post: Post
  onCommentPress: () => void
  liked?: boolean
  onLikeChange?: (liked: boolean) => void
  reposted?: boolean
  onRepost?: () => void
  newPostsCount?: number
  commentCount?: number
}

type HeartP = {
  id:  number
  tx:  Animated.Value
  ty:  Animated.Value
  s:   Animated.Value
  o:   Animated.Value
}

function fmt(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000)     return `${(n / 1_000).toFixed(1)}K`
  return String(n)
}

export default React.memo(function ActionBar({
  post, onCommentPress, liked: likedProp = false,
  onLikeChange, reposted: repostedProp = false, onRepost,
  newPostsCount = 0, commentCount: commentCountProp,
}: Props) {
  const { bottom: safeBottom } = useSafeAreaInsets()
  const tabOffset = 42 + Math.max(safeBottom, 8)
  const t          = useT()

  const [liked,      setLiked]      = useState(likedProp)
  const [reposted,   setReposted]   = useState(repostedProp)
  const [likeCount,  setLikeCount]  = useState(post._count?.likes ?? 0)
  const [shareCount, setShareCount] = useState(post._count?.shares ?? 0)
  const [showReactions, setShowReactions] = useState(false)
  const [hearts,    setHearts]    = useState<HeartP[]>([])
  const heartIdRef = useRef(0)
  const repostSpin = useRef(new Animated.Value(0)).current
  const repostRotate = repostSpin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] })

  function burstHearts() {
    const newHearts: HeartP[] = []
    for (let i = 0; i < 10; i++) {
      const tx = new Animated.Value(0)
      const ty = new Animated.Value(0)
      const s  = new Animated.Value(0)
      const o  = new Animated.Value(1)
      const id = ++heartIdRef.current

      const angle  = Math.random() * Math.PI * 2
      const dist   = 28 + Math.random() * 54
      const finalX = Math.cos(angle) * dist
      const finalY = Math.sin(angle) * dist
      const finalS = 0.5 + Math.random() * 0.9
      const dur    = 550 + Math.random() * 220

      Animated.parallel([
        Animated.sequence([
          Animated.spring(s, { toValue: finalS, speed: 55, bounciness: 16, useNativeDriver: true }),
          Animated.timing(s, { toValue: 0, duration: 160, useNativeDriver: true }),
        ]),
        Animated.timing(tx, { toValue: finalX, duration: dur, useNativeDriver: true }),
        Animated.timing(ty, { toValue: finalY, duration: dur, useNativeDriver: true }),
        Animated.sequence([
          Animated.delay(180 + i * 18),
          Animated.timing(o, { toValue: 0, duration: 380, useNativeDriver: true }),
        ]),
      ]).start(() => {
        setHearts((prev) => prev.filter((h) => h.id !== id))
      })

      newHearts.push({ id, tx, ty, s, o })
    }
    setHearts((prev) => [...prev, ...newHearts])
  }

  useEffect(() => {
    setLiked(likedProp)
    setReposted(repostedProp)
    setLikeCount(post._count?.likes ?? 0)
    setShareCount(post._count?.shares ?? 0)
    setShowReactions(false)
  }, [post.id])

  function handleRepost() {
    if (reposted) return     // repost uma vez
    setReposted(true)        // feedback imediato
    setShareCount((c) => c + 1)
    repostSpin.setValue(0)   // gira 360°
    Animated.timing(repostSpin, { toValue: 1, duration: 600, useNativeDriver: true }).start()
    onRepost?.()             // FeedScreen faz a chamada à API
  }

  async function handleLike() {
    const was = liked; const prev = likeCount
    const optimisticCount = was ? prev - 1 : prev + 1
    setLiked(!was); setLikeCount(optimisticCount); onLikeChange?.(!was)
    if (!was) burstHearts()
    updateCachedPost(post.id, { _count: { ...post._count, likes: optimisticCount } }).catch(() => {})
    try {
      const res = await postService.likePost(post.id)
      setLiked(res.liked); onLikeChange?.(res.liked)
      const confirmedCount = res.liked !== !was ? prev + (res.liked ? 1 : -1) : optimisticCount
      setLikeCount(confirmedCount)
      updateCachedPost(post.id, { _count: { ...post._count, likes: confirmedCount } }).catch(() => {})
    } catch {
      setLiked(was); setLikeCount(prev); onLikeChange?.(was)
      updateCachedPost(post.id, { _count: { ...post._count, likes: prev } }).catch(() => {})
    }
  }

  async function handleShare() {
    try {
      const result = await Share.share({
        message: `${post.caption ? `"${post.caption}" — ` : ''}${t.feed_share_msg}`,
      })
      if (result.action === Share.sharedAction)
        postService.sharePost(post.id).then(() => setShareCount((c) => c + 1)).catch(() => {})
    } catch {}
  }

  const isAnnouncement = post.isAnnouncement ?? false

  return (
    <>
      {/* Vertical column — right edge, alinhado com user info */}
      <View style={[s.column, { bottom: 16 + tabOffset }]}>

        {/* Like */}
        {!isAnnouncement && (
          <TouchableOpacity
            style={s.btn}
            onPress={handleLike}
            onLongPress={() => setShowReactions(true)}
            activeOpacity={0.75}
          >
            <Heart
              size={26}
              strokeWidth={2}
              color={liked ? '#FF4B6E' : '#fff'}
              fill={liked ? '#FF4B6E' : 'transparent'}
            />
            <Text style={s.label}>{fmt(likeCount)}</Text>

            {/* Heart burst particles */}
            {hearts.map((h) => (
              <Animated.View
                key={h.id}
                pointerEvents="none"
                style={[
                  s.burstHeart,
                  {
                    opacity: h.o,
                    transform: [
                      { translateX: h.tx },
                      { translateY: h.ty },
                      { scale: h.s },
                    ],
                  },
                ]}
              >
                <Heart size={14} strokeWidth={0} color="#FF4B6E" fill="#FF4B6E" />
              </Animated.View>
            ))}
          </TouchableOpacity>
        )}

        {/* Comment — ícone da pasta icins (cauda à direita, sem espelhar) */}
        {!isAnnouncement && (
          <TouchableOpacity style={s.btn} onPress={onCommentPress} activeOpacity={0.75}>
            <ChatIcon size={24} color="#fff" />
            <Text style={s.label}>{fmt(commentCountProp ?? post._count?.comments ?? 0)}</Text>
          </TouchableOpacity>
        )}

        {/* Share */}
        {!isAnnouncement && (
          <TouchableOpacity style={s.btn} onPress={handleShare} activeOpacity={0.75}>
            <PaperPlaneIcon size={25} color="#fff" />
            <Text style={s.label}>{fmt(shareCount)}</Text>
          </TouchableOpacity>
        )}

        {/* Repostar — gira ao repostar e mostra o ponto central (refresh-cw-dot) */}
        {!isAnnouncement && (
          <TouchableOpacity style={s.btn} onPress={handleRepost} activeOpacity={0.75}>
            <View style={s.repostIcon}>
              <Animated.View style={{ transform: [{ rotate: repostRotate }] }}>
                <RefreshCw size={26} strokeWidth={2} color="#fff" />
              </Animated.View>
              {reposted && <View style={s.repostDot} pointerEvents="none" />}
            </View>
            <Text style={s.label}>{fmt(shareCount)}</Text>
          </TouchableOpacity>
        )}

        {/* Views saíram da feed — o autor vê-as no próprio perfil.
            Os 3 pontinhos passaram para o topo do post (PostOptionsMenu). */}
      </View>

      {showReactions && !isAnnouncement && (
        <Modal transparent animationType="none" visible onRequestClose={() => setShowReactions(false)}>
          <ReactionPicker postId={post.id} currentReaction={undefined} onClose={() => setShowReactions(false)} />
        </Modal>
      )}
    </>
  )
})

const s = StyleSheet.create({
  // ── Icon column ─────────────────────────────────────────────────────────────
  column: {
    position: 'absolute',
    right: 12,
    width: 52,
    alignItems: 'center',
    zIndex: 20,
  },

  // Botão principal: ícone + contador
  btn: {
    width: 52,
    alignItems: 'center',
    paddingVertical: 11,
    gap: 5,
  },

  repostIcon: { width: 26, height: 26, alignItems: 'center', justifyContent: 'center' },
  repostDot:  { position: 'absolute', top: 10.5, left: 10.5, width: 5, height: 5, borderRadius: 2.5, backgroundColor: '#fff' },

  burstHeart: {
    position: 'absolute',
    top: 24,    // centro vertical do ícone de coração (paddingTop 11 + metade do ícone 26)
    left: 19,   // centro horizontal (52/2 - 7)
    zIndex: 30,
  },

  label: {
    color: '#fff',
    fontFamily: fonts.semiBold,
    fontSize: 12,
    letterSpacing: -0.1,
    textShadowColor: 'rgba(0,0,0,0.28)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
})
