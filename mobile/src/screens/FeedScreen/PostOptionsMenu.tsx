import React, { useState, useRef, useEffect } from 'react'
import {
  View, Modal, Pressable, Animated, TouchableOpacity, TextInput,
  StyleSheet, KeyboardAvoidingView, Platform,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { LinearGradient } from 'expo-linear-gradient'
import { MoreVertical, Pencil, Trash2, Send } from 'lucide-react-native'
import { Post } from '../../types'
import { colors, fonts } from '../../theme'
import { useT } from '../../i18n'
import { confirm } from '../../components/confirm'

// ─── PostOptionsMenu ──────────────────────────────────────────────────────────
// Os três pontinhos do autor: editar legenda e apagar publicação.
// Extraído da ActionBar para poder viver no topo do post, ao lado do Seguir.

interface Props {
  post: Post
  onDeleted?: (id: string) => void
  onEdited?: (id: string, caption: string) => void
  onBlockingChange?: (open: boolean) => void   // pausa o vídeo enquanto está aberto
}

export default function PostOptionsMenu({ post, onDeleted, onEdited, onBlockingChange }: Props) {
  const { bottom: safeBottom } = useSafeAreaInsets()
  const t = useT()

  const [showMenu, setShowMenu] = useState(false)
  const [editMode, setEditMode] = useState(false)
  const [editText, setEditText] = useState(post.caption ?? '')

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

  useEffect(() => { onBlockingChange?.(showMenu || editMode) }, [showMenu, editMode])

  // Repõe ao trocar de publicação
  useEffect(() => {
    setShowMenu(false); setEditMode(false)
    setEditText(post.caption ?? '')
  }, [post.id])

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

  return (
    <>
      <TouchableOpacity
        style={s.trigger}
        onPress={() => setShowMenu(true)}
        activeOpacity={0.75}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <MoreVertical size={20} strokeWidth={2} color="rgba(255,255,255,0.9)" />
      </TouchableOpacity>

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
}

const s = StyleSheet.create({
  trigger: {
    width: 30, height: 30, borderRadius: 15,
    alignItems: 'center', justifyContent: 'center',
  },

  iconMenuBackdrop: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center', justifyContent: 'center',
  },
  iconMenuRow: { flexDirection: 'row', gap: 22 },
  iconCircle: {
    width: 62, height: 62, borderRadius: 31,
    alignItems: 'center', justifyContent: 'center',
  },

  editOverlay:  { flex: 1, justifyContent: 'flex-end' },
  editBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.45)' },
  editSheet: {
    backgroundColor: colors.white,
    borderTopLeftRadius: 22, borderTopRightRadius: 22,
    paddingHorizontal: 16, paddingTop: 10,
  },
  editGrabber: {
    width: 38, height: 4, borderRadius: 2,
    backgroundColor: colors.gray200, alignSelf: 'center', marginBottom: 14,
  },
  editRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 10 },
  editInput: {
    flex: 1, minHeight: 44, maxHeight: 120,
    backgroundColor: '#F4F4F6', borderRadius: 16,
    paddingHorizontal: 14, paddingVertical: 11,
    fontFamily: fonts.regular, fontSize: 15, color: colors.gray800,
  },
  editSubmit: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: colors.primary,
    alignItems: 'center', justifyContent: 'center',
  },
})
