import React, { useState, useEffect } from 'react'
import { View, TouchableOpacity, StyleSheet, Share, Modal, Text, Alert, TextInput } from 'react-native'
import * as Haptics from 'expo-haptics'
import { Ionicons } from '@expo/vector-icons'
import { Post } from '../../types'
import { colors, fonts } from '../../theme'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import * as postService from '../../services/post.service'
import { ReactionType } from '../../services/reaction.service'
import ActionItem from './ActionItem'
import ReactionPicker from '../../components/ReactionPicker'
import { useAuthStore } from '../../store/auth.store'

interface Props {
  post: Post
  onCommentPress: () => void
  liked?: boolean
  onLikeChange?: (liked: boolean) => void
  onDeleted?: (id: string) => void
  onEdited?: (id: string, caption: string) => void
  newPostsCount?: number   // total unviewed posts from followed users → badge no ícone Home
}

function fmt(n: number) {
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`
  return String(n)
}

export default function ActionBar({ post, onCommentPress, liked: likedProp = false, onLikeChange, onDeleted, onEdited, newPostsCount = 0 }: Props) {
  const { bottom } = useSafeAreaInsets()
  const { user }   = useAuthStore()
  const isSelf     = user?.id === post.userId

  const [liked, setLiked]           = useState(likedProp)
  const [likeCount, setLikeCount]   = useState(post._count?.likes ?? 0)
  const [shareCount, setShareCount] = useState(post._count?.shares ?? 0)
  const [currentReaction, setCurrentReaction] = useState<ReactionType | undefined>()
  const [showReactions, setShowReactions]     = useState(false)
  const [showMenu, setShowMenu]   = useState(false)
  const [editMode, setEditMode]   = useState(false)
  const [editText, setEditText]   = useState(post.caption ?? '')

  // Reset all per-post state when post changes (avoids remount via key prop)
  useEffect(() => {
    setLiked(likedProp)
    setLikeCount(post._count?.likes ?? 0)
    setShareCount(post._count?.shares ?? 0)
    setCurrentReaction(undefined)
    setShowReactions(false)
    setShowMenu(false)
    setEditMode(false)
    setEditText(post.caption ?? '')
  }, [post.id])

  function handleDelete() {
    setShowMenu(false)
    Alert.alert('Eliminar publicação', 'Esta ação é permanente.', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Eliminar', style: 'destructive', onPress: () => {
        // Delegate to parent (useFeed.removePost) which handles SQLite + offline queue
        onDeleted?.(post.id)
      }},
    ])
  }

  function handleSaveEdit() {
    setEditMode(false)
    // Delegate to parent (useFeed.updatePost) which handles SQLite + offline queue
    onEdited?.(post.id, editText)
  }

  async function handleLike() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    const wasLiked = liked
    const prevCount = likeCount
    setLiked(!wasLiked)
    setLikeCount((c) => wasLiked ? c - 1 : c + 1)
    onLikeChange?.(!wasLiked)
    try {
      const res = await postService.likePost(post.id)
      setLiked(res.liked)
      setLikeCount((c) => (res.liked !== !wasLiked ? prevCount + (res.liked ? 1 : -1) : c))
      onLikeChange?.(res.liked)
    } catch {
      setLiked(wasLiked)
      setLikeCount(prevCount)
      onLikeChange?.(wasLiked)
    }
  }

  async function handleShare() {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
      const caption = post.caption ? `"${post.caption}" — ` : ''
      const name    = post.user?.name ?? 'alguém'
      const result  = await Share.share({
        message: `${caption}Vê o post de ${name} no luxee antes que expire! 🔥`,
      })
      if (result.action === Share.sharedAction) {
        postService.sharePost(post.id).then(() => setShareCount((c) => c + 1)).catch(() => {})
      }
    } catch {
      // Share cancelled or not available — silently ignore
    }
  }

  return (
    <>
      <View style={[s.pill, { bottom: bottom + 52 }]}>
        {/* ── Post actions ────────────────────────────────────────────── */}
        <ActionItem
          icon={liked ? 'heart' : 'heart-outline'}
          size={30}
          count={fmt(likeCount)}
          onPress={handleLike}
          onLongPress={() => setShowReactions(true)}
          circleStyle={liked ? s.circleActive : undefined}
          spinOnPress
        />
        <ActionItem
          icon="chatbubble-ellipses"
          size={28}
          count={fmt(post._count?.comments ?? 0)}
          onPress={onCommentPress}
        />
        <ActionItem
          icon="paper-plane"
          size={28}
          count={fmt(shareCount)}
          onPress={handleShare}
        />
        {isSelf && (
          <View style={s.viewsItem}>
            <Ionicons name="eye" size={26} color="rgba(255,255,255,0.85)" />
            <Text style={s.viewsCount}>{fmt(post._count?.views ?? 0)}</Text>
          </View>
        )}

        {/* ── Options (só para o autor) ────────────────────────────────── */}
        {isSelf && (
          <TouchableOpacity
            style={s.optionsBtn}
            onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setShowMenu(true) }}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="ellipsis-horizontal" size={20} color="rgba(255,255,255,0.85)" />
          </TouchableOpacity>
        )}

      </View>

      {showReactions && (
        <Modal transparent animationType="none" visible onRequestClose={() => setShowReactions(false)}>
          <ReactionPicker postId={post.id} currentReaction={currentReaction} onClose={() => setShowReactions(false)} />
        </Modal>
      )}

      {/* ── Post options menu ────────────────────────────────────────── */}
      <Modal visible={showMenu} transparent animationType="fade" onRequestClose={() => setShowMenu(false)}>
        <TouchableOpacity style={s.overlay} activeOpacity={1} onPress={() => setShowMenu(false)}>
          <View style={s.menu}>
            <TouchableOpacity style={s.menuItem} onPress={() => { setShowMenu(false); setEditText(post.caption ?? ''); setEditMode(true) }}>
              <Ionicons name="pencil-outline" size={20} color={colors.gray800} />
              <Text style={s.menuItemText}>Editar legenda</Text>
            </TouchableOpacity>
            <View style={s.menuDivider} />
            <TouchableOpacity style={s.menuItem} onPress={handleDelete}>
              <Ionicons name="trash-outline" size={20} color="#E53E3E" />
              <Text style={[s.menuItemText, { color: '#E53E3E' }]}>Eliminar publicação</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* ── Edit caption ─────────────────────────────────────────────── */}
      <Modal visible={editMode} transparent animationType="slide" onRequestClose={() => setEditMode(false)}>
        <View style={s.editOverlay}>
          <View style={s.editSheet}>
            <Text style={s.editTitle}>Editar legenda</Text>
            <TextInput style={s.editInput} value={editText} onChangeText={setEditText} multiline maxLength={200} autoFocus placeholder="Legenda..." placeholderTextColor={colors.gray400} />
            <View style={s.editActions}>
              <TouchableOpacity style={s.editCancel} onPress={() => setEditMode(false)}>
                <Text style={s.editCancelText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.editSave} onPress={handleSaveEdit}>
                <Text style={s.editSaveText}>Guardar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </>
  )
}

const s = StyleSheet.create({
  pill: {
    position: 'absolute',
    right: 10,
    alignItems: 'center',
    gap: 4,
    paddingVertical: 8,
    paddingHorizontal: 6,
  },
  badge: {
    position: 'absolute', top: -2, right: -4,
    minWidth: 16, height: 16, borderRadius: 8,
    backgroundColor: colors.primary,
    alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 3,
    borderWidth: 1.5, borderColor: 'rgba(0,0,0,0.5)',
  },
  badgeTxt:    { color: colors.white, fontSize: 9, fontFamily: fonts.bold },
  circleActive: { backgroundColor: 'rgba(255,75,110,0.28)' },
  viewsItem:   { alignItems: 'center', gap: 2, width: 44, paddingVertical: 8 },
  viewsCount:  { color: colors.white, fontFamily: fonts.bold, fontSize: 13, letterSpacing: -0.2 },
  optionsBtn:  { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  overlay:     { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end', paddingBottom: 48 },
  menu:        { marginHorizontal: 16, backgroundColor: '#fff', borderRadius: 16, overflow: 'hidden' },
  menuItem:    { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingVertical: 16 },
  menuItemText:{ fontSize: 16, fontFamily: fonts.regular, color: colors.gray800 },
  menuDivider: { height: 1, backgroundColor: '#EAEAEA', marginHorizontal: 16 },
  editOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  editSheet:   { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24, paddingBottom: 40, gap: 16 },
  editTitle:   { fontSize: 17, fontFamily: fonts.semiBold, color: colors.gray800 },
  editInput:   { backgroundColor: '#F5F5F7', borderRadius: 12, padding: 14, minHeight: 90, fontSize: 15, fontFamily: fonts.regular, color: colors.gray800, textAlignVertical: 'top' },
  editActions: { flexDirection: 'row', gap: 10 },
  editCancel:  { flex: 1, paddingVertical: 14, borderRadius: 12, backgroundColor: '#EAEAEA', alignItems: 'center' },
  editCancelText: { fontSize: 15, fontFamily: fonts.semiBold, color: colors.gray600 },
  editSave:    { flex: 1, paddingVertical: 14, borderRadius: 12, backgroundColor: colors.primary, alignItems: 'center' },
  editSaveText:{ fontSize: 15, fontFamily: fonts.semiBold, color: '#fff' },
})
