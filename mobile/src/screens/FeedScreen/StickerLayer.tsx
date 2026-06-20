import React, { useState, useRef } from 'react'
import { View, Text, StyleSheet, Modal, Animated, Pressable } from 'react-native'
import { useNavigation } from '@react-navigation/native'
import { StackNavigationProp } from '@react-navigation/stack'
import { PostSticker } from '../../types'
import { AppStackParams } from '../../navigation/AppNavigator'
import AvatarImage from '../../components/AvatarImage'
import { colors, fonts } from '../../theme'
import { API_BASE } from '../../config'

type Nav = StackNavigationProp<AppStackParams>

function resolveAvatar(uri: string | null | undefined): string | null {
  if (!uri) return null
  return uri.startsWith('http') || uri.startsWith('file://') ? uri : `${API_BASE}${uri}`
}

const SPARKS = ['✨','⭐','🌟','💫','✨','⭐','🌟','💫','⚡','🌠','✨','⭐','🌟','💫','✨','⭐','🌟','💫','✨','🌠','⭐','🌟','💫','✨','⭐','🌟','⚡','💫','✨','⭐']

// ─── StickerItem ─────────────────────────────────────────────────────────────
// Separate component so each item can have its own refs for long-press timing.
// Uses the raw RN responder system (onStartShouldSetResponder) which ALWAYS
// wins in Fabric — unlike Pressable/TouchableOpacity which lose to sibling
// Pressables behind them when pointerEvents="box-none" is in the chain.
interface ItemProps {
  s: PostSticker
  left: number
  top: number
  type: 'emoji' | 'message' | 'gift'
  canDelete: boolean
  onTap: () => void
  onLongPress: () => void
  onAuthorPress: () => void
}

function StickerItem({ s, left, top, type, canDelete, onTap, onLongPress, onAuthorPress }: ItemProps) {
  const longTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const didLong   = useRef(false)

  function clearLong() {
    if (longTimer.current) { clearTimeout(longTimer.current); longTimer.current = null }
  }

  return (
    <View style={[st.item, { left: left - 28, top: top - 28 }]}>
      {/* ── Main emoji touch area ── */}
      <View
        style={st.emojiHit}
        onStartShouldSetResponder={() => true}
        onMoveShouldSetResponder={() => false}
        onResponderTerminationRequest={() => false}
        onResponderGrant={() => {
          didLong.current = false
          if (canDelete) {
            longTimer.current = setTimeout(() => {
              didLong.current = true
              longTimer.current = null
              onLongPress()
            }, 480)
          }
        }}
        onResponderMove={() => clearLong()}
        onResponderRelease={() => {
          clearLong()
          if (!didLong.current) onTap()
        }}
        onResponderTerminate={() => clearLong()}
      >
        <Text style={[st.emoji, type === 'message' && st.messagePulse]}>
          {type === 'message' ? '💌' : s.emoji}
        </Text>
        {type === 'gift' && <Text style={st.giftHint}>✨</Text>}
      </View>

      {/* ── Author badge ── */}
      <View
        style={st.authorBadge}
        onStartShouldSetResponder={() => true}
        onMoveShouldSetResponder={() => false}
        onResponderTerminationRequest={() => false}
        onResponderRelease={() => onAuthorPress()}
      >
        <AvatarImage
          uri={resolveAvatar(s.user.avatar)}
          size={18}
          borderWidth={1}
          borderColor="rgba(255,255,255,0.9)"
        />
        <Text style={st.authorName} numberOfLines={1}>{s.user.name.split(' ')[0]}</Text>
      </View>
    </View>
  )
}

// ─── Particle types ──────────────────────────────────────────────────────────
type Particle = { id: number; emoji: string; x: Animated.Value; y: Animated.Value; scale: Animated.Value; opacity: Animated.Value }
type Explosion = { id: string; originX: number; originY: number; particles: Particle[] }

// ─── StickerLayer ─────────────────────────────────────────────────────────────
interface Props {
  stickers: PostSticker[]
  containerW: number
  containerH: number
  onLongPress?: (stickerId: string) => void
  currentUserId?: string
  postOwnerId?: string
}

export default function StickerLayer({ stickers, containerW, containerH, onLongPress, currentUserId, postOwnerId }: Props) {
  const nav = useNavigation<StackNavigationProp<AppStackParams>>()
  const [messageSticker, setMessageSticker] = useState<PostSticker | null>(null)
  const [explosions, setExplosions] = useState<Explosion[]>([])
  const fadeTimers = useRef<ReturnType<typeof setTimeout>[]>([])

  function triggerExplosion(sticker: PostSticker) {
    const originX = (sticker.x / 100) * containerW
    const originY = (sticker.y / 100) * containerH
    const expId   = `${sticker.id}-${Date.now()}`

    const particles: Particle[] = Array.from({ length: 28 }, (_, i) => {
      const angle = (i / 28) * Math.PI * 2 + (Math.random() - 0.5) * 0.5
      const dist  = 80 + Math.random() * 260
      const tx    = Math.cos(angle) * dist
      const ty    = Math.sin(angle) * dist
      const dur   = 650 + Math.random() * 350

      const x      = new Animated.Value(0)
      const y      = new Animated.Value(0)
      const scale  = new Animated.Value(0.3)
      const opacity = new Animated.Value(1)

      // Move + scale — flat parallel, zero nesting
      Animated.parallel([
        Animated.timing(x,     { toValue: tx,  duration: dur, useNativeDriver: true }),
        Animated.timing(y,     { toValue: ty,  duration: dur, useNativeDriver: true }),
        Animated.timing(scale, { toValue: 0.8 + Math.random() * 0.5, duration: 220, useNativeDriver: true }),
      ]).start()

      // Fade starts halfway through — plain setTimeout avoids Animated.sequence issues
      const t = setTimeout(
        () => Animated.timing(opacity, { toValue: 0, duration: Math.round(dur * 0.5), useNativeDriver: true }).start(),
        Math.round(dur * 0.5),
      )
      fadeTimers.current.push(t)

      return { id: i, emoji: SPARKS[i % SPARKS.length], x, y, scale, opacity }
    })

    setExplosions(prev => [...prev, { id: expId, originX, originY, particles }])
    const cleanup = setTimeout(() => setExplosions(prev => prev.filter(e => e.id !== expId)), 1400)
    fadeTimers.current.push(cleanup)
  }

  if (!stickers.length || !containerW || !containerH) return null

  return (
    // box-none on the outer layer so empty areas still pass touches to viewer nav
    <View style={[StyleSheet.absoluteFill, { zIndex: 16 }]} pointerEvents="box-none">

      {/* ── Sticker items ──────────────────────────────────────────────────── */}
      {stickers.map((s) => {
        const left = (s.x / 100) * containerW
        const top  = (s.y / 100) * containerH
        const type = (s.type ?? 'emoji') as 'emoji' | 'message' | 'gift'
        const canDelete = !!currentUserId &&
          (s.user.id === currentUserId || postOwnerId === currentUserId)

        return (
          <StickerItem
            key={s.id}
            s={s}
            left={left}
            top={top}
            type={type}
            canDelete={canDelete}
            onTap={() => {
              if (type === 'message') setMessageSticker(s)
              else if (type === 'gift') triggerExplosion(s)
            }}
            onLongPress={() => onLongPress?.(s.id)}
            onAuthorPress={() => nav.navigate('Profile', { userId: s.user.id })}
          />
        )
      })}

      {/* ── Firework particles ──────────────────────────────────────────────── */}
      {explosions.map((exp) =>
        exp.particles.map((p) => (
          <Animated.Text
            key={`${exp.id}-${p.id}`}
            pointerEvents="none"
            style={[st.particle, {
              left: exp.originX,
              top:  exp.originY,
              transform: [{ translateX: p.x }, { translateY: p.y }, { scale: p.scale }],
              opacity: p.opacity,
            }]}
          >
            {p.emoji}
          </Animated.Text>
        ))
      )}

      {/* ── Message modal ───────────────────────────────────────────────────── */}
      <Modal transparent animationType="fade" visible={!!messageSticker} onRequestClose={() => setMessageSticker(null)}>
        <Pressable style={st.msgBackdrop} onPress={() => setMessageSticker(null)}>
          <View style={st.msgCard}>
            <Pressable style={st.msgCloseBtn} onPress={() => setMessageSticker(null)}>
              <Text style={st.msgCloseTxt}>✕</Text>
            </Pressable>
            <Text style={st.msgCardEmoji}>💌</Text>
            <Text style={st.msgCardContent}>{messageSticker?.content}</Text>
            <View style={st.msgCardFooter}>
              <AvatarImage
                uri={resolveAvatar(messageSticker?.user.avatar)}
                size={28}
                borderWidth={1.5}
                borderColor={colors.primary}
              />
              <View style={{ flex: 1 }}>
                <Text style={st.msgCardName}>{messageSticker?.user.name.split(' ')[0]}</Text>
                <Text style={st.msgCardLabel}>deixou uma mensagem</Text>
              </View>
            </View>
          </View>
        </Pressable>
      </Modal>
    </View>
  )
}

const st = StyleSheet.create({
  item: {
    position: 'absolute',
    alignItems: 'center',
    zIndex: 15,
  },
  emojiHit: {
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  emoji: {
    fontSize: 44,
    textShadowColor: 'rgba(0,0,0,0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  messagePulse: { fontSize: 46 },
  giftHint: {
    color: '#fff',
    fontFamily: fonts.bold,
    fontSize: 9,
    textAlign: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 6,
    paddingHorizontal: 4,
    paddingVertical: 1,
    marginTop: 1,
    overflow: 'hidden',
  },
  authorBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: 'rgba(0,0,0,0.52)',
    borderRadius: 10,
    paddingHorizontal: 5,
    paddingVertical: 3,
    marginTop: 2,
    maxWidth: 90,
  },
  authorName: {
    color: '#fff',
    fontFamily: fonts.medium,
    fontSize: 9,
    letterSpacing: 0.1,
    flexShrink: 1,
  },
  particle: {
    position: 'absolute',
    fontSize: 22,
    zIndex: 99,
  },
  msgBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
  },
  msgCard: {
    backgroundColor: '#fff',
    borderRadius: 24,
    padding: 24,
    paddingTop: 20,
    alignItems: 'center',
    width: '100%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2,
    shadowRadius: 24,
    elevation: 14,
  },
  msgCloseBtn: {
    alignSelf: 'flex-end',
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: '#F0F0F0',
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 8,
  },
  msgCloseTxt:    { fontSize: 13, color: '#666', fontFamily: fonts.semiBold },
  msgCardEmoji:   { fontSize: 48, marginBottom: 10 },
  msgCardContent: {
    fontFamily: fonts.semiBold,
    fontSize: 18, color: '#111',
    textAlign: 'center', lineHeight: 26,
    marginBottom: 20,
  },
  msgCardFooter: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    borderTopWidth: 1, borderTopColor: '#F0F0F0',
    paddingTop: 14, width: '100%',
  },
  msgCardName:  { fontFamily: fonts.semiBold, fontSize: 14, color: '#111' },
  msgCardLabel: { fontFamily: fonts.regular,  fontSize: 12, color: colors.gray600 },
})
