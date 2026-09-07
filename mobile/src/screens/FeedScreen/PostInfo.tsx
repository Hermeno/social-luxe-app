import React, { useState, useRef, useEffect, useMemo } from 'react'
import {
  Animated, View, Text, TouchableOpacity, StyleSheet, Image,
} from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useNavigation } from '@react-navigation/native'
import { StackNavigationProp } from '@react-navigation/stack'
import { Post, Pairing } from '../../types'
import { brandPalette, colors, radius, sheet, spacing } from '../../theme'
import Icon from '../../components/Icon'
import { feedIcon, feedInk, feedLine, feedTextShadow, feedType, RAIL_CLEARANCE } from './tokens'
import { useT } from '../../i18n'
import { useAuthStore } from '../../store/auth.store'
import { useFollowStore } from '../../store/follow.store'
import { getUserFollowers, FollowUser } from '../../services/follow.service'
import { getCache, setCache } from '../../db/database'
import { toast } from '../../utils/toast'
import * as postService from '../../services/post.service'
import * as pairingService from '../../services/pairing.service'
import { API_BASE } from '../../config'
import AvatarImage from '../../components/AvatarImage'
import VerifiedBadge from '../../components/VerifiedBadge'
import AuthorAvatar from '../../components/AuthorAvatar'
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
  /** Feed: cabeçalho na faixa branca do topo, texto escuro. Sem isto (PostViewer):
   *  sobreposto no vídeo, em baixo, texto branco. */
  light?: boolean
  /** A descrição vive sempre em baixo-esquerda, à parte — por isso o bloco do
   *  autor (topo branco e imersivo) não a repete. */
  hideCaption?: boolean
  onExpired?: () => void
}

export default function PostInfo({
  post, isActive, commentCount: commentCountProp, light = false, hideCaption = false, onExpired
}: Props) {
  const { user }    = useAuthStore()
  const nav         = useNavigation<Nav>()
  const t           = useT()
  const { bottom: safeBottom, top: safeTop } = useSafeAreaInsets()
  const following   = useFollowStore((s) => s.followingIds.has(post.user.id))
  const [expanded, setExpanded]           = useState(false)
  const [loadingFollow, setLoadingFollow] = useState(false)
  const [now, setNow]                     = useState(Date.now)
  const [extraCommenters, setExtraCommenters] = useState<CommenterThumb[]>([])
  const [authorPairing, setAuthorPairing] = useState<Pairing | null>(null)
  // Seguidores do postador — aparecem enquanto sigo, somem se deixar de seguir
  const [followers, setFollowers] = useState<FollowUser[]>([])
  useEffect(() => {
    if (!light || !following || followers.length > 0) return
    let cancelled = false
    getUserFollowers(post.user.id).then((fs) => { if (!cancelled) setFollowers(fs) }).catch(() => {})
    return () => { cancelled = true }
  }, [light, following, post.user.id])

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
    <>
    {/* Autor + legenda + comentadores num só bloco, em baixo, por cima dos
        ícones de like/comentar. Ancorado por baixo → cresce para cima. */}
    <View style={[s.container, light ? { top: safeTop + 134 } : { bottom: safeBottom + 176 }]}>

      {/* Linha de topo — autor à esquerda, ações à direita */}
      <View style={s.topRow}>

        {/* ── Esquerda: avatar + nome + meta ─────────────────────────────────── */}
        <View style={s.identity}>
          <View style={s.avatarStack}>
            <TouchableOpacity
              onPress={() => nav.navigate('Profile', { userId: post.user.id })}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel={post.user.name}
            >
              <AuthorAvatar
                uri={post.user.avatar}
                name={post.user.name}
                avatarSize={30}
                ringWidth={1.75}
                gap={2.25}
                wellColor={light ? sheet.surface : colors.feedSurface}
              />
            </TouchableOpacity>
            {post.partnerUser && post.partnerAccepted && (
              <TouchableOpacity
                onPress={() => nav.navigate('Profile', { userId: post.partnerUser!.id })}
                activeOpacity={0.8}
                style={s.partnerAvatarOverlap}
                accessibilityRole="button"
                accessibilityLabel={post.partnerUser.name}
              >
                <AuthorAvatar
                  uri={post.partnerUser.avatar}
                  name={post.partnerUser.name}
                  avatarSize={24}
                  ringWidth={1.5}
                  gap={0.5}
                  wellColor={light ? sheet.surface : colors.feedSurface}
                />
              </TouchableOpacity>
            )}
          </View>

          <View style={s.nameCol}>
            {/* Nome (ou estado) + selo de vida prolongada */}
            <View style={s.nameLine}>
              {post.user.statusLabel ? (
                <TouchableOpacity
                  onPress={() => nav.navigate('Profile', { userId: post.user.id })}
                  activeOpacity={0.8}
                  accessibilityRole="button"
                  accessibilityLabel={`${post.user.name}, ${post.user.statusLabel}`}
                >
                  <LinearGradient
                    colors={[STATUS_TINT, STATUS_TINT]}
                    start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                    style={s.statusBadge}
                  >
                    <Text style={s.statusText} numberOfLines={1}>{post.user.statusLabel}</Text>
                  </LinearGradient>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  onPress={() => nav.navigate('Profile', { userId: post.user.id })}
                  activeOpacity={0.8}
                  accessibilityRole="button"
                  accessibilityLabel={post.user.name}
                >
                  <View style={s.nameWithBadge}>
                    <Text style={[s.username, light && s.usernameLight]} numberOfLines={1}>
                      {post.user.name}{post.partnerUser && post.partnerAccepted ? ` & ${post.partnerUser.name}` : ''}
                    </Text>
                    {post.user.isVerified && (
                      <VerifiedBadge color={light ? colors.primary : feedInk.primary} />
                    )}
                  </View>
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
                  <Icon name="megaphone" size={feedIcon.inline} color={feedInk.primary} />
                  <Text style={s.announceTxt}>{t.feed_announcement}</Text>
                </View>
              ) : (
                <Animated.View style={{ opacity: isDying ? pulseAnim : 1 }}>
                  <Text style={[s.timer, light && s.timerLight, isDying && s.timerDying]}>{timeLeft()}</Text>
                </Animated.View>
              )}

              {post.user.showDevice && !post.isAnnouncement && (
                <>
                  <Text style={[s.metaSep, light && s.metaLightTxt]}>·</Text>
                  <Icon name="smartphone" size={feedIcon.inline} color={feedInk.muted} />
                  <Text style={[s.metaTxt, light && s.metaLightTxt]} numberOfLines={1}>
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
                accessibilityRole="button"
                accessibilityLabel={`${pairingService.pairingLabel(authorPairing)} · ${pairingService.pairingPartner(authorPairing, post.user.id).name}`}
              >
                <View style={s.pairingDot} />
                <Text style={[s.pairingRowTxt, light && s.pairingRowTxtLight]} numberOfLines={1}>
                  {pairingService.pairingLabel(authorPairing)} · {pairingService.pairingPartner(authorPairing, post.user.id).name}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* ── Direita: interruptor Seguir|Seguindo + seguidores (feed) ou botão ── */}
        <View style={s.actions}>
          {!isSelf && (light ? (
            <View style={s.segToggle}>
              <TouchableOpacity
                style={s.segItem}
                activeOpacity={0.8}
                onPress={() => { if (following) handleFollow('forever') }}
                accessibilityRole="button"
                accessibilityLabel={`${t.follow} ${post.user.name}`}
                accessibilityState={{ selected: !following }}
              >
                <Text style={[s.segTxt, !following && s.segTxtActive]}>{t.follow}</Text>
                <View style={[s.segUnderline, !following && s.segUnderlineOn]} />
              </TouchableOpacity>
              <TouchableOpacity
                style={s.segItem}
                activeOpacity={0.8}
                onPress={() => { if (!following) handleFollow('forever') }}
                accessibilityRole="button"
                accessibilityLabel={`${t.following} ${post.user.name}`}
                accessibilityState={{ selected: following }}
              >
                {/* "Seguindo" + avatares ao lado; o traço passa por baixo de ambos */}
                <View style={s.segRow}>
                  <Text style={[s.segTxt, following && s.segTxtActive]}>{t.following}</Text>
                  {following && followers.length > 0 && (
                    <View style={s.followerStack}>
                      {followers.slice(0, 3).map((f, i) => (
                        <View key={f.id} style={[i > 0 && s.followerOverlap, { zIndex: 3 - i }]}>
                          <AvatarImage uri={f.avatar} name={f.name} size={14} />
                        </View>
                      ))}
                    </View>
                  )}
                </View>
                <View style={[s.segUnderline, following && s.segUnderlineOn]} />
              </TouchableOpacity>
            </View>
          ) : (
            <FollowSplitButton
              following={following}
              loading={loadingFollow}
              onFollow={handleFollow}
              theme="dark"
            />
          ))}
        </View>
      </View>

      {/* Legenda — expande para baixo ao toque */}
      {!hideCaption && caption.length > 0 && post.mediaType !== 'TEXT' && (
        <TouchableOpacity
          onPress={() => setExpanded((e) => !e)}
          activeOpacity={0.8}
          style={[s.captionWrap, light && s.captionWrapLight]}
          accessibilityRole="button"
          accessibilityLabel={caption}
          accessibilityState={{ expanded }}
        >
          <Text style={[s.caption, light && s.captionLight]} numberOfLines={light && !expanded ? 1 : undefined}>
            {displayed}
            {isLong && !expanded && <Text style={[s.seeMore, light && s.seeMoreLight]}> {t.see_more}</Text>}
          </Text>
        </TouchableOpacity>
      )}

    </View>
    </>
  )
}

/**
 * O véu do selo de estado e o fundo de um avatar em falta.
 *
 * Estavam escritos como `rgba(89,72,249,…)` e `rgba(194,70,230,…)` — o `indigo`
 * e o `magenta` da paleta copiados à mão em decimal. Escritos assim, sobrevivem
 * intactos à próxima troca de paleta: foi o que aconteceu quando a marca passou
 * de carmim a laranja e de laranja a azul, e estes ficaram para trás.
 */
const STATUS_TINT     = `${brandPalette.indigo}1F`
const AVATAR_FALLBACK = `${brandPalette.magenta}B3`

const s = StyleSheet.create({
  // Bloco do autor — agora ancorado em baixo (nome + Seguir por cima dos ícones)
  container: { position: 'absolute', left: spacing.md, right: spacing.md, gap: spacing.sm, zIndex: 30 },

  topRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm2 },

  identity:    { flex: 1, flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  avatarStack: { flexDirection: 'row', alignItems: 'flex-start' },
  partnerAvatarOverlap: { marginLeft: -14, marginTop: spacing.sm, zIndex: 1 },

  // Coluna nome → meta → pareamento, alinhada ao centro óptico do avatar
  nameCol:  { flex: 1, gap: spacing.xxs, paddingTop: spacing.xxs },
  nameLine: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs2 },
  // Nome e legenda mantêm a mesma escala compacta; a hierarquia vem dos cortes
  // 900 e 700, não de aumentar o nome e levantar a altura do bloco.
  nameWithBadge: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, flexShrink: 1 },
  username: {
    ...feedTextShadow,
    ...feedType.author,
    color: feedInk.primary, flexShrink: 1,
  },

  metaLine: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  metaSep:  { ...feedTextShadow, ...feedType.meta, color: feedInk.muted },
  metaTxt: {
    ...feedTextShadow,
    ...feedType.meta,
    color: feedInk.muted, flexShrink: 1,
  },

  announceBadge: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.xs,
    backgroundColor: `${brandPalette.violet}E0`,
    paddingHorizontal: spacing.sm, paddingVertical: spacing.xs, borderRadius: radius.full,
  },
  announceTxt: {
    ...feedType.meta,
    color: feedInk.primary,
  },

  // Seguir + 3 pontinhos, à direita e no topo
  actions: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingTop: spacing.xs },

  // Interruptor Seguir | Seguindo — o foco é uma linha por baixo, sem cor
  segToggle: { flexDirection: 'row', gap: spacing.md },
  segItem: { minHeight: 44, justifyContent: 'center', alignItems: 'center', paddingBottom: spacing.xs2 },
  segRow:  { flexDirection: 'row', alignItems: 'center', gap: spacing.xs2 },
  segTxt: { ...feedType.primary, color: sheet.inkFaint },
  segTxtActive: { color: sheet.ink },
  segUnderline: { height: 2, alignSelf: 'stretch', borderRadius: radius.full, marginTop: spacing.xs, backgroundColor: 'transparent' },
  segUnderlineOn: { backgroundColor: sheet.ink },

  // Avatares dos seguidores — pequenos, ao lado do "Seguindo"
  followerStack:  { flexDirection: 'row', alignItems: 'center' },
  followerOverlap:{ marginLeft: -spacing.xs2 },

  pairingRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs2 },
  pairingDot: { width: 5, height: 5, borderRadius: radius.full, backgroundColor: feedInk.primary },
  pairingRowTxt: {
    ...feedTextShadow,
    ...feedType.meta,
    color: feedInk.muted,
  },

  extBadge:     { backgroundColor: colors.primary, borderRadius: radius.full, paddingHorizontal: spacing.xs2, paddingVertical: 1 },
  extBadgeText: { ...feedType.badge, color: colors.white },

  statusBadge: {
    borderRadius: radius.full, paddingHorizontal: spacing.sm, paddingVertical: spacing.xs,
    maxWidth: 160,
  },
  statusText: {
    ...feedTextShadow,
    ...feedType.meta,
    color: feedInk.secondary,
  },

  // Legenda alinhada ao avatar; expande para baixo sem empurrar o cabeçalho
  captionWrap: { marginLeft: 46, marginRight: spacing.xs2 },
  caption:     {
    ...feedTextShadow,
    ...feedType.content,
    color: feedInk.secondary,
  },
  seeMore:     { color: feedInk.muted },

  timer:      {
    ...feedTextShadow,
    ...feedType.meta,
    color: feedInk.muted,
  },
  timerDying: { color: brandPalette.purple },

  // ── Variante clara (feed): texto escuro sobre a faixa branca, sem sombras ──
  // A variante clara herda os tamanhos de cima e só troca a tinta — sem sombra,
  // que sobre branco só suja as letras.
  usernameLight:      { color: sheet.ink, letterSpacing: -0.3, textShadowColor: 'transparent' },
  metaLightTxt:       { color: sheet.inkMuted, textShadowColor: 'transparent' },
  pairingRowTxtLight: { color: sheet.inkMuted, textShadowColor: 'transparent' },
  captionWrapLight:   { marginLeft: 0, marginTop: spacing.xs2 },
  captionLight:       { color: sheet.inkSoft, textShadowColor: 'transparent' },
  seeMoreLight:       { color: sheet.inkFaint },
  timerLight:         { color: sheet.inkFaint, textShadowColor: 'transparent' },

  // ── Commenter avatars ────────────────────────────────────────────────────────
  // Ancorado ao fundo-esquerda; à direita deixa espaço para a coluna de ações.
  commentersBottom: {
    position: 'absolute',
    left: spacing.md, right: RAIL_CLEARANCE,
    zIndex: 30,
  },
  commentersRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  commenterAvatar: {
    width: 22, height: 22, borderRadius: radius.full,
    overflow: 'hidden',
  },
  commenterImg: { width: '100%', height: '100%' },
  commenterFallback: {
    backgroundColor: AVATAR_FALLBACK,
    alignItems: 'center', justifyContent: 'center',
  },
  commenterInitial: {
    ...feedType.badge,
    color: feedInk.primary,
  },
  commentersLabel: {
    ...feedTextShadow,
    ...feedType.meta,
    color: feedInk.muted,
    marginLeft: spacing.xs2,
  }
})
