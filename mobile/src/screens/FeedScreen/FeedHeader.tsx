import React, { useState } from 'react'
import { View, Text, TouchableOpacity, Image, StyleSheet } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useNavigation } from '@react-navigation/native'
import { StackNavigationProp } from '@react-navigation/stack'
import { Ionicons } from '@expo/vector-icons'
import { useAuthStore } from '../../store/auth.store'
import { AppStackParams } from '../../navigation/AppNavigator'
import { colors, spacing } from '../../theme'

type Nav = StackNavigationProp<AppStackParams>
interface Props { onTabChange: (tab: 'following' | 'forYou') => void }

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
        <TouchableOpacity onPress={() => select('following')} style={s.tabBtn}>
          <Text style={[s.tabText, active !== 'following' && s.tabDim]}>Following</Text>
          {active === 'following' && <View style={s.underline} />}
        </TouchableOpacity>
        <TouchableOpacity onPress={() => select('forYou')} style={[s.tabBtn, active === 'forYou' && s.activePill]}>
          <Text style={s.tabText}>For You</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity style={s.searchBtn} activeOpacity={0.8}>
        <Ionicons name="search" size={26} color={colors.white} />
      </TouchableOpacity>
    </View>
  )
}

const s = StyleSheet.create({
  container: {
    position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: spacing.md, paddingBottom: spacing.sm,
  },
  avatar:    { width: 36, height: 36, borderRadius: 18, borderWidth: 2, borderColor: colors.white },
  tabs:      { flexDirection: 'row', alignItems: 'center', gap: 4 },
  tabBtn:    { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, position: 'relative' },
  tabText:   { color: colors.white, fontWeight: '700', fontSize: 15 },
  tabDim:    { color: 'rgba(255,255,255,0.6)', fontWeight: '500' },
  activePill:{ backgroundColor: colors.primary },
  underline: { position: 'absolute', bottom: 3, left: '20%', right: '20%', height: 2, backgroundColor: colors.white, borderRadius: 1 },
  searchBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(0,0,0,0.3)', alignItems: 'center', justifyContent: 'center' },
})
