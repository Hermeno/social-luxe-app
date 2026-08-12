import React, { useEffect, useMemo, useRef, useState } from 'react'
import {
  ActivityIndicator, Animated, KeyboardAvoidingView, Modal, Platform, Pressable,
  StyleSheet, Text, TextInput, TouchableOpacity, View,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import FeedIcon from '../../components/FeedIcon'
import Icon, { type IconName } from '../../components/Icon'
import { confirm } from '../../components/confirm'
import { API_BASE } from '../../config'
import { deleteCachedPostsByUser } from '../../db/database'
import useReducedMotionPreference from '../../hooks/useReducedMotionPreference'
import { useT } from '../../i18n'
import { blockUser } from '../../services/block.service'
import { isPostSaved, toggleSavedPost } from '../../services/savedPost.service'
import { useAuthStore } from '../../store/auth.store'
import { colors, fonts } from '../../theme'
import { Post } from '../../types'
import { saveMediaListToGallery } from '../../utils/download'
import { toast } from '../../utils/toast'

interface Props {
  post: Post
  onDeleted?: (id: string) => void
  onEdited?: (id: string, caption: string) => void
  onProfileBlocked?: (userId: string) => void
  onBlockingChange?: (open: boolean) => void
  rail?: boolean
  triggerSize?: number
}

interface OptionRowProps {
  icon: IconName
  label: string
  onPress: () => void
  selected?: boolean
  danger?: boolean
  disabled?: boolean
  loading?: boolean
}

function OptionRow({ icon, label, onPress, selected, danger, disabled, loading }: OptionRowProps) {
  // Todos os ícones desta folha são pretos — sem variante de cor por estado.
  // O que distingue a linha é o rótulo e o sinal de selecionado, não o ícone.
  const color = colors.black
  return (
    <TouchableOpacity
      style={[s.optionRow, disabled && s.optionDisabled]}
      onPress={onPress}
      activeOpacity={0.78}
      disabled={disabled || loading}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled, selected: !!selected, busy: !!loading }}
    >
      <View style={s.optionIcon}>
        {icon === 'bookmark' ? (
          // Único destes que veio no pacote de SVG do Herminio.
          <FeedIcon name="bookmark" size={21} color={color} />
        ) : (
          <Icon name={icon} size={21} strokeWidth={1.8} color={color} fill="none" />
        )}
      </View>
      <Text style={[s.optionLabel, danger && s.optionLabelDanger]} numberOfLines={1}>{label}</Text>
      {loading ? (
        <ActivityIndicator size="small" color={color} />
      ) : selected ? (
        <View style={s.selectedSignal} pointerEvents="none">
          <View style={s.selectedLine} />
          <View style={s.selectedDot} />
        </View>
      ) : null}
    </TouchableOpacity>
  )
}

function resolveMedia(url: string): string {
  if (url.startsWith('http') || url.startsWith('file://')) return url
  return `${API_BASE}${url}`
}

export default function PostOptionsMenu({
  post, onDeleted, onEdited, onProfileBlocked, onBlockingChange,
  rail = false, triggerSize = 25,
}: Props) {
  const { bottom: safeBottom } = useSafeAreaInsets()
  const t = useT()
  const reduceMotion = useReducedMotionPreference()
  const currentUserId = useAuthStore((state) => state.user?.id)
  const isOwnPost = currentUserId === post.user.id

  const [showMenu, setShowMenu] = useState(false)
  const [editMode, setEditMode] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [editText, setEditText] = useState(post.caption ?? '')
  const [saved, setSaved] = useState(false)
  const [savedLoading, setSavedLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [downloading, setDownloading] = useState(false)
  const [blocking, setBlocking] = useState(false)

  const menuScale = useRef(new Animated.Value(0.92)).current
  const menuOp = useRef(new Animated.Value(0)).current

  const mediaUrls = useMemo(() => {
    if (post.mediaType === 'TEXT') return []
    const source = post.mediaUrls?.length ? post.mediaUrls : [post.mediaUrl]
    return source.filter((url): url is string => !!url).map(resolveMedia)
  }, [post.mediaType, post.mediaUrl, post.mediaUrls])

  useEffect(() => {
    if (!showMenu) return
    if (reduceMotion) {
      menuScale.setValue(1)
      menuOp.setValue(1)
      return
    }
    menuScale.setValue(0.96)
    menuOp.setValue(0)
    Animated.parallel([
      Animated.spring(menuScale, { toValue: 1, useNativeDriver: true, damping: 22, stiffness: 250 }),
      Animated.timing(menuOp, { toValue: 1, duration: 150, useNativeDriver: true }),
    ]).start()
  }, [menuOp, menuScale, reduceMotion, showMenu])

  useEffect(() => {
    onBlockingChange?.(showMenu || editMode || confirming || blocking)
    // A identidade do callback não representa uma mudança de bloqueio.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [blocking, confirming, editMode, showMenu])

  useEffect(() => {
    let active = true
    setShowMenu(false)
    setEditMode(false)
    setConfirming(false)
    setEditText(post.caption ?? '')
    setSavedLoading(true)

    if (!currentUserId) {
      setSaved(false)
      setSavedLoading(false)
      return () => { active = false }
    }

    isPostSaved(currentUserId, post.id)
      .then((value) => { if (active) setSaved(value) })
      .catch(() => { if (active) setSaved(false) })
      .finally(() => { if (active) setSavedLoading(false) })

    return () => { active = false }
  }, [currentUserId, post.caption, post.id])

  async function handleToggleSaved() {
    if (!currentUserId || saving) return
    const previous = saved
    setShowMenu(false)
    setSaving(true)
    setSaved(!previous)
    try {
      const next = await toggleSavedPost(currentUserId, post.id)
      setSaved(next)
      toast.success(next ? t.feed_saved_title : t.feed_unsaved_title, next ? t.feed_saved_msg : t.feed_unsaved_msg)
    } catch {
      setSaved(previous)
      toast.error(t.error, t.feed_save_fail)
    } finally {
      setSaving(false)
    }
  }

  async function handleDownload() {
    if (!mediaUrls.length || downloading) return
    setShowMenu(false)
    setDownloading(true)
    try {
      await saveMediaListToGallery(mediaUrls)
    } finally {
      setDownloading(false)
    }
  }

  async function handleBlockProfile() {
    if (!currentUserId || isOwnPost || post.isAnnouncement || blocking) return
    setShowMenu(false)
    setConfirming(true)
    const ok = await confirm({
      title: t.feed_block_profile,
      message: t.feed_block_confirm.replace('{name}', post.user.name),
      confirmText: t.pf_block,
      cancelText: t.cancel,
      destructive: true,
      icon: 'ban-outline',
    })
    if (!ok) {
      setConfirming(false)
      return
    }

    setBlocking(true)
    setConfirming(false)
    try {
      await blockUser(post.user.id)
      await deleteCachedPostsByUser(post.user.id).catch(() => {})
      onProfileBlocked?.(post.user.id)
      toast.success(t.pf_blocked_ok)
    } catch {
      toast.error(t.error, t.feed_block_fail)
    } finally {
      setBlocking(false)
    }
  }

  async function handleDelete() {
    if (!onDeleted) return
    setConfirming(true)
    setShowMenu(false)
    const ok = await confirm({
      title: t.feed_delete_title,
      message: t.feed_delete_msg,
      confirmText: t.delete,
      cancelText: t.cancel,
      destructive: true,
      icon: 'trash-outline',
    })
    setConfirming(false)
    if (ok) onDeleted(post.id)
  }

  function handleSaveEdit() {
    setEditMode(false)
    onEdited?.(post.id, editText)
  }

  function openOptionsMenu() {
    setShowMenu(true)
    if (!currentUserId) return
    // Outra instância do mesmo post (por exemplo, o visualizador sobre a Feed)
    // pode ter mudado o estado. Revalidamos ao abrir para nunca mostrar rótulo antigo.
    setSavedLoading(true)
    isPostSaved(currentUserId, post.id)
      .then(setSaved)
      .catch(() => {})
      .finally(() => setSavedLoading(false))
  }

  const hasOwnerActions = isOwnPost && (!!onEdited || !!onDeleted)

  return (
    <>
      <TouchableOpacity
        style={[s.trigger, rail && s.triggerRail]}
        onPress={openOptionsMenu}
        activeOpacity={0.75}
        hitSlop={{ top: 9, bottom: 9, left: 9, right: 9 }}
        accessibilityRole="button"
        accessibilityLabel={t.feed_options_title}
      >
        <View style={[s.triggerIconStage, rail && s.triggerIconStageRail]}>
          <FeedIcon name="setimo-nav-currentcolor" size={triggerSize} color="#fff" />
        </View>
        {rail && <View style={s.triggerMetricSlot} pointerEvents="none" />}
      </TouchableOpacity>

      <Modal
        visible={showMenu}
        transparent
        statusBarTranslucent
        animationType={reduceMotion ? 'none' : 'fade'}
        onRequestClose={() => setShowMenu(false)}
      >
        <Pressable
          style={[s.backdrop, { paddingBottom: Math.max(safeBottom, 12) }]}
          onPress={() => setShowMenu(false)}
        >
          <Animated.View
            style={[s.sheet, { opacity: menuOp, transform: [{ scale: menuScale }] }]}
            onStartShouldSetResponder={() => true}
            accessibilityViewIsModal
            importantForAccessibility="yes"
          >
            <View style={s.grabber} />
            <View style={s.sheetHeader}>
              <Text style={s.sheetTitle}>{t.feed_options_title}</Text>
              <View style={s.sheetSignal} pointerEvents="none">
                <View style={s.sheetSignalLine} />
                <View style={s.sheetSignalDot} />
              </View>
            </View>

            <View style={s.optionList}>
              <OptionRow
                icon="bookmark"
                label={saved ? t.feed_remove_saved : t.feed_save_post}
                selected={saved}
                loading={savedLoading || saving}
                disabled={!currentUserId}
                onPress={handleToggleSaved}
              />
              <View style={s.divider} />
              <OptionRow
                icon="download"
                label={mediaUrls.length ? t.dl_download : t.feed_download_unavailable}
                loading={downloading}
                disabled={!mediaUrls.length}
                onPress={handleDownload}
              />

              {!!currentUserId && !isOwnPost && !post.isAnnouncement && (
                <>
                  <View style={s.divider} />
                  <OptionRow
                    icon="ban"
                    label={t.feed_block_profile}
                    danger
                    loading={blocking}
                    onPress={handleBlockProfile}
                  />
                </>
              )}

              {hasOwnerActions && (
                <>
                  <View style={s.sectionBreak} />
                  <Text style={s.sectionLabel}>{t.feed_manage_post}</Text>
                  {!!onEdited && (
                    <OptionRow
                      icon="edit"
                      label={t.feed_edit_caption}
                      onPress={() => {
                        setShowMenu(false)
                        setEditText(post.caption ?? '')
                        setEditMode(true)
                      }}
                    />
                  )}
                  {!!onEdited && !!onDeleted && <View style={s.divider} />}
                  {!!onDeleted && (
                    <OptionRow icon="trash" label={t.delete} danger onPress={handleDelete} />
                  )}
                </>
              )}
            </View>
          </Animated.View>
        </Pressable>
      </Modal>

      <Modal
        visible={editMode}
        transparent
        animationType={reduceMotion ? 'none' : 'slide'}
        onRequestClose={() => setEditMode(false)}
      >
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
              <TouchableOpacity
                style={s.editSubmit}
                onPress={handleSaveEdit}
                activeOpacity={0.85}
                accessibilityRole="button"
                accessibilityLabel={t.save}
              >
                <Icon name="send" size={19} strokeWidth={2.2} color="#fff" />
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
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.45,
    shadowRadius: 2,
  },
  triggerRail: {
    width: 64,
    height: 53,
    borderRadius: 0,
    justifyContent: 'flex-start',
    gap: 2,
  },
  triggerIconStage: {
    width: 34,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
  },
  triggerIconStageRail: {
    width: 44,
    height: 36,
  },
  triggerMetricSlot: { height: 15 },
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    paddingHorizontal: 10,
    backgroundColor: 'rgba(0,0,0,0.28)',
  },
  sheet: {
    width: '100%',
    maxWidth: 430,
    alignSelf: 'center',
    paddingHorizontal: 12,
    paddingTop: 9,
    paddingBottom: 12,
    borderRadius: 26,
    backgroundColor: '#FCFCFA',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.16,
    shadowRadius: 24,
    elevation: 18,
  },
  grabber: {
    width: 34,
    height: 3,
    borderRadius: 2,
    alignSelf: 'center',
    backgroundColor: '#D5D5D1',
  },
  sheetHeader: {
    minHeight: 48,
    paddingHorizontal: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sheetTitle: {
    color: colors.gray800,
    fontFamily: fonts.bold,
    fontSize: 17,
    letterSpacing: -0.35,
  },
  sheetSignal: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  sheetSignalLine: { width: 16, height: 2, borderRadius: 1, backgroundColor: colors.primary },
  sheetSignalDot: { width: 3, height: 3, borderRadius: 2, backgroundColor: colors.primary },
  optionList: {
    overflow: 'hidden',
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#E1E1DD',
    backgroundColor: '#FFFFFF',
  },
  optionRow: {
    minHeight: 58,
    paddingHorizontal: 13,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  optionDisabled: { opacity: 0.42 },
  optionIcon: {
    width: 34,
    height: 34,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F4F4F1',
  },
  optionLabel: {
    flex: 1,
    color: colors.gray800,
    fontFamily: fonts.semiBold,
    fontSize: 14.5,
    letterSpacing: -0.16,
  },
  optionLabelDanger: { color: colors.error },
  selectedSignal: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  selectedLine: { width: 13, height: 2, borderRadius: 1, backgroundColor: colors.primary },
  selectedDot: { width: 3, height: 3, borderRadius: 2, backgroundColor: colors.primary },
  divider: {
    height: StyleSheet.hairlineWidth,
    marginLeft: 59,
    backgroundColor: '#E7E7E3',
  },
  sectionBreak: { height: 9, backgroundColor: '#F3F3F0' },
  sectionLabel: {
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 3,
    color: colors.gray500,
    fontFamily: fonts.bold,
    fontSize: 9.5,
    letterSpacing: 1.1,
    textTransform: 'uppercase',
  },
  editOverlay: { flex: 1, justifyContent: 'flex-end' },
  editBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.38)' },
  editSheet: {
    paddingHorizontal: 16,
    paddingTop: 10,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    backgroundColor: colors.white,
  },
  editGrabber: {
    width: 38,
    height: 4,
    marginBottom: 14,
    borderRadius: 2,
    alignSelf: 'center',
    backgroundColor: colors.gray200,
  },
  editRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 10 },
  editInput: {
    flex: 1,
    minHeight: 44,
    maxHeight: 120,
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderRadius: 16,
    backgroundColor: '#F4F4F6',
    color: colors.gray800,
    fontFamily: fonts.regular,
    fontSize: 15,
  },
  editSubmit: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
  },
})
