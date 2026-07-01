import React, { useState, useRef, useEffect, useMemo } from 'react'
import {
  Animated, View, Text, TouchableOpacity, StyleSheet, Image,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { LinearGradient } from 'expo-linear-gradient'
import { Ionicons } from '@expo/vector-icons'
import Svg, { Polygon, Path } from 'react-native-svg'
import { useNavigation } from '@react-navigation/native'
import { StackNavigationProp } from '@react-navigation/stack'
import { Post } from '../../types'
import { colors, fonts } from '../../theme'
import { useT } from '../../i18n'
import { useAuthStore } from '../../store/auth.store'
import { useFollowStore } from '../../store/follow.store'
import { getCache, setCache } from '../../db/database'
import * as postService from '../../services/post.service'
import { API_BASE } from '../../config'
import AvatarImage from '../../components/AvatarImage'
import FollowSplitButton, { FollowDuration } from '../../components/FollowSplitButton'
import { AppStackParams } from '../../navigation/AppNavigator'

const MAX_COMMENTERS = 4

type CommenterThumb = { id: string; name: string; avatar: string | null }

function uniqueCommenters(
  comments: Array<{ user: CommenterThumb }>,
  post: { user: { id: string } },
): CommenterThumb[] {
  const seen = new Set<string>()
  seen.add(post.user.id) // exclui o autor do post
  const result: CommenterThumb[] = []
  for (const c of comments) {
    if (!c.user?.id || seen.has(c.user.id)) continue
    seen.add(c.user.id)
    result.push(c.user)
    if (result.length >= MAX_COMMENTERS) break
  }
  return result
}

function resolveAvatar(uri: string | null | undefined): string | null {
  if (!uri) return null
  if (uri.startsWith('http') || uri.startsWith('file://')) return uri
  return `${API_BASE}${uri}`
}

type Nav = StackNavigationProp<AppStackParams>

const FULL_LIFE_MS  = 24 * 60 * 60 * 1000   // 24h baseline
const DYING_THRESH  =  2 * 60 * 60 * 1000   // <2h = dying

// ─── Hourglass Icon (Lucide style) ───────────────────────────────────────────
// Viewbox 24×24. Funnel corners: top (7,2)–(17,2), pinch (12,12), bottom (7,22)–(17,22)
// Upper sand shrinks toward pinch as pct drops; lower sand grows from bottom.
function HourglassIcon({ pct, color }: { pct: number; color: string }) {
  const p = Math.max(0, Math.min(100, pct)) / 100   // 1 = full, 0 = empty

  // Upper chamber sand: triangle from (12-p*5, 12-p*10) → (12+p*5, 12-p*10) → (12,12)
  const upY  = 12 - p * 10
  const upHW = p * 5

  // Lower chamber sand: quad from (7,22)→(17,22)→(12+p*5, 12+p*10)→(12-p*5, 12+p*10)
  const loY  = 12 + p * 10
  const loHW = p * 5

  return (
    <Svg width={15} height={15} viewBox="0 0 24 24" fill="none">
      {/* Sand in upper chamber (shrinks as time passes) */}
      {p > 0.02 && (
        <Polygon
          points={`${12 - upHW},${upY} ${12 + upHW},${upY} 12,12`}
          fill={color}
          opacity={0.82}
        />
      )}
      {/* Sand in lower chamber (grows as time passes) */}
      {p < 0.98 && (
        <Polygon
          points={`7,22 17,22 ${12 + loHW},${loY} ${12 - loHW},${loY}`}
          fill={color}
          opacity={0.82}
        />
      )}
      {/* Hourglass outline — exact Lucide paths */}
      <Path
        d="M5 22h14M5 2h14M17 22v-4.172a2 2 0 0 0-.586-1.414L12 12l-4.414 4.414A2 2 0 0 0 7 17.828V22M7 2v4.172a2 2 0 0 0 .586 1.414L12 12l4.414-4.414A2 2 0 0 0 17 6.172V2"
        stroke={color}
        strokeWidth={1.7}
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity={0.92}
      />
    </Svg>
  )
}

interface Props {
  post: Post
  isActive: boolean
  commentCount?: number
  onExpired?: () => void
  voted?: boolean
  extraMs?: number
  voteLoading?: boolean
  onVoteToggle?: () => void
}

// Height of tab bar above the device safe-area bottom (paddingTop + icon row)
const TAB_BAR_ABOVE_SAFE = 42

export default function PostInfo({ post, isActive, commentCount: commentCountProp, onExpired, voted = false, extraMs: extraMsProp = 0, voteLoading = false, onVoteToggle }: Props) {
  const { bottom: safeBottom } = useSafeAreaInsets()
  const tabOffset = TAB_BAR_ABOVE_SAFE + Math.max(safeBottom, 8)
  const { user }    = useAuthStore()
  const nav         = useNavigation<Nav>()
  const t           = useT()
  const following   = useFollowStore((s) => s.followingIds.has(post.user.id))
  const [expanded, setExpanded]           = useState(false)
  const [loadingFollow, setLoadingFollow] = useState(false)
  const [now, setNow]                     = useState(Date.now)
  const [extraCommenters, setExtraCommenters] = useState<CommenterThumb[]>([])

  // Vote animation refs
  const hourglassScale = useRef(new Animated.Value(1)).current
  const floatY         = useRef(new Animated.Value(0)).current
  const floatOpacity   = useRef(new Animated.Value(0)).current
  const voteDirectionRef = useRef<'+' | '-'>('+')  // direction of last tap

  const caption   = post.caption ?? ''
  const isLong    = caption.length > 80
  const displayed = expanded || !isLong ? caption : caption.slice(0, 80) + '...'
  const isSelf    = user?.id === post.user.id

  // Animated values
  const pulseAnim  = useRef(new Animated.Value(1)).current

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

  // Reset state on post change
  useEffect(() => {
    setExpanded(false)
    setExtraCommenters([])
  }, [post.id])

  // Load extra commenters only when recentCommenters is absent (old cached posts)
  useEffect(() => {
    if (post._count.comments === 0) return
    if (post.recentCommenters && post.recentCommenters.length > 0) return
    let cancelled = false

    async function load() {
      // SQLite generic cache (populated when CommentSheet opens)
      const cached = await getCache<Array<{ user: CommenterThumb }>>(`comments:${post.id}`)
        .catch(() => null)
      if (!cancelled && cached && cached.length > 0) {
        setExtraCommenters(uniqueCommenters(cached, post))
        return
      }
      // Fallback: fetch from API and save to cache for next time
      try {
        const fresh = await postService.getComments(post.id)
        if (fresh.length > 0) {
          setCache(`comments:${post.id}`, fresh).catch(() => {})
          if (!cancelled) setExtraCommenters(uniqueCommenters(fresh as any, post))
        }
      } catch {}
    }

    load()
    return () => { cancelled = true }
  }, [post.id])

  async function handleFollow(duration: FollowDuration = 'forever') {
    if (loadingFollow) return
    setLoadingFollow(true)
    try {
      await useFollowStore.getState().toggle(post.user.id, duration, { name: post.user.name, avatar: post.user.avatar ?? null })
    } catch {}
    setLoadingFollow(false)
  }

  // Prefer recentCommenters from the feed response (cached with post, works offline).
  // Fall back to extraCommenters fetched separately for old cached posts.
  const commenters = useMemo<CommenterThumb[]>(() => {
    if (post.recentCommenters && post.recentCommenters.length > 0) return post.recentCommenters
    return extraCommenters
  }, [post.recentCommenters, extraCommenters])

  // ── Energy calculations ─────────────────────────────────────────────────────
  const expiresMs   = (post.expiresAt ? new Date(post.expiresAt).getTime() : 0) + extraMsProp
  const remainingMs = Math.max(0, expiresMs - now)
  const energyPct   = Math.min(100, (remainingMs / FULL_LIFE_MS) * 100)
  const isDying     = remainingMs > 0 && remainingMs < DYING_THRESH
  const isExpired   = expiresMs > 0 && remainingMs === 0

  // Dying pulse
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

  function timeLeft() {
    if (isExpired) return 'Expirado'
    const h = Math.floor(remainingMs / 3_600_000)
    if (h > 0) return `${h}h`
    const m = Math.floor(remainingMs / 60_000)
    return `${m}m`
  }

  const clockColor = isDying ? '#FF3B30' : 'rgba(255,255,255,0.65)'

  function handleVoteExtend() {
    if (voteLoading || post.isAnnouncement) return
    voteDirectionRef.current = voted ? '-' : '+'

    // Hourglass pulse
    Animated.sequence([
      Animated.spring(hourglassScale, { toValue: 1.6, useNativeDriver: true, speed: 60, bounciness: 14 }),
      Animated.spring(hourglassScale, { toValue: 1,   useNativeDriver: true, speed: 25, bounciness: 8 }),
    ]).start()

    // Floating label rises and fades
    floatY.setValue(0)
    floatOpacity.setValue(1)
    Animated.parallel([
      Animated.timing(floatY,       { toValue: -52, duration: 900, useNativeDriver: true }),
      Animated.sequence([
        Animated.delay(350),
        Animated.timing(floatOpacity, { toValue: 0, duration: 550, useNativeDriver: true }),
      ]),
    ]).start()

    onVoteToggle?.()
  }

  return (
    <View style={[s.container, { bottom: 16 + tabOffset }]}>

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
                <LinearGradient
                  colors={['rgba(8,8,40,0.10)', 'rgba(16,16,64,0.12)']}
                  start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                  style={s.statusBadge}
                >
                  <Text style={s.statusText} numberOfLines={1}>{post.user.statusLabel}</Text>
                </LinearGradient>
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

        {/* Avatares dos comentadores */}
        {commenters.length > 0 && (
          <View style={s.commentersRow}>
            {commenters.map((c, i) => {
              const uri = resolveAvatar(c.avatar)
              return (
                <View key={c.id} style={[s.commenterAvatar, { marginLeft: i === 0 ? 0 : -9, zIndex: MAX_COMMENTERS - i }]}>
                  {uri ? (
                    <Image source={{ uri }} style={s.commenterImg} />
                  ) : (
                    <View style={[s.commenterImg, s.commenterFallback]}>
                      <Text style={s.commenterInitial}>{c.name?.[0]?.toUpperCase() ?? '?'}</Text>
                    </View>
                  )}
                </View>
              )
            })}
            <Text style={s.commentersLabel}>
              {(() => {
                const total = commentCountProp ?? post._count.comments
                return total > 1
                  ? `+${total - 1} comentário${total > 2 ? 's' : ''}`
                  : 'comentou'
              })()}
            </Text>
          </View>
        )}

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
            <View style={s.timerTapWrap}>
              <TouchableOpacity
                onPress={handleVoteExtend}
                activeOpacity={0.7}
                style={s.timerTap}
                disabled={voteLoading}
              >
                <Animated.View style={[{ opacity: isDying ? pulseAnim : 1 }, { transform: [{ scale: hourglassScale }] }]}>
                  <HourglassIcon pct={energyPct} color={clockColor} />
                </Animated.View>
                <Text style={[s.timer, isDying && s.timerDying]}> {timeLeft()}</Text>
              </TouchableOpacity>

              {/* Floating +10min / -10min label */}
              <Animated.Text style={[s.floatLabel, { transform: [{ translateY: floatY }], opacity: floatOpacity, color: voteDirectionRef.current === '+' ? '#4CD964' : '#FF6766' }]}>
                {voteDirectionRef.current === '+' ? '+10min' : '-10min'}
              </Animated.Text>
            </View>

            {post.user.showDevice && (
              <LinearGradient
                colors={['rgba(8,8,40,0.10)', 'rgba(16,16,64,0.12)']}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                style={s.deviceBadge}
              >
                <Ionicons name="phone-portrait-outline" size={10} color="rgba(255,255,255,0.75)" />
                <Text style={s.deviceText}>{t.feed_posted_by} {post.deviceModel ?? 'Mobile'}</Text>
              </LinearGradient>
            )}
          </View>
        )}


    </View>
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
    maxWidth: 160,
  },
  statusText: {
    color: 'rgba(255,255,255,0.88)', fontFamily: fonts.medium, fontSize: 11, letterSpacing: 0.1,
  },

  deviceBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 7, paddingVertical: 2, borderRadius: 20,
    marginLeft: 8,
  },
  deviceText: { color: 'rgba(255,255,255,0.75)', fontFamily: fonts.medium, fontSize: 10, letterSpacing: 0.3 },

  caption:    { color: 'rgba(255,255,255,0.88)', fontFamily: fonts.regular, fontSize: 13, lineHeight: 19 },
  seeMore:    { color: 'rgba(255,255,255,0.50)', fontFamily: fonts.medium },

  timerRow:     { flexDirection: 'row', alignItems: 'center', gap: 2 },
  timerTapWrap: { position: 'relative' },
  timerTap:     { flexDirection: 'row', alignItems: 'center' },
  timer:        { color: 'rgba(255,255,255,0.65)', fontFamily: fonts.medium, fontSize: 12, letterSpacing: 0.1 },
  timerDying:   { color: '#FF3B30' },
  floatLabel: {
    position: 'absolute',
    left: 0,
    bottom: 0,
    color: '#4CD964',
    fontFamily: fonts.bold,
    fontSize: 13,
    letterSpacing: 0.3,
    textShadowColor: 'rgba(0,0,0,0.4)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },

  // ── Commenter avatars ────────────────────────────────────────────────────────
  commentersRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: -2,
  },
  commenterAvatar: {
    width: 22, height: 22, borderRadius: 11,
    overflow: 'hidden',
  },
  commenterImg: { width: '100%', height: '100%' },
  commenterFallback: {
    backgroundColor: 'rgba(202,40,81,0.7)',
    alignItems: 'center', justifyContent: 'center',
  },
  commenterInitial: {
    color: '#fff', fontSize: 9, fontFamily: fonts.bold,
  },
  commentersLabel: {
    color: 'rgba(255,255,255,0.65)',
    fontFamily: fonts.medium,
    fontSize: 11,
    marginLeft: 6,
    letterSpacing: -0.1,
    textShadowColor: 'rgba(0,0,0,0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
})
