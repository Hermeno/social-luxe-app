import React, { useState, useRef, useEffect } from 'react'
import {
  View, Text, StyleSheet, Animated,
  TouchableOpacity, Pressable, Modal, ScrollView,
} from 'react-native'
import { useNavigation } from '@react-navigation/native'
import { StackNavigationProp } from '@react-navigation/stack'
import { Ionicons } from '@expo/vector-icons'
import { PostSticker, StickerReactionCount } from '../../types'
import { AppStackParams } from '../../navigation/AppNavigator'
import AvatarImage from '../../components/AvatarImage'
import { colors, fonts } from '../../theme'
import { API_BASE } from '../../config'
import { likeSticker, reactSticker } from '../../services/post.service'

// Reserved vocabulary — shown as tappable chips inside the message modal
const REACTION_WORDS = [
  // PT
  'amei', 'lindo', 'incrível', 'maravilhoso', 'verdade',
  'obrigado', 'valeu', 'perfeito', 'bonito', 'brilhante',
  'gostoso', 'que amor', 'demais', 'show', 'top',
  // EN
  'love it', 'amazing', 'beautiful', 'wonderful', 'so true',
  'thanks', 'perfect', 'gorgeous', 'awesome', 'brilliant',
]

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

// ─── Message card — compact bubble with likes + word reactions ────────────────
interface MsgCardProps {
  sticker: PostSticker
  onClose: () => void
}

function MessageCard({ sticker, onClose }: MsgCardProps) {
  const scaleAnim = useRef(new Animated.Value(0.88)).current
  const opacAnim  = useRef(new Animated.Value(0)).current

  const [likeCount, setLikeCount] = useState(sticker.likeCount ?? 0)
  const [myLike, setMyLike]       = useState(sticker.myLike ?? false)
  const [reactions, setReactions] = useState<StickerReactionCount[]>(sticker.reactions ?? [])
  const [openWord, setOpenWord]   = useState<string | null>(null)

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

  async function handleLike() {
    const next = !myLike
    setMyLike(next)
    setLikeCount((c) => next ? c + 1 : Math.max(0, c - 1))
    try { await likeSticker(sticker.id) } catch {
      setMyLike(!next)
      setLikeCount((c) => next ? Math.max(0, c - 1) : c + 1)
    }
  }

  async function handleChipTap(word: string) {
    // Toggle branch visibility
    setOpenWord((prev) => prev === word ? null : word)

    // Toggle reaction
    const existing = reactions.find((r) => r.word === word)
    const wasMine  = existing?.mine ?? false
    setReactions((prev) => {
      if (wasMine) {
        return prev
          .map((r) => r.word === word ? { ...r, count: r.count - 1, mine: false } : r)
          .filter((r) => r.count > 0)
      }
      if (existing) {
        return prev.map((r) => r.word === word ? { ...r, count: r.count + 1, mine: true } : r)
      }
      return [...prev, { word, count: 1, mine: true, users: [] }]
    })
    try { await reactSticker(sticker.id, word) } catch {
      setReactions(sticker.reactions ?? [])
    }
  }

  const message  = sticker.content?.trim()
  const usedWords = reactions.slice().sort((a, b) => b.count - a.count)
  const usedSet   = new Set(usedWords.map((r) => r.word))
  const wordList  = [...usedWords.map((r) => r.word), ...REACTION_WORDS.filter((w) => !usedSet.has(w))]
  const openReaction = reactions.find((r) => r.word === openWord)

  return (
    <Modal transparent animationType="none" visible onRequestClose={dismiss}>
      <Pressable style={st.msgBackdrop} onPress={dismiss}>
        <Pressable onPress={() => {}}>
          <Animated.View style={[st.msgCard, { opacity: opacAnim, transform: [{ scale: scaleAnim }] }]}>

            {/* Header: avatar + name + close */}
            <View style={st.msgRow}>
              <AvatarImage
                uri={resolveAvatar(sticker.user.avatar)}
                size={36}
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

            {/* Message */}
            {message
              ? <Text style={st.msgText}>{message}</Text>
              : <Text style={st.msgEmpty}>💌 sem mensagem</Text>
            }

            {/* Total likes badge */}
            {likeCount > 0 && (
              <View style={st.likeBadge}>
                <Ionicons name="heart" size={13} color={colors.primary} />
                <Text style={st.likeBadgeTxt}>
                  {likeCount} {likeCount === 1 ? 'curtida' : 'curtidas'}
                </Text>
              </View>
            )}

            <View style={st.msgDivider} />

            {/* Bottom: heart toggle + word chips */}
            <View style={st.msgBottom}>
              <TouchableOpacity onPress={handleLike} style={st.likeBtn} activeOpacity={0.75}>
                <Ionicons
                  name={myLike ? 'heart' : 'heart-outline'}
                  size={22}
                  color={myLike ? colors.primary : '#BDBDBD'}
                />
              </TouchableOpacity>

              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={st.chipsContent}
                style={st.chipsScroll}
                keyboardShouldPersistTaps="handled"
              >
                {wordList.map((word) => {
                  const info   = reactions.find((r) => r.word === word)
                  const mine   = info?.mine ?? false
                  const count  = info?.count ?? 0
                  const isOpen = openWord === word
                  return (
                    <TouchableOpacity
                      key={word}
                      onPress={() => handleChipTap(word)}
                      activeOpacity={0.72}
                      style={[st.chip, mine && st.chipActive, isOpen && st.chipOpen]}
                    >
                      <Text style={[st.chipTxt, (mine || isOpen) && st.chipTxtActive]}>{word}</Text>
                      {count > 0 && (
                        <Text style={[st.chipCount, (mine || isOpen) && st.chipCountActive]}>{count}</Text>
                      )}
                      {isOpen && <Text style={st.chipCaret}>▾</Text>}
                    </TouchableOpacity>
                  )
                })}
              </ScrollView>
            </View>

            {/* Branch — who reacted with the selected word */}
            {openWord && (
              <View style={st.branch}>
                <View style={st.branchAccent} />
                <View style={st.branchBody}>
                  <Text style={st.branchLabel}>{openWord}</Text>
                  {openReaction && openReaction.users.length > 0
                    ? openReaction.users.map((u, i, arr) => (
                        <View key={u.id} style={st.branchRow}>
                          {/* Connector lines */}
                          <View style={st.connectorWrap}>
                            <View style={[st.connVertical, i === arr.length - 1 && { opacity: 0 }]} />
                            <View style={st.connHoriz} />
                          </View>
                          <AvatarImage
                            uri={resolveAvatar(u.avatar)}
                            size={26}
                            borderWidth={0}
                            borderColor="transparent"
                          />
                          <Text style={st.branchName} numberOfLines={1}>
                            {u.name.split(' ')[0]}
                          </Text>
                        </View>
                      ))
                    : (
                        <Text style={st.branchEmpty}>Seja o primeiro a reagir</Text>
                      )
                  }
                </View>
              </View>
            )}

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

  // ── Message card ──────────────────────────────────────────────────────────
  msgBackdrop: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  msgCard: {
    backgroundColor: '#fff',
    borderRadius: 22,
    paddingTop: 14,
    paddingHorizontal: 16,
    paddingBottom: 10,
    width: '100%',
    maxWidth: 360,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.16,
    shadowRadius: 24,
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
    marginBottom: 2,
  },
  msgEmpty: {
    fontFamily: fonts.regular,
    fontSize: 13,
    color: colors.gray500,
    fontStyle: 'italic',
    marginBottom: 2,
  },
  // ── Total likes badge ──────────────────────────────────────────────────────
  likeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 8,
    alignSelf: 'flex-start',
    backgroundColor: `${colors.primary}12`,
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  likeBadgeTxt: {
    fontFamily: fonts.semiBold,
    fontSize: 12,
    color: colors.primary,
  },

  msgDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: '#EBEBEB',
    marginVertical: 10,
  },

  // ── Like button + word chips row ──────────────────────────────────────────
  msgBottom: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 2,
  },
  likeBtn: {
    paddingVertical: 4,
    paddingHorizontal: 2,
    flexShrink: 0,
  },
  chipsScroll: { flex: 1 },
  chipsContent: {
    gap: 6,
    paddingRight: 4,
    alignItems: 'center',
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    backgroundColor: '#F2F2F5',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  chipActive: {
    backgroundColor: `${colors.primary}18`,
    borderColor: colors.primary,
  },
  chipOpen: {
    backgroundColor: `${colors.primary}22`,
    borderColor: colors.primary,
  },
  chipTxt: {
    fontFamily: fonts.medium,
    fontSize: 12,
    color: '#555',
  },
  chipTxtActive: { color: colors.primary },
  chipCount: {
    fontFamily: fonts.semiBold,
    fontSize: 11,
    color: '#888',
  },
  chipCountActive: { color: colors.primary },
  chipCaret: {
    fontSize: 10,
    color: colors.primary,
    marginLeft: -1,
  },

  // ── Branch (who reacted with selected word) ───────────────────────────────
  branch: {
    flexDirection: 'row',
    marginTop: 10,
    marginBottom: 2,
  },
  branchAccent: {
    width: 2,
    backgroundColor: colors.primary,
    borderRadius: 1,
    marginRight: 12,
    alignSelf: 'stretch',
  },
  branchBody: {
    flex: 1,
  },
  branchLabel: {
    fontFamily: fonts.semiBold,
    fontSize: 12,
    color: colors.primary,
    marginBottom: 8,
    textTransform: 'lowercase',
  },
  branchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 0,
  },
  connectorWrap: {
    width: 18,
    alignItems: 'flex-start',
    alignSelf: 'stretch',
    marginRight: 6,
  },
  connVertical: {
    position: 'absolute',
    top: 0,
    bottom: -8,
    left: 5,
    width: 1.5,
    backgroundColor: '#DDD',
  },
  connHoriz: {
    position: 'absolute',
    top: 12,
    left: 5,
    width: 12,
    height: 1.5,
    backgroundColor: '#DDD',
  },
  branchName: {
    fontFamily: fonts.medium,
    fontSize: 13,
    color: '#333',
    marginLeft: 8,
    flexShrink: 1,
  },
  branchEmpty: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: '#BDBDBD',
    fontStyle: 'italic',
  },
})
