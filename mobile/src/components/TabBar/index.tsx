import React, { useRef, useEffect } from 'react'
import { View, TouchableOpacity, StyleSheet, Text, Image, Animated } from 'react-native'
import { BottomTabBarProps } from '@react-navigation/bottom-tabs'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Search, Home, MessageCircle, User, Circle, Camera } from 'lucide-react-native'
import { colors, fonts } from '../../theme'
import { useFeedStore } from '../../store/feed.store'
import { useAuthStore } from '../../store/auth.store'
import { useMessageBadgeStore } from '../../store/messageBadge.store'
import { useNotificationStore } from '../../store/notification.store'

const SZ = 24

function MessageBadge({ count, iconColor, icon }: { count: number; iconColor: string; icon?: boolean }) {
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
  const newPostsCount = useFeedStore((s) => s.newPostsCount)
  const totalUnread   = useMessageBadgeStore((s) => s.totalUnread)
  const circleInvite  = useNotificationStore((s) => s.circleInvite)
  const openSearch    = useFeedStore((s) => s.openSearch)
  const setOpenSearch = useFeedStore((s) => s.setOpenSearch)
  const avatar        = useAuthStore((s) => s.user?.avatar ?? null)

  const activeTab  = state.routes[state.index].name
  const onFeed     = activeTab === 'Feed'
  const iconActive = onFeed ? '#ffffff' : colors.black
  const iconInactv = onFeed ? 'rgba(255,255,255,0.5)' : colors.gray400

  function goTo(tab: string) {
    const route = state.routes.find((r) => r.name === tab)
    if (!route) return
    const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true })
    if (!event.defaultPrevented) navigation.navigate(tab)
  }

  function handleSearch() {
    setOpenSearch(true)
    if (activeTab !== 'Feed') goTo('Feed')
  }

  const searchActive = activeTab === 'Feed' && openSearch
  const homeActive   = activeTab === 'Feed' && !openSearch
  const msgActive    = activeTab === 'Messages'
  const circActive   = activeTab === 'Circle'
  const profActive   = activeTab === 'Profile'

  return (
    <View style={s.root}>
      <View style={[s.bar, { paddingBottom: Math.max(bottom, 8) }]}>

        {/* Search */}
        <TouchableOpacity style={s.btn} onPress={handleSearch} activeOpacity={0.7}>
          <Search
            size={SZ}
            strokeWidth={searchActive ? 2.5 : 2}
            color={searchActive ? iconActive : iconInactv}
          />
        </TouchableOpacity>

        {/* Home → Feed — badge shows unread post count */}
        <TouchableOpacity style={s.btn} onPress={() => goTo('Feed')} activeOpacity={0.7}>
          <MessageBadge count={newPostsCount} iconColor={iconInactv} />
          <Home
            size={SZ}
            strokeWidth={homeActive ? 2.5 : 2}
            color={homeActive ? iconActive : iconInactv}
            fill={homeActive ? iconActive : 'transparent'}
          />
        </TouchableOpacity>

        {/* Messages — badge com total de mensagens não lidas */}
        <TouchableOpacity style={s.btn} onPress={() => goTo('Messages')} activeOpacity={0.7}>
          <MessageBadge count={totalUnread} iconColor={iconInactv} icon />
          <View style={s.mirrorX}>
            <MessageCircle
              size={SZ}
              strokeWidth={msgActive ? 2.5 : 2}
              color={msgActive ? iconActive : iconInactv}
              fill={msgActive ? iconActive : 'transparent'}
            />
          </View>
        </TouchableOpacity>

        {/* Círculo — badge com câmara quando alguém me convida */}
        <TouchableOpacity style={s.btn} onPress={() => goTo('Circle')} activeOpacity={0.7}>
          {circleInvite && (
            <View style={s.badgeAnchor}>
              <View style={s.badgePill}>
                <Camera size={13} strokeWidth={2.6} color="#fff" />
              </View>
              <View style={s.badgeTip} />
            </View>
          )}
          <Circle
            size={SZ}
            strokeWidth={circActive ? 2.5 : 2}
            color={circActive ? iconActive : iconInactv}
            fill={circActive ? iconActive : 'transparent'}
          />
        </TouchableOpacity>

        {/* Profile */}
        <TouchableOpacity style={s.btn} onPress={() => goTo('Profile')} activeOpacity={0.7}>
          {avatar ? (
            <Image source={{ uri: avatar }} style={s.avatar} />
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
    paddingTop: 10,
  },
  btn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
    overflow: 'visible',
  },
  mirrorX: { transform: [{ scaleX: -1 }] },
  badgeIcon: { marginRight: 5, transform: [{ scaleX: -1 }] },

  // Badge — positioned above the icon, centered on the btn
  badgeAnchor: {
    position: 'absolute',
    top: -18,
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
})
