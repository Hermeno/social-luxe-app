import React, { useEffect, useMemo, useRef, useState } from 'react'
import {
  ActivityIndicator, Animated, Easing, Modal, Pressable,
  StyleSheet, Text, TextInput, TouchableOpacity, View,
  useWindowDimensions,
} from 'react-native'
// O KeyboardAvoidingView do React Native falha em edge-to-edge e, no Android,
// não faz nada sem `behavior`. Este lê o inset real do teclado (WindowInsets
// IME) através do KeyboardProvider que envolve a app — é o mesmo que a folha
// de comentários já usa.
import { KeyboardAvoidingView, useKeyboardState } from 'react-native-keyboard-controller'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import FeedIcon from '../../components/FeedIcon'
import Icon, { type IconName } from '../../components/Icon'
import PostActionIcon from '../../components/PostActionIcon'
import { feedIcon, feedInk, feedRail } from './tokens'
import { confirm } from '../../components/confirm'
import { API_BASE } from '../../config'
import { deleteCachedPostsByUser } from '../../db/database'
import useReducedMotionPreference from '../../hooks/useReducedMotionPreference'
import { useT } from '../../i18n'
import { blockUser } from '../../services/block.service'
import { muteUser, type MuteDuration } from '../../services/mute.service'
import { isPostSaved, toggleSavedPost } from '../../services/savedPost.service'
import { useAuthStore } from '../../store/auth.store'
import { colors, fonts, leading, radius, sheet, spacing, typography } from '../../theme'
import { Post } from '../../types'
import { saveMediaListToGallery } from '../../utils/download'
import { toast } from '../../utils/toast'

interface Props {
  post: Post
  onDeleted?: (id: string) => void
  onEdited?: (id: string, caption: string) => void
  onProfileBlocked?: (userId: string) => void
  onAuthorMuted?: (userId: string) => void
  onBlockingChange?: (open: boolean) => void
  rail?: boolean
  triggerSize?: number
  /** Tinta do gatilho; branca sobre mídia, escura sobre superfícies claras. */
  triggerColor?: string
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

/**
 * Mantém o Modal montado até a superfície terminar de sair.
 *
 * O `animationType="fade"` nativo anexava/desanexava a janela inteira e o cartão
 * branco parecia piscar. Aqui a janela fica imóvel: só o backdrop ganha opacidade
 * e só a folha se desloca no eixo Y.
 */
function useSheetMotion(visible: boolean, reduceMotion: boolean) {
  const { height: windowHeight } = useWindowDimensions()
  const [mounted, setMounted] = useState(visible)
  const progress = useRef(new Animated.Value(visible ? 1 : 0)).current

  useEffect(() => {
    if (visible && !mounted) setMounted(true)
  }, [mounted, visible])

  useEffect(() => {
    if (!mounted) return
    progress.stopAnimation()

    if (reduceMotion) {
      progress.setValue(visible ? 1 : 0)
      if (!visible) setMounted(false)
      return
    }

    const animation = visible
      ? Animated.spring(progress, {
          toValue: 1,
          damping: 26,
          stiffness: 240,
          mass: 0.9,
          useNativeDriver: true,
        })
      : Animated.timing(progress, {
          toValue: 0,
          duration: 230,
          easing: Easing.in(Easing.cubic),
          useNativeDriver: true,
        })

    animation.start(({ finished }) => {
      if (finished && !visible) setMounted(false)
    })
  }, [mounted, progress, reduceMotion, visible])

  useEffect(() => () => progress.stopAnimation(), [progress])

  return {
    mounted,
    backdropOpacity: progress,
    translateY: progress.interpolate({
      inputRange: [0, 1],
      outputRange: [windowHeight, 0],
      extrapolate: 'clamp',
    }),
  }
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
          <FeedIcon name="bookmark" size={feedIcon.control} color={color} />
        ) : (
          <Icon name={icon} size={feedIcon.control} color={color} fill="none" />
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
  post, onDeleted, onEdited, onProfileBlocked, onAuthorMuted, onBlockingChange,
  rail = false, triggerSize = 25, triggerColor = '#fff',
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
  const [showMuteChoices, setShowMuteChoices] = useState(false)
  const [muting, setMuting] = useState<MuteDuration | null>(null)

  // O campo já não precisa da área segura do fundo quando o teclado a cobre.
  const keyboardOpen = useKeyboardState().isVisible

  const menuMotion = useSheetMotion(showMenu, reduceMotion)
  const muteMotion = useSheetMotion(showMuteChoices, reduceMotion)
  const editMotion = useSheetMotion(editMode, reduceMotion)

  const mediaUrls = useMemo(() => {
    if (post.mediaType === 'TEXT') return []
    const source = post.mediaUrls?.length ? post.mediaUrls : [post.mediaUrl]
    return source.filter((url): url is string => !!url).map(resolveMedia)
  }, [post.mediaType, post.mediaUrl, post.mediaUrls])

  useEffect(() => {
    onBlockingChange?.(
      menuMotion.mounted
      || muteMotion.mounted
      || editMotion.mounted
      || confirming
      || blocking
      || !!muting,
    )
    // A identidade do callback não representa uma mudança de bloqueio.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [blocking, confirming, editMotion.mounted, menuMotion.mounted, muteMotion.mounted, muting])

  useEffect(() => {
    let active = true
    setShowMenu(false)
    setShowMuteChoices(false)
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

  async function handleMuteAuthor(duration: MuteDuration) {
    if (!currentUserId || isOwnPost || post.isAnnouncement || muting) return
    setMuting(duration)
    try {
      await muteUser(post.user.id, duration)
      await deleteCachedPostsByUser(post.user.id).catch(() => {})
      setShowMuteChoices(false)
      onAuthorMuted?.(post.user.id)
      toast.success(
        t.feed_mute_done_title,
        (duration === 'ONE_MONTH' ? t.feed_mute_month_done : t.feed_mute_forever_done)
          .replace('{name}', post.user.name),
      )
    } catch {
      toast.error(t.error, t.feed_mute_fail)
    } finally {
      setMuting(null)
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
        // Na rail, a caixa já mede 64×54. Aumentá-la mais 9pt invadia os
        // alvos vizinhos e fazia duas acções disputarem o mesmo toque.
        hitSlop={rail ? undefined : { top: 9, bottom: 9, left: 9, right: 9 }}
        accessibilityRole="button"
        accessibilityLabel={t.feed_options_title}
      >
        <View style={[
          s.triggerIconStage,
          rail && s.triggerIconStageRail,
        ]}>
          <PostActionIcon
            name="options"
            size={triggerSize}
            color={triggerColor}
          />
        </View>
        {rail && <View style={s.triggerMetricSlot} pointerEvents="none" />}
      </TouchableOpacity>

      <Modal
        visible={menuMotion.mounted}
        transparent
        statusBarTranslucent
        animationType="none"
        onRequestClose={() => setShowMenu(false)}
      >
        <View style={[s.backdrop, { paddingBottom: Math.max(safeBottom, 12) }]}>
          <Animated.View style={[s.backdropShade, { opacity: menuMotion.backdropOpacity }]}>
            <Pressable style={StyleSheet.absoluteFill} onPress={() => setShowMenu(false)} accessible={false} />
          </Animated.View>
          <Animated.View
            style={[s.sheet, { transform: [{ translateY: menuMotion.translateY }] }]}
            onStartShouldSetResponder={() => true}
            accessibilityViewIsModal
            importantForAccessibility="yes"
            renderToHardwareTextureAndroid
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
                    icon="eye"
                    label={t.feed_mute_posts}
                    onPress={() => {
                      setShowMenu(false)
                      setShowMuteChoices(true)
                    }}
                  />
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
        </View>
      </Modal>

      <Modal
        visible={muteMotion.mounted}
        transparent
        statusBarTranslucent
        animationType="none"
        onRequestClose={() => { if (!muting) setShowMuteChoices(false) }}
      >
        <View style={[s.backdrop, { paddingBottom: Math.max(safeBottom, 12) }]}>
          <Animated.View style={[s.backdropShade, { opacity: muteMotion.backdropOpacity }]}>
            <Pressable
              style={StyleSheet.absoluteFill}
              onPress={() => { if (!muting) setShowMuteChoices(false) }}
              accessible={false}
            />
          </Animated.View>
          <Animated.View
            style={[s.sheet, { transform: [{ translateY: muteMotion.translateY }] }]}
            onStartShouldSetResponder={() => true}
            accessibilityViewIsModal
            importantForAccessibility="yes"
            renderToHardwareTextureAndroid
          >
            <View style={s.grabber} />
            <View style={s.sheetHeader}>
              <Text style={s.sheetTitle} numberOfLines={2}>
                {t.feed_mute_title.replace('{name}', post.user.name)}
              </Text>
              <View style={s.sheetSignal} pointerEvents="none">
                <View style={s.sheetSignalLine} />
                <View style={s.sheetSignalDot} />
              </View>
            </View>
            <Text style={s.muteDescription}>{t.feed_mute_description}</Text>
            <View style={s.optionList}>
              <OptionRow
                icon="hourglass"
                label={t.feed_mute_one_month}
                loading={muting === 'ONE_MONTH'}
                disabled={!!muting && muting !== 'ONE_MONTH'}
                onPress={() => handleMuteAuthor('ONE_MONTH')}
              />
              <View style={s.divider} />
              <OptionRow
                icon="eye"
                label={t.feed_mute_forever}
                loading={muting === 'FOREVER'}
                disabled={!!muting && muting !== 'FOREVER'}
                onPress={() => handleMuteAuthor('FOREVER')}
              />
            </View>
            <TouchableOpacity
              style={s.muteCancel}
              onPress={() => setShowMuteChoices(false)}
              disabled={!!muting}
              activeOpacity={0.75}
              accessibilityRole="button"
              accessibilityLabel={t.cancel}
            >
              <Text style={s.muteCancelText}>{t.cancel}</Text>
            </TouchableOpacity>
          </Animated.View>
        </View>
      </Modal>

      <Modal
        visible={editMotion.mounted}
        transparent
        statusBarTranslucent
        animationType="none"
        onRequestClose={() => setEditMode(false)}
      >
        <KeyboardAvoidingView style={s.editOverlay} behavior="padding">
          <Animated.View style={[s.editBackdrop, { opacity: editMotion.backdropOpacity }]}>
            <Pressable style={StyleSheet.absoluteFill} onPress={() => setEditMode(false)} accessible={false} />
          </Animated.View>
          <Animated.View
            style={[
              s.editSheet,
              {
                paddingBottom: keyboardOpen ? 14 : Math.max(safeBottom, 14),
                transform: [{ translateY: editMotion.translateY }],
              },
            ]}
            renderToHardwareTextureAndroid
          >
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
                <Icon name="send" size={feedIcon.control} color={feedInk.primary} />
              </TouchableOpacity>
            </View>
          </Animated.View>
        </KeyboardAvoidingView>
      </Modal>
    </>
  )
}

const s = StyleSheet.create({
  trigger: {
    width: 34,
    height: 34,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.38,
    shadowRadius: 1.8,
  },
  triggerRail: {
    width: feedRail.width,
    height: feedRail.itemHeight,
    borderRadius: 0,
    justifyContent: 'center',
    gap: feedRail.iconToMetricGap,
  },
  triggerIconStage: {
    width: 34,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
  },
  triggerIconStageRail: {
    width: feedRail.iconStageWidth,
    height: feedRail.iconStageHeight,
  },
  triggerMetricSlot: { height: feedRail.metricSlotHeight },
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    paddingHorizontal: spacing.sm2,
  },
  backdropShade: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.28)',
  },
  sheet: {
    width: '100%',
    maxWidth: 430,
    alignSelf: 'center',
    paddingHorizontal: spacing.sm2,
    paddingTop: spacing.sm2,
    paddingBottom: spacing.sm2,
    borderRadius: radius.xl,
    backgroundColor: sheet.surface,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.16,
    shadowRadius: 24,
    elevation: 18,
  },
  grabber: {
    width: 34,
    height: 3,
    borderRadius: radius.full,
    alignSelf: 'center',
    backgroundColor: sheet.lineStrong,
  },
  sheetHeader: {
    minHeight: 48,
    paddingHorizontal: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sheetTitle: {
    color: colors.gray800,
    fontFamily: fonts.regular,
    fontSize: typography.section,
    lineHeight: leading.section,
    letterSpacing: -0.35,
  },
  sheetSignal: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  sheetSignalLine: { width: 16, height: 2, borderRadius: radius.full, backgroundColor: colors.primary },
  sheetSignalDot: { width: 3, height: 3, borderRadius: radius.full, backgroundColor: colors.primary },
  optionList: {
    overflow: 'hidden',
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: sheet.line,
    backgroundColor: colors.white,
  },
  optionRow: {
    minHeight: 58,
    paddingHorizontal: spacing.sm2,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm2,
  },
  optionDisabled: { opacity: 0.42 },
  optionIcon: {
    width: 34,
    height: 34,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: sheet.surfaceSunk,
  },
  optionLabel: {
    flex: 1,
    color: colors.gray800,
    fontFamily: fonts.regular,
    fontSize: typography.body,
    lineHeight: leading.body,
    letterSpacing: -0.16,
  },
  optionLabelDanger: { color: colors.error },
  selectedSignal: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  selectedLine: { width: 13, height: 2, borderRadius: radius.full, backgroundColor: colors.primary },
  selectedDot: { width: 3, height: 3, borderRadius: radius.full, backgroundColor: colors.primary },
  divider: {
    height: StyleSheet.hairlineWidth,
    marginLeft: 59,
    backgroundColor: sheet.line,
  },
  sectionBreak: { height: spacing.sm, backgroundColor: sheet.surfaceSunk },
  sectionLabel: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm2,
    paddingBottom: spacing.xs,
    color: colors.gray500,
    fontFamily: fonts.regular,
    fontSize: typography.meta,
    lineHeight: leading.meta,
    letterSpacing: 1.1,
    textTransform: 'uppercase',
  },
  muteDescription: {
    marginTop: -2,
    marginBottom: spacing.sm2,
    paddingHorizontal: spacing.sm,
    color: colors.gray500,
    fontFamily: fonts.regular,
    fontSize: typography.secondary,
    lineHeight: leading.secondary,
  },
  muteCancel: {
    minHeight: 48,
    marginTop: spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.lg,
    backgroundColor: sheet.surfaceSunk,
  },
  muteCancelText: {
    color: colors.gray600,
    fontFamily: fonts.regular,
    fontSize: typography.body,
    lineHeight: leading.body,
  },
  editOverlay: { flex: 1, justifyContent: 'flex-end' },
  editBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.38)' },
  editSheet: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm2,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    backgroundColor: colors.white,
  },
  editGrabber: {
    width: 38,
    height: 4,
    marginBottom: spacing.md,
    borderRadius: radius.full,
    alignSelf: 'center',
    backgroundColor: colors.gray200,
  },
  editRow: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.sm2 },
  editInput: {
    flex: 1,
    minHeight: 44,
    maxHeight: 120,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm2,
    borderRadius: radius.lg,
    backgroundColor: sheet.surfaceSunk,
    color: colors.gray800,
    fontFamily: fonts.regular,
    fontSize: typography.body,
    lineHeight: leading.body,
  },
  editSubmit: {
    width: 44,
    height: 44,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
  },
})
