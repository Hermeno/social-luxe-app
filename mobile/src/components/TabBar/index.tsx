import React from 'react'
import { View, TouchableOpacity, StyleSheet, Text } from 'react-native'
import { BottomTabBarProps } from '@react-navigation/bottom-tabs'
import { Ionicons } from '@expo/vector-icons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { colors, fonts } from '../../theme'
import { useFriendsStore } from '../../store/friends.store'

type IconName = React.ComponentProps<typeof Ionicons>['name']

const TAB_ICONS: Record<string, [IconName, IconName]> = {
  Feed:     ['home',       'home-outline'],
  Messages: ['chatbubble', 'chatbubble-outline'],
  Friends:  ['people',     'people-outline'],
}

export default function TabBar({ state, navigation }: BottomTabBarProps) {
  const { bottom } = useSafeAreaInsets()
  const badge = useFriendsStore((s) => s.badge)

  return (
    <View style={[s.outer, { bottom: bottom + 12 }]}>
      <View style={s.pill}>
        {state.routes.map((route, i) => {
          const focused  = state.index === i
          const isCreate = route.name === 'Create'

          if (isCreate) return (
            <TouchableOpacity key={route.key} style={s.tab} onPress={() => navigation.navigate(route.name)} activeOpacity={0.75}>
              <View style={[s.create, focused && s.createFocused]}>
                <Ionicons name="add" size={30} color={colors.white} />
              </View>
            </TouchableOpacity>
          )

          const isFriends = route.name === 'Friends'
          const [active, inactive] = TAB_ICONS[route.name] ?? ['home', 'home-outline']

          return (
            <TouchableOpacity key={route.key} style={s.tab} onPress={() => navigation.navigate(route.name)} activeOpacity={0.75}>
              <View style={[s.iconWrap, focused && s.iconFocused]}>
                <Ionicons
                  name={focused ? active : inactive}
                  size={24}
                  color={focused ? colors.white : 'rgba(255,255,255,0.4)'}
                />
              </View>
              {isFriends && badge > 0 && (
                <View style={s.badge}>
                  <Text style={s.badgeTxt}>{badge > 9 ? '9+' : badge}</Text>
                </View>
              )}
            </TouchableOpacity>
          )
        })}
      </View>
    </View>
  )
}

const s = StyleSheet.create({
  outer:       { position: 'absolute', left: 72, right: 72 },
  pill:        {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    borderRadius: 40,
    paddingVertical: 10,
    paddingHorizontal: 8,
    backgroundColor: '#0D0D0D',
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.07)',
  },
  tab:         { alignItems: 'center', justifyContent: 'center', position: 'relative', flex: 1 },
  iconWrap:    { width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center' },
  iconFocused: { backgroundColor: 'rgba(255,255,255,0.1)' },
  create:      {
    width: 52, height: 52, borderRadius: 26,
    backgroundColor: colors.primary,
    alignItems: 'center', justifyContent: 'center',
  },
  createFocused: { backgroundColor: colors.primaryLight },
  badge:       {
    position: 'absolute', top: 4, right: '10%',
    minWidth: 16, height: 16, borderRadius: 8,
    backgroundColor: colors.primary,
    alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 3,
    borderWidth: 1.5, borderColor: '#0D0D0D',
  },
  badgeTxt:    { color: colors.white, fontFamily: fonts.extraBold, fontSize: 9 },
})
