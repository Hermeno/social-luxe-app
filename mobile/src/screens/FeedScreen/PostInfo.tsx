import React, { useState, useRef, useEffect } from 'react'
import {
  Animated, View, Text, TouchableOpacity, StyleSheet,
  Easing, Alert, TextInput, Modal,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { Post } from '../../types'
import { colors, fonts } from '../../theme'
import { useAuthStore } from '../../store/auth.store'
import { toggleFollow, getFollowStatus } from '../../services/follow.service'
import { api } from '../../services/api'
import AvatarImage from '../../components/AvatarImage'
import * as Haptics from 'expo-haptics'

interface Props {
  post: Post
  isActive: boolean
  onDeleted?: (postId: string) => void
  onEdited?: (postId: string, caption: string) => void
}

export default function PostInfo({ post, isActive, onDeleted, onEdited }: Props) {
  const { user }      = useAuthStore()
  const [expanded, setExpanded]   = useState(false)
  const [following, setFollowing] = useState(false)
  const [loadingFollow, setLoadingFollow] = useState(false)
  const [showMenu, setShowMenu]   = useState(false)
  const [editMode, setEditMode]   = useState(false)
  const [editText, setEditText]   = useState(post.caption ?? '')

  const caption  = post.caption ?? ''
  const isLong   = caption.length > 80
  const displayed = expanded || !isLong ? caption : caption.slice(0, 80) + '...'
  const isSelf   = user?.id === post.user.id

  const fadeAnim  = useRef(new Animated.Value(0)).current
  const slideAnim = useRef(new Animated.Value(16)).current
  const clockAnim = useRef(new Animated.Value(0)).current

  useEffect(() => {
    Animated.loop(
      Animated.timing(clockAnim, {
        toValue: 1, duration: 6000,
        easing: Easing.linear, useNativeDriver: true,
      }),
    ).start()
  }, [])

  useEffect(() => {
    if (isActive) {
      fadeAnim.setValue(0)
      slideAnim.setValue(16)
      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 1, duration: 380, useNativeDriver: true }),
        Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, speed: 22, bounciness: 4 }),
      ]).start()
    } else {
      fadeAnim.setValue(0)
    }
  }, [isActive])

  useEffect(() => {
    if (isSelf) return
    getFollowStatus(post.user.id)
      .then((r) => setFollowing(r.following))
      .catch(() => {})
  }, [post.user.id])

  async function handleFollow() {
    if (loadingFollow) return
    setLoadingFollow(true)
    try {
      const res = await toggleFollow(post.user.id)
      setFollowing(res.following)
    } catch {}
    setLoadingFollow(false)
  }

  async function handleDelete() {
    setShowMenu(false)
    Alert.alert(
      'Eliminar publicação',
      'Esta ação é permanente. O ficheiro também será apagado do servidor.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar', style: 'destructive',
          onPress: async () => {
            try {
              await api.delete(`/posts/${post.id}`)
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
              onDeleted?.(post.id)
            } catch {
              Alert.alert('Erro', 'Não foi possível eliminar o post.')
            }
          },
        },
      ],
    )
  }

  async function handleSaveEdit() {
    try {
      await api.patch(`/posts/${post.id}`, { caption: editText })
      setEditMode(false)
      onEdited?.(post.id, editText)
    } catch {
      Alert.alert('Erro', 'Não foi possível guardar a edição.')
    }
  }

  function timeLeft() {
    const diff = new Date(post.expiresAt).getTime() - Date.now()
    const h = Math.max(0, Math.floor(diff / 3600000))
    const m = Math.max(0, Math.floor((diff % 3600000) / 60000))
    return `${h}h ${m}m`
  }

  return (
    <>
      <Animated.View style={[s.container, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
        {/* Avatar + Name + follow/menu */}
        <View style={s.userRow}>
          <AvatarImage
            uri={post.user.avatar}
            size={32}
            borderColor="rgba(255,255,255,0.8)"
            borderWidth={1}
          />
          <View style={s.nameGroup}>
            {post.extended && (
              <View style={s.extBadge}>
                <Text style={s.extBadgeText}>+24h</Text>
              </View>
            )}
            <Text style={s.username} numberOfLines={1}>{post.user.name}</Text>
            {!isSelf && (
              <TouchableOpacity
                style={s.followBtn}
                onPress={handleFollow}
                activeOpacity={0.7}
                disabled={loadingFollow}
              >
                <Text style={s.followTxt}>
                  {following ? 'Seguindo' : 'Seguir'}
                </Text>
              </TouchableOpacity>
            )}
          </View>

        </View>

        {/* Caption */}
        {caption.length > 0 && post.mediaType !== 'TEXT' && (
          <TouchableOpacity onPress={() => setExpanded((e) => !e)} activeOpacity={0.8}>
            <Text style={s.caption}>
              {displayed}
              {isLong && !expanded && <Text style={s.seeMore}> Ver mais</Text>}
            </Text>
          </TouchableOpacity>
        )}

        {/* Timer */}
        <View style={s.timerRow}>
          <Animated.View style={{
            transform: [{
              rotate: clockAnim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] }),
            }],
          }}>
            <Ionicons name="time-outline" size={14} color="rgba(255,255,255,0.65)" />
          </Animated.View>
          <Text style={s.timer}> {timeLeft()}</Text>
        </View>
      </Animated.View>

      {/* ── Post options menu ─────────────────────────────────── */}
      <Modal visible={showMenu} transparent animationType="fade" onRequestClose={() => setShowMenu(false)}>
        <TouchableOpacity style={s.overlay} activeOpacity={1} onPress={() => setShowMenu(false)}>
          <View style={s.menu}>
            <TouchableOpacity
              style={s.menuItem}
              onPress={() => { setShowMenu(false); setEditText(post.caption ?? ''); setEditMode(true) }}
            >
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

      {/* ── Edit caption modal ─────────────────────────────────── */}
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

const s = StyleSheet.create({
  container: { position: 'absolute', left: 16, bottom: 120, right: 90, gap: 8, zIndex: 30 },

  userRow:   { flexDirection: 'row', alignItems: 'center', gap: 8 },
  nameGroup: { flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 },
  username: {
    color: colors.white, fontFamily: fonts.semiBold, fontSize: 13,
    letterSpacing: -0.2, flexShrink: 1,
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },

  extBadge:     { backgroundColor: colors.primary, borderRadius: 4, paddingHorizontal: 5, paddingVertical: 1 },
  extBadgeText: { color: colors.white, fontFamily: fonts.bold, fontSize: 9, letterSpacing: 0.2 },

  followBtn: {
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.85)',
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  followTxt: { color: colors.white, fontFamily: fonts.medium, fontSize: 11 },

  menuBtn: { marginLeft: 4 },

  caption:  { color: 'rgba(255,255,255,0.88)', fontFamily: fonts.regular, fontSize: 13, lineHeight: 19 },
  seeMore:  { color: 'rgba(255,255,255,0.50)', fontFamily: fonts.medium },

  timerRow: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  timer:    { color: 'rgba(255,255,255,0.65)', fontFamily: fonts.medium, fontSize: 12, letterSpacing: 0.1 },

  // Menu
  overlay:      { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end', paddingBottom: 48 },
  menu:         { marginHorizontal: 16, backgroundColor: '#fff', borderRadius: 16, overflow: 'hidden' },
  menuItem:     { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingVertical: 16 },
  menuItemText: { fontSize: 16, fontFamily: fonts.regular, color: colors.gray800 },
  menuDivider:  { height: 1, backgroundColor: '#EAEAEA', marginHorizontal: 16 },

  // Edit modal
  editOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  editSheet:   { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24, paddingBottom: 40, gap: 16 },
  editTitle:   { fontSize: 17, fontFamily: fonts.semiBold, color: colors.gray800 },
  editInput:   {
    backgroundColor: '#F5F5F7', borderRadius: 12,
    padding: 14, minHeight: 90,
    fontSize: 15, fontFamily: fonts.regular, color: colors.gray800,
    textAlignVertical: 'top',
  },
  editActions:     { flexDirection: 'row', gap: 10 },
  editCancel:      { flex: 1, paddingVertical: 14, borderRadius: 12, backgroundColor: '#EAEAEA', alignItems: 'center' },
  editCancelText:  { fontSize: 15, fontFamily: fonts.semiBold, color: colors.gray600 },
  editSave:        { flex: 1, paddingVertical: 14, borderRadius: 12, backgroundColor: colors.primary, alignItems: 'center' },
  editSaveText:    { fontSize: 15, fontFamily: fonts.semiBold, color: '#fff' },
})
