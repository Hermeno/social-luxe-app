import React, { useState, useEffect, useRef } from 'react'
import {
  View, Text, Pressable, StyleSheet, Share, Modal, Animated,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Heart, Forward, MessageCircle, Bookmark, MoreHorizontal } from 'lucide-react-native'

import { Post } from '../../types'
import { colors, fonts } from '../../theme'
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
  /** Distância ao fundo da coluna de ações. Sobrepõe o valor por defeito para
   *  a coluna assentar sobre o vídeo (que não vai até ao fundo do ecrã). */
  bottomOffset?: number
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

interface RailActionProps {
  label: string
  count?: string
  selected?: boolean
  onPress: () => void
  onLongPress?: () => void
  children: React.ReactNode
}

function RailAction({ label, count, selected, onPress, onLongPress, children }: RailActionProps) {
  const scale = useRef(new Animated.Value(1)).current
  const halo  = useRef(new Animated.Value(0)).current

  function pressIn() {
    Animated.parallel([
      Animated.spring(scale, {
        toValue: 0.88,
        speed: 45,
        bounciness: 4,
        useNativeDriver: true,
      }),
      Animated.timing(halo, { toValue: 1, duration: 80, useNativeDriver: true }),
    ]).start()
  }

  function pressOut() {
    Animated.parallel([
      Animated.spring(scale, {
        toValue: 1,
        speed: 22,
        bounciness: 10,
        useNativeDriver: true,
      }),
      Animated.timing(halo, { toValue: 0, duration: 180, useNativeDriver: true }),
    ]).start()
  }

  return (
    <Pressable
      style={s.actionHit}
      onPress={onPress}
      onLongPress={onLongPress}
      onPressIn={pressIn}
      onPressOut={pressOut}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityValue={count !== undefined ? { text: count } : undefined}
      accessibilityState={selected !== undefined ? { selected } : undefined}
    >
      <Animated.View style={[s.actionVisual, { transform: [{ scale }] }]}>
        <View style={s.iconStage}>
          <Animated.View style={[s.pressHalo, { opacity: halo }]} />
          {children}
        </View>
        <View style={s.metricSlot}>
          {count !== undefined && <Text style={s.railN} maxFontSizeMultiplier={1.3}>{count}</Text>}
        </View>
      </Animated.View>
    </Pressable>
  )
}

export default React.memo(function ActionBar({
  post, onCommentPress, liked: likedProp = false,
  onLikeChange, reposted: repostedProp = false, onRepost,
  newPostsCount = 0, commentCount: commentCountProp, bottomOffset,
}: Props) {
  const { bottom: safeBottom } = useSafeAreaInsets()
  const t          = useT()

  const [liked,      setLiked]      = useState(likedProp)
  const [reposted,   setReposted]   = useState(repostedProp)
  const [likeCount,  setLikeCount]  = useState(post._count?.likes ?? 0)
  const [shareCount, setShareCount] = useState(post._count?.shares ?? 0)
  const [showReactions, setShowReactions] = useState(false)
  const [saved,      setSaved]      = useState(false)   // guardar — visual, backend depois
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
      {/* Mesma linguagem do topo: ícones livres, traço leve e microinteração. */}
      {!isAnnouncement && (
        <View style={[s.rail, { bottom: bottomOffset ?? safeBottom + 96 }]} pointerEvents="box-none">

          {/* Like */}
          <RailAction
            label={t.nf_likes}
            count={fmt(likeCount)}
            selected={liked}
            onPress={handleLike}
            onLongPress={() => setShowReactions(true)}
          >
            <Heart
              size={27}
              strokeWidth={1.9}
              color={liked ? colors.heart : '#fff'}
              fill={liked ? colors.heart : 'transparent'}
            />
            {hearts.map((h) => (
              <Animated.View
                key={h.id}
                pointerEvents="none"
                accessible={false}
                style={[s.burstHeart, { opacity: h.o, transform: [{ translateX: h.tx }, { translateY: h.ty }, { scale: h.s }] }]}
              >
                <Heart size={14} strokeWidth={0} color={colors.heart} fill={colors.heart} />
              </Animated.View>
            ))}
          </RailAction>

          {/* Comentar */}
          <RailAction
            label={t.nf_comments}
            count={fmt(commentCountProp ?? post._count?.comments ?? 0)}
            onPress={onCommentPress}
          >
            <View style={s.mirrorX}><MessageCircle size={26} strokeWidth={1.9} color="#fff" /></View>
          </RailAction>

          {/* Partilhar */}
          <RailAction label={t.mo_share} count={fmt(shareCount)} onPress={handleShare}>
            <Forward size={26} strokeWidth={1.9} color="#fff" />
          </RailAction>

          {/* Guardar — visual por agora */}
          <RailAction label={t.save} selected={saved} onPress={() => setSaved((v) => !v)}>
            <Bookmark
              size={25}
              strokeWidth={1.9}
              color={saved ? colors.primary : '#fff'}
              fill={saved ? colors.primary : 'transparent'}
            />
          </RailAction>

          {/* Mais */}
          <RailAction label={t.see_more} onPress={handleShare}>
            <MoreHorizontal size={26} strokeWidth={1.9} color="#fff" />
          </RailAction>

        </View>
      )}

      {showReactions && !isAnnouncement && (
        <Modal transparent animationType="none" visible onRequestClose={() => setShowReactions(false)}>
          <ReactionPicker postId={post.id} currentReaction={undefined} onClose={() => setShowReactions(false)} />
        </Modal>
      )}
    </>
  )
})

const s = StyleSheet.create({
  // Alinhada com o último botão do topo: centro a 32 px da margem direita.
  rail: {
    position: 'absolute',
    right: 0,
    width: 64,
    alignItems: 'center',
    gap: 4,
    zIndex: 20,
  },
  actionHit: {
    width: 64,
    height: 53,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionVisual: {
    height: 53,
    alignItems: 'center',
    gap: 2,
  },
  iconStage: {
    width: 44,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'visible',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.35, shadowRadius: 5,
  },
  pressHalo: {
    position: 'absolute',
    top: -2,
    left: 2,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.13)',
  },
  metricSlot: {
    height: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  railN: {
    color: 'rgba(255,255,255,0.88)',
    fontFamily: fonts.semiBold,
    fontSize: 11.5,
    lineHeight: 15,
    letterSpacing: 0,
    fontVariant: ['tabular-nums'],
    textShadowColor: 'rgba(0,0,0,0.4)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },

  mirrorX:    { transform: [{ scaleX: -1 }] },

  // Centrado sobre o ícone do like (primeiro da coluna)
  burstHeart: {
    position: 'absolute',
    top: 11,
    left: 15,
    zIndex: 30,
  },
})
