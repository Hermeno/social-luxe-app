import React, { useState, useEffect, useRef } from 'react'
import {
  View, Pressable, StyleSheet, Share, Modal, Animated
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import FeedIcon from '../../components/FeedIcon'

import { Post } from '../../types'
import { colors, fonts } from '../../theme'
import * as postService from '../../services/post.service'
import { updateCachedPost, queueLike } from '../../db/database'
import { isConnected } from '../../services/netinfo.service'
import ReactionPicker from '../../components/ReactionPicker'
import { useT } from '../../i18n'
import PostOptionsMenu from './PostOptionsMenu'

interface Props {
  post: Post
  onCommentPress: () => void
  liked?: boolean
  onLikeChange?: (liked: boolean) => void
  commentCount?: number
  onDeleted?: (id: string) => void
  onEdited?: (id: string, caption: string) => void
  onProfileBlocked?: (userId: string) => void
  onOptionsBlockingChange?: (open: boolean) => void
  isActive?: boolean
  reduceMotion?: boolean
  /** Distância ao fundo da coluna de ações. Sobrepõe o valor por defeito para
   *  a coluna assentar sobre o vídeo (que não vai até ao fundo do ecrã). */
  bottomOffset?: number
}

/**
 * Um só tamanho para a rail toda.
 *
 * Os desenhos vêm de famílias diferentes, mas o build já reenquadra cada caixa para
 * a tinta ocupar a mesma fração (ver scripts/build-feed-icons.mjs). Por isso o mesmo
 * número dá o mesmo tamanho aparente — não voltar a compensar ícone a ícone.
 */
const RAIL = 27

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
  entry: Animated.Value
  order: number
  reduceMotion: boolean
}

function RailAction({
  label, count, selected, onPress, onLongPress, children,
  entry, order, reduceMotion
}: RailActionProps) {
  const scale = useRef(new Animated.Value(1)).current
  const halo  = useRef(new Animated.Value(0)).current
  const metricY = useRef(new Animated.Value(0)).current
  const metricOpacity = useRef(new Animated.Value(1)).current
  const previousCount = useRef(count)

  useEffect(() => {
    if (previousCount.current === count) return
    previousCount.current = count
    if (reduceMotion) return
    metricY.setValue(8)
    metricOpacity.setValue(0)
    Animated.parallel([
      Animated.spring(metricY, { toValue: 0, speed: 28, bounciness: 5, useNativeDriver: true }),
      Animated.timing(metricOpacity, { toValue: 1, duration: 170, useNativeDriver: true }),
    ]).start()
  }, [count, metricOpacity, metricY, reduceMotion])

  function pressIn() {
    if (reduceMotion) {
      halo.setValue(1)
      return
    }
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
    if (reduceMotion) {
      halo.setValue(0)
      return
    }
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

  const start = order * 0.1
  const end = Math.min(1, start + 0.42)

  return (
    <Animated.View
      style={[
        s.actionSlot,
        !reduceMotion && {
          opacity: entry.interpolate({ inputRange: [start, end], outputRange: [0, 1], extrapolate: 'clamp' }),
          transform: [{ translateX: entry.interpolate({ inputRange: [start, end], outputRange: [16, 0], extrapolate: 'clamp' }) }]
        },
      ]}
    >
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
            {count !== undefined && (
              <Animated.Text
                style={[s.railN, { opacity: metricOpacity, transform: [{ translateY: metricY }] }]}
                maxFontSizeMultiplier={1.3}
              >
                {count}
              </Animated.Text>
            )}
          </View>
        </Animated.View>
      </Pressable>
    </Animated.View>
  )
}

export default React.memo(function ActionBar({
  post, onCommentPress, liked: likedProp = false,
  onLikeChange, commentCount: commentCountProp, bottomOffset,
  onDeleted, onEdited, onProfileBlocked, onOptionsBlockingChange,
  isActive = true, reduceMotion = false
}: Props) {
  const { bottom: safeBottom } = useSafeAreaInsets()
  const t          = useT()

  const [liked,      setLiked]      = useState(likedProp)
  const [likeCount,  setLikeCount]  = useState(post._count?.likes ?? 0)
  const [shareCount, setShareCount] = useState(post._count?.shares ?? 0)
  const [showReactions, setShowReactions] = useState(false)
  const [hearts,    setHearts]    = useState<HeartP[]>([])
  const heartIdRef = useRef(0)
  const railEntry = useRef(new Animated.Value(isActive ? 1 : 0)).current
  const likePop = useRef(new Animated.Value(1)).current

  useEffect(() => {
    railEntry.stopAnimation()
    if (reduceMotion) {
      railEntry.setValue(isActive ? 1 : 0)
      return
    }
    if (!isActive) {
      railEntry.setValue(0)
      return
    }
    railEntry.setValue(0)
    Animated.sequence([
      Animated.delay(110),
      Animated.spring(railEntry, { toValue: 1, speed: 18, bounciness: 5, useNativeDriver: true }),
    ]).start()
  }, [isActive, railEntry, reduceMotion])

  function animateLikeMagnet() {
    if (reduceMotion) return
    likePop.stopAnimation()
    likePop.setValue(1)
    Animated.sequence([
      Animated.timing(likePop, { toValue: 0.84, duration: 70, useNativeDriver: true }),
      Animated.spring(likePop, { toValue: 1.2, speed: 30, bounciness: 12, useNativeDriver: true }),
      Animated.spring(likePop, { toValue: 1, speed: 24, bounciness: 4, useNativeDriver: true }),
    ]).start()
  }

  function burstHearts() {
    if (reduceMotion) return
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
    setLikeCount(post._count?.likes ?? 0)
    setShareCount(post._count?.shares ?? 0)
    setShowReactions(false)
  }, [post.id])

  // O duplo toque vive no FeedItem; quando ele altera o estado partilhado,
  // esta rail recebe a mudança e completa o mesmo feedback magnético.
  useEffect(() => {
    if (likedProp === liked) return
    setLiked(likedProp)
    if (likedProp) {
      animateLikeMagnet()
      burstHearts()
    }
  }, [likedProp])

  async function handleLike() {
    const was = liked; const prev = likeCount
    const optimisticCount = was ? prev - 1 : prev + 1
    setLiked(!was); setLikeCount(optimisticCount); onLikeChange?.(!was)
    animateLikeMagnet()
    if (!was) burstHearts()
    updateCachedPost(post.id, { _count: { ...post._count, likes: optimisticCount } }).catch(() => {})

    // Sem rede o gosto fica na fila e o estado otimista mantém-se. Desfazer o
    // coração à frente da pessoa por não haver rede é perder a intenção dela.
    if (!isConnected()) {
      queueLike(post.id, !was).catch(() => {})
      return
    }

    try {
      const res = await postService.likePost(post.id)
      setLiked(res.liked); onLikeChange?.(res.liked)
      const confirmedCount = res.liked !== !was ? prev + (res.liked ? 1 : -1) : optimisticCount
      setLikeCount(confirmedCount)
      updateCachedPost(post.id, { _count: { ...post._count, likes: confirmedCount } }).catch(() => {})
    } catch {
      // Falhou a meio: guarda a intenção em vez de a deitar fora. A fila
      // reconcilia com o servidor e descarta sozinha se for erro de cliente.
      queueLike(post.id, !was).catch(() => {})
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
      <Animated.View style={[s.rail, { bottom: bottomOffset ?? safeBottom + 96 }]} pointerEvents="box-none">
        {!isAnnouncement && (
          <>
            {/* Marca de calibração Luxee: uma hairline e um único tick de marca.
                Não é botão nem fundo; apenas assina a coluna sem tapar a média. */}
            <Animated.View
              pointerEvents="none"
              accessible={false}
              style={[
                s.railSignature,
                !reduceMotion && {
                  opacity: railEntry.interpolate({ inputRange: [0, 0.4], outputRange: [0, 0.72], extrapolate: 'clamp' }),
                  transform: [{ translateX: railEntry.interpolate({ inputRange: [0, 0.4], outputRange: [8, 0], extrapolate: 'clamp' }) }]
                },
              ]}
            >
              <View style={s.signatureHairline} />
              <View style={s.signatureTick} />
            </Animated.View>

            {/* Like */}
            <RailAction
              label={t.nf_likes}
              count={fmt(likeCount)}
              selected={liked}
              onPress={handleLike}
              onLongPress={() => setShowReactions(true)}
              entry={railEntry}
              order={0}
              reduceMotion={reduceMotion}
            >
              {/* Gostado troca de desenho, não de preenchimento: o contorno destes
                  ícones é geometria, não traço, por isso não há `fill` para ligar. */}
              <Animated.View style={{ transform: [{ scale: likePop }] }}>
                <FeedIcon
                  name={liked ? 'heart-solid' : 'heart'}
                  size={RAIL}
                  color={liked ? colors.heart : '#fff'}
                />
              </Animated.View>
              {hearts.map((h) => (
                <Animated.View
                  key={h.id}
                  pointerEvents="none"
                  accessible={false}
                  style={[s.burstHeart, { opacity: h.o, transform: [{ translateX: h.tx }, { translateY: h.ty }, { scale: h.s }] }]}
                >
                  <FeedIcon name="heart-solid" size={14} color={colors.heart} />
                </Animated.View>
              ))}
            </RailAction>

            {/* Comentar */}
            <RailAction
              label={t.nf_comments}
              count={fmt(commentCountProp ?? post._count?.comments ?? 0)}
              onPress={onCommentPress}
              entry={railEntry}
              order={1}
              reduceMotion={reduceMotion}
            >
              {/* Já nasce com a cauda à direita — dispensa o espelho que aqui estava. */}
              <FeedIcon name="chat-outline" size={RAIL} color="#fff" />
            </RailAction>

            {/* Partilhar */}
            <RailAction label={t.mo_share} count={fmt(shareCount)} onPress={handleShare} entry={railEntry} order={2} reduceMotion={reduceMotion}>
              <FeedIcon name="share" size={RAIL} color="#fff" />
            </RailAction>
          </>
        )}

        {/* Opções — ocupa exatamente a mesma grelha visual das três ações. */}
        <Animated.View
          style={[
            s.actionSlot,
            !reduceMotion && {
              opacity: railEntry.interpolate({
                inputRange: [0.3, 0.72],
                outputRange: [0, 1],
                extrapolate: 'clamp'
              }),
              transform: [{
                translateX: railEntry.interpolate({
                  inputRange: [0.3, 0.72],
                  outputRange: [16, 0],
                  extrapolate: 'clamp'
                })
              }]
            },
          ]}
        >
          <PostOptionsMenu
            post={post}
            onDeleted={onDeleted}
            onEdited={onEdited}
            onProfileBlocked={onProfileBlocked}
            onBlockingChange={onOptionsBlockingChange}
            rail
            triggerSize={RAIL}
          />
        </Animated.View>
      </Animated.View>

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
    zIndex: 20
  },
  railSignature: {
    width: 24,
    height: 8,
    opacity: 0.72,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3
  },
  signatureHairline: {
    width: 14,
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(255,255,255,0.46)'
  },
  signatureTick: {
    width: 4,
    height: 2,
    borderRadius: 1,
    backgroundColor: colors.primary
  },
  actionHit: {
    width: 64,
    height: 53,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionSlot: { width: 64, height: 53 },
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
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.46, shadowRadius: 2
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
  },


  // Centrado sobre o ícone do like (primeiro da coluna)
  burstHeart: {
    position: 'absolute',
    top: 11,
    left: 15,
    zIndex: 30,
  },
})
