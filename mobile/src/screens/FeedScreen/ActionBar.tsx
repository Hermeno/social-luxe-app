import React, { useState, useEffect } from 'react'
import {
  View, Text, TouchableOpacity, StyleSheet, Share, Modal, Alert, TextInput,
} from 'react-native'
import * as Haptics from 'expo-haptics'
import { Ionicons, FontAwesome5 } from '@expo/vector-icons'
import { Post } from '../../types'
import { colors, fonts } from '../../theme'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import * as postService from '../../services/post.service'
import ReactionPicker from '../../components/ReactionPicker'
import { useAuthStore } from '../../store/auth.store'

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
  const { bottom } = useSafeAreaInsets()
  const { user }   = useAuthStore()
  const isSelf     = user?.id === post.userId

  const [liked,      setLiked]      = useState(likedProp)
  const [likeCount,  setLikeCount]  = useState(post._count?.likes ?? 0)
  const [shareCount, setShareCount] = useState(post._count?.shares ?? 0)
  const [showReactions, setShowReactions] = useState(false)
  const [showMenu,  setShowMenu]  = useState(false)
  const [editMode,  setEditMode]  = useState(false)
  const [editText,  setEditText]  = useState(post.caption ?? '')

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
        message: `${post.caption ? `"${post.caption}" — ` : ''}Vê no luxee antes que expire! 🔥`,
      })
      if (result.action === Share.sharedAction)
        postService.sharePost(post.id).then(() => setShareCount((c) => c + 1)).catch(() => {})
    } catch {}
  }

  function handleDelete() {
    setShowMenu(false)
    Alert.alert('Eliminar publicação', 'Esta ação é permanente.', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Eliminar', style: 'destructive', onPress: () => onDeleted?.(post.id) },
    ])
  }

  function handleSaveEdit() {
    setEditMode(false)
    onEdited?.(post.id, editText)
  }

  const isAnnouncement = post.isAnnouncement ?? false

  return (
    <>
      {/* Vertical column — fixed position, right side */}
      <View style={[s.column, { bottom: bottom + 150 }]}>

        {/* Like */}
        {!isAnnouncement && (
          <TouchableOpacity
            style={s.btn}
            onPress={handleLike}
            onLongPress={() => setShowReactions(true)}
            activeOpacity={0.7}
          >
            <FontAwesome5 name="heart" size={24} color={liked ? '#FF4B6E' : '#fff'} solid={liked} />
            <Text style={s.label}>{fmt(likeCount)}</Text>
          </TouchableOpacity>
        )}

        {/* Comment */}
        {!isAnnouncement && (
          <TouchableOpacity style={s.btn} onPress={onCommentPress} activeOpacity={0.7}>
            <Ionicons name="chatbubble-outline" size={28} color="#fff" style={s.mirrorX} />
            <Text style={s.label}>{fmt(commentCountProp ?? post._count?.comments ?? 0)}</Text>
          </TouchableOpacity>
        )}

        {/* Share */}
        {!isAnnouncement && (
          <TouchableOpacity style={s.btn} onPress={handleShare} activeOpacity={0.7}>
            <Ionicons name="paper-plane" size={28} color="#fff" />
            <Text style={s.label}>{fmt(shareCount)}</Text>
          </TouchableOpacity>
        )}

        {/* Views */}
        <View style={[s.btn, { opacity: (isSelf || post.user.viewsPublic) ? 1 : 0 }]}>
          <Ionicons name="eye" size={28} color="#fff" />
          <Text style={s.label}>{fmt(post._count?.views ?? 0)}</Text>
        </View>

        {/* Options — visible only for author */}
        <TouchableOpacity
          style={[s.btn, { opacity: isSelf ? 1 : 0 }]}
          onPress={() => { if (isSelf) { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setShowMenu(true) } }}
          activeOpacity={isSelf ? 0.7 : 1}
        >
          <Ionicons name="ellipsis-horizontal" size={24} color="rgba(255,255,255,0.85)" />
        </TouchableOpacity>
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

      <Modal visible={editMode} transparent animationType="slide" onRequestClose={() => setEditMode(false)}>
        <View style={s.editOverlay}>
          <View style={s.editSheet}>
            <Text style={s.editTitle}>Editar legenda</Text>
            <TextInput
              style={s.editInput}
              value={editText}
              onChangeText={setEditText}
              multiline
              maxLength={200}
              autoFocus
              placeholder="Legenda..."
              placeholderTextColor={colors.gray400}
            />
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
})

const s = StyleSheet.create({
  column: {
    position: 'absolute',
    right: 14,
    width: 60,
    alignItems: 'center',
    zIndex: 20,
    gap: 4,
  },
  btn: {
    width: 60,
    alignItems: 'center',
    paddingVertical: 8,
    gap: 4,
  },
  mirrorX: { transform: [{ scaleX: -1 }] },
  label: {
    color: '#fff',
    fontFamily: fonts.semiBold,
    fontSize: 13,
    letterSpacing: -0.2,
  },

  overlay:       { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end', paddingBottom: 48 },
  menu:          { marginHorizontal: 16, backgroundColor: '#fff', borderRadius: 16, overflow: 'hidden' },
  menuItem:      { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingVertical: 16 },
  menuItemText:  { fontSize: 16, fontFamily: fonts.regular, color: colors.gray800 },
  menuDivider:   { height: 1, backgroundColor: '#EAEAEA', marginHorizontal: 16 },
  editOverlay:   { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  editSheet:     { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24, paddingBottom: 40, gap: 16 },
  editTitle:     { fontSize: 17, fontFamily: fonts.semiBold, color: colors.gray800 },
  editInput:     { backgroundColor: '#F5F5F7', borderRadius: 12, padding: 14, minHeight: 90, fontSize: 15, fontFamily: fonts.regular, color: colors.gray800, textAlignVertical: 'top' },
  editActions:   { flexDirection: 'row', gap: 10 },
  editCancel:    { flex: 1, paddingVertical: 14, borderRadius: 12, backgroundColor: '#EAEAEA', alignItems: 'center' },
  editCancelText:{ fontSize: 15, fontFamily: fonts.semiBold, color: colors.gray600 },
  editSave:      { flex: 1, paddingVertical: 14, borderRadius: 12, backgroundColor: colors.primary, alignItems: 'center' },
  editSaveText:  { fontSize: 15, fontFamily: fonts.semiBold, color: '#fff' },
})
