import React, { useEffect, useRef, useState } from 'react'
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  Animated, ActivityIndicator,
} from 'react-native'
import { Image } from 'expo-image'
import { Ionicons } from '@expo/vector-icons'
import { useNavigation } from '@react-navigation/native'
import { StackNavigationProp } from '@react-navigation/stack'
import { api } from '../services/api'
import { colors, fonts } from '../theme'
import { API_BASE } from '../config'
import { AppStackParams } from '../navigation/AppNavigator'
import { useFollowStore } from '../store/follow.store'
import FollowSplitButton, { FollowDuration } from './FollowSplitButton'
import { toast } from '../utils/toast'
import { useT } from '../i18n'

const CARD_W = 128
const CARD_H = 158   // usado só para a altura do spinner

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
  const t = useT()
  const followed = useFollowStore((s) => s.followingIds.has(user.id))
  const [loading, setLoading]  = useState(false)
  const fadeAnim = useRef(new Animated.Value(1)).current

  async function handleFollow(duration: FollowDuration) {
    if (followed || loading) return
    setLoading(true)
    try {
      await useFollowStore.getState().toggle(user.id, duration, { name: user.name, avatar: user.avatar })
      Animated.timing(fadeAnim, { toValue: 0, duration: 350, useNativeDriver: true }).start(onFollow)
    } catch {
      toast.error(t.follow_err)
    }
    setLoading(false)
  }

  const photo = resolveUri(user.avatar)

  return (
    <Animated.View style={[d.card, { opacity: fadeAnim }]}>
      {/* Avatar redondo — toca para abrir perfil */}
      <TouchableOpacity onPress={onPress} activeOpacity={0.85}>
        {photo
          ? <Image source={{ uri: photo }} style={d.avatar} contentFit="cover" cachePolicy="memory-disk" />
          : <View style={[d.avatar, d.photoFallback]}>
              <Ionicons name="person" size={26} color={colors.gray400} />
            </View>
        }
      </TouchableOpacity>

      <TouchableOpacity onPress={onPress} activeOpacity={0.7} style={d.textWrap}>
        <Text style={d.name} numberOfLines={1}>{user.name.split(' ')[0]}</Text>
      </TouchableOpacity>

      <FollowSplitButton
        following={followed}
        loading={loading}
        onFollow={handleFollow}
        theme="light"
      />
    </Animated.View>
  )
}

interface Props {
  /** Label shown above the row */
  title?: string
  /** Called when row should be hidden (all followed or dismissed) */
  onDismiss: () => void
}

export default function DiscoveryRow({ title, onDismiss }: Props) {
  const t = useT()
  const label = title ?? t.msg_suggestions_title
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
        <Text style={d.title}>{label}</Text>
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
    backgroundColor: colors.white,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: '#EBEBEB',
    paddingBottom: 14,
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

  // ── Mini card (Instagram-style: avatar redondo, nome, botão seguir) ──────────
  card: {
    width:        CARD_W,
    borderRadius: 16,
    backgroundColor: '#fff',
    borderWidth:  1,
    borderColor:  '#ECECEF',
    paddingVertical:   16,
    paddingHorizontal: 10,
    alignItems:   'center',
  },
  avatar: {
    width:        68,
    height:       68,
    borderRadius: 34,
    backgroundColor: colors.gray100,
  },
  photoFallback: {
    alignItems:     'center',
    justifyContent: 'center',
  },
  textWrap: {
    marginTop:    10,
    marginBottom: 12,
    alignSelf:    'stretch',
    alignItems:   'center',
  },
  name: {
    fontSize:      13.5,
    fontFamily:    fonts.semiBold,
    color:         colors.gray800,
    letterSpacing: -0.2,
    textAlign:     'center',
  },
})
