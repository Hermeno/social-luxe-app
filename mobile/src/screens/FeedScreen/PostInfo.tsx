import React, { useState, useRef, useEffect } from 'react'
import { Animated, View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { Post } from '../../types'
import { colors, fonts } from '../../theme'

interface Props {
  post: Post
  isActive: boolean
}

export default function PostInfo({ post, isActive }: Props) {
  const [expanded, setExpanded] = useState(false)
  const caption = post.caption ?? ''
  const isLong = caption.length > 80
  const displayed = expanded || !isLong ? caption : caption.slice(0, 80) + '...'

  const fadeAnim  = useRef(new Animated.Value(0)).current
  const slideAnim = useRef(new Animated.Value(16)).current

  useEffect(() => {
    if (isActive) {
      fadeAnim.setValue(0)
      slideAnim.setValue(16)
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1, duration: 380, useNativeDriver: true,
        }),
        Animated.spring(slideAnim, {
          toValue: 0, useNativeDriver: true, speed: 22, bounciness: 4,
        }),
      ]).start()
    } else {
      fadeAnim.setValue(0)
    }
  }, [isActive])

  function timeLeft() {
    const diff = new Date(post.expiresAt).getTime() - Date.now()
    const h = Math.max(0, Math.floor(diff / 3600000))
    const m = Math.max(0, Math.floor((diff % 3600000) / 60000))
    return `${h}h ${m}m`
  }

  return (
    <Animated.View style={[s.container, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
      <View style={s.userRow}>
        <Text style={s.username}>@{post.user.name}</Text>
        {post.extended && (
          <View style={s.badge}>
            <Text style={s.badgeText}>+24h</Text>
          </View>
        )}
      </View>

      {caption.length > 0 && (
        <TouchableOpacity onPress={() => setExpanded((e) => !e)} activeOpacity={0.8}>
          <Text style={s.caption}>
            {displayed}
            {isLong && !expanded && <Text style={s.seeMore}> Ver mais</Text>}
          </Text>
        </TouchableOpacity>
      )}

      <View style={s.timerRow}>
        <Ionicons name="timer-outline" size={11} color="rgba(255,255,255,0.4)" />
        <Text style={s.timer}> {timeLeft()}</Text>
      </View>
    </Animated.View>
  )
}

const s = StyleSheet.create({
  container: { position: 'absolute', left: 16, bottom: 120, right: 90, gap: 6 },
  userRow:   { flexDirection: 'row', alignItems: 'center', gap: 8 },
  username:  { color: colors.white, fontFamily: fonts.extraBold, fontSize: 16, letterSpacing: -0.5 },
  badge:     { backgroundColor: colors.primary, borderRadius: 6, paddingHorizontal: 7, paddingVertical: 2 },
  badgeText: { color: colors.white, fontFamily: fonts.bold, fontSize: 10, letterSpacing: 0.3 },
  caption:   { color: 'rgba(255,255,255,0.88)', fontFamily: fonts.medium, fontSize: 13.5, lineHeight: 20 },
  seeMore:   { color: 'rgba(255,255,255,0.55)', fontFamily: fonts.semiBold },
  timerRow:  { flexDirection: 'row', alignItems: 'center' },
  timer:     { color: 'rgba(255,255,255,0.42)', fontFamily: fonts.regular, fontSize: 11, letterSpacing: 0.1 },
})
