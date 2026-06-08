import React, { useState, useRef, useEffect } from 'react'
import {
  Animated, View, Text, TouchableOpacity, StyleSheet,
  Easing,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useNavigation } from '@react-navigation/native'
import { StackNavigationProp } from '@react-navigation/stack'
import { Post } from '../../types'
import { colors, fonts } from '../../theme'
import { useAuthStore } from '../../store/auth.store'
import { toggleFollow, getFollowStatus } from '../../services/follow.service'
import AvatarImage from '../../components/AvatarImage'
import FollowSplitButton, { FollowDuration } from '../../components/FollowSplitButton'
import { AppStackParams } from '../../navigation/AppNavigator'
import * as Haptics from 'expo-haptics'

type Nav = StackNavigationProp<AppStackParams>

// Module-level cache so follow state is instant on revisit
const followCache = new Map<string, boolean>()

interface Props {
  post: Post
  isActive: boolean
}

export default function PostInfo({ post, isActive }: Props) {
  const { user }    = useAuthStore()
  const { bottom }  = useSafeAreaInsets()
  const nav         = useNavigation<Nav>()
  const [expanded, setExpanded]         = useState(false)
  const [following, setFollowing]       = useState(() => followCache.get(post.user.id) ?? false)
  const [loadingFollow, setLoadingFollow] = useState(false)

  const caption  = post.caption ?? ''
  const isLong   = caption.length > 80
  const displayed = expanded || !isLong ? caption : caption.slice(0, 80) + '...'
  const isSelf   = user?.id === post.user.id

  const slideAnim = useRef(new Animated.Value(10)).current
  const clockAnim = useRef(new Animated.Value(0)).current

  useEffect(() => {
    Animated.loop(
      Animated.timing(clockAnim, {
        toValue: 1, duration: 6000,
        easing: Easing.linear, useNativeDriver: true,
      }),
    ).start()
  }, [])

  useEffect(() => {
    if (isActive) {
      slideAnim.setValue(10)
      Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, speed: 28, bounciness: 3 }).start()
    }
  }, [isActive])

  // Reset per-post state without needing key-based remount
  useEffect(() => {
    setExpanded(false)
    setFollowing(followCache.get(post.user.id) ?? false)
  }, [post.id])

  useEffect(() => {
    if (isSelf) return
    if (followCache.has(post.user.id)) {
      setFollowing(followCache.get(post.user.id)!)
      return
    }
    getFollowStatus(post.user.id)
      .then((r) => { followCache.set(post.user.id, r.following); setFollowing(r.following) })
      .catch(() => {})
  }, [post.user.id])

  async function handleFollow(duration: FollowDuration = 'forever') {
    if (loadingFollow) return
    setLoadingFollow(true)
    try {
      const res = await toggleFollow(post.user.id, duration)
      followCache.set(post.user.id, res.following)
      setFollowing(res.following)
    } catch {}
    setLoadingFollow(false)
  }

  function timeLeft() {
    const diff = new Date(post.expiresAt).getTime() - Date.now()
    const h = Math.max(0, Math.floor(diff / 3600000))
    const m = Math.max(0, Math.floor((diff % 3600000) / 60000))
    return `${h}h ${m}m`
  }

  return (
    <>
      <Animated.View style={[s.container, { bottom: bottom + 130, transform: [{ translateY: slideAnim }] }]}>
        {/* Avatar(s) + Name + follow */}
        <View style={s.userRow}>
          <View style={s.avatarStack}>
            <TouchableOpacity onPress={() => nav.navigate('Profile', { userId: post.user.id })} activeOpacity={0.8}>
              <AvatarImage uri={post.user.avatar} size={32} borderColor="rgba(255,255,255,0.9)" borderWidth={1.5} />
            </TouchableOpacity>
            {post.partnerUser && post.partnerAccepted && (
              <TouchableOpacity
                onPress={() => nav.navigate('Profile', { userId: post.partnerUser!.id })}
                activeOpacity={0.8}
                style={s.partnerAvatarOverlap}
              >
                <AvatarImage uri={post.partnerUser.avatar} size={28} borderColor="rgba(255,255,255,0.95)" borderWidth={2} />
              </TouchableOpacity>
            )}
          </View>
          <View style={s.nameGroup}>
            {post.extended && (
              <View style={s.extBadge}>
                <Text style={s.extBadgeText}>+24h</Text>
              </View>
            )}
            <TouchableOpacity onPress={() => nav.navigate('Profile', { userId: post.user.id })} activeOpacity={0.8}>
              <Text style={s.username} numberOfLines={1}>
                {post.user.name}{post.partnerUser && post.partnerAccepted ? ` & ${post.partnerUser.name}` : ''}
              </Text>
            </TouchableOpacity>
            {!isSelf && (
              <FollowSplitButton
                following={following}
                loading={loadingFollow}
                onFollow={handleFollow}
                theme="dark"
              />
            )}
          </View>

        </View>

        {/* Caption */}
        {caption.length > 0 && post.mediaType !== 'TEXT' && (
          <TouchableOpacity onPress={() => setExpanded((e) => !e)} activeOpacity={0.8}>
            <Text style={s.caption}>
              {displayed}
              {isLong && !expanded && <Text style={s.seeMore}> Ver mais</Text>}
            </Text>
          </TouchableOpacity>
        )}

        {/* Timer */}
        <View style={s.timerRow}>
          <Animated.View style={{
            transform: [{
              rotate: clockAnim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] }),
            }],
          }}>
            <Ionicons name="time-outline" size={14} color="rgba(255,255,255,0.65)" />
          </Animated.View>
          <Text style={s.timer}> {timeLeft()}</Text>
        </View>
      </Animated.View>

    </>
  )
}

const s = StyleSheet.create({
  container: { position: 'absolute', left: 16, right: 16, gap: 8, zIndex: 30 },

  userRow:  { flexDirection: 'row', alignItems: 'center', gap: 8 },

  // Row of avatars — overlap via negative margin
  avatarStack: { flexDirection: 'row', alignItems: 'flex-start' },

  // Partner avatar: overlaps left (-14px) and drops slightly (6px) — diagonal stack
  partnerAvatarOverlap: {
    marginLeft: -14,
    marginTop: 6,
    zIndex: 1,
  },

  nameGroup: { flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 },
  username: {
    color: colors.white, fontFamily: fonts.semiBold, fontSize: 13,
    letterSpacing: -0.2, flexShrink: 1,
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },

  extBadge:     { backgroundColor: colors.primary, borderRadius: 4, paddingHorizontal: 5, paddingVertical: 1 },
  extBadgeText: { color: colors.white, fontFamily: fonts.bold, fontSize: 9, letterSpacing: 0.2 },

  caption:  { color: 'rgba(255,255,255,0.88)', fontFamily: fonts.regular, fontSize: 13, lineHeight: 19 },
  seeMore:  { color: 'rgba(255,255,255,0.50)', fontFamily: fonts.medium },

  timerRow: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  timer:    { color: 'rgba(255,255,255,0.65)', fontFamily: fonts.medium, fontSize: 12, letterSpacing: 0.1 },
})
