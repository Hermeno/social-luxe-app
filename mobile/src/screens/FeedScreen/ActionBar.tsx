import React, { useState, useEffect, useRef } from 'react'
import {
  View, Text, TouchableOpacity, StyleSheet, Share, Modal, Alert, TextInput, Animated, Easing,
} from 'react-native'
import * as Haptics from 'expo-haptics'
import { Ionicons } from '@expo/vector-icons'
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

function useTimeLeft(expiresAt: string) {
  const calc = () => {
    const diff = new Date(expiresAt).getTime() - Date.now()
    const totalMin = Math.max(0, Math.floor(diff / 60_000))
    const h = Math.floor(totalMin / 60)
    const m = totalMin % 60
    const label = h > 0 ? `${h}h ${m}m` : `${m}m`
    return { label, urgent: diff < 2 * 3_600_000 }
  }
  const [state, setState] = useState(calc)
  useEffect(() => {
    setState(calc())
    const id = setInterval(() => setState(calc()), 30_000)
    return () => clearInterval(id)
  }, [expiresAt])
  return state
}

export default function ActionBar({
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

  const clockAnim = useRef(new Animated.Value(0)).current
  const { label: timeLeft, urgent } = useTimeLeft(post.expiresAt)

  useEffect(() => {
    Animated.loop(
      Animated.timing(clockAnim, {
        toValue: 1, duration: urgent ? 3000 : 8000,
        easing: Easing.linear, useNativeDriver: true,
      }),
    ).start()
  }, [urgent])

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

  return (
    <>
      {/* Vertical column — fixed position, right side */}
      <View style={[s.column, { bottom: bottom + 120 }]}>

        {/* Like — always visible */}
        <TouchableOpacity
          style={s.btn}
          onPress={handleLike}
          onLongPress={() => setShowReactions(true)}
          activeOpacity={0.7}
        >
          <Ionicons
            name={liked ? 'heart' : 'heart-outline'}
            size={30}
            color={liked ? '#FF4B6E' : '#fff'}
            style={s.shadow}
          />
          <Text style={s.label}>{fmt(likeCount)}</Text>
        </TouchableOpacity>

        {/* Comment — always visible */}
        <TouchableOpacity style={s.btn} onPress={onCommentPress} activeOpacity={0.7}>
          <Ionicons name="chatbubble-ellipses" size={28} color="#fff" style={s.shadow} />
          <Text style={s.label}>{fmt(commentCountProp ?? post._count?.comments ?? 0)}</Text>
        </TouchableOpacity>

        {/* Share — always visible */}
        <TouchableOpacity style={s.btn} onPress={handleShare} activeOpacity={0.7}>
          <Ionicons name="paper-plane" size={28} color="#fff" style={s.shadow} />
          <Text style={s.label}>{fmt(shareCount)}</Text>
        </TouchableOpacity>

        {/* Views — always occupies space; count shown only when authorized */}
        <View style={s.btn}>
          <Ionicons
            name="eye"
            size={28}
            color={(isSelf || post.user.viewsPublic) ? '#fff' : 'transparent'}
            style={s.shadow}
          />
          <Text style={[s.label, !(isSelf || post.user.viewsPublic) && { opacity: 0 }]}>
            {fmt(post._count?.views ?? 0)}
          </Text>
        </View>

        {/* Timer — always visible */}
        <View style={s.btn}>
          <Animated.View style={{
            transform: [{
              rotate: clockAnim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] }),
            }],
          }}>
            <Ionicons name="time-outline" size={26} color="#fff" style={s.shadow} />
          </Animated.View>
          <Text style={s.label}>{timeLeft}</Text>
        </View>

        {/* Options — always occupies space; visible only for author */}
        <TouchableOpacity
          style={s.btn}
          onPress={() => { if (isSelf) { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setShowMenu(true) } }}
          activeOpacity={isSelf ? 0.7 : 1}
        >
          <Ionicons
            name="ellipsis-horizontal"
            size={24}
            color={isSelf ? 'rgba(255,255,255,0.85)' : 'transparent'}
            style={s.shadow}
          />
        </TouchableOpacity>
      </View>

      {showReactions && (
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
}

const SHADOW = {
  textShadowColor: 'rgba(0,0,0,0.6)',
  textShadowOffset: { width: 0, height: 1 },
  textShadowRadius: 4,
}

const s = StyleSheet.create({
  column: {
    position: 'absolute',
    right: 12,
    alignItems: 'center',
    zIndex: 20,
    gap: 4,
  },
  btn: {
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 4,
    gap: 4,
  },
  shadow: {
    // icon drop shadow via text shadow (works on Ionicons which renders as text)
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 5,
  } as any,
  label: {
    color: '#fff',
    fontFamily: fonts.semiBold,
    fontSize: 13,
    letterSpacing: -0.2,
    ...SHADOW,
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
