import React, { useState, useRef } from 'react'
import { View, Text, TouchableOpacity, Image, StyleSheet, Animated } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useNavigation } from '@react-navigation/native'
import { StackNavigationProp } from '@react-navigation/stack'
import { Ionicons } from '@expo/vector-icons'
import { useAuthStore } from '../../store/auth.store'
import { AppStackParams } from '../../navigation/AppNavigator'
import { colors, spacing, fonts } from '../../theme'

type Nav = StackNavigationProp<AppStackParams>
interface Props { onTabChange: (tab: 'following' | 'forYou') => void }

const TABS = [
  { key: 'following' as const, label: 'Following' },
  { key: 'forYou'   as const, label: 'For You'  },
]

function SearchButton() {
  const pressAnim = useRef(new Animated.Value(1)).current

  function onIn()  { Animated.spring(pressAnim, { toValue: 0.85, useNativeDriver: true, speed: 50, bounciness: 0 }).start() }
  function onOut() { Animated.spring(pressAnim, { toValue: 1,    useNativeDriver: true, speed: 25, bounciness: 10 }).start() }

  return (
    <TouchableOpacity onPressIn={onIn} onPressOut={onOut} activeOpacity={1}>
      <Animated.View style={[s.searchBtn, { transform: [{ scale: pressAnim }] }]}>
        <Ionicons name="search-outline" size={24} color="rgba(255,255,255,0.92)" />
      </Animated.View>
    </TouchableOpacity>
  )
}

export default function FeedHeader({ onTabChange }: Props) {
  const [active, setActive] = useState<'following' | 'forYou'>('forYou')
  const { top } = useSafeAreaInsets()
  const nav = useNavigation<Nav>()
  const { user } = useAuthStore()

  const avatarUri = user?.avatar ??
    `https://ui-avatars.com/api/?name=${user?.name ?? 'U'}&background=FF4B6E&color=fff&size=64`

  function select(tab: 'following' | 'forYou') {
    setActive(tab)
    onTabChange(tab)
  }

  return (
    <View style={[s.container, { paddingTop: top + 8 }]}>
      <TouchableOpacity onPress={() => nav.navigate('Profile', {})} activeOpacity={0.85}>
        <Image source={{ uri: avatarUri }} style={s.avatar} />
      </TouchableOpacity>

      <View style={s.tabs}>
        {TABS.map(({ key, label }) => {
          const isActive = active === key
          return (
            <TouchableOpacity key={key} onPress={() => select(key)} style={s.tabBtn} activeOpacity={0.75}>
              <Text style={[s.tabText, !isActive && s.tabDim]}>{label}</Text>
              {isActive && <View style={s.dot} />}
            </TouchableOpacity>
          )
        })}
      </View>

      <SearchButton />
    </View>
  )
}

const s = StyleSheet.create({
  container: {
    position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: spacing.md, paddingBottom: spacing.sm,
  },
  avatar:    { width: 36, height: 36, borderRadius: 18, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.8)' },
  tabs:      { flexDirection: 'row', alignItems: 'center', gap: 2 },
  tabBtn:    { paddingHorizontal: 12, paddingVertical: 8, alignItems: 'center', gap: 5 },
  tabText:   { color: colors.white, fontFamily: fonts.bold, fontSize: 16, letterSpacing: -0.3 },
  tabDim:    { color: 'rgba(255,255,255,0.38)', fontFamily: fonts.medium },
  dot:       { width: 4, height: 4, borderRadius: 2, backgroundColor: colors.white },
  searchBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center', justifyContent: 'center',
  },
})
