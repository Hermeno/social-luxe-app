import React, { useRef, useEffect, useMemo, useState } from 'react'
import { View, TouchableOpacity, StyleSheet, Text, Animated } from 'react-native'
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import FeedIcon from '../FeedIcon'
import { colors, fonts } from '../../theme'
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
import { TAB_BAR_ROW_HEIGHT, TAB_BAR_TOP_GAP, tabBarBottomInset } from './layout'
import useReducedMotionPreference from '../../hooks/useReducedMotionPreference'

const SZ = 24
const ACTIVE_MARKER_WIDTH = 24

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
  pulseSignal = 0, reduceMotion,
}: {
  children: React.ReactNode
  selected: boolean
  onPress: () => void
  label: string
  valueText?: string
  pulseSignal?: number
  reduceMotion: boolean
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
      accessibilityRole="tab"
      accessibilityLabel={label}
      accessibilityValue={valueText ? { text: valueText } : undefined}
      accessibilityState={{ selected }}
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
  const bumpHomeTap   = useFeedStore((s) => s.bumpHomeTap)
  const homeTap       = useFeedStore((s) => s.homeTap)
  const commentTarget = useFeedStore((s) => s.activeCommentTarget)
  const requestComments = useFeedStore((s) => s.requestComments)
  const clearFocusedPost = useFeedStore((s) => s.clearFocusedPost)
  const requestSuggestions = useMessagesStore((s) => s.requestSuggestions)
  const requestConnections = useProfileUiStore((s) => s.requestConnections)
  const previewFollowers = useSocialPreviewStore((s) => s.followers)
  const previewFollowing = useSocialPreviewStore((s) => s.following)
  const loadSocialPreview = useSocialPreviewStore((s) => s.load)
  const currentUser   = useAuthStore((s) => s.user)
  const avatar        = currentUser?.avatar ?? null
  const [navWidth, setNavWidth] = useState(0)
  const indicatorX = useRef(new Animated.Value(0)).current
  const indicatorOpacity = useRef(new Animated.Value(0)).current
  const barVisibility = useRef(new Animated.Value(1)).current
  const commentScale = useRef(new Animated.Value(1)).current

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
  // A nav é branca em toda a app, feed incluída — logo os ícones são sempre os
  // escuros. Eram brancos enquanto a barra acompanhava o fundo da feed.
  const iconActive = colors.black
  const iconInactv = colors.gray400

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

  const homeActive   = activeTab === 'Feed' && !openSearch
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

  const activeNavIndex = homeActive ? 0 : msgActive ? 1 : profActive ? 2 : -1
  useEffect(() => {
    if (navWidth <= 0 || activeNavIndex < 0) {
      indicatorOpacity.stopAnimation()
      indicatorOpacity.setValue(0)
      return
    }
    const buttonWidth = navWidth / 3
    const targetX = activeNavIndex * buttonWidth + (buttonWidth - ACTIVE_MARKER_WIDTH) / 2
    if (reduceMotion) {
      indicatorX.stopAnimation()
      indicatorOpacity.stopAnimation()
      indicatorX.setValue(targetX)
      indicatorOpacity.setValue(1)
      return
    }
    Animated.parallel([
      Animated.spring(indicatorX, { toValue: targetX, speed: 20, bounciness: 5, useNativeDriver: true }),
      Animated.timing(indicatorOpacity, { toValue: 1, duration: 150, useNativeDriver: true }),
    ]).start()
  }, [activeNavIndex, indicatorOpacity, indicatorX, navWidth, reduceMotion])

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
    >
      <View
        style={[
          s.bar,
          s.barLight,
          { paddingBottom: tabBarBottomInset(bottom) },
        ]}
      >

        {/* Espaço partilhado: comentar, descobrir pessoas ou abrir a rede. */}
        <View style={s.commentSlot}>
          {onFeed && (
            <Animated.View style={[s.utilityMotion, { transform: [{ scale: commentScale }] }]}>
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
                <AvatarImage
                  uri={avatar}
                  name={currentUser?.name}
                  size={27}
                  borderWidth={0}
                  borderColor="transparent"
                />
                <Text style={s.commentText} numberOfLines={1}>{commentLabel}</Text>
                <Icon name="chevron-right" size={14} color="rgba(255,255,255,0.42)" strokeWidth={1.8} />
              </TouchableOpacity>
            </Animated.View>
          )}

          {/* Create, Chat e Círculo partilham a entrada branca de descoberta. */}
          {(onMessages || onCreate || onCircle) && (
            <Animated.View style={[s.utilityMotion, { transform: [{ scale: commentScale }] }]}>
              <TouchableOpacity
                style={s.discoveryField}
                onPress={openSuggestions}
                onPressIn={() => animateCommentField(true)}
                onPressOut={() => animateCommentField(false)}
                activeOpacity={0.9}
                hitSlop={{ top: 2, bottom: 2, left: 2, right: 2 }}
                accessibilityRole="button"
                accessibilityLabel={`${t.follow}. ${t.nav_suggestions}`}
              >
                <SocialAvatarStack users={discoveryPreview} />
                <Text style={s.discoveryText} numberOfLines={1}>{t.follow}</Text>
                <Icon name="chevron-right" size={14} color={colors.gray400} strokeWidth={1.8} />
              </TouchableOpacity>
            </Animated.View>
          )}

          {/* No perfil, a pilha representa relações existentes, não sugestões. */}
          {onOwnProfile && (
            <Animated.View style={[s.utilityMotion, { transform: [{ scale: commentScale }] }]}>
              <TouchableOpacity
                style={s.networkField}
                onPress={openProfileConnections}
                onPressIn={() => animateCommentField(true)}
                onPressOut={() => animateCommentField(false)}
                activeOpacity={0.9}
                hitSlop={{ top: 2, bottom: 2, left: 2, right: 2 }}
                accessibilityRole="button"
                accessibilityLabel={t.nav_my_network}
              >
                <SocialAvatarStack users={networkPreview} />
                <Text style={s.networkText} numberOfLines={1}>{t.nav_my_network}</Text>
                <Icon name="chevron-right" size={14} color={colors.gray400} strokeWidth={1.8} />
              </TouchableOpacity>
            </Animated.View>
          )}
        </View>

        <View style={s.navActions} onLayout={(event) => setNavWidth(event.nativeEvent.layout.width)}>
          <Animated.View
            pointerEvents="none"
            style={[
              s.activeMarker,
              { opacity: indicatorOpacity, transform: [{ translateX: indicatorX }] },
            ]}
          >
            <View style={s.activeMarkerLine} />
            <View style={s.activeMarkerDot} />
          </Animated.View>

          {/* Home → Feed. Tocar já no feed refresca (como as apps grandes). */}
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
            {/* Ativo troca para o desenho sólido — nestes ícones o contorno é
                geometria, não traço, por isso não há `fill` para alternar. */}
            <FeedIcon
              name={homeActive ? 'home-rounded' : 'home'}
              size={SZ}
              color={homeActive ? iconActive : iconInactv}
            />
          </MotionTabButton>

          {/* Messages — badge com total de mensagens não lidas */}
          <MotionTabButton
            onPress={() => goTo('Messages')}
            label={t.nav_chat}
            valueText={unreadValue}
            selected={msgActive}
            pulseSignal={totalUnread}
            reduceMotion={reduceMotion}
          >
            <MessageBadge count={totalUnread} reduceMotion={reduceMotion} />
            {/* Já nasce com a cauda à direita — dispensa o espelho que aqui estava. */}
            <FeedIcon
              name={msgActive ? 'chat-solid' : 'chat-outline'}
              size={SZ}
              color={msgActive ? iconActive : iconInactv}
            />
          </MotionTabButton>

          {/* Profile */}
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
              // Não veio `user` no pacote — fica o ícone da Luxee, que já o tem.
              <Icon
                name="user"
                size={SZ}
                strokeWidth={profActive ? 2.5 : 2}
                color={profActive ? iconActive : iconInactv}
                fill={profActive ? iconActive : 'none'}
              />
            )}
          </MotionTabButton>

        </View>
      </View>
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
    paddingHorizontal: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  // Variante escura: a nav acompanhava o fundo da feed e desaparecia dentro
  // dele. Fica guardada para o caso de se querer voltar — basta repô-la no
  // `style` da barra, junto com os ícones claros.
  barFeed: {
    backgroundColor: colors.feedSurface,
    borderTopColor: 'rgba(255,255,255,0.12)',
  },
  barLight: {
    backgroundColor: '#FFFFFF',
    borderTopColor: '#E5E5E9',
  },
  commentSlot: {
    // 5:4 preserva o campo sem deixar cada tab cair abaixo de 44 px.
    flex: 5,
    minWidth: 0,
    height: TAB_BAR_ROW_HEIGHT,
    justifyContent: 'center',
    paddingRight: 8,
  },
  utilityMotion: { width: '100%', height: TAB_BAR_ROW_HEIGHT },
  commentField: {
    height: TAB_BAR_ROW_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 10,
    borderRadius: TAB_BAR_ROW_HEIGHT / 2,
    backgroundColor: colors.commentField,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#2B3946',
  },
  commentFieldDisabled: { opacity: 0.54 },
  discoveryField: {
    height: TAB_BAR_ROW_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingHorizontal: 9,
    borderRadius: TAB_BAR_ROW_HEIGHT / 2,
    backgroundColor: '#FFFFFF',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#D8D8D3',
  },
  discoveryText: {
    flex: 1,
    color: colors.gray800,
    fontFamily: fonts.bold,
    fontSize: 12.5,
    letterSpacing: -0.15,
  },
  networkField: {
    height: TAB_BAR_ROW_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingHorizontal: 9,
    borderRadius: TAB_BAR_ROW_HEIGHT / 2,
    backgroundColor: '#FFFFFF',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#D8D8D3',
  },
  networkText: {
    flex: 1,
    color: colors.gray800,
    fontFamily: fonts.semiBold,
    fontSize: 11.5,
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
    color: 'rgba(23, 17, 17, 0.64)',
    fontFamily: fonts.medium,
    fontSize: 13.5,
    letterSpacing: -0.15,
  },
  navActions: {
    flex: 4,
    minWidth: TAB_BAR_ROW_HEIGHT * 3,
    height: TAB_BAR_ROW_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    position: 'relative',
  },
  activeMarker: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    width: ACTIVE_MARKER_WIDTH,
    height: 4,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
  },
  activeMarkerLine: {
    width: 14,
    height: 2,
    borderRadius: 1,
    backgroundColor: colors.primary,
  },
  activeMarkerDot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: colors.primary,
  },
  btn: {
    flex: 1,
    minWidth: TAB_BAR_ROW_HEIGHT,
    height: TAB_BAR_ROW_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'visible',
  },
  navIconMotion: {
    position: 'relative',
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
    fontSize: 9.5,
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
