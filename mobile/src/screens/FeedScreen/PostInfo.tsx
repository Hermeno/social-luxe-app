import React, { useState, useRef, useEffect, useMemo } from 'react'
import {
  Animated, View, Text, TouchableOpacity, StyleSheet, Image,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { LinearGradient } from 'expo-linear-gradient'
import { Ionicons } from '@expo/vector-icons'
import { useNavigation } from '@react-navigation/native'
import { StackNavigationProp } from '@react-navigation/stack'
import { Post, Pairing } from '../../types'
import { colors, fonts } from '../../theme'
import { useT } from '../../i18n'
import { useAuthStore } from '../../store/auth.store'
import { useFollowStore } from '../../store/follow.store'
import { getCache, setCache } from '../../db/database'
import { toast } from '../../utils/toast'
import * as postService from '../../services/post.service'
import * as pairingService from '../../services/pairing.service'
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

interface Props {
  post: Post
  isActive: boolean
  commentCount?: number
  onExpired?: () => void
}

// Height of tab bar above the device safe-area bottom (paddingTop + icon row)
const TAB_BAR_ABOVE_SAFE = 42

export default function PostInfo({ post, isActive, commentCount: commentCountProp, onExpired }: Props) {
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
  const [authorPairing, setAuthorPairing] = useState<Pairing | null>(null)

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

  // Pairing badge — only fetched for the post currently on screen, not the whole feed
  useEffect(() => {
    setAuthorPairing(null)
    if (!isActive) return
    let cancelled = false
    pairingService.getUserPairing(post.user.id).then((p) => { if (!cancelled) setAuthorPairing(p) }).catch(() => {})
    return () => { cancelled = true }
  }, [post.user.id, isActive])

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
    } catch {
      toast.error(t.follow_err)
    }
    setLoadingFollow(false)
  }

  // Prefer recentCommenters from the feed response (cached with post, works offline).
  // Fall back to extraCommenters fetched separately for old cached posts.
  const commenters = useMemo<CommenterThumb[]>(() => {
    if (post.recentCommenters && post.recentCommenters.length > 0) return post.recentCommenters
    return extraCommenters
  }, [post.recentCommenters, extraCommenters])

  // ── Energy calculations ─────────────────────────────────────────────────────
  const expiresMs   = post.expiresAt ? new Date(post.expiresAt).getTime() : 0
  const remainingMs = Math.max(0, expiresMs - now)
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

  return (
    <View style={[s.container, { bottom: 16 + tabOffset }]}>

        {/* Avatar(s) + Name + follow */}
        <View style={s.userRow}>
          <View style={s.avatarStack}>
            <TouchableOpacity onPress={() => nav.navigate('Profile', { userId: post.user.id })} activeOpacity={0.8}>
              <View style={s.avatarRing}>
                <AvatarImage uri={post.user.avatar} size={30} />
              </View>
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

        {/* Pairing badge */}
        {authorPairing?.status === 'ACTIVE' && (
          <TouchableOpacity
            onPress={() => nav.navigate('Profile', { userId: pairingService.pairingPartner(authorPairing, post.user.id).id })}
            activeOpacity={0.8}
            style={s.pairingRow}
          >
            <View style={s.pairingDot} />
            <Text style={s.pairingRowTxt} numberOfLines={1}>
              {pairingService.pairingLabel(authorPairing)} · {pairingService.pairingPartner(authorPairing, post.user.id).name}
            </Text>
          </TouchableOpacity>
        )}

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
            <Animated.View style={{ opacity: isDying ? pulseAnim : 1 }}>
              <Text style={[s.timer, isDying && s.timerDying]}>{timeLeft()}</Text>
            </Animated.View>

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
  avatarRing: {
    width: 38, height: 38, borderRadius: 19,
    borderWidth: 1.3, borderColor: 'rgba(255,255,255,0.85)',
    alignItems: 'center', justifyContent: 'center',
  },
  partnerAvatarOverlap: { marginLeft: -14, marginTop: 9, zIndex: 1 },

  nameGroup: { flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 },
  username: {
    color: colors.white, fontFamily: fonts.semiBold, fontSize: 13,
    letterSpacing: -0.2, flexShrink: 1,
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },

  pairingRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: -2 },
  pairingDot: { width: 5, height: 5, borderRadius: 2.5, backgroundColor: colors.primary },
  pairingRowTxt: {
    color: 'rgba(255,255,255,0.75)', fontFamily: fonts.medium, fontSize: 11.5, letterSpacing: -0.1,
    textShadowColor: 'rgba(0,0,0,0.4)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 2,
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
  timer:        { color: 'rgba(255,255,255,0.65)', fontFamily: fonts.medium, fontSize: 12, letterSpacing: 0.1 },
  timerDying:   { color: '#FF3B30' },

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
