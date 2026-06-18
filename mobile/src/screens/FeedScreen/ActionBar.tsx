import React, { useState, useEffect, useRef } from 'react'
import {
  View, Text, TouchableOpacity, StyleSheet, Share, Modal, Alert, TextInput,
  Animated,
} from 'react-native'
import * as Haptics from 'expo-haptics'
import { Heart, MessageCircle, Send, Eye, MoreVertical, Pencil, Trash2 } from 'lucide-react-native'
import { Post } from '../../types'
import { colors, fonts } from '../../theme'
import * as postService from '../../services/post.service'
import ReactionPicker from '../../components/ReactionPicker'
import { useAuthStore } from '../../store/auth.store'
import { useT } from '../../i18n'

interface Props {
  post: Post
  onCommentPress: () => void
  liked?: boolean
  onLikeChange?: (liked: boolean) => void
  onDeleted?: (id: string) => void
  onEdited?: (id: string, caption: string) => void
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
  onLikeChange, onDeleted, onEdited, newPostsCount = 0,
  commentCount: commentCountProp,
}: Props) {
  const { user }   = useAuthStore()
  const t          = useT()
  const isSelf     = user?.id === post.userId

  const [liked,      setLiked]      = useState(likedProp)
  const [likeCount,  setLikeCount]  = useState(post._count?.likes ?? 0)
  const [shareCount, setShareCount] = useState(post._count?.shares ?? 0)
  const [showReactions, setShowReactions] = useState(false)
  const [showMenu,  setShowMenu]  = useState(false)
  const [editMode,  setEditMode]  = useState(false)
  const [editText,  setEditText]  = useState(post.caption ?? '')
  const [hearts,    setHearts]    = useState<HeartP[]>([])
  const heartIdRef = useRef(0)

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
    setLikeCount(post._count?.likes ?? 0)
    setShareCount(post._count?.shares ?? 0)
    setShowReactions(false); setShowMenu(false); setEditMode(false)
    setEditText(post.caption ?? '')
  }, [post.id])

  async function handleLike() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    const was = liked; const prev = likeCount
    setLiked(!was); setLikeCount((c) => was ? c - 1 : c + 1); onLikeChange?.(!was)
    if (!was) burstHearts()
    try {
      const res = await postService.likePost(post.id)
      setLiked(res.liked); onLikeChange?.(res.liked)
      setLikeCount((c) => res.liked !== !was ? prev + (res.liked ? 1 : -1) : c)
    } catch { setLiked(was); setLikeCount(prev); onLikeChange?.(was) }
  }

  async function handleShare() {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
      const result = await Share.share({
        message: `${post.caption ? `"${post.caption}" — ` : ''}${t.feed_share_msg}`,
      })
      if (result.action === Share.sharedAction)
        postService.sharePost(post.id).then(() => setShareCount((c) => c + 1)).catch(() => {})
    } catch {}
  }

  function handleDelete() {
    setShowMenu(false)
    Alert.alert(t.feed_delete_title, t.feed_delete_msg, [
      { text: t.cancel, style: 'cancel' },
      { text: t.delete, style: 'destructive', onPress: () => onDeleted?.(post.id) },
    ])
  }

  function handleSaveEdit() {
    setEditMode(false)
    onEdited?.(post.id, editText)
  }

  const isAnnouncement = post.isAnnouncement ?? false

  return (
    <>
      {/* Vertical column — right edge, alinhado com user info */}
      <View style={[s.column, { bottom: 16 }]}>

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

        {/* Comment */}
        {!isAnnouncement && (
          <TouchableOpacity style={s.btn} onPress={onCommentPress} activeOpacity={0.75}>
            <View style={s.mirrorX}>
              <MessageCircle size={26} strokeWidth={2} color="#fff" />
            </View>
            <Text style={s.label}>{fmt(commentCountProp ?? post._count?.comments ?? 0)}</Text>
          </TouchableOpacity>
        )}

        {/* Share */}
        {!isAnnouncement && (
          <TouchableOpacity style={s.btn} onPress={handleShare} activeOpacity={0.75}>
            <Send size={25} strokeWidth={2} color="#fff" />
            <Text style={s.label}>{fmt(shareCount)}</Text>
          </TouchableOpacity>
        )}

        {/* Views */}
        <View style={[s.btn, { opacity: (isSelf || post.user.viewsPublic) ? 1 : 0 }]}>
          <Eye size={26} strokeWidth={2} color="#fff" />
          <Text style={s.label}>{fmt(post._count?.views ?? 0)}</Text>
        </View>

        {/* Options — só visível para o autor */}
        {isSelf && (
          <TouchableOpacity
            style={s.btnOptions}
            onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setShowMenu(true) }}
            activeOpacity={0.75}
          >
            <MoreVertical size={22} strokeWidth={2} color="rgba(255,255,255,0.82)" />
          </TouchableOpacity>
        )}
      </View>

      {showReactions && !isAnnouncement && (
        <Modal transparent animationType="none" visible onRequestClose={() => setShowReactions(false)}>
          <ReactionPicker postId={post.id} currentReaction={undefined} onClose={() => setShowReactions(false)} />
        </Modal>
      )}

      <Modal visible={showMenu} transparent animationType="fade" onRequestClose={() => setShowMenu(false)}>
        <TouchableOpacity style={s.overlay} activeOpacity={1} onPress={() => setShowMenu(false)}>
          <View style={s.menu}>
            <TouchableOpacity style={s.menuItem} onPress={() => { setShowMenu(false); setEditText(post.caption ?? ''); setEditMode(true) }}>
              <Pencil size={20} strokeWidth={2} color={colors.gray800} />
              <Text style={s.menuItemText}>{t.feed_edit_caption}</Text>
            </TouchableOpacity>
            <View style={s.menuDivider} />
            <TouchableOpacity style={s.menuItem} onPress={handleDelete}>
              <Trash2 size={20} strokeWidth={2} color="#E53E3E" />
              <Text style={[s.menuItemText, { color: '#E53E3E' }]}>{t.feed_delete_title}</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      <Modal visible={editMode} transparent animationType="slide" onRequestClose={() => setEditMode(false)}>
        <View style={s.editOverlay}>
          <View style={s.editSheet}>
            <Text style={s.editTitle}>{t.feed_edit_caption}</Text>
            <TextInput
              style={s.editInput}
              value={editText}
              onChangeText={setEditText}
              multiline
              maxLength={200}
              autoFocus
              placeholder={t.feed_caption_ph}
              placeholderTextColor={colors.gray400}
            />
            <View style={s.editActions}>
              <TouchableOpacity style={s.editCancel} onPress={() => setEditMode(false)}>
                <Text style={s.editCancelText}>{t.cancel}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.editSave} onPress={handleSaveEdit}>
                <Text style={s.editSaveText}>{t.save}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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

  // Botão de opções (sem contador)
  btnOptions: {
    width: 52,
    alignItems: 'center',
    paddingTop: 11,
    paddingBottom: 4,
  },

  mirrorX: { transform: [{ scaleX: -1 }] },

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

  // ── Modais ──────────────────────────────────────────────────────────────────
  overlay:       { flex: 1, backgroundColor: 'transparent', justifyContent: 'flex-end', paddingBottom: 48 },
  menu:          { marginHorizontal: 16, backgroundColor: '#fff', borderRadius: 16, overflow: 'hidden' },
  menuItem:      { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingVertical: 16 },
  menuItemText:  { fontSize: 16, fontFamily: fonts.regular, color: colors.gray800 },
  menuDivider:   { height: 1, backgroundColor: '#EAEAEA', marginHorizontal: 16 },
  editOverlay:   { flex: 1, backgroundColor: 'transparent', justifyContent: 'flex-end' },
  editSheet:     { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24, paddingBottom: 40, gap: 16 },
  editTitle:     { fontSize: 17, fontFamily: fonts.semiBold, color: colors.gray800 },
  editInput:     { backgroundColor: '#F5F5F7', borderRadius: 12, padding: 14, minHeight: 90, fontSize: 15, fontFamily: fonts.regular, color: colors.gray800, textAlignVertical: 'top' },
  editActions:   { flexDirection: 'row', gap: 10 },
  editCancel:    { flex: 1, paddingVertical: 14, borderRadius: 12, backgroundColor: '#EAEAEA', alignItems: 'center' },
  editCancelText:{ fontSize: 15, fontFamily: fonts.semiBold, color: colors.gray600 },
  editSave:      { flex: 1, paddingVertical: 14, borderRadius: 12, backgroundColor: colors.primary, alignItems: 'center' },
  editSaveText:  { fontSize: 15, fontFamily: fonts.semiBold, color: '#fff' },
})
