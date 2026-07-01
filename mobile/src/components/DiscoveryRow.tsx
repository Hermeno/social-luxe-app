import React, { useEffect, useRef, useState } from 'react'
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  Animated, ActivityIndicator,
} from 'react-native'
import { Image } from 'expo-image'
import { LinearGradient } from 'expo-linear-gradient'
import { Ionicons } from '@expo/vector-icons'
import { useNavigation } from '@react-navigation/native'
import { StackNavigationProp } from '@react-navigation/stack'
import { api } from '../services/api'
import { colors, fonts } from '../theme'
import { API_BASE } from '../config'
import { AppStackParams } from '../navigation/AppNavigator'
import { useFollowStore } from '../store/follow.store'
import FollowSplitButton, { FollowDuration } from './FollowSplitButton'

const CARD_W = 110
const CARD_H = 160

interface SuggestedUser {
  id: string
  name: string
  avatar: string | null
  _count?: { followers: number; posts: number }
}

function resolveUri(uri: string | null | undefined): string | null {
  if (!uri) return null
  return uri.startsWith('http') || uri.startsWith('file://') ? uri : `${API_BASE}${uri}`
}

function MiniCard({
  user,
  onFollow,
  onPress,
}: {
  user: SuggestedUser
  onFollow: () => void
  onPress: () => void
}) {
  const followed = useFollowStore((s) => s.followingIds.has(user.id))
  const [loading, setLoading]  = useState(false)
  const fadeAnim = useRef(new Animated.Value(1)).current

  async function handleFollow(duration: FollowDuration) {
    if (followed || loading) return
    setLoading(true)
    try {
      await useFollowStore.getState().toggle(user.id, duration, { name: user.name, avatar: user.avatar })
      Animated.timing(fadeAnim, { toValue: 0, duration: 350, useNativeDriver: true }).start(onFollow)
    } catch {}
    setLoading(false)
  }

  const photo = resolveUri(user.avatar)

  return (
    <Animated.View style={[d.card, { opacity: fadeAnim }]}>
      <TouchableOpacity style={StyleSheet.absoluteFill} onPress={onPress} activeOpacity={0.88} />
      {photo
        ? <Image source={{ uri: photo }} style={StyleSheet.absoluteFill} contentFit="cover" cachePolicy="memory-disk" />
        : <View style={[StyleSheet.absoluteFill, d.photoFallback]}>
            <Ionicons name="person" size={28} color="rgba(255,255,255,0.25)" />
          </View>
      }
      <LinearGradient
        colors={['transparent', 'rgba(0,0,0,0.5)', 'rgba(0,0,0,0.88)']}
        locations={[0.3, 0.6, 1]}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />
      <View style={d.info}>
        <Text style={d.name} numberOfLines={1}>{user.name.split(' ')[0]}</Text>
        <FollowSplitButton
          following={followed}
          loading={loading}
          onFollow={handleFollow}
          theme="light"
        />
      </View>
    </Animated.View>
  )
}

interface Props {
  /** Label shown above the row */
  title?: string
  /** Called when row should be hidden (all followed or dismissed) */
  onDismiss: () => void
}

export default function DiscoveryRow({ title = 'Sugestões para ti', onDismiss }: Props) {
  const nav = useNavigation<StackNavigationProp<AppStackParams>>()
  const [users,   setUsers]   = useState<SuggestedUser[]>([])
  const [loading, setLoading] = useState(true)
  const [visible, setVisible] = useState<Set<string>>(new Set())

  const slideAnim = useRef(new Animated.Value(0)).current

  useEffect(() => {
    ;(async () => {
      try {
        const res = await api.get('/users/suggested')
        const data: SuggestedUser[] = res.data.data ?? res.data ?? []
        setUsers(data)
        setVisible(new Set(data.map((u) => u.id)))
      } catch {}
      setLoading(false)
    })()

    Animated.spring(slideAnim, { toValue: 1, speed: 14, bounciness: 4, useNativeDriver: true }).start()
  }, [])

  function handleFollowed(userId: string) {
    setVisible((prev) => {
      const next = new Set(prev)
      next.delete(userId)
      if (next.size === 0) dismiss()
      return next
    })
  }

  function dismiss() {
    Animated.timing(slideAnim, { toValue: 0, duration: 220, useNativeDriver: true }).start(onDismiss)
  }

  const visibleUsers = users.filter((u) => visible.has(u.id))

  return (
    <Animated.View style={[d.container, { opacity: slideAnim, transform: [{ scaleY: slideAnim }] }]}>
      {/* Header */}
      <View style={d.header}>
        <Text style={d.title}>{title}</Text>
        <TouchableOpacity onPress={dismiss} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="close" size={18} color="#8E8E93" />
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={d.spinner}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={visibleUsers}
          keyExtractor={(u) => u.id}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={d.list}
          renderItem={({ item }) => (
            <MiniCard
              user={item}
              onFollow={() => handleFollowed(item.id)}
              onPress={() => nav.navigate('Profile', { userId: item.id })}
            />
          )}
        />
      )}
    </Animated.View>
  )
}

const d = StyleSheet.create({
  container: {
    backgroundColor: '#FAFAFA',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: '#EBEBEB',
    paddingBottom: 12,
    transformOrigin: 'top',
  },
  header: {
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop:     12,
    paddingBottom:  10,
  },
  title: {
    fontSize:   13,
    fontFamily: fonts.bold,
    color:      '#8E8E93',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  spinner: { height: CARD_H, alignItems: 'center', justifyContent: 'center' },
  list: { paddingHorizontal: 16, gap: 10 },

  // ── Mini card ──────────────────────────────────────────────────────────────
  card: {
    width:        CARD_W,
    height:       CARD_H,
    borderRadius: 14,
    overflow:     'hidden',
    backgroundColor: '#1A1A1A',
  },
  photoFallback: {
    backgroundColor: '#2A2A2A',
    alignItems:      'center',
    justifyContent:  'center',
  },
  info: {
    position: 'absolute',
    bottom:   0,
    left:     0,
    right:    0,
    padding:  8,
    gap:      5,
  },
  name: {
    fontSize:    12,
    fontFamily:  fonts.bold,
    color:       '#fff',
    letterSpacing: -0.1,
  },
})
