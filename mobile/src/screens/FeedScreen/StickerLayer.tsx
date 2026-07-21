import React, { useState, useRef, useEffect, useMemo } from 'react'
import {
  View, Text, StyleSheet, Animated, Dimensions,
  TouchableOpacity, Pressable, Modal, PanResponder,
} from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'

const AnimatedGradient = Animated.createAnimatedComponent(LinearGradient)

const CARD_MAX_H = Dimensions.get('window').height * 0.78
import { useNavigation } from '@react-navigation/native'
import { StackNavigationProp } from '@react-navigation/stack'
import { Ionicons } from '@expo/vector-icons'
import { PostSticker } from '../../types'
import { AppStackParams } from '../../navigation/AppNavigator'
import AvatarImage from '../../components/AvatarImage'
import { colors, fonts } from '../../theme'
import { API_BASE } from '../../config'
import { likeSticker, viewSticker } from '../../services/post.service'

function resolveAvatar(uri: string | null | undefined): string | null {
  if (!uri) return null
  return uri.startsWith('http') || uri.startsWith('file://') ? uri : `${API_BASE}${uri}`
}

type Particle = {
  id: number
  tx: Animated.Value
  ty: Animated.Value
  s:  Animated.Value
  o:  Animated.Value
}

// ─── StickerItem ─────────────────────────────────────────────────────────────
interface ItemProps {
  sticker:       PostSticker
  left:          number
  top:           number
  type:          'emoji' | 'message' | 'gift'
  canDelete:     boolean
  canMove:       boolean
  onTap:         () => void
  onLongPress:   () => void
  onAuthorPress: () => void
  onMoveEnd?:    (dx: number, dy: number) => void
}

function StickerItem({ sticker, left, top, type, canDelete, canMove, onTap, onLongPress, onAuthorPress, onMoveEnd }: ItemProps) {
  const [particles, setParticles] = useState<Particle[]>([])
  const pidRef = useRef(0)

  // ── Arrastar: o dedo agarra o objeto e leva-o; ao soltar, a posição fica ──
  const pan = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current
  const [dragging, setDragging] = useState(false)
  const dragResponder = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => false,
    // só reclama o gesto quando é claramente um arrasto (não rouba taps/long-press)
    onMoveShouldSetPanResponder: (_, g) => canMove && (Math.abs(g.dx) > 6 || Math.abs(g.dy) > 6),
    onPanResponderGrant: () => setDragging(true),
    onPanResponderMove: Animated.event([null, { dx: pan.x, dy: pan.y }], { useNativeDriver: false }),
    onPanResponderRelease: (_, g) => {
      setDragging(false)
      onMoveEnd?.(g.dx, g.dy)   // o pai fixa a nova posição…
      pan.setValue({ x: 0, y: 0 })  // …e o offset volta a zero no mesmo frame
    },
    onPanResponderTerminate: () => {
      setDragging(false)
      pan.setValue({ x: 0, y: 0 })
    },
  }), [canMove, left, top, onMoveEnd])

  function burst() {
    const batch: Particle[] = []
    for (let i = 0; i < 22; i++) {
      const tx = new Animated.Value(0)
      const ty = new Animated.Value(0)
      const s  = new Animated.Value(0)
      const o  = new Animated.Value(1)
      const id = ++pidRef.current

      const angle  = Math.random() * Math.PI * 2
      const dist   = 280 + Math.random() * 420
      const finalX = Math.cos(angle) * dist
      const finalY = Math.sin(angle) * dist
      const finalS = 0.9 + Math.random() * 1.4
      const dur    = 1800 + Math.random() * 900

      Animated.parallel([
        Animated.sequence([
          Animated.spring(s, { toValue: finalS, speed: 30, bounciness: 14, useNativeDriver: true }),
          Animated.timing(s, { toValue: 0, duration: 300, useNativeDriver: true }),
        ]),
        Animated.timing(tx, { toValue: finalX, duration: dur, useNativeDriver: true }),
        Animated.timing(ty, { toValue: finalY, duration: dur, useNativeDriver: true }),
        Animated.sequence([
          Animated.delay(700 + i * 30),
          Animated.timing(o, { toValue: 0, duration: 900, useNativeDriver: true }),
        ]),
      ]).start(() => setParticles(prev => prev.filter(p => p.id !== id)))

      batch.push({ id, tx, ty, s, o })
    }
    setParticles(prev => [...prev, ...batch])
  }

  const isMessage = type === 'message' || sticker.emoji === '💌'
  const displayEmoji = isMessage ? '💌' : sticker.emoji

  return (
    <Animated.View
      style={[
        st.item,
        { left: left - 28, top: top - 28, transform: pan.getTranslateTransform() },
        dragging && st.itemDragging,
      ]}
      {...dragResponder.panHandlers}
    >

      <TouchableOpacity
        activeOpacity={0.75}
        onPress={() => {
          if (!isMessage) burst()
          onTap()
        }}
        onLongPress={canDelete ? () => {
          onLongPress()
        } : undefined}
        delayLongPress={500}
      >
        <View style={st.emojiWrap}>
          <Text style={st.emoji}>{displayEmoji}</Text>
          {!isMessage && type === 'gift' && <Text style={st.giftBadge}>✨</Text>}
        </View>

        {particles.map(p => (
          <Animated.Text
            key={p.id}
            pointerEvents="none"
            style={[st.particle, {
              opacity: p.o,
              transform: [{ translateX: p.tx }, { translateY: p.ty }, { scale: p.s }],
            }]}
          >
            {sticker.emoji}
          </Animated.Text>
        ))}
      </TouchableOpacity>

      <TouchableOpacity onPress={onAuthorPress} activeOpacity={0.8}>
        <View style={st.author}>
          <AvatarImage
            uri={resolveAvatar(sticker.user.avatar)}
            size={16}
            borderWidth={1}
            borderColor="rgba(255,255,255,0.85)"
          />
          <Text style={st.authorName} numberOfLines={1}>
            {sticker.user.name.split(' ')[0]}
          </Text>
        </View>
      </TouchableOpacity>

    </Animated.View>
  )
}

// ─── Per-sticker interaction cache (lives in StickerLayer, survives modal re-open) ──
type StickerInteraction = {
  likeCount: number
  myLike:    boolean
  viewCount: number
  myView:    boolean   // true once we've registered a view this session
}

function initInteractions(stickers: PostSticker[]): Record<string, StickerInteraction> {
  const m: Record<string, StickerInteraction> = {}
  for (const s of stickers) {
    m[s.id] = { likeCount: s.likeCount ?? 0, myLike: s.myLike ?? false, viewCount: s.viewCount ?? 0, myView: false }
  }
  return m
}

// ─── Message card ─────────────────────────────────────────────────────────────
interface MsgCardProps {
  sticker:     PostSticker
  interaction: StickerInteraction
  onUpdate:    (patch: Partial<StickerInteraction>) => void
  onClose:     () => void
}

function MessageCard({ sticker, interaction, onUpdate, onClose }: MsgCardProps) {
  const scaleAnim = useRef(new Animated.Value(0.88)).current
  const opacAnim  = useRef(new Animated.Value(0)).current

  const [likeCount, setLikeCount] = useState(interaction.likeCount)
  const [myLike, setMyLike]       = useState(interaction.myLike)
  const [viewCount, setViewCount] = useState(interaction.viewCount)

  useEffect(() => {
    Animated.parallel([
      Animated.spring(scaleAnim, { toValue: 1, speed: 30, bounciness: 10, useNativeDriver: true }),
      Animated.timing(opacAnim,  { toValue: 1, duration: 140, useNativeDriver: true }),
    ]).start()

    // Only register the view once per session — cache survives modal close/reopen
    if (!interaction.myView) {
      const next = interaction.viewCount + 1
      setViewCount(next)
      onUpdate({ myView: true, viewCount: next })
      viewSticker(sticker.id).catch(() => {})
    }
  }, [])

  function dismiss() {
    Animated.parallel([
      Animated.timing(scaleAnim, { toValue: 0.9, duration: 110, useNativeDriver: true }),
      Animated.timing(opacAnim,  { toValue: 0,   duration: 110, useNativeDriver: true }),
    ]).start(onClose)
  }

  async function handleLike() {
    const next      = !myLike
    const nextCount = next ? likeCount + 1 : Math.max(0, likeCount - 1)
    setMyLike(next)
    setLikeCount(nextCount)
    onUpdate({ myLike: next, likeCount: nextCount })
    try { await likeSticker(sticker.id) } catch {
      setMyLike(!next)
      setLikeCount(likeCount)
      onUpdate({ myLike: !next, likeCount })
    }
  }

  const message = sticker.content?.trim()

  return (
    <Modal transparent animationType="none" visible onRequestClose={dismiss}>
      <Pressable style={st.msgBackdrop} onPress={dismiss}>
        <AnimatedGradient
          colors={['#2A2A2E', '#0A0A0C']}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
          style={[st.msgCard, { opacity: opacAnim, transform: [{ scale: scaleAnim }] }]}
          onStartShouldSetResponder={() => true}
        >

          {/* Header */}
          <View style={st.msgRow}>
            <AvatarImage
              uri={resolveAvatar(sticker.user.avatar)}
              size={36}
              borderWidth={0}
              borderColor="transparent"
            />
            <Text style={st.msgName} numberOfLines={1}>
              {sticker.user.name.split(' ')[0]}
            </Text>
            <TouchableOpacity
              onPress={dismiss}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              style={st.msgCloseBtn}
            >
              <Text style={st.msgCloseTxt}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* Message */}
          {message
            ? <Text style={st.msgText}>{message}</Text>
            : <Text style={st.msgEmpty}>💌 sem mensagem</Text>
          }

          <View style={st.msgDivider} />

          {/* Like + View counts */}
          <View style={st.msgBottom}>
            <TouchableOpacity onPress={handleLike} style={st.likeBtn} activeOpacity={0.75}>
              <Ionicons
                name={myLike ? 'heart' : 'heart-outline'}
                size={20}
                color={myLike ? '#fff' : 'rgba(255,255,255,0.75)'}
              />
              {likeCount > 0 && (
                <Text style={st.likeCount}>
                  {likeCount}
                </Text>
              )}
            </TouchableOpacity>

            <View style={st.viewBadge}>
              <Ionicons name="eye-outline" size={18} color="rgba(255,255,255,0.75)" />
              <Text style={st.viewCountTxt}>{viewCount}</Text>
            </View>
          </View>

        </AnimatedGradient>
      </Pressable>
    </Modal>
  )
}

// ─── StickerLayer ─────────────────────────────────────────────────────────────
interface Props {
  postId:          string
  stickers:        PostSticker[]
  containerW:      number
  containerH:      number
  onLongPress?:    (id: string) => void
  onMove?:         (id: string, x: number, y: number) => void   // x/y em % (0–100)
  currentUserId?:  string
  postOwnerId?:    string
  onMessageOpen?:  () => void
  onMessageClose?: () => void
}

export default function StickerLayer({ postId, stickers, containerW, containerH, onLongPress, onMove, currentUserId, postOwnerId, onMessageOpen, onMessageClose }: Props) {
  const nav = useNavigation<StackNavigationProp<AppStackParams>>()
  const [messageSticker, setMessageSticker] = useState<PostSticker | null>(null)

  const [interactions, setInteractions] = useState<Record<string, StickerInteraction>>(
    () => initInteractions(stickers)
  )

  useEffect(() => {
    setInteractions(initInteractions(stickers))
    setMessageSticker(null)
  }, [postId])

  function patchInteraction(id: string, patch: Partial<StickerInteraction>) {
    setInteractions((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } }))
  }

  useEffect(() => {
    if (messageSticker) {
      onMessageOpen?.()
    } else {
      onMessageClose?.()
    }
  }, [!!messageSticker])

  if (!stickers.length || !containerW || !containerH) return null

  return (
    <View style={[StyleSheet.absoluteFill, { zIndex: 14 }]} pointerEvents="box-none">

      {stickers.map(stk => {
        const left = (stk.x / 100) * containerW
        const top  = (stk.y / 100) * containerH
        const type = (stk.emoji === '💌' ? 'message' : (stk.type ?? 'emoji')) as 'emoji' | 'message' | 'gift'
        const canDelete = !!currentUserId &&
          (stk.user.id === currentUserId || postOwnerId === currentUserId)

        return (
          <StickerItem
            key={stk.id}
            sticker={stk}
            left={left}
            top={top}
            type={type}
            canDelete={canDelete}
            canMove={canDelete && !!onMove}
            onTap={() => {
              const isMsg = type === 'message' || stk.emoji === '💌'
              if (isMsg) setMessageSticker(stk)
            }}
            onLongPress={() => onLongPress?.(stk.id)}
            onAuthorPress={() => nav.navigate('Profile', { userId: stk.user.id })}
            onMoveEnd={(dx, dy) => {
              const nx = Math.max(3, Math.min(97, ((left + dx) / containerW) * 100))
              const ny = Math.max(3, Math.min(97, ((top + dy) / containerH) * 100))
              onMove?.(stk.id, nx, ny)
            }}
          />
        )
      })}

      {messageSticker && (
        <MessageCard
          sticker={messageSticker}
          interaction={interactions[messageSticker.id] ?? { likeCount: 0, myLike: false, viewCount: 0, myView: false }}
          onUpdate={(patch) => patchInteraction(messageSticker.id, patch)}
          onClose={() => setMessageSticker(null)}
        />
      )}

    </View>
  )
}

const st = StyleSheet.create({
  item: {
    position: 'absolute',
    alignItems: 'center',
    zIndex: 14,
  },
  itemDragging: {
    zIndex: 30,          // por cima de tudo enquanto viaja
    opacity: 0.92,
  },
  emojiWrap: { alignItems: 'center' },
  emoji: {
    fontSize: 42,
    textShadowColor: 'rgba(0,0,0,0.35)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 6,
  },
  giftBadge: { fontSize: 11, marginTop: -4, opacity: 0.9 },
  particle: {
    position: 'absolute',
    top: 8,
    left: 8,
    fontSize: 36,
    zIndex: 30,
  },
  author: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(0,0,0,0.50)',
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 3,
    marginTop: 4,
    maxWidth: 88,
  },
  authorName: {
    color: '#fff',
    fontFamily: fonts.medium,
    fontSize: 9,
    letterSpacing: 0.1,
    flexShrink: 1,
  },

  // ── Message card ──────────────────────────────────────────────────────────
  msgBackdrop: {
    flex: 1,
    alignItems: 'stretch',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  msgCard: {
    borderRadius: 22,
    paddingTop: 14,
    paddingHorizontal: 16,
    paddingBottom: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.4,
    shadowRadius: 26,
    elevation: 18,
  },
  msgRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 10,
  },
  msgName: {
    flex: 1,
    fontFamily: fonts.semiBold,
    fontSize: 15,
    color: '#fff',
  },
  msgCloseBtn: {
    width: 26, height: 26, borderRadius: 13,
    backgroundColor: 'rgba(255,255,255,0.22)',
    alignItems: 'center', justifyContent: 'center',
  },
  msgCloseTxt: { fontSize: 11, color: '#fff', fontFamily: fonts.semiBold },
  msgText: {
    fontFamily: fonts.medium,
    fontSize: 15.5,
    color: '#fff',
    lineHeight: 23,
    marginBottom: 2,
  },
  msgEmpty: {
    fontFamily: fonts.regular,
    fontSize: 13,
    color: 'rgba(255,255,255,0.85)',
    fontStyle: 'italic',
    marginBottom: 2,
  },
  msgDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(255,255,255,0.25)',
    marginVertical: 10,
  },

  // ── Like + View row ───────────────────────────────────────────────────────
  msgBottom: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  likeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingVertical: 4,
    paddingHorizontal: 2,
  },
  likeCount: {
    fontFamily: fonts.semiBold,
    fontSize: 14,
    color: '#fff',
  },
  viewBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  viewCountTxt: {
    fontFamily: fonts.semiBold,
    fontSize: 14,
    color: 'rgba(255,255,255,0.85)',
  },
})
