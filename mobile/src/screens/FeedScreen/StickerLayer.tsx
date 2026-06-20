import React, { useState } from 'react'
import {
  View, Text, TouchableOpacity, StyleSheet, Modal, Animated,
} from 'react-native'
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

// Firework spark emojis
const SPARKS = ['✨','⭐','🌟','💫','✨','⭐','🌟','💫','⚡','🌠','✨','⭐','🌟','💫','✨','⭐','🌟','💫','✨','🌠','⭐','🌟','💫','✨','⭐','🌟','⚡','💫','✨','⭐']

type Particle = {
  id: number
  emoji: string
  x: Animated.Value
  y: Animated.Value
  scale: Animated.Value
  opacity: Animated.Value
}

type Explosion = {
  id: string       // unique per-tap: stickerId + timestamp
  originX: number  // pixel origin
  originY: number
  particles: Particle[]
}

interface Props {
  stickers: PostSticker[]
  containerW: number
  containerH: number
  onLongPress?: (stickerId: string) => void
  currentUserId?: string
  postOwnerId?: string
}

export default function StickerLayer({ stickers, containerW, containerH, onLongPress, currentUserId, postOwnerId }: Props) {
  const nav = useNavigation<Nav>()
  const [messageSticker, setMessageSticker] = useState<PostSticker | null>(null)
  const [explosions, setExplosions] = useState<Explosion[]>([])

  function triggerExplosion(sticker: PostSticker) {
    const originX = (sticker.x / 100) * containerW
    const originY = (sticker.y / 100) * containerH
    const expId   = `${sticker.id}-${Date.now()}`
    const COUNT   = 30

    const particles: Particle[] = Array.from({ length: COUNT }, (_, i) => {
      // Spread particles evenly around 360°, with slight random jitter
      const angle = (i / COUNT) * Math.PI * 2 + (Math.random() - 0.5) * 0.5
      const dist  = 100 + Math.random() * 300   // 100–400px radius → covers full screen
      const tx    = Math.cos(angle) * dist
      const ty    = Math.sin(angle) * dist
      const dur   = 800 + Math.random() * 500   // 800–1300ms

      const x      = new Animated.Value(0)
      const y      = new Animated.Value(0)
      const scale  = new Animated.Value(0.1)
      const opacity = new Animated.Value(1)

      // Two independent tracks — NO nesting sequences inside parallel
      Animated.parallel([
        Animated.timing(x,     { toValue: tx,  duration: dur, useNativeDriver: true }),
        Animated.timing(y,     { toValue: ty,  duration: dur, useNativeDriver: true }),
        Animated.timing(scale, { toValue: 0.8 + Math.random() * 0.6, duration: 300, useNativeDriver: true }),
      ]).start()

      // Fade out in the second half — started independently so it never blocks the above
      setTimeout(() => {
        Animated.timing(opacity, { toValue: 0, duration: dur * 0.55, useNativeDriver: true }).start()
      }, dur * 0.45)

      return { id: i, emoji: SPARKS[i % SPARKS.length], x, y, scale, opacity }
    })

    setExplosions(prev => [...prev, { id: expId, originX, originY, particles }])

    // Clean up after animation ends
    setTimeout(() => {
      setExplosions(prev => prev.filter(e => e.id !== expId))
    }, 1600)
  }

  if (!stickers.length || !containerW || !containerH) return null

  return (
    <View style={[StyleSheet.absoluteFill, { zIndex: 16 }]} pointerEvents="box-none">

      {/* ── Stickers ─────────────────────────────────────────────────────────── */}
      {stickers.map((s) => {
        const left = (s.x / 100) * containerW
        const top  = (s.y / 100) * containerH
        const type = (s.type ?? 'emoji') as 'emoji' | 'message' | 'gift'

        // Only sticker creator or post owner can delete
        const canDelete = !!currentUserId && (s.user.id === currentUserId || postOwnerId === currentUserId)

        return (
          <View
            key={s.id}
            style={[st.item, { left: left - 24, top: top - 24 }]}
            pointerEvents="box-none"
          >
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => {
                if (type === 'message') setMessageSticker(s)
                else if (type === 'gift') triggerExplosion(s)
              }}
              onLongPress={canDelete ? () => onLongPress?.(s.id) : undefined}
            >
              <Text style={[st.emoji, type === 'message' && st.messagePulse]}>
                {type === 'message' ? '💌' : s.emoji}
              </Text>
              {type === 'gift' && <Text style={st.giftHint}>✨ Toque!</Text>}
            </TouchableOpacity>

            {/* Author badge */}
            <TouchableOpacity
              style={st.authorBadge}
              activeOpacity={0.8}
              onPress={() => nav.navigate('Profile', { userId: s.user.id })}
              onLongPress={canDelete ? () => onLongPress?.(s.id) : undefined}
            >
              <AvatarImage
                uri={resolveAvatar(s.user.avatar)}
                size={18}
                borderWidth={1}
                borderColor="rgba(255,255,255,0.9)"
              />
              <Text style={st.authorName} numberOfLines={1}>{s.user.name.split(' ')[0]}</Text>
            </TouchableOpacity>
          </View>
        )
      })}

      {/* ── Firework particles ───────────────────────────────────────────────── */}
      {explosions.map((exp) =>
        exp.particles.map((p) => (
          <Animated.Text
            key={`${exp.id}-${p.id}`}
            pointerEvents="none"
            style={[
              st.particle,
              {
                left: exp.originX,
                top:  exp.originY,
                transform: [
                  { translateX: p.x },
                  { translateY: p.y },
                  { scale: p.scale },
                ],
                opacity: p.opacity,
              },
            ]}
          >
            {p.emoji}
          </Animated.Text>
        ))
      )}

      {/* ── Message modal ────────────────────────────────────────────────────── */}
      {messageSticker && (
        <Modal
          transparent
          animationType="fade"
          visible
          onRequestClose={() => setMessageSticker(null)}
        >
          <TouchableOpacity style={st.msgBackdrop} activeOpacity={1} onPress={() => setMessageSticker(null)}>
            <View style={st.msgCard}>
              <Text style={st.msgCardEmoji}>💌</Text>
              <Text style={st.msgCardContent}>{messageSticker.content}</Text>
              <View style={st.msgCardFooter}>
                <AvatarImage
                  uri={resolveAvatar(messageSticker.user.avatar)}
                  size={28}
                  borderWidth={1.5}
                  borderColor={colors.primary}
                />
                <View>
                  <Text style={st.msgCardName}>{messageSticker.user.name.split(' ')[0]}</Text>
                  <Text style={st.msgCardLabel}>deixou uma mensagem</Text>
                </View>
              </View>
            </View>
          </TouchableOpacity>
        </Modal>
      )}
    </View>
  )
}

const st = StyleSheet.create({
  item: {
    position: 'absolute',
    alignItems: 'center',
    zIndex: 15,
  },
  emoji: {
    fontSize: 36,
    textShadowColor: 'rgba(0,0,0,0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  messagePulse: { fontSize: 38 },
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
    paddingVertical: 2,
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
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  msgCard: {
    backgroundColor: '#fff',
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
    width: '100%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 20,
    elevation: 12,
  },
  msgCardEmoji:    { fontSize: 48, marginBottom: 12 },
  msgCardContent: {
    fontFamily: fonts.semiBold,
    fontSize: 18,
    color: '#111',
    textAlign: 'center',
    lineHeight: 26,
    marginBottom: 20,
  },
  msgCardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
    paddingTop: 14,
    width: '100%',
  },
  msgCardName:  { fontFamily: fonts.semiBold, fontSize: 14, color: '#111' },
  msgCardLabel: { fontFamily: fonts.regular, fontSize: 12, color: colors.gray600 },
})
