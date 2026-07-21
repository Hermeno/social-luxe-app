import React, { useState, useRef, useEffect, useMemo } from 'react'
import {
  Animated, View, Text, TouchableOpacity, StyleSheet, Image,
} from 'react-native'
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
import PostOptionsMenu from './PostOptionsMenu'
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
  onDeleted?: (id: string) => void
  onEdited?: (id: string, caption: string) => void
  onBlockingChange?: (open: boolean) => void
}

export default function PostInfo({
  post, isActive, commentCount: commentCountProp, onExpired,
  onDeleted, onEdited, onBlockingChange,
}: Props) {
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
    <View style={s.container}>

      {/* Linha de topo — autor à esquerda, ações à direita */}
      <View style={s.topRow}>

        {/* ── Esquerda: avatar + nome + meta ─────────────────────────────────── */}
        <View style={s.identity}>
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

          <View style={s.nameCol}>
            {/* Nome (ou estado) + selo de vida prolongada */}
            <View style={s.nameLine}>
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

              {post.extended && (
                <View style={s.extBadge}>
                  <Text style={s.extBadgeText}>+24h</Text>
                </View>
              )}
            </View>

            {/* Meta — hora · postado por · anúncio */}
            <View style={s.metaLine}>
              {post.isAnnouncement ? (
                <View style={s.announceBadge}>
                  <Ionicons name="megaphone-outline" size={10} color="#fff" />
                  <Text style={s.announceTxt}>{t.feed_announcement}</Text>
                </View>
              ) : (
                <Animated.View style={{ opacity: isDying ? pulseAnim : 1 }}>
                  <Text style={[s.timer, isDying && s.timerDying]}>{timeLeft()}</Text>
                </Animated.View>
              )}

              {post.user.showDevice && !post.isAnnouncement && (
                <>
                  <Text style={s.metaSep}>·</Text>
                  <Ionicons name="phone-portrait-outline" size={9.5} color="rgba(255,255,255,0.62)" />
                  <Text style={s.metaTxt} numberOfLines={1}>
                    {t.feed_posted_by} {post.deviceModel ?? 'Mobile'}
                  </Text>
                </>
              )}
            </View>

            {/* Pareamento do autor */}
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
          </View>
        </View>

        {/* ── Direita: seguir + opções ───────────────────────────────────────── */}
        <View style={s.actions}>
          {!isSelf && (
            <FollowSplitButton
              following={following}
              loading={loadingFollow}
              onFollow={handleFollow}
              theme="dark"
            />
          )}
          {isSelf && (
            <PostOptionsMenu
              post={post}
              onDeleted={onDeleted}
              onEdited={onEdited}
              onBlockingChange={onBlockingChange}
            />
          )}
        </View>
      </View>

      {/* Legenda — expande para baixo ao toque */}
      {caption.length > 0 && post.mediaType !== 'TEXT' && (
        <TouchableOpacity onPress={() => setExpanded((e) => !e)} activeOpacity={0.8} style={s.captionWrap}>
          <Text style={s.caption}>
            {displayed}
            {isLong && !expanded && <Text style={s.seeMore}> {t.see_more}</Text>}
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
              if (total <= 1) return t.comment_ed
              const others = total - 1
              return `+${others} ${others === 1 ? t.comment_one : t.comment_many}`
            })()}
          </Text>
        </View>
      )}

    </View>
  )
}

const s = StyleSheet.create({
  // Cabeçalho do post — ancorado ao topo, largura toda para a legenda respirar
  container: { position: 'absolute', top: 12, left: 16, right: 14, gap: 8, zIndex: 30 },

  topRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },

  identity:    { flex: 1, flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  avatarStack: { flexDirection: 'row', alignItems: 'flex-start' },
  avatarRing: {
    width: 38, height: 38, borderRadius: 19,
    borderWidth: 1.3, borderColor: 'rgba(255,255,255,0.85)',
    alignItems: 'center', justifyContent: 'center',
  },
  partnerAvatarOverlap: { marginLeft: -14, marginTop: 9, zIndex: 1 },

  // Coluna nome → meta → pareamento, alinhada ao centro óptico do avatar
  nameCol:  { flex: 1, gap: 2, paddingTop: 2 },
  nameLine: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  username: {
    color: colors.white, fontFamily: fonts.semiBold, fontSize: 13,
    letterSpacing: -0.2, flexShrink: 1,
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },

  metaLine: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaSep:  { color: 'rgba(255,255,255,0.40)', fontFamily: fonts.medium, fontSize: 11 },
  metaTxt: {
    color: 'rgba(255,255,255,0.62)', fontFamily: fonts.medium, fontSize: 10.5,
    letterSpacing: 0.1, flexShrink: 1,
  },

  announceBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: 'rgba(245,158,11,0.88)',
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20,
  },
  announceTxt: { color: '#fff', fontFamily: fonts.semiBold, fontSize: 10, letterSpacing: 0.2 },

  // Seguir + 3 pontinhos, à direita e no topo
  actions: { flexDirection: 'row', alignItems: 'center', gap: 2, paddingTop: 3 },

  pairingRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
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

  // Legenda alinhada ao avatar; expande para baixo sem empurrar o cabeçalho
  captionWrap: { marginLeft: 46, marginRight: 6 },
  caption:     { color: 'rgba(255,255,255,0.88)', fontFamily: fonts.regular, fontSize: 13, lineHeight: 19 },
  seeMore:     { color: 'rgba(255,255,255,0.50)', fontFamily: fonts.medium },

  timer:      { color: 'rgba(255,255,255,0.65)', fontFamily: fonts.medium, fontSize: 11, letterSpacing: 0.1 },
  timerDying: { color: '#FF3B30' },

  // ── Commenter avatars ────────────────────────────────────────────────────────
  commentersRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 46,
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
