import React, { useEffect, useState } from 'react'
import { View, Text, FlatList, TouchableOpacity, StyleSheet } from 'react-native'
import { useNavigation } from '@react-navigation/native'
import { StackNavigationProp } from '@react-navigation/stack'
import { Ionicons } from '@expo/vector-icons'
import { useAuthStore } from '../store/auth.store'
import { StoryGroup, getFriendsStories } from '../services/story.service'
import { AppStackParams } from '../navigation/AppNavigator'
import { colors, fonts } from '../theme'
import AvatarImage from './AvatarImage'

type Nav = StackNavigationProp<AppStackParams>

const CIRCLE = 52

export default function StoriesBar() {
  const nav = useNavigation<Nav>()
  const { user } = useAuthStore()
  const [groups, setGroups] = useState<StoryGroup[]>([])

  useEffect(() => {
    getFriendsStories().then(setGroups).catch(() => {})
  }, [])

  const myGroup = groups.find((g) => g.user.id === user?.id)
  const othersGroups = groups.filter((g) => g.user.id !== user?.id)

  function handleOwnPress() {
    if (myGroup) {
      const idx = groups.findIndex((g) => g.user.id === user?.id)
      nav.navigate('StoryViewer', { groups, startGroupIndex: Math.max(0, idx) })
    } else {
      nav.navigate('CreateStory')
    }
  }

  function handleGroupPress(group: StoryGroup) {
    const allGroups = myGroup ? [myGroup, ...othersGroups] : othersGroups
    const idx = allGroups.findIndex((g) => g.user.id === group.user.id)
    nav.navigate('StoryViewer', { groups: allGroups, startGroupIndex: Math.max(0, idx) })
  }

  const allGroups = myGroup ? [myGroup, ...othersGroups] : othersGroups

  return (
    <View style={s.container}>
      <FlatList
        horizontal
        data={allGroups}
        keyExtractor={(g) => g.user.id}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={s.list}
        ListHeaderComponent={
          <TouchableOpacity style={s.item} onPress={handleOwnPress} activeOpacity={0.8}>
            <View style={[s.ring, myGroup ? s.ringActive : s.ringGray]}>
              <View style={s.avatarWrap}>
                <AvatarImage uri={user?.avatar} size={CIRCLE} />
                {!myGroup && (
                  <View style={s.addOverlay}>
                    <Ionicons name="add" size={14} color={colors.white} />
                  </View>
                )}
              </View>
            </View>
            <Text style={s.label} numberOfLines={1}>
              {myGroup ? 'Minha Story' : '+ Story'}
            </Text>
          </TouchableOpacity>
        }
        renderItem={({ item }) => (
            <TouchableOpacity
              style={s.item}
              onPress={() => handleGroupPress(item)}
              activeOpacity={0.8}
            >
              <View style={[s.ring, item.hasUnviewed ? s.ringActive : s.ringViewed]}>
                <View style={s.avatarWrap}>
                  <AvatarImage uri={item.user.avatar} size={CIRCLE} />
                </View>
              </View>
              <Text style={s.label} numberOfLines={1}>
                {item.user.name.split(' ')[0]}
              </Text>
            </TouchableOpacity>
          )}
      />
    </View>
  )
}

const s = StyleSheet.create({
  container: {
    backgroundColor: 'rgba(0,0,0,0.72)',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  list:     { paddingHorizontal: 12, paddingVertical: 10, gap: 14 },
  item:     { alignItems: 'center', gap: 5, width: 64 },
  ring:     {
    width: CIRCLE + 6,
    height: CIRCLE + 6,
    borderRadius: (CIRCLE + 6) / 2,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ringActive: { borderColor: colors.primary },
  ringViewed: { borderColor: 'rgba(255,255,255,0.2)' },
  ringGray:   { borderColor: 'rgba(255,255,255,0.15)' },
  avatarWrap: { position: 'relative' },
  avatar:     { width: CIRCLE, height: CIRCLE, borderRadius: CIRCLE / 2 },
  addOverlay: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: colors.primary,
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#1A1A1A',
  },
  label: {
    color: 'rgba(255,255,255,0.75)',
    fontFamily: fonts.regular,
    fontSize: 9,
    textAlign: 'center',
    maxWidth: 60,
  },
})
