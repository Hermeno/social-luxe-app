import React from 'react'
import { View, TouchableOpacity, StyleSheet, Text, Image } from 'react-native'
import { BottomTabBarProps } from '@react-navigation/bottom-tabs'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Search, Home, MessageCircle, User, Squircle } from 'lucide-react-native'
import { colors, fonts } from '../../theme'
import { useMessageBadgeStore } from '../../store/messageBadge.store'
import { useFeedStore } from '../../store/feed.store'
import { useAuthStore } from '../../store/auth.store'

const SZ       = 24
const ACTIVE   = colors.black
const INACTIVE = colors.gray400

export default function TabBar({ state, navigation }: BottomTabBarProps) {
  const { bottom }    = useSafeAreaInsets()
  const messageBadge  = useMessageBadgeStore((s) => s.totalUnread)
  const openSearch    = useFeedStore((s) => s.openSearch)
  const setOpenSearch = useFeedStore((s) => s.setOpenSearch)
  const avatar        = useAuthStore((s) => s.user?.avatar ?? null)

  const activeTab = state.routes[state.index].name

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

  const searchActive  = activeTab === 'Feed' && openSearch
  const homeActive    = activeTab === 'Feed' && !openSearch
  const msgActive     = activeTab === 'Messages'
  const donActive     = activeTab === 'Donations'
  const profActive    = activeTab === 'Profile'

  return (
    <View style={[s.bar, { paddingBottom: Math.max(bottom, 8) }]}>

      {/* Search */}
      <TouchableOpacity style={s.btn} onPress={handleSearch} activeOpacity={0.7}>
        <Search
          size={SZ}
          strokeWidth={searchActive ? 2.5 : 2}
          color={searchActive ? ACTIVE : INACTIVE}
        />
      </TouchableOpacity>

      {/* Home → Feed */}
      <TouchableOpacity style={s.btn} onPress={() => goTo('Feed')} activeOpacity={0.7}>
        <Home
          size={SZ}
          strokeWidth={homeActive ? 2.5 : 2}
          color={homeActive ? ACTIVE : INACTIVE}
          fill={homeActive ? ACTIVE : 'transparent'}
        />
      </TouchableOpacity>

      {/* Messages (center) — tail pointing right via mirrorX */}
      <TouchableOpacity style={s.btn} onPress={() => goTo('Messages')} activeOpacity={0.7}>
        <View style={s.relative}>
          <View style={s.mirrorX}>
            <MessageCircle
              size={SZ}
              strokeWidth={msgActive ? 2.5 : 2}
              color={msgActive ? colors.white : INACTIVE}
              fill={msgActive ? ACTIVE : 'transparent'}
            />
          </View>
          {messageBadge > 0 && (
            <View style={s.badge}>
              <Text style={s.badgeTxt}>{messageBadge > 9 ? '9+' : String(messageBadge)}</Text>
            </View>
          )}
        </View>
      </TouchableOpacity>

      {/* Donations (Piedade) */}
      <TouchableOpacity style={s.btn} onPress={() => goTo('Donations')} activeOpacity={0.7}>
        <Squircle
          size={SZ}
          strokeWidth={donActive ? 2.5 : 2}
          color={donActive ? ACTIVE : INACTIVE}
          fill={donActive ? ACTIVE : 'transparent'}
        />
      </TouchableOpacity>

      {/* Profile */}
      <TouchableOpacity style={s.btn} onPress={() => goTo('Profile')} activeOpacity={0.7}>
        {avatar ? (
          <Image
            source={{ uri: avatar }}
            style={[s.avatar, profActive && s.avatarActive]}
          />
        ) : (
          <User
            size={SZ}
            strokeWidth={profActive ? 2.5 : 2}
            color={profActive ? ACTIVE : INACTIVE}
            fill={profActive ? ACTIVE : 'transparent'}
          />
        )}
      </TouchableOpacity>

    </View>
  )
}

const s = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    backgroundColor: colors.white,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#EBEBEB',
    paddingTop: 10,
  },
  btn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
  },
  relative: { position: 'relative' },
  mirrorX:  { transform: [{ scaleX: -1 }] },
  badge: {
    position: 'absolute',
    top: -5,
    right: -8,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
    borderWidth: 1.5,
    borderColor: colors.white,
  },
  badgeTxt: {
    color: colors.white,
    fontSize: 9,
    fontFamily: fonts.bold,
    lineHeight: 11,
    includeFontPadding: false,
  },
  avatar: {
    width: SZ,
    height: SZ,
    borderRadius: SZ / 2,
    borderWidth: 0,
  },
  avatarActive: {
    borderWidth: 0,
  },
})
