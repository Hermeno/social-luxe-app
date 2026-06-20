import React, { useState, useRef, useEffect } from 'react'
import {
  View, Text, StyleSheet, Animated,
  TouchableOpacity, Pressable, Modal,
} from 'react-native'
import { useNavigation } from '@react-navigation/native'
import { StackNavigationProp } from '@react-navigation/stack'
import { PostSticker } from '../../types'
import { AppStackParams } from '../../navigation/AppNavigator'
import AvatarImage from '../../components/AvatarImage'
import { colors, fonts } from '../../theme'
import { API_BASE } from '../../config'

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
  onTap:         () => void
  onLongPress:   () => void
  onAuthorPress: () => void
}

function StickerItem({ sticker, left, top, type, canDelete, onTap, onLongPress, onAuthorPress }: ItemProps) {
  const [particles, setParticles] = useState<Particle[]>([])
  const pidRef = useRef(0)

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

  // Use emoji as additional check — '💌' is always a message sticker
  const isMessage = type === 'message' || sticker.emoji === '💌'
  const displayEmoji = isMessage ? '💌' : sticker.emoji

  return (
    <View style={[st.item, { left: left - 28, top: top - 28 }]}>

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

    </View>
  )
}

// ─── Message card — small compact bubble, Modal so fica acima de tudo ────────
interface MsgCardProps {
  sticker: PostSticker
  onClose: () => void
}

function MessageCard({ sticker, onClose }: MsgCardProps) {
  const scaleAnim = useRef(new Animated.Value(0.88)).current
  const opacAnim  = useRef(new Animated.Value(0)).current

  useEffect(() => {
    Animated.parallel([
      Animated.spring(scaleAnim, { toValue: 1, speed: 30, bounciness: 10, useNativeDriver: true }),
      Animated.timing(opacAnim,  { toValue: 1, duration: 140, useNativeDriver: true }),
    ]).start()
  }, [])

  function dismiss() {
    Animated.parallel([
      Animated.timing(scaleAnim, { toValue: 0.9, duration: 110, useNativeDriver: true }),
      Animated.timing(opacAnim,  { toValue: 0,   duration: 110, useNativeDriver: true }),
    ]).start(onClose)
  }

  const message = sticker.content?.trim()

  return (
    <Modal transparent animationType="none" visible onRequestClose={dismiss}>
      <Pressable style={st.msgBackdrop} onPress={dismiss}>
        {/* Stop tap propagation inside card */}
        <Pressable onPress={() => {}}>
          <Animated.View style={[st.msgCard, { opacity: opacAnim, transform: [{ scale: scaleAnim }] }]}>

            {/* Row: avatar + name + close */}
            <View style={st.msgRow}>
              <AvatarImage
                uri={resolveAvatar(sticker.user.avatar)}
                size={38}
                borderWidth={2}
                borderColor={colors.primary}
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

            {/* Message text */}
            {message
              ? <Text style={st.msgText}>{message}</Text>
              : <Text style={st.msgEmpty}>💌 sem mensagem</Text>
            }

          </Animated.View>
        </Pressable>
      </Pressable>
    </Modal>
  )
}

// ─── StickerLayer ─────────────────────────────────────────────────────────────
interface Props {
  stickers:        PostSticker[]
  containerW:      number
  containerH:      number
  onLongPress?:    (id: string) => void
  currentUserId?:  string
  postOwnerId?:    string
  onMessageOpen?:  () => void
  onMessageClose?: () => void
}

export default function StickerLayer({ stickers, containerW, containerH, onLongPress, currentUserId, postOwnerId, onMessageOpen, onMessageClose }: Props) {
  const nav = useNavigation<StackNavigationProp<AppStackParams>>()
  const [messageSticker, setMessageSticker] = useState<PostSticker | null>(null)

  // Pause the feed while the message card is open, resume when it closes
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
        // Use emoji as additional fallback for type detection
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
            onTap={() => {
              const isMsg = type === 'message' || stk.emoji === '💌'
              if (isMsg) setMessageSticker(stk)
            }}
            onLongPress={() => onLongPress?.(stk.id)}
            onAuthorPress={() => nav.navigate('Profile', { userId: stk.user.id })}
          />
        )
      })}

      {/* Modal fica acima de ActionBar, FeedHeader e tudo o resto */}
      {messageSticker && (
        <MessageCard
          sticker={messageSticker}
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

  // ── Message card — compact bubble ─────────────────────────────────────────
  msgBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  msgCard: {
    backgroundColor: '#fff',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 14,
    width: '100%',
    maxWidth: 340,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 20,
    elevation: 16,
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
    color: '#111',
  },
  msgCloseBtn: {
    width: 26, height: 26, borderRadius: 13,
    backgroundColor: '#F0F0F0',
    alignItems: 'center', justifyContent: 'center',
  },
  msgCloseTxt: { fontSize: 11, color: '#777', fontFamily: fonts.semiBold },
  msgText: {
    fontFamily: fonts.regular,
    fontSize: 15,
    color: '#333',
    lineHeight: 22,
  },
  msgEmpty: {
    fontFamily: fonts.regular,
    fontSize: 13,
    color: colors.gray500,
    fontStyle: 'italic',
  },
})
