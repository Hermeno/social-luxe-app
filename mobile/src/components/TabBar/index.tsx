import React, { useRef, useEffect, useMemo, useState } from 'react'
import { View, TouchableOpacity, StyleSheet, Text, Animated, Easing } from 'react-native'
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import FeedIcon from '../FeedIcon'
import { colors, fonts, radius, typography } from '../../theme'
import { useFeedStore } from '../../store/feed.store'
import { useAuthStore } from '../../store/auth.store'
import { useMessageBadgeStore } from '../../store/messageBadge.store'
import { useMessagesStore } from '../../store/messages.store'
import { useProfileUiStore } from '../../store/profileUi.store'
import { type SocialPreviewUser, useSocialPreviewStore } from '../../store/socialPreview.store'
import { useOverlayStore } from '../../store/overlay.store'
import { useT } from '../../i18n'
import AvatarImage from '../AvatarImage'
import Icon from '../Icon'
import {
  FEED_COMPOSER_HEIGHT,
  TAB_BAR_ROW_HEIGHT,
  TAB_BAR_TOP_GAP,
  tabBarBottomInset,
} from './layout'
import useReducedMotionPreference from '../../hooks/useReducedMotionPreference'

// O mesmo tamanho da coluna de acções do post (`DEFAULT_RAIL_ICON_SIZE`), para
// os dois conjuntos de ícones da feed se lerem como um só sistema.
const SZ = 27

function mergePreview(...groups: SocialPreviewUser[][]): SocialPreviewUser[] {
  const seen = new Set<string>()
  const merged: SocialPreviewUser[] = []
  groups.flat().forEach((user) => {
    if (!user?.id || seen.has(user.id)) return
    seen.add(user.id)
    merged.push(user)
  })
  return merged.slice(0, 5)
}

function SocialAvatarStack({ users }: { users: SocialPreviewUser[] }) {
  return (
    <View style={s.socialStack} pointerEvents="none" importantForAccessibility="no-hide-descendants">
      {Array.from({ length: 5 }, (_, index) => {
        const user = users[index]
        return (
          <View
            key={user?.id ?? `preview-slot-${index}`}
            style={[
              s.socialAvatarSlot,
              index > 0 && s.socialAvatarOverlap,
              { zIndex: 5 - index },
              s.socialAvatarSlotLight,
            ]}
          >
            {user ? (
              <AvatarImage uri={user.avatar} name={user.name} size={22} />
            ) : (
              <View style={s.socialAvatarPlaceholder}>
                <Icon name="user" size={11} color="#AAA9A4" strokeWidth={1.7} />
              </View>
            )}
          </View>
        )
      })}
    </View>
  )
}

function MotionTabButton({
  children, selected, onPress, label, valueText,
  pulseSignal = 0, reduceMotion, role = 'tab',
}: {
  children: React.ReactNode
  selected: boolean
  onPress: () => void
  label: string
  valueText?: string
  pulseSignal?: number
  reduceMotion: boolean
  role?: 'tab' | 'button'
}) {
  const scale = useRef(new Animated.Value(1)).current
  const pulse = useRef(new Animated.Value(0)).current
  const mounted = useRef(false)

  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true
      return
    }
    if (reduceMotion) {
      scale.stopAnimation()
      scale.setValue(1)
      return
    }
    if (!selected) return
    scale.setValue(0.9)
    Animated.spring(scale, { toValue: 1, speed: 26, bounciness: 10, useNativeDriver: true }).start()
  }, [reduceMotion, scale, selected])

  useEffect(() => {
    if (reduceMotion) {
      pulse.stopAnimation()
      pulse.setValue(0)
      return
    }
    if (pulseSignal === 0) return
    pulse.setValue(0)
    Animated.timing(pulse, { toValue: 1, duration: 520, useNativeDriver: true }).start()
  }, [pulse, pulseSignal, reduceMotion])

  function pressIn() {
    if (reduceMotion) return
    Animated.spring(scale, { toValue: 0.88, speed: 42, bounciness: 3, useNativeDriver: true }).start()
  }

  function pressOut() {
    if (reduceMotion) return
    Animated.spring(scale, { toValue: 1, speed: 25, bounciness: 8, useNativeDriver: true }).start()
  }

  return (
    <TouchableOpacity
      style={s.btn}
      onPress={onPress}
      onPressIn={pressIn}
      onPressOut={pressOut}
      activeOpacity={1}
      accessibilityRole={role}
      accessibilityLabel={label}
      accessibilityValue={valueText ? { text: valueText } : undefined}
      accessibilityState={role === 'tab' ? { selected } : undefined}
    >
      <Animated.View
        style={[
          s.navIconMotion,
          {
            opacity: pulse.interpolate({ inputRange: [0, 0.42, 1], outputRange: [1, 0.78, 1] }),
            transform: [
              { scale },
              { scale: pulse.interpolate({ inputRange: [0, 0.42, 1], outputRange: [1, 1.08, 1] }) },
            ],
          },
        ]}
      >
        {children}
      </Animated.View>
    </TouchableOpacity>
  )
}

function MessageBadge({
  count, reduceMotion,
}: {
  count: number
  reduceMotion: boolean
}) {
  const scale  = useRef(new Animated.Value(0)).current
  const wobble = useRef(new Animated.Value(0)).current
  const prev   = useRef(0)

  useEffect(() => {
    if (reduceMotion) {
      scale.stopAnimation()
      wobble.stopAnimation()
      scale.setValue(count > 0 ? 1 : 0)
      wobble.setValue(0)
      prev.current = count
      return
    }
    if (count > 0 && prev.current === 0) {
      // First appearance — spring pop-in
      Animated.spring(scale, {
        toValue: 1,
        tension: 260,
        friction: 7,
        useNativeDriver: true,
      }).start()
    } else if (count > prev.current && count > 0) {
      // New message arrived — quick wiggle
      Animated.sequence([
        Animated.timing(wobble, { toValue:  4, duration: 60, useNativeDriver: true }),
        Animated.timing(wobble, { toValue: -4, duration: 60, useNativeDriver: true }),
        Animated.timing(wobble, { toValue:  2, duration: 50, useNativeDriver: true }),
        Animated.timing(wobble, { toValue:  0, duration: 50, useNativeDriver: true }),
      ]).start()
    } else if (count === 0) {
      scale.setValue(0)
    }
    prev.current = count
  }, [count, reduceMotion, scale, wobble])

  if (count === 0) return null

  const label = count > 99 ? '99+' : String(count)

  return (
    <Animated.View
      style={[
        s.badgeAnchor,
        { transform: [{ scale }, { translateX: wobble }] },
      ]}
    >
      <View style={s.badgeCounter}>
        <Text style={s.badgeTxt}>{label}</Text>
      </View>
    </Animated.View>
  )
}

export default function TabBar({ state, navigation }: BottomTabBarProps) {
  const { bottom }    = useSafeAreaInsets()
  const t             = useT()
  const reduceMotion  = useReducedMotionPreference()
  const overlayOpen   = useOverlayStore((s) => s.count > 0)
  const newPostsCount = useFeedStore((s) => s.newPostsCount)
  const totalUnread   = useMessageBadgeStore((s) => s.totalUnread)
  const openSearch    = useFeedStore((s) => s.openSearch)
  const searchVisible = useFeedStore((s) => s.searchVisible)
  const bumpHomeTap   = useFeedStore((s) => s.bumpHomeTap)
  const homeTap       = useFeedStore((s) => s.homeTap)
  const commentTarget = useFeedStore((s) => s.activeCommentTarget)
  // Só vale na feed: nenhum outro separador recolhe a navegação.
  const immersive = useFeedStore((s) => s.immersive)
  const requestComments = useFeedStore((s) => s.requestComments)
  const clearFocusedPost = useFeedStore((s) => s.clearFocusedPost)
  const requestSuggestions = useMessagesStore((s) => s.requestSuggestions)
  const requestConnections = useProfileUiStore((s) => s.requestConnections)
  const previewFollowers = useSocialPreviewStore((s) => s.followers)
  const previewFollowing = useSocialPreviewStore((s) => s.following)
  const loadSocialPreview = useSocialPreviewStore((s) => s.load)
  const currentUser   = useAuthStore((s) => s.user)
  const avatar        = currentUser?.avatar ?? null
  const barVisibility = useRef(new Animated.Value(1)).current
  const commentScale = useRef(new Animated.Value(1)).current
  // 0 = barra normal · 1 = só o campo de comentar, de margem a margem.
  const collapse = useRef(new Animated.Value(0)).current
  // A face clicável muda apenas no fim do crossfade. Assim nunca há um
  // controlo quase invisível a receber o toque destinado ao que ainda se vê.
  const [interactiveFace, setInteractiveFace] = useState<'navigation' | 'composer'>('navigation')

  const activeRoute = state.routes[state.index]
  const activeTab  = activeRoute.name
  const onFeed     = activeTab === 'Feed'
  const onMessages = activeTab === 'Messages'
  const onCreate   = activeTab === 'Create'
  const onCircle   = activeTab === 'Circle'
  const onProfile  = activeTab === 'Profile'
  const profileUserId = onProfile
    ? (activeRoute.params as { userId?: string } | undefined)?.userId
    : undefined
  const onOwnProfile = onProfile && (!profileUserId || profileUserId === currentUser?.id)
  // O campo utilitário só existe nestes ecrãs. Sem ele a cápsula da navegação
  // abre para a largura toda, em vez de ficar encostada à direita a olhar para
  // um vazio do tamanho de si mesma.
  const hasUtilityField = onMessages || onCreate || onCircle || onOwnProfile
  // Na feed a cápsula é só o fio: o fundo é a própria feed, escura, e os ícones
  // são brancos. Nos outros ecrãs o papel é branco e os ícones voltam a escuros.
  const iconActive = onFeed ? '#FFFFFF' : colors.black
  const iconInactv = onFeed ? 'rgba(255,255,255,0.62)' : '#74757B'

  useEffect(() => {
    if (currentUser?.id) loadSocialPreview(currentUser.id).catch(() => {})
  }, [activeTab, currentUser?.id, loadSocialPreview])

  useEffect(() => {
    const target = overlayOpen ? 0 : 1
    barVisibility.stopAnimation()
    if (reduceMotion) { barVisibility.setValue(target); return }
    Animated.timing(barVisibility, { toValue: target, duration: overlayOpen ? 150 : 210, useNativeDriver: true }).start()
  }, [barVisibility, overlayOpen, reduceMotion])

  function goTo(tab: string) {
    const route = state.routes.find((r) => r.name === tab)
    if (!route) return
    const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true })
    if (!event.defaultPrevented) navigation.navigate(tab)
  }

  const homeActive   = activeTab === 'Feed' && !openSearch && !searchVisible
  const msgActive    = activeTab === 'Messages'
  const profActive   = activeTab === 'Profile'
  const commentLabel = commentTarget && commentTarget.authorId !== currentUser?.id
    ? `${t.msg_reply_to} ${commentTarget.authorName.split(' ')[0]}…`
    : t.feed_add_comment
  const newPostValue = newPostsCount > 0
    ? `${newPostsCount} ${newPostsCount === 1 ? t.nav_new_post : t.nav_new_posts}`
    : undefined
  const unreadValue = totalUnread > 0
    ? `${totalUnread} ${totalUnread === 1 ? t.nav_unread_message : t.nav_unread_messages}`
    : undefined
  const discoveryPreview = useMemo(
    () => mergePreview(previewFollowers, previewFollowing),
    [previewFollowers, previewFollowing],
  )
  const networkPreview = useMemo(
    () => mergePreview(previewFollowing, previewFollowers),
    [previewFollowing, previewFollowers],
  )

  // A Feed mantém uma stage de altura fixa: cinco controlos iguais dão lugar ao
  // compositor sem alterar a geometria reservada pela mídia e pelo scrubber.
  const collapsed = onFeed && immersive
  useEffect(() => {
    // Outra aba nunca herda um frame transparente/recolhido da Feed.
    if (!onFeed) {
      collapse.stopAnimation()
      collapse.setValue(0)
      setInteractiveFace('navigation')
      return
    }
    if (reduceMotion) {
      collapse.stopAnimation()
      collapse.setValue(collapsed ? 1 : 0)
      setInteractiveFace(collapsed ? 'composer' : 'navigation')
      return
    }
    collapse.stopAnimation()
    Animated.timing(collapse, {
      toValue: collapsed ? 1 : 0,
      duration: 220,
      easing: Easing.out(Easing.cubic),
      // A cor da barra e a margem do compositor acompanham esta transição.
      useNativeDriver: false,
    }).start(({ finished }) => {
      if (finished) setInteractiveFace(collapsed ? 'composer' : 'navigation')
    })
  }, [collapsed, collapse, onFeed, reduceMotion])

  const navigationInteractive = !onFeed || interactiveFace === 'navigation'
  const composerInteractive = onFeed && interactiveFace === 'composer'

  function animateCommentField(pressed: boolean) {
    if (reduceMotion) return
    Animated.spring(commentScale, {
      toValue: pressed ? 0.975 : 1,
      speed: pressed ? 38 : 24,
      bounciness: pressed ? 2 : 7,
      useNativeDriver: true,
    }).start()
  }

  useEffect(() => {
    if (!reduceMotion) return
    commentScale.stopAnimation()
    commentScale.setValue(1)
  }, [commentScale, reduceMotion])

  function openSuggestions() {
    // Só pede. Chat, Create e Círculo renderizam a folha cada um no seu ecrã —
    // antes isto saltava para o Chat, o que tirava a pessoa de onde estava.
    requestSuggestions()
  }

  function openProfileConnections() {
    if (!onOwnProfile) return
    requestConnections()
  }

  // As duas acções da barra da Feed. A pesquisa não navega: levanta a bandeira
  // que o próprio ecrã atende e mantém o post atual como âncora.
  function openFeedSearch() {
    useFeedStore.getState().setOpenSearch(true)
  }

  function openCreate() {
    goTo('Create')
  }

  function goToOwnProfile() {
    const route = state.routes.find((item) => item.name === 'Profile')
    if (!route) return
    const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true })
    if (!event.defaultPrevented) {
      // Passar o parâmetro explicitamente evita que um `userId` antigo da rota
      // Profile da Tab sobreviva ao toque no ícone do próprio utilizador.
      navigation.navigate('Profile', { userId: undefined })
    }
  }

  const primaryTabs = (
    <>
      <MotionTabButton
        onPress={() => {
          if (activeTab === 'Feed') bumpHomeTap()
          else { clearFocusedPost(); goTo('Feed') }
        }}
        label={t.nav_home}
        valueText={newPostValue}
        selected={homeActive}
        pulseSignal={homeTap}
        reduceMotion={reduceMotion}
      >
        <MessageBadge count={newPostsCount} reduceMotion={reduceMotion} />
        <FeedIcon
          name={homeActive ? 'home-rounded' : 'home'}
          size={SZ}
          color={homeActive ? iconActive : iconInactv}
        />
      </MotionTabButton>

      <MotionTabButton
        onPress={() => goTo('Messages')}
        label={t.nav_chat}
        valueText={unreadValue}
        selected={msgActive}
        pulseSignal={totalUnread}
        reduceMotion={reduceMotion}
      >
        <MessageBadge count={totalUnread} reduceMotion={reduceMotion} />
        <FeedIcon
          name={msgActive ? 'chat-solid' : 'chat-outline'}
          size={SZ}
          color={msgActive ? iconActive : iconInactv}
        />
      </MotionTabButton>

      <MotionTabButton
        onPress={goToOwnProfile}
        label={t.nav_profile}
        selected={profActive}
        reduceMotion={reduceMotion}
      >
        {avatar ? (
          <View style={[s.avatar, !profActive && s.avatarInactive]}>
            <AvatarImage uri={avatar} name={currentUser?.name} size={SZ} />
          </View>
        ) : (
          <Icon
            name="user"
            size={SZ}
            strokeWidth={profActive ? 2.5 : 2}
            color={profActive ? iconActive : iconInactv}
            fill={profActive ? iconActive : 'none'}
          />
        )}
      </MotionTabButton>
    </>
  )

  return (
    <Animated.View
      style={[
        s.root,
        {
          opacity: barVisibility,
          transform: [{ translateY: barVisibility.interpolate({ inputRange: [0, 1], outputRange: [18, 0] }) }],
        },
      ]}
      pointerEvents={overlayOpen ? 'none' : 'box-none'}
      accessibilityElementsHidden={overlayOpen}
      importantForAccessibility={overlayOpen ? 'no-hide-descendants' : 'auto'}
    >
      <Animated.View
        style={[
          s.bar,
          {
            paddingBottom: tabBarBottomInset(bottom),
            paddingHorizontal: onFeed ? 0 : 14,
            // Na feed a barra não pinta nada: a cápsula flutua sobre a própria
            // feed, do primeiro ao último estado. Nos outros ecrãs o papel
            // branco continua a segurar o campo.
            backgroundColor: onFeed ? 'transparent' : '#FFFFFF',
          },
        ]}
      >
        {onFeed ? (
          <View style={s.feedStage}>
            {/* Uma única fila, cinco células iguais. Nenhum subgrupo pode
                introduzir uma largura mínima ou um intervalo diferente. */}
            <Animated.View
              style={[
                s.feedNavigationFace,
                { opacity: collapse.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }) },
              ]}
              pointerEvents={navigationInteractive ? 'auto' : 'none'}
              accessibilityElementsHidden={!navigationInteractive}
              importantForAccessibility={navigationInteractive ? 'auto' : 'no-hide-descendants'}
            >
              {/* A cápsula ocupa exactamente o rectângulo do campo de comentar:
                  mesma altura, mesmo raio, mesma margem. No crossfade lê-se como
                  um só objecto a trocar de conteúdo, não como duas barras. */}
              <View style={[s.navShell, s.navShellFeed]}>
                <MotionTabButton
                  onPress={openFeedSearch}
                  label={t.feed_top_search}
                  selected={searchVisible}
                  reduceMotion={reduceMotion}
                  role="button"
                >
                  <FeedIcon
                    name="search"
                    size={SZ}
                    color={searchVisible ? iconActive : iconInactv}
                    weight="medium"
                  />
                </MotionTabButton>

                <MotionTabButton
                  onPress={openCreate}
                  label={t.feed_create}
                  selected={false}
                  reduceMotion={reduceMotion}
                  role="button"
                >
                  <Icon name="plus" size={28} color={iconInactv} strokeWidth={1.9} />
                </MotionTabButton>

                {primaryTabs}
              </View>
            </Animated.View>

            <Animated.View
              style={[
                s.feedComposerFace,
                {
                  opacity: collapse,
                  paddingHorizontal: collapse.interpolate({ inputRange: [0, 1], outputRange: [0, 14] }),
                },
              ]}
              pointerEvents={composerInteractive ? 'auto' : 'none'}
              accessibilityElementsHidden={!composerInteractive}
              importantForAccessibility={composerInteractive ? 'auto' : 'no-hide-descendants'}
            >
              <Animated.View style={[s.composerMotion, { transform: [{ scale: commentScale }] }]}>
                <TouchableOpacity
                  style={[s.commentField, !commentTarget && s.commentFieldDisabled]}
                  onPress={() => commentTarget && requestComments(commentTarget.postId)}
                  onPressIn={() => animateCommentField(true)}
                  onPressOut={() => animateCommentField(false)}
                  activeOpacity={0.9}
                  disabled={!commentTarget}
                  accessibilityRole="button"
                  accessibilityLabel={commentLabel}
                  accessibilityState={{ disabled: !commentTarget }}
                >
                  <Text style={s.commentText} numberOfLines={1}>{commentLabel}</Text>
                </TouchableOpacity>
              </Animated.View>
            </Animated.View>
          </View>
        ) : (
          <View style={[s.navShell, s.navShellLight]}>
            {/* Fora da Feed é um campo só: os avatares, o rótulo e as três
                tabs vivem dentro da mesma borda. Dois campos encostados um ao
                outro liam-se como dois objectos; isto lê-se como um. */}
            {(onMessages || onCreate || onCircle) && (
              <Animated.View style={[s.utilityMotion, { transform: [{ scale: commentScale }] }]}>
                <TouchableOpacity
                  style={s.utilityField}
                  onPress={openSuggestions}
                  onPressIn={() => animateCommentField(true)}
                  onPressOut={() => animateCommentField(false)}
                  activeOpacity={0.9}
                  accessibilityRole="button"
                  accessibilityLabel={`${t.follow}. ${t.nav_suggestions}`}
                >
                  <SocialAvatarStack users={discoveryPreview} />
                  <Text style={s.discoveryText} numberOfLines={1}>{t.follow}</Text>
                  <Icon name="chevron-right" size={14} color={colors.gray400} strokeWidth={1.8} />
                </TouchableOpacity>
              </Animated.View>
            )}

            {onOwnProfile && (
              <Animated.View style={[s.utilityMotion, { transform: [{ scale: commentScale }] }]}>
                <TouchableOpacity
                  style={s.utilityField}
                  onPress={openProfileConnections}
                  onPressIn={() => animateCommentField(true)}
                  onPressOut={() => animateCommentField(false)}
                  activeOpacity={0.9}
                  accessibilityRole="button"
                  accessibilityLabel={t.nav_my_network}
                >
                  <SocialAvatarStack users={networkPreview} />
                  <Text style={s.networkText} numberOfLines={1}>{t.nav_my_network}</Text>
                  <Icon name="chevron-right" size={14} color={colors.gray400} strokeWidth={1.8} />
                </TouchableOpacity>
              </Animated.View>
            )}

            <View style={[s.navGroup, !hasUtilityField && s.navGroupWide]}>{primaryTabs}</View>
          </View>
        )}
      </Animated.View>
    </Animated.View>
  )
}

const s = StyleSheet.create({
  root: {
    position: 'absolute',
    bottom: 0, left: 0, right: 0,
  },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: TAB_BAR_TOP_GAP,
  },
  feedStage: {
    flex: 1,
    height: FEED_COMPOSER_HEIGHT,
    position: 'relative',
  },
  feedNavigationFace: {
    ...StyleSheet.absoluteFillObject,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
  },
  // O campo que segura a navegação: um fio, cantos totalmente redondos e nada
  // mais. Sem sombra — quem separa a barra do que está por cima é a borda.
  navShell: {
    flex: 1,
    height: '100%',
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'stretch',
    paddingHorizontal: 4,
    borderRadius: radius.full,
    borderWidth: StyleSheet.hairlineWidth,
  },
  // Na feed o campo é só contorno: o fundo é a feed que passa por baixo.
  navShellFeed: {
    backgroundColor: 'transparent',
    borderColor: 'rgba(255,255,255,0.22)',
  },
  // Fora da feed continua a ser papel branco com o fio do campo de form.
  navShellLight: {
    height: TAB_BAR_ROW_HEIGHT,
    backgroundColor: '#FFFFFF',
    borderColor: '#D8D8D3',
  },
  feedComposerFace: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // 5:4 — a mesma proporção de sempre entre o bloco social e as três tabs, só
  // que agora dentro da mesma borda em vez de dois campos encostados.
  utilityMotion: { flex: 5, minWidth: 0, alignSelf: 'stretch' },
  navGroup: { flex: 4, minWidth: 0, flexDirection: 'row', alignSelf: 'stretch' },
  navGroupWide: { flex: 1 },
  utilityField: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingLeft: 5,
    paddingRight: 10,
  },
  composerMotion: { width: '100%', height: FEED_COMPOSER_HEIGHT },
  commentField: {
    height: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 18,
    borderRadius: 999,
    backgroundColor: 'rgba(24,32,39,0.96)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.16)',
    shadowColor: '#000',
    shadowOpacity: 0.34,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 5,
  },
  commentFieldDisabled: { opacity: 0.54 },
  discoveryText: {
    flex: 1,
    color: colors.gray800,
    fontFamily: fonts.bold,
    fontSize: typography.secondary,
    letterSpacing: -0.15,
  },
  networkText: {
    flex: 1,
    color: colors.gray800,
    fontFamily: fonts.semiBold,
    fontSize: typography.meta,
    letterSpacing: -0.18,
  },
  socialStack: {
    height: 26,
    minWidth: 60,
    flexDirection: 'row',
    alignItems: 'center',
  },
  socialAvatarSlot: {
    width: 25,
    height: 25,
    borderRadius: 12.5,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderWidth: 1.5,
  },
  socialAvatarOverlap: { marginLeft: -16 },
  socialAvatarSlotLight: { borderColor: '#FFFFFF', backgroundColor: '#E9E9E5' },
  socialAvatarPlaceholder: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#E3E3DE',
  },
  commentText: {
    flex: 1,
    color: 'rgba(255,255,255,0.76)',
    fontFamily: fonts.medium,
    fontSize: typography.body,
    lineHeight: 20,
    letterSpacing: -0.24,
  },
  btn: {
    flex: 1,
    minWidth: 0,
    alignSelf: 'stretch',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'visible',
  },
  navIconMotion: {
    position: 'relative',
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },

  badgeAnchor: {
    position: 'absolute',
    top: -7,
    right: -11,
    zIndex: 2,
  },
  badgeCounter: {
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    paddingHorizontal: 4,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeTxt: {
    color: '#fff',
    fontSize: typography.badge,
    fontFamily: fonts.bold,
    lineHeight: 12,
    includeFontPadding: false,
    letterSpacing: -0.1,
  },

  avatar: {
    width: SZ,
    height: SZ,
    borderRadius: SZ / 2,
  },
  avatarInactive: { opacity: 0.58 },
})
