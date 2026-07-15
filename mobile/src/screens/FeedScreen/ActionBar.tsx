import React, { useState, useEffect, useRef } from 'react'
import {
  View, Text, TouchableOpacity, StyleSheet, Share, Modal, Alert, TextInput,
  Animated, Pressable, KeyboardAvoidingView, Platform,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { LinearGradient } from 'expo-linear-gradient'
import { Heart, MessageCircle, Send, Eye, Octagon, OctagonX, MoreVertical, Pencil, Trash2, FilePlusCorner, RefreshCw } from 'lucide-react-native'
import { confirm } from '../../components/confirm'

import { Post } from '../../types'
import { colors, fonts } from '../../theme'
import * as postService from '../../services/post.service'
import { updateCachedPost } from '../../db/database'
import ReactionPicker from '../../components/ReactionPicker'
import { useAuthStore } from '../../store/auth.store'
import { useT } from '../../i18n'

interface Props {
  post: Post
  onCommentPress: () => void
  onStickerPress?: () => void
  liked?: boolean
  onLikeChange?: (liked: boolean) => void
  reposted?: boolean
  onRepost?: () => void
  stickerCount?: number
  stickersHidden?: boolean
  onToggleStickers?: () => void
  onDeleted?: (id: string) => void
  onEdited?: (id: string, caption: string) => void
  onBlockingChange?: (open: boolean) => void
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
  post, onCommentPress, onStickerPress, liked: likedProp = false,
  onLikeChange, reposted: repostedProp = false, onRepost,
  stickerCount = 0, stickersHidden = false, onToggleStickers,
  onDeleted, onEdited, onBlockingChange, newPostsCount = 0,
  commentCount: commentCountProp,
}: Props) {
  const { bottom: safeBottom } = useSafeAreaInsets()
  const tabOffset = 42 + Math.max(safeBottom, 8)
  const { user }   = useAuthStore()
  const t          = useT()
  const isSelf     = user?.id === post.userId

  const [liked,      setLiked]      = useState(likedProp)
  const [reposted,   setReposted]   = useState(repostedProp)
  const [likeCount,  setLikeCount]  = useState(post._count?.likes ?? 0)
  const [shareCount, setShareCount] = useState(post._count?.shares ?? 0)
  const [showReactions, setShowReactions] = useState(false)
  const [showMenu,  setShowMenu]  = useState(false)
  const [editMode,  setEditMode]  = useState(false)
  const [editText,  setEditText]  = useState(post.caption ?? '')
  const [hearts,    setHearts]    = useState<HeartP[]>([])
  const heartIdRef = useRef(0)
  const repostSpin = useRef(new Animated.Value(0)).current
  const repostRotate = repostSpin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] })

  // Pop-in dos dois ícones do menu (escala + opacidade)
  const menuScale = useRef(new Animated.Value(0.8)).current
  const menuOp    = useRef(new Animated.Value(0)).current
  useEffect(() => {
    if (showMenu) {
      menuScale.setValue(0.8); menuOp.setValue(0)
      Animated.parallel([
        Animated.spring(menuScale, { toValue: 1, useNativeDriver: true, damping: 15, stiffness: 260 }),
        Animated.timing(menuOp,    { toValue: 1, duration: 130, useNativeDriver: true }),
      ]).start()
    }
  }, [showMenu])

  // Pausar o post enquanto o menu ou a edição estão abertos
  useEffect(() => { onBlockingChange?.(showMenu || editMode) }, [showMenu, editMode])

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
    setShowReactions(false); setShowMenu(false); setEditMode(false)
    setEditText(post.caption ?? '')
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

  async function handleDelete() {
    setShowMenu(false)
    const ok = await confirm({
      title: t.feed_delete_title, message: t.feed_delete_msg,
      confirmText: t.delete, cancelText: t.cancel,
      destructive: true, icon: 'trash-outline',
    })
    if (ok) onDeleted?.(post.id)
  }

  function handleSaveEdit() {
    setEditMode(false)
    onEdited?.(post.id, editText)
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
            <Send size={26} strokeWidth={2} color="#fff" />
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

        {/* Adicionar objetos — com contador de objetos no post */}
        {!isAnnouncement && post.stickersEnabled && (
          <TouchableOpacity style={s.btn} onPress={onStickerPress} activeOpacity={0.75}>
            <FilePlusCorner size={26} strokeWidth={2} color="#fff" />
            <Text style={s.label}>{fmt(stickerCount)}</Text>
          </TouchableOpacity>
        )}

        {/* Mostrar / ocultar objetos — só quando há objetos no post */}
        {!isAnnouncement && stickerCount > 0 && (
          <TouchableOpacity style={s.btn} onPress={onToggleStickers} activeOpacity={0.75}>
            {stickersHidden
              ? <OctagonX size={26} strokeWidth={2} color="#fff" />
              : <Octagon size={26} strokeWidth={2} color="#fff" />}
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
            onPress={() => { setShowMenu(true) }}
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
        <Pressable style={s.iconMenuBackdrop} onPress={() => setShowMenu(false)}>
          <Animated.View style={[s.iconMenuRow, { opacity: menuOp, transform: [{ scale: menuScale }] }]}>
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={() => { setShowMenu(false); setEditText(post.caption ?? ''); setEditMode(true) }}
            >
              <LinearGradient colors={['#3A3A3E', '#151517']} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }} style={s.iconCircle}>
                <Pencil size={26} strokeWidth={2} color="#fff" />
              </LinearGradient>
            </TouchableOpacity>

            <TouchableOpacity activeOpacity={0.85} onPress={handleDelete}>
              <LinearGradient colors={['#FF5A52', '#D22C22']} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }} style={s.iconCircle}>
                <Trash2 size={26} strokeWidth={2} color="#fff" />
              </LinearGradient>
            </TouchableOpacity>
          </Animated.View>
        </Pressable>
      </Modal>

      <Modal visible={editMode} transparent animationType="slide" onRequestClose={() => setEditMode(false)}>
        <KeyboardAvoidingView style={s.editOverlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <Pressable style={s.editBackdrop} onPress={() => setEditMode(false)} />
          <View style={[s.editSheet, { paddingBottom: Math.max(safeBottom, 14) }]}>
            <View style={s.editGrabber} />
            <View style={s.editRow}>
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
              <TouchableOpacity style={s.editSubmit} onPress={handleSaveEdit} activeOpacity={0.85}>
                <Send size={19} strokeWidth={2.2} color="#fff" />
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
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

  mirrorX:   { transform: [{ scaleX: -1 }] },

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

  // ── Menu dos 3 pontos: dois ícones em gradiente ─────────────────────────────
  iconMenuBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center' },
  iconMenuRow:      { flexDirection: 'row', gap: 22 },
  iconCircle: {
    width: 64, height: 64, borderRadius: 32,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOpacity: 0.28, shadowRadius: 16, shadowOffset: { width: 0, height: 8 }, elevation: 10,
  },

  // ── Edição: campo + ícone de submeter ───────────────────────────────────────
  editBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.35)' },
  editGrabber:  { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: '#E0E0E4', marginBottom: 14 },
  editRow:      { flexDirection: 'row', alignItems: 'flex-end', gap: 10 },
  editSubmit:   { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  editOverlay:   { flex: 1, justifyContent: 'flex-end' },
  editSheet:     { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingTop: 12, paddingHorizontal: 16 },
  editInput:     { flex: 1, backgroundColor: '#F2F2F5', borderRadius: 18, paddingHorizontal: 16, paddingVertical: 12, minHeight: 44, maxHeight: 120, fontSize: 15.5, fontFamily: fonts.medium, color: colors.gray800, textAlignVertical: 'center' },
})
