import React, { useState, useEffect, useRef } from 'react'
import {
  View, Text, TouchableOpacity, StyleSheet, Share, Modal, Animated,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { LinearGradient } from 'expo-linear-gradient'
import { Heart, RefreshCw, Forward, MessageCircle } from 'lucide-react-native'

import { Post } from '../../types'
import { fonts } from '../../theme'

// Vidro escuro real: base escura com um brilho no topo (não um gradiente branco
// lavado). Dá profundidade e faz o ícone branco assentar com contraste.
const CHIP_GRAD = ['rgba(72,72,80,0.55)', 'rgba(14,14,18,0.5)'] as const
import * as postService from '../../services/post.service'
import { updateCachedPost } from '../../db/database'
import ReactionPicker from '../../components/ReactionPicker'
import AvatarImage from '../../components/AvatarImage'
import { useAuthStore } from '../../store/auth.store'
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
  const t          = useT()
  const myAvatar   = useAuthStore((s) => s.user?.avatar ?? null)
  const myName     = useAuthStore((s) => s.user?.name ?? '')

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
  const commenters = post.recentCommenters ?? []

  return (
    <>
      {/* Barra única — comentar à esquerda, gostar + partilhar à direita */}
      {!isAnnouncement && (
        <View style={[s.row, { left: 16, right: 16, bottom: safeBottom + 54 }]}>
          <View style={s.bar}>
            {/* Comentar — avatar + placeholder, toca e abre a folha */}
            <TouchableOpacity style={s.commentArea} onPress={onCommentPress} activeOpacity={0.8}>
              <AvatarImage uri={myAvatar} name={myName} size={30} />
              <Text style={s.commentPh} numberOfLines={1}>{t.feed_add_comment}</Text>
            </TouchableOpacity>

            {/* Ações — gostar · comentários · repost · partilhar */}
            <View style={s.barActs}>
              <TouchableOpacity style={s.act} onPress={handleLike} onLongPress={() => setShowReactions(true)} activeOpacity={0.7}>
                <Heart size={21} strokeWidth={2} color={liked ? '#FF4B6E' : '#fff'} fill={liked ? '#FF4B6E' : 'transparent'} />
                <Text style={s.actN}>{fmt(likeCount)}</Text>
                {hearts.map((h) => (
                  <Animated.View
                    key={h.id}
                    pointerEvents="none"
                    style={[s.burstHeart, { opacity: h.o, transform: [{ translateX: h.tx }, { translateY: h.ty }, { scale: h.s }] }]}
                  >
                    <Heart size={14} strokeWidth={0} color="#FF4B6E" fill="#FF4B6E" />
                  </Animated.View>
                ))}
              </TouchableOpacity>

              <TouchableOpacity style={s.act} onPress={onCommentPress} activeOpacity={0.7}>
                <View style={s.mirrorX}><MessageCircle size={21} strokeWidth={2} color="#fff" /></View>
                <Text style={s.actN}>{fmt(commentCountProp ?? post._count?.comments ?? 0)}</Text>
              </TouchableOpacity>

              <TouchableOpacity style={s.act} onPress={handleRepost} activeOpacity={0.7}>
                <View style={s.repostIcon}>
                  <Animated.View style={{ transform: [{ rotate: repostRotate }] }}>
                    <RefreshCw size={21} strokeWidth={2} color="#fff" />
                  </Animated.View>
                  {reposted && <View style={s.repostDot} pointerEvents="none" />}
                </View>
              </TouchableOpacity>

              <TouchableOpacity style={s.act} onPress={handleShare} activeOpacity={0.7}>
                <Forward size={21} strokeWidth={2} color="#fff" />
              </TouchableOpacity>
            </View>
          </View>
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
  // ── Barra horizontal ────────────────────────────────────────────────────────
  // Sem largura fixa (só left): a fila ajusta-se ao conteúdo e o chip de
  // comentário pode crescer com os avatares sem empurrar os outros para fora.
  row: {
    position: 'absolute',
    left: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    zIndex: 20,
  },

  // Barra única de vidro — comentar + ações
  bar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    height: 50,
    borderRadius: 25,
    paddingLeft: 8,
    paddingRight: 15,
    backgroundColor: 'rgba(16,16,20,0.5)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.16)',
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.32, shadowRadius: 12,
  },
  commentArea: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 9 },
  commentPh:   { flex: 1, color: 'rgba(255,255,255,0.7)', fontFamily: fonts.regular, fontSize: 13.5, letterSpacing: -0.1 },
  barActs:     { flexDirection: 'row', alignItems: 'center', gap: 15 },
  act:         { flexDirection: 'row', alignItems: 'center', gap: 5 },
  actN:        { color: '#fff', fontFamily: fonts.semiBold, fontSize: 12, fontVariant: ['tabular-nums'], letterSpacing: 0.1 },

  // Pilha de avatares dentro do chip de comentário
  commenterStack: { flexDirection: 'row', alignItems: 'center' },
  commenterOverlap: { marginLeft: -7 },

  mirrorX:    { transform: [{ scaleX: -1 }] },
  repostIcon: { width: 21, height: 21, alignItems: 'center', justifyContent: 'center' },
  repostDot:  { position: 'absolute', top: 8, left: 8, width: 5, height: 5, borderRadius: 2.5, backgroundColor: '#fff' },

  // Centrado sobre o ícone do like (primeiro segmento)
  burstHeart: {
    position: 'absolute',
    top: 14,
    left: 18,
    zIndex: 30,
  },

  label: {
    color: '#fff',
    fontFamily: fonts.semiBold,
    fontSize: 12.5,
    letterSpacing: 0.1,
    fontVariant: ['tabular-nums'],
  },
})
