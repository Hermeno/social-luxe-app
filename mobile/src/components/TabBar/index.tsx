import React from 'react'
import { View, TouchableOpacity, StyleSheet, Text } from 'react-native'
import { BottomTabBarProps } from '@react-navigation/bottom-tabs'
import { Ionicons } from '@expo/vector-icons'
import { LinearGradient } from 'expo-linear-gradient'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { colors } from '../../theme'
import { useFriendsStore } from '../../store/friends.store'

type IconName = React.ComponentProps<typeof Ionicons>['name']

const TAB_ICONS: Record<string, [IconName, IconName]> = {
  Feed:     ['home',       'home-outline'],
  Messages: ['chatbubble', 'chatbubble-outline'],
  Friends:  ['people',     'people-outline'],
}
const GRAD: [string, string] = ['rgba(8,8,8,0.55)', 'rgba(8,8,8,0.94)']

export default function TabBar({ state, navigation }: BottomTabBarProps) {
  const { bottom } = useSafeAreaInsets()
  const badge = useFriendsStore((s) => s.badge)
  return (
    <View style={[s.outer, { bottom: bottom + 10 }]}>
      <LinearGradient colors={GRAD} style={s.pill}>
        {state.routes.map((route, i) => {
          const focused  = state.index === i
          const isCreate = route.name === 'Create'
          if (isCreate) return (
            <TouchableOpacity key={route.key} style={s.tab} onPress={() => navigation.navigate(route.name)} activeOpacity={0.8}>
              <View style={[s.create, focused && s.createFocused]}>
                <Ionicons name="add" size={32} color={colors.white} />
              </View>
            </TouchableOpacity>
          )
          const isFriends = route.name === 'Friends'
          const [active, inactive] = TAB_ICONS[route.name] ?? ['home', 'home-outline']
          return (
            <TouchableOpacity key={route.key} style={s.tab} onPress={() => navigation.navigate(route.name)} activeOpacity={0.8}>
              <View style={[s.iconWrap, focused && s.iconFocused]}>
                <Ionicons name={focused ? active : inactive} size={24} color={focused ? colors.white : 'rgba(255,255,255,0.55)'} />
              </View>
              {isFriends && badge > 0 && (
                <View style={s.badge}>
                  <Text style={s.badgeTxt}>{badge > 9 ? '9+' : badge}</Text>
                </View>
              )}
            </TouchableOpacity>
          )
        })}
      </LinearGradient>
    </View>
  )
}

const s = StyleSheet.create({
  outer:        { position: 'absolute', left: 80, right: 80 },
  pill:         { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around', borderRadius: 40, paddingVertical: 10, paddingHorizontal: 8, overflow: 'hidden' },
  tab:          { alignItems: 'center', justifyContent: 'center', position: 'relative', flex: 1 },
  iconWrap:     { width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center' },
  iconFocused:  { backgroundColor: 'rgba(255,255,255,0.15)' },
  create:       { width: 52, height: 52, borderRadius: 26, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  createFocused:{ backgroundColor: colors.primaryLight },
  badge:        { position: 'absolute', top: 4, right: '10%', minWidth: 16, height: 16, borderRadius: 8, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3, borderWidth: 1.5, borderColor: 'rgba(8,8,8,0.94)' },
  badgeTxt:     { color: colors.white, fontSize: 9, fontWeight: '800' as const },
})
