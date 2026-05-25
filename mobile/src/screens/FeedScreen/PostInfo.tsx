import React, { useState, useRef, useEffect } from 'react'
import { Animated, View, Text, TouchableOpacity, StyleSheet, Easing } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { Post } from '../../types'
import { colors, fonts } from '../../theme'
import { useAuthStore } from '../../store/auth.store'
import { toggleFollow, getFollowStatus } from '../../services/follow.service'

interface Props {
  post: Post
  isActive: boolean
}

export default function PostInfo({ post, isActive }: Props) {
  const { user }      = useAuthStore()
  const [expanded, setExpanded]   = useState(false)
  const [following, setFollowing] = useState(false)
  const [loadingFollow, setLoadingFollow] = useState(false)
  const caption  = post.caption ?? ''
  const isLong   = caption.length > 80
  const displayed = expanded || !isLong ? caption : caption.slice(0, 80) + '...'
  const isSelf   = user?.id === post.user.id

  const fadeAnim  = useRef(new Animated.Value(0)).current
  const slideAnim = useRef(new Animated.Value(16)).current
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
      fadeAnim.setValue(0)
      slideAnim.setValue(16)
      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 1, duration: 380, useNativeDriver: true }),
        Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, speed: 22, bounciness: 4 }),
      ]).start()
    } else {
      fadeAnim.setValue(0)
    }
  }, [isActive])

  // Load initial follow status
  useEffect(() => {
    if (isSelf) return
    getFollowStatus(post.user.id)
      .then((r) => setFollowing(r.following))
      .catch(() => {})
  }, [post.user.id])

  async function handleFollow() {
    if (loadingFollow) return
    setLoadingFollow(true)
    try {
      const res = await toggleFollow(post.user.id)
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
    <Animated.View style={[s.container, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
      {/* Name + follow button on the same row */}
      <View style={s.userRow}>
        <Text style={s.username}>{post.user.name}</Text>
        {post.extended && (
          <View style={s.extBadge}>
            <Text style={s.extBadgeText}>+24h</Text>
          </View>
        )}
        {!isSelf && (
          <TouchableOpacity
            style={[s.followBtn, following && s.followBtnActive]}
            onPress={handleFollow}
            activeOpacity={0.75}
            disabled={loadingFollow}
          >
            <Text style={[s.followTxt, following && s.followTxtActive]}>
              {following ? 'Seguindo' : 'Seguir'}
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Caption */}
      {caption.length > 0 && (
        <TouchableOpacity onPress={() => setExpanded((e) => !e)} activeOpacity={0.8}>
          <Text style={s.caption}>
            {displayed}
            {isLong && !expanded && <Text style={s.seeMore}> Ver mais</Text>}
          </Text>
        </TouchableOpacity>
      )}

      <View style={s.timerRow}>
        <Animated.View style={{
          transform: [{
            rotate: clockAnim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] }),
          }],
        }}>
          <Ionicons name="time-outline" size={14} color="rgba(255,255,255,0.5)" />
        </Animated.View>
        <Text style={s.timer}> {timeLeft()}</Text>
      </View>
    </Animated.View>
  )
}

const s = StyleSheet.create({
  container:       { position: 'absolute', left: 16, bottom: 120, right: 90, gap: 6, zIndex: 30 },
  userRow:         { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  username:        { color: colors.white, fontFamily: fonts.extraBold, fontSize: 16, letterSpacing: -0.5 },
  extBadge:        { backgroundColor: colors.primary, borderRadius: 6, paddingHorizontal: 7, paddingVertical: 2 },
  extBadgeText:    { color: colors.white, fontFamily: fonts.bold, fontSize: 10, letterSpacing: 0.3 },

  followBtn: {
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.75)',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  followBtnActive: {
    borderColor: 'rgba(255,255,255,0.35)',
  },
  followTxt:       { color: colors.white, fontFamily: fonts.semiBold, fontSize: 12 },
  followTxtActive: { color: 'rgba(255,255,255,0.55)' },

  caption:   { color: 'rgba(255,255,255,0.88)', fontFamily: fonts.medium, fontSize: 13.5, lineHeight: 20 },
  seeMore:   { color: 'rgba(255,255,255,0.55)', fontFamily: fonts.semiBold },
  timerRow:  { flexDirection: 'row', alignItems: 'center' },
  timer:     { color: 'rgba(255,255,255,0.50)', fontFamily: fonts.regular, fontSize: 12, letterSpacing: 0.1 },
})
