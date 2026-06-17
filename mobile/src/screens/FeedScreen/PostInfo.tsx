import React, { useState, useRef, useEffect } from 'react'
import {
  Animated, View, Text, TouchableOpacity, StyleSheet,
} from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { Ionicons } from '@expo/vector-icons'
import Svg, { Polygon } from 'react-native-svg'
import { useNavigation } from '@react-navigation/native'
import { StackNavigationProp } from '@react-navigation/stack'
import { Post } from '../../types'
import { colors, fonts } from '../../theme'
import { useT } from '../../i18n'
import { useAuthStore } from '../../store/auth.store'
import { toggleFollow, getFollowStatus } from '../../services/follow.service'
import { getCache } from '../../db/database'
import AvatarImage from '../../components/AvatarImage'
import FollowSplitButton, { FollowDuration } from '../../components/FollowSplitButton'
import { AppStackParams } from '../../navigation/AppNavigator'

type Nav = StackNavigationProp<AppStackParams>

const FULL_LIFE_MS  = 24 * 60 * 60 * 1000   // 24h baseline
const DYING_THRESH  =  2 * 60 * 60 * 1000   // <2h = dying

// Module-level follow cache — persists for the full JS session
const followCache = new Map<string, boolean>()
let _cacheWarmed = false

// Load my_following from SQLite into followCache once per session.
// After this, useState initializers and the follow-status useEffect both
// read the correct value without a per-user API call.
async function ensureFollowCacheWarmed(): Promise<void> {
  if (_cacheWarmed) return
  _cacheWarmed = true
  try {
    const following = await getCache<Array<{ id: string }>>('my_following')
    if (following?.length) following.forEach((u) => { if (!followCache.has(u.id)) followCache.set(u.id, true) })
  } catch {}
}

// ─── Sand Timer ───────────────────────────────────────────────────────────────
// Upper chamber: inverted triangle (wide top → pinch)
// Sand fills from the pinch point upward, shrinking as pct drops (0–100)
function SandTimer({ pct, color }: { pct: number; color: string }) {
  const W = 12, H = 18, PX = 6, PY = 9
  const p  = Math.max(0, Math.min(100, pct)) / 100
  const sx = PX * p          // half-width of sand's top edge
  const sy = PY * (1 - p)    // y-position of sand's top edge

  return (
    <Svg width={W} height={H} viewBox={`0 0 ${W} ${H}`}>
      {/* Upper chamber outline */}
      <Polygon
        points={`0,0 ${W},0 ${PX},${PY}`}
        fill="none"
        stroke={color}
        strokeWidth={1.1}
        strokeLinejoin="round"
        opacity={0.38}
      />
      {/* Sand in upper chamber */}
      {p > 0.015 && (
        <Polygon
          points={`${PX - sx},${sy} ${PX + sx},${sy} ${PX},${PY}`}
          fill={color}
          opacity={0.88}
        />
      )}
      {/* Lower chamber outline */}
      <Polygon
        points={`${PX},${PY} 0,${H} ${W},${H}`}
        fill="none"
        stroke={color}
        strokeWidth={1.1}
        strokeLinejoin="round"
        opacity={0.38}
      />
    </Svg>
  )
}

interface Props {
  post: Post
  isActive: boolean
  onExpired?: () => void
}

export default function PostInfo({ post, isActive, onExpired }: Props) {
  const { user }    = useAuthStore()
  const nav         = useNavigation<Nav>()
  const t           = useT()
  const [expanded, setExpanded]           = useState(false)
  const [following, setFollowing]         = useState(() => followCache.get(post.user.id) ?? false)
  const [loadingFollow, setLoadingFollow] = useState(false)
  const [now, setNow]                     = useState(Date.now)

  const caption   = post.caption ?? ''
  const isLong    = caption.length > 80
  const displayed = expanded || !isLong ? caption : caption.slice(0, 80) + '...'
  const isSelf    = user?.id === post.user.id

  // Animated values
  const slideAnim  = useRef(new Animated.Value(10)).current
  const pulseAnim  = useRef(new Animated.Value(1)).current
  const energyAnim = useRef(new Animated.Value(0)).current

  // Warm the follow cache from SQLite on first mount — runs once per session.
  // After warm, re-check this post's author so the button shows the right state immediately.
  useEffect(() => {
    if (_cacheWarmed) return
    ensureFollowCacheWarmed().then(() => {
      const cached = followCache.get(post.user.id)
      if (cached !== undefined) setFollowing(cached)
    }).catch(() => {})
  }, [])

  // Live clock — refreshes every 30s for display
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000)
    return () => clearInterval(id)
  }, [])

  // Precise expiry timeout — fires at the EXACT moment the post dies
  useEffect(() => {
    if (!post.expiresAt || post.isAnnouncement) return
    const ms = new Date(post.expiresAt).getTime() - Date.now()
    if (ms <= 0) {
      // Already expired when this post was shown — remove immediately
      onExpired?.()
      return
    }
    const id = setTimeout(() => {
      setNow(Date.now())
      onExpired?.()
    }, ms)
    return () => clearTimeout(id)
  }, [post.id])

  // Slide-in when post becomes active
  useEffect(() => {
    if (isActive) {
      slideAnim.setValue(10)
      Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, speed: 28, bounciness: 3 }).start()
    }
  }, [isActive])

  // Reset state on post change
  useEffect(() => {
    setExpanded(false)
    setFollowing(followCache.get(post.user.id) ?? false)
    // Animate energy bar in
    energyAnim.setValue(0)
    Animated.timing(energyAnim, { toValue: energyPct, duration: 900, useNativeDriver: false }).start()
  }, [post.id])

  // Follow status fetch
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

  // ── Energy calculations ─────────────────────────────────────────────────────
  const expiresMs   = post.expiresAt ? new Date(post.expiresAt).getTime() : 0
  const remainingMs = Math.max(0, expiresMs - now)
  const energyPct   = Math.min(100, (remainingMs / FULL_LIFE_MS) * 100)
  const isDying     = remainingMs > 0 && remainingMs < DYING_THRESH
  const isExpired   = expiresMs > 0 && remainingMs === 0

  const barWidth = energyAnim.interpolate({
    inputRange: [0, 100], outputRange: ['0%', '100%'],
  })

  // Dying pulse on bar
  useEffect(() => {
    if (!isDying) { pulseAnim.setValue(1); return }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 0.3, duration: 700, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1,   duration: 700, useNativeDriver: true }),
      ])
    )
    loop.start()
    return () => loop.stop()
  }, [isDying])

  // Also animate bar when energyPct updates (live tick)
  useEffect(() => {
    Animated.timing(energyAnim, { toValue: energyPct, duration: 400, useNativeDriver: false }).start()
  }, [energyPct])

  function timeLeft() {
    if (isExpired) return 'Expirado'
    const h = Math.floor(remainingMs / 3_600_000)
    const m = Math.floor((remainingMs % 3_600_000) / 60_000)
    if (h === 0) return `${m}m restantes`
    return `${h}h ${m}m`
  }

  const clockColor = isDying ? '#FF3B30' : 'rgba(255,255,255,0.65)'

  return (
    <>
      <Animated.View style={[s.container, { bottom: 16, transform: [{ translateY: slideAnim }] }]}>

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

            {post.user.statusLabel ? (
              <TouchableOpacity onPress={() => nav.navigate('Profile', { userId: post.user.id })} activeOpacity={0.8}>
                <View style={s.statusBadge}>
                  <Text style={s.statusText} numberOfLines={1}>{post.user.statusLabel}</Text>
                </View>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity onPress={() => nav.navigate('Profile', { userId: post.user.id })} activeOpacity={0.8}>
                <Text style={s.username} numberOfLines={1}>
                  {post.user.name}{post.partnerUser && post.partnerAccepted ? ` & ${post.partnerUser.name}` : ''}
                </Text>
              </TouchableOpacity>
            )}

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
              {isLong && !expanded && <Text style={s.seeMore}> {t.see_more}</Text>}
            </Text>
          </TouchableOpacity>
        )}

        {/* Timer + device badge */}
        {!post.isAnnouncement && (
          <View style={s.timerRow}>
            <Animated.View style={{ opacity: isDying ? pulseAnim : 1 }}>
              <SandTimer pct={energyPct} color={clockColor} />
            </Animated.View>
            <Text style={[s.timer, isDying && s.timerDying]}> {timeLeft()}</Text>

            {post.user.showDevice && (
              <LinearGradient
                colors={['rgba(255,255,255,0.18)', 'rgba(255,255,255,0.10)']}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                style={s.deviceBadge}
              >
                <Ionicons name="phone-portrait-outline" size={10} color="rgba(255,255,255,0.75)" />
                <Text style={s.deviceText}>{t.feed_posted_by} {post.deviceModel ?? 'Mobile'}</Text>
              </LinearGradient>
            )}
          </View>
        )}

        {/* ── Barra de energia com gradiente ───────────────────────────────── */}
        {!post.isAnnouncement && expiresMs > 0 && (
          <View style={s.energyWrap}>
            <View style={s.energyTrack}>
              <Animated.View style={[s.energyClip, { width: barWidth }]}>
                <LinearGradient
                  colors={['#CA2851', '#FF6766', '#FFB173']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={s.energyGradient}
                />
              </Animated.View>
            </View>
            {isDying && (
              <Animated.Text style={[s.dyingLabel, { opacity: pulseAnim }]}>
                ⚡ Morrendo... interaja para salvar
              </Animated.Text>
            )}
          </View>
        )}

      </Animated.View>
    </>
  )
}

const s = StyleSheet.create({
  container: { position: 'absolute', left: 16, right: 80, gap: 6, zIndex: 30 },

  userRow:     { flexDirection: 'row', alignItems: 'center', gap: 8 },
  avatarStack: { flexDirection: 'row', alignItems: 'flex-start' },
  partnerAvatarOverlap: { marginLeft: -14, marginTop: 6, zIndex: 1 },

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

  statusBadge: {
    borderRadius: 20, paddingHorizontal: 9, paddingVertical: 4,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.22)',
    backgroundColor: 'rgba(255,255,255,0.13)', maxWidth: 160,
  },
  statusText: {
    color: 'rgba(255,255,255,0.88)', fontFamily: fonts.medium, fontSize: 11, letterSpacing: 0.1,
  },

  deviceBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 7, paddingVertical: 2, borderRadius: 20,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)', marginLeft: 8,
  },
  deviceText: { color: 'rgba(255,255,255,0.75)', fontFamily: fonts.medium, fontSize: 10, letterSpacing: 0.3 },

  caption:    { color: 'rgba(255,255,255,0.88)', fontFamily: fonts.regular, fontSize: 13, lineHeight: 19 },
  seeMore:    { color: 'rgba(255,255,255,0.50)', fontFamily: fonts.medium },

  timerRow:   { flexDirection: 'row', alignItems: 'center', gap: 2 },
  timer:      { color: 'rgba(255,255,255,0.65)', fontFamily: fonts.medium, fontSize: 12, letterSpacing: 0.1 },
  timerDying: { color: '#FF3B30' },

  // ── Energy bar ──────────────────────────────────────────────────────────────
  energyWrap:  { gap: 4 },
  energyTrack: {
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.14)',
    borderRadius: 4,
    overflow: 'hidden',
  },
  energyClip: {
    height: '100%',
    overflow: 'hidden',
    borderRadius: 4,
  },
  energyGradient: {
    position: 'absolute',
    left: 0, top: 0, bottom: 0,
    width: 320,   // wider than any phone — gradient spans full potential bar
  },
  dyingLabel: {
    color: '#FF6766',
    fontFamily: fonts.bold,
    fontSize: 10,
    letterSpacing: 0.3,
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
})
