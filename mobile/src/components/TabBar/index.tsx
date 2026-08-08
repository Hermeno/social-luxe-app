import React, { useRef, useEffect } from 'react'
import { View, TouchableOpacity, StyleSheet, Text, Animated } from 'react-native'
import { BottomTabBarProps } from '@react-navigation/bottom-tabs'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Home, MessageCircle, User } from 'lucide-react-native'
import { colors, fonts } from '../../theme'
import { useFeedStore } from '../../store/feed.store'
import { useAuthStore } from '../../store/auth.store'
import { useMessageBadgeStore } from '../../store/messageBadge.store'
import { useMessagesStore } from '../../store/messages.store'
import { useOverlayStore } from '../../store/overlay.store'
import { useT } from '../../i18n'
import AvatarImage from '../AvatarImage'
import Icon from '../Icon'
import { TAB_BAR_ROW_HEIGHT, TAB_BAR_TOP_GAP, tabBarBottomInset } from './layout'

const SZ = 24

function MessageBadge({ count, icon }: { count: number; icon?: boolean }) {
  const scale  = useRef(new Animated.Value(0)).current
  const wobble = useRef(new Animated.Value(0)).current
  const prev   = useRef(0)

  useEffect(() => {
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
  }, [count])

  if (count === 0) return null

  const label = count > 99 ? '99+' : String(count)

  return (
    <Animated.View
      style={[
        s.badgeAnchor,
        { transform: [{ scale }, { translateX: wobble }] },
      ]}
    >
      {/* Pill bubble */}
      <View style={s.badgePill}>
        {icon && (
          <View style={s.badgeIcon}>
            <MessageCircle size={11} strokeWidth={2.6} color="#fff" fill="#fff" />
          </View>
        )}
        <Text style={s.badgeTxt}>{label}</Text>
      </View>
      {/* Downward-pointing triangle tip */}
      <View style={s.badgeTip} />
    </Animated.View>
  )
}

export default function TabBar({ state, navigation }: BottomTabBarProps) {
  const { bottom }    = useSafeAreaInsets()
  const t             = useT()
  const overlayOpen   = useOverlayStore((s) => s.count > 0)
  const newPostsCount = useFeedStore((s) => s.newPostsCount)
  const totalUnread   = useMessageBadgeStore((s) => s.totalUnread)
  const openSearch    = useFeedStore((s) => s.openSearch)
  const bumpHomeTap   = useFeedStore((s) => s.bumpHomeTap)
  const commentTarget = useFeedStore((s) => s.activeCommentTarget)
  const requestComments = useFeedStore((s) => s.requestComments)
  const requestSuggestions = useMessagesStore((s) => s.requestSuggestions)
  const currentUser   = useAuthStore((s) => s.user)
  const avatar        = currentUser?.avatar ?? null

  const activeTab  = state.routes[state.index].name
  const onFeed     = activeTab === 'Feed'
  const onMessages = activeTab === 'Messages'
  const iconActive = onFeed ? '#ffffff' : colors.black
  const iconInactv = onFeed ? 'rgba(255,255,255,0.5)' : colors.gray400

  function goTo(tab: string) {
    const route = state.routes.find((r) => r.name === tab)
    if (!route) return
    const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true })
    if (!event.defaultPrevented) navigation.navigate(tab)
  }

  // Uma folha modal aberta manda na barra: sem isto ela pinta por cima da folha
  // e, no Android, sobe com o teclado até tapar o botão de enviar.
  if (overlayOpen) return null

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

  return (
    <View style={s.root}>
      <View style={[s.bar, { paddingBottom: tabBarBottomInset(bottom) }]}>

        {/* Espaço partilhado: comentar (feed) ou sugestões (chat). */}
        <View style={s.commentSlot}>
          {onFeed && (
            <TouchableOpacity
              style={[s.commentField, !commentTarget && s.commentFieldDisabled]}
              onPress={() => commentTarget && requestComments(commentTarget.postId)}
              activeOpacity={0.78}
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
            </TouchableOpacity>
          )}

          {/* No chat, o mesmo espaço abre a folha de sugestões. */}
          {onMessages && (
            <TouchableOpacity
              style={s.suggestField}
              onPress={requestSuggestions}
              activeOpacity={0.78}
              accessibilityRole="button"
              accessibilityLabel={t.nav_suggestions}
            >
              <Icon name="user-plus" size={18} color={colors.gray800} strokeWidth={1.9} />
              <Text style={s.suggestText} numberOfLines={1}>{t.nav_suggestions}</Text>
            </TouchableOpacity>
          )}
        </View>

        <View style={s.navActions}>

          {/* Home → Feed. Tocar já no feed refresca (como as apps grandes). */}
          <TouchableOpacity
            style={s.btn}
            onPress={() => (activeTab === 'Feed' ? bumpHomeTap() : goTo('Feed'))}
            activeOpacity={0.7}
            accessibilityRole="tab"
            accessibilityLabel={t.nav_home}
            accessibilityValue={newPostValue ? { text: newPostValue } : undefined}
            accessibilityState={{ selected: homeActive }}
          >
            <MessageBadge count={newPostsCount} />
            <Home
              size={SZ}
              strokeWidth={homeActive ? 2.5 : 2}
              color={homeActive ? iconActive : iconInactv}
              fill={homeActive ? iconActive : 'transparent'}
            />
          </TouchableOpacity>

          {/* Messages — badge com total de mensagens não lidas */}
          <TouchableOpacity
            style={s.btn}
            onPress={() => goTo('Messages')}
            activeOpacity={0.7}
            accessibilityRole="tab"
            accessibilityLabel={t.nav_chat}
            accessibilityValue={unreadValue ? { text: unreadValue } : undefined}
            accessibilityState={{ selected: msgActive }}
          >
            <MessageBadge count={totalUnread} icon />
            <View style={s.mirrorX}>
              <MessageCircle
                size={SZ}
                strokeWidth={msgActive ? 2.5 : 2}
                color={msgActive ? iconActive : iconInactv}
                fill={msgActive ? iconActive : 'transparent'}
              />
            </View>
          </TouchableOpacity>

          {/* Profile */}
          <TouchableOpacity
            style={s.btn}
            onPress={() => goTo('Profile')}
            activeOpacity={0.7}
            accessibilityRole="tab"
            accessibilityLabel={t.nav_profile}
            accessibilityState={{ selected: profActive }}
          >
            {avatar ? (
              <View style={[s.avatar, profActive && s.avatarActive]}>
                <AvatarImage uri={avatar} name={currentUser?.name} size={SZ} />
              </View>
            ) : (
              <User
                size={SZ}
                strokeWidth={profActive ? 2.5 : 2}
                color={profActive ? iconActive : iconInactv}
                fill={profActive ? iconActive : 'transparent'}
              />
            )}
          </TouchableOpacity>

        </View>
      </View>
    </View>
  )
}

const PILL_BG = colors.primary

const s = StyleSheet.create({
  root: {
    position: 'absolute',
    bottom: 0, left: 0, right: 0,
  },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: TAB_BAR_TOP_GAP,
    paddingHorizontal: 10,
  },
  commentSlot: {
    // 5:4 contra `navActions` — o campo ganha largura sem apertar os três
    // separadores abaixo do alvo de toque confortável.
    flex: 5,
    height: TAB_BAR_ROW_HEIGHT,
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  commentField: {
    height: TAB_BAR_ROW_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 8,
    borderRadius: TAB_BAR_ROW_HEIGHT / 2,
    backgroundColor: colors.commentField,
  },
  commentFieldDisabled: { opacity: 0.58 },
  // No chat o fundo é branco: a pílula inverte-se para ficar legível.
  suggestField: {
    height: TAB_BAR_ROW_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    borderRadius: TAB_BAR_ROW_HEIGHT / 2,
    backgroundColor: colors.gray100,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.gray200,
  },
  suggestText: {
    flex: 1,
    color: colors.gray800,
    fontFamily: fonts.semiBold,
    fontSize: 13.5,
    letterSpacing: -0.15,
  },
  commentText: {
    flex: 1,
    color: 'rgba(255,255,255,0.64)',
    fontFamily: fonts.medium,
    fontSize: 13.5,
    letterSpacing: -0.15,
  },
  navActions: {
    flex: 4,
    height: TAB_BAR_ROW_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
  },
  btn: {
    flex: 1,
    height: TAB_BAR_ROW_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'visible',
  },
  mirrorX: { transform: [{ scaleX: -1 }] },
  badgeIcon: { marginRight: 5, transform: [{ scaleX: -1 }] },

  // Badge — positioned above the icon, centered on the btn
  badgeAnchor: {
    position: 'absolute',
    top: -14,
    left: 0, right: 0,
    alignItems: 'center',
  },
  badgePill: {
    backgroundColor: PILL_BG,
    borderRadius: 8,
    paddingHorizontal: 11,
    paddingVertical: 3,
    minWidth: 26,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeTxt: {
    color: '#fff',
    fontSize: 11,
    fontFamily: fonts.bold,
    lineHeight: 16,
    includeFontPadding: false,
    letterSpacing: 0.2,
  },
  // Downward triangle connecting pill to icon
  badgeTip: {
    width: 0,
    height: 0,
    borderLeftWidth: 5,
    borderRightWidth: 5,
    borderTopWidth: 6,
    borderStyle: 'solid',
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderTopColor: PILL_BG,
  },

  avatar: {
    width: SZ,
    height: SZ,
    borderRadius: SZ / 2,
  },
  avatarActive: {
    shadowColor: colors.primary,
    shadowOpacity: 0.9,
    shadowRadius: 4,
    elevation: 3,
  },
})
