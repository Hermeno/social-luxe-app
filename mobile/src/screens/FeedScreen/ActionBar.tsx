import React, { useState, useEffect } from 'react'
import { View, TouchableOpacity, StyleSheet, Share, Modal, Text, Alert, TextInput } from 'react-native'
import * as Haptics from 'expo-haptics'
import { Ionicons } from '@expo/vector-icons'
import { Post } from '../../types'
import { colors, fonts } from '../../theme'
import { useNavigation } from '@react-navigation/native'
import { StackNavigationProp } from '@react-navigation/stack'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { AppStackParams } from '../../navigation/AppNavigator'
import * as postService from '../../services/post.service'
import { ReactionType } from '../../services/reaction.service'
import ActionItem from './ActionItem'
import ReactionPicker from '../../components/ReactionPicker'
import { useNotificationStore } from '../../store/notification.store'
import { api } from '../../services/api'
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

const TAB_ITEMS = [
  { icon: 'home',        iconOff: 'home-outline',        screen: 'Feed'     },
  { icon: 'chatbubble', iconOff: 'chatbubble-outline',   screen: 'Messages' },
] as const

export default function ActionBar({ post, onCommentPress, liked: likedProp = false, onLikeChange, onDeleted, onEdited, newPostsCount = 0 }: Props) {
  const nav        = useNavigation<StackNavigationProp<AppStackParams>>()
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

  const messageBadge = useNotificationStore((s) =>
    s.notifications.filter((n) => n.type === 'message' && !n.read).length
  )

  useEffect(() => { setLiked(likedProp) }, [likedProp])

  async function handleDelete() {
    setShowMenu(false)
    Alert.alert('Eliminar publicação', 'Esta ação é permanente.', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Eliminar', style: 'destructive', onPress: async () => {
        try { await api.delete(`/posts/${post.id}`); onDeleted?.(post.id) } catch {
          Alert.alert('Erro', 'Não foi possível eliminar.')
        }
      }},
    ])
  }

  async function handleSaveEdit() {
    try {
      await api.patch(`/posts/${post.id}`, { caption: editText })
      setEditMode(false)
      onEdited?.(post.id, editText)
    } catch { Alert.alert('Erro', 'Não foi possível guardar.') }
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
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    postService.sharePost(post.id)
      .then(() => setShareCount((c) => c + 1))
      .catch(() => {})

    // Open native share sheet
    const caption = post.caption ? `"${post.caption}" — ` : ''
    Share.share({
      message: `${caption}Veja o post de ${post.user.name} no Luxe antes que expire! 🔥`,
      title: 'Luxe',
    }).catch(() => {})
  }

  return (
    <>
      <View style={[s.pill, { bottom: bottom + 52 }]}>
        {/* ── Post actions ────────────────────────────────────────────── */}
        <ActionItem
          icon={liked ? 'heart' : 'heart-outline'}
          size={28}
          count={fmt(likeCount)}
          onPress={handleLike}
          onLongPress={() => setShowReactions(true)}
          circleStyle={liked ? s.circleActive : undefined}
          spinOnPress
        />
        <ActionItem
          icon="chatbubble-ellipses"
          size={26}
          count={fmt(post._count?.comments ?? 0)}
          onPress={onCommentPress}
        />
        <ActionItem
          icon="paper-plane"
          size={26}
          count={fmt(shareCount)}
          onPress={handleShare}
        />
        <ActionItem
          icon="eye-outline"
          size={26}
          count={fmt(post._count?.views ?? 0)}
          onPress={() => {}}
        />

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

        {/* ── Separator ───────────────────────────────────────────────── */}
        <View style={s.separator} />

        {/* ── Tab navigation — pill escuro, badges, icons filled ───────── */}
        <View style={s.navGroup}>
          {TAB_ITEMS.map(({ icon, screen }) => {
            const badge = screen === 'Messages' ? messageBadge : newPostsCount
            return (
              <TouchableOpacity
                key={screen}
                style={s.navItem}
                onPress={() => (nav as any).navigate(screen)}
                activeOpacity={0.65}
              >
                <Ionicons name={icon as any} size={28} color="#fff" />
                {badge > 0 && (
                  <View style={s.navBadge}>
                    <Text style={s.navBadgeTxt}>{badge > 9 ? '9+' : badge}</Text>
                  </View>
                )}
              </TouchableOpacity>
            )
          })}
        </View>
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
  separator: {
    width: 26, height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(255,255,255,0.25)',
    marginVertical: 8,
  },
  // Pill sólido — mesmo preto de cima para baixo, 50% radius
  navGroup: {
    backgroundColor: 'rgba(0,0,0,0.42)',
    borderRadius: 999,
    paddingVertical: 8,
    paddingHorizontal: 4,
    alignItems: 'center',
    gap: 6,
  },
  navItem: {
    width: 44, height: 44,
    alignItems: 'center', justifyContent: 'center',
  },
  navBadge: {
    position: 'absolute', top: 4, right: 2,
    minWidth: 15, height: 15, borderRadius: 8,
    backgroundColor: '#FF3B30',
    alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 3,
    borderWidth: 1.5, borderColor: 'rgba(0,0,0,0.5)',
  },
  navBadgeTxt: { color: '#fff', fontFamily: fonts.bold, fontSize: 9, lineHeight: 11 },
  badge: {
    position: 'absolute', top: -2, right: -4,
    minWidth: 16, height: 16, borderRadius: 8,
    backgroundColor: colors.primary,
    alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 3,
    borderWidth: 1.5, borderColor: 'rgba(0,0,0,0.5)',
  },
  badgeTxt:    { color: colors.white, fontSize: 9, fontFamily: fonts.bold },
  circleActive:{ backgroundColor: 'rgba(255,75,110,0.28)' },
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
