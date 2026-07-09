import React, { memo, useRef, useEffect, useState } from 'react'
import {
  View, Text, TextInput, TouchableOpacity,
  ScrollView, StyleSheet, Animated,
} from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { Search } from 'lucide-react-native'
import { colors, fonts } from '../../theme'
import AvatarImage from '../../components/AvatarImage'
import SegmentedRing from '../../components/SegmentedRing'
import { useOnlineStore } from '../../store/online.store'
import { useAuthStore } from '../../store/auth.store'
import { useT } from '../../i18n'
import { Post } from '../../types'
import { API_BASE } from '../../config'

export interface FeedUserGroup {
  user: Post['user']
  posts: Post[]
}

const AV_SIZE      = 36   // TEST: was 68
const RING_STROKE  = 3
const RING_OUTER   = AV_SIZE + RING_STROKE * 2 + 6   // ring sits a visible ~3px away from the avatar, like Instagram
const BUBBLE_SIZE  = 56
const BADGE_SIZE   = 14   // TEST: was 22 — scaled down for the smaller AV_SIZE
const OVERLAP      = 21
const MAX_VISIBLE_AVATARS = 7
const ONLINE_THRESH = 5 * 60 * 1000

const GRAD: [string, string, string] = ['#CA2851', '#FF6766', '#FFB173']

function resolveAvatar(uri: string | null | undefined): string | null {
  if (!uri) return null
  return uri.startsWith('http') || uri.startsWith('file://') ? uri : `${API_BASE}${uri}`
}

function isOnlineByLastSeen(lastSeen?: string | null): boolean {
  if (!lastSeen) return false
  return Date.now() - new Date(lastSeen).getTime() < ONLINE_THRESH
}

// ─── White water-ripple rings — clipped inside avatar ────────────────────────
function OnlineRipple({ size }: { size: number }) {
  const a0 = useRef(new Animated.Value(0)).current
  const a1 = useRef(new Animated.Value(0)).current
  const a2 = useRef(new Animated.Value(0)).current

  useEffect(() => {
    const makeLoop = (anim: Animated.Value, delay: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(anim, { toValue: 1, duration: 1600, useNativeDriver: true }),
          Animated.timing(anim, { toValue: 0, duration: 0,    useNativeDriver: true }),
        ])
      )
    const l0 = makeLoop(a0, 0)
    const l1 = makeLoop(a1, 530)
    const l2 = makeLoop(a2, 1060)
    l0.start(); l1.start(); l2.start()
    return () => { l0.stop(); l1.stop(); l2.stop() }
  }, [])

  const ring = (anim: Animated.Value) => ({
    position: 'absolute' as const,
    top: 0, left: 0, right: 0, bottom: 0,
    borderRadius: size / 2,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.95)',
    opacity:   anim.interpolate({ inputRange: [0, 0.08, 0.55, 1], outputRange: [0, 0.9, 0.3, 0] }),
    transform: [{ scale: anim.interpolate({ inputRange: [0, 1], outputRange: [0.15, 1.08] }) }],
  })

  return (
    <>
      <Animated.View pointerEvents="none" style={ring(a0)} />
      <Animated.View pointerEvents="none" style={ring(a1)} />
      <Animated.View pointerEvents="none" style={ring(a2)} />
    </>
  )
}

// ─── Online badge pill ────────────────────────────────────────────────────────
function OnlineBadge() {
  return (
    <LinearGradient
      colors={GRAD}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 0 }}
      style={s.onlineBadge}
    >
      <Text style={s.onlineBadgeTxt}>online</Text>
    </LinearGradient>
  )
}

export interface FeedHeaderProps {
  filteredGroups:  FeedUserGroup[]
  viewedIds:       Set<string>
  activeUserId:    string | undefined
  searchMode:      boolean
  searchQuery:     string
  onSearchClose:   () => void
  onSearchChange:  (q: string) => void
  onSearchPress:   () => void
  onBubblePress:   (group: FeedUserGroup) => void
  onCreatePress:   () => void
}

export default memo(function FeedHeader({
  filteredGroups, viewedIds, activeUserId,
  searchMode, searchQuery,
  onSearchClose, onSearchChange, onSearchPress,
  onBubblePress, onCreatePress,
}: FeedHeaderProps) {
  const { top } = useSafeAreaInsets()
  const t = useT()
  const isSocketOnline = useOnlineStore((s) => s.isOnline)
  const currentUser    = useAuthStore((s) => s.user)
  const [avatarsExpanded, setAvatarsExpanded] = useState(false)
  const hiddenAvatarsCount = Math.max(0, filteredGroups.length - MAX_VISIBLE_AVATARS)
  const visibleGroups = avatarsExpanded ? filteredGroups : filteredGroups.slice(0, MAX_VISIBLE_AVATARS)

  /* ── Search panel ────────────────────────────────────────────────────────── */
  if (searchMode) {
    return (
      <View style={[s.searchPanel, { paddingTop: top + 10 }]}>
        <View style={s.searchRow}>
          <View style={s.searchField}>
            <Search size={14} strokeWidth={2} color="rgba(255,255,255,0.5)" />
            <TextInput
              autoFocus
              placeholder={t.feed_search_ph}
              placeholderTextColor="rgba(255,255,255,0.35)"
              value={searchQuery}
              onChangeText={onSearchChange}
              style={s.searchInput}
              returnKeyType="search"
              autoCapitalize="none"
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => onSearchChange('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Ionicons name="close-circle" size={17} color="rgba(255,255,255,0.45)" />
              </TouchableOpacity>
            )}
          </View>
          <TouchableOpacity onPress={onSearchClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Text style={s.cancelText}>{t.cancel}</Text>
          </TouchableOpacity>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={s.bubbleScroll}
          contentContainerStyle={s.bubbleContent}
          keyboardShouldPersistTaps="handled"
        >
          {filteredGroups.length === 0 ? (
            <View style={s.emptyWrap}>
              <Text style={s.emptyTxt}>Nenhum utilizador encontrado</Text>
            </View>
          ) : (
            filteredGroups.map((g) => {
              const isActive = g.user.id === activeUserId
              return (
                <TouchableOpacity key={g.user.id} style={s.bubble}
                  onPress={() => { onBubblePress(g); onSearchChange('') }} activeOpacity={0.78}>
                  <View style={[s.bubbleRing, isActive && s.bubbleRingActive]}>
                    <AvatarImage uri={g.user.avatar} size={BUBBLE_SIZE} borderWidth={0} borderColor="transparent" />
                  </View>
                  <Text style={s.bubbleName} numberOfLines={1}>{g.user.name.split(' ')[0]}</Text>
                </TouchableOpacity>
              )
            })
          )}
        </ScrollView>
      </View>
    )
  }

  /* ── Normal bar — overlapping avatars with gradient ring ─────────────────── */
  return (
    <View style={[s.wrapper, { paddingTop: top }]} pointerEvents="box-none">
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={s.barScroll}
        contentContainerStyle={s.barContent}
      >
        {/* ── Add button — user avatar + round black "+" badge ── */}
        <TouchableOpacity onPress={onCreatePress} activeOpacity={0.78} style={s.addWrap}>
          <View style={s.avatarCircle}>
            {currentUser?.avatar
              ? <AvatarImage
                  uri={resolveAvatar(currentUser.avatar)}
                  size={AV_SIZE}
                  borderWidth={0}
                  borderColor="transparent"
                />
              : <View style={s.addPlaceholder}>
                  <Ionicons name="person" size={22} color="rgba(255,255,255,0.45)" />
                </View>
            }
          </View>
          <View style={s.addBadge}>
            <Ionicons name="add" size={9} color="#fff" />
          </View>
        </TouchableOpacity>

        {/* ── Friend avatars — overlapping, always coloured ring ── */}
        {visibleGroups.map((g, i) => {
          const online = isSocketOnline(g.user.id) || isOnlineByLastSeen(g.user.lastSeen)

          return (
            <TouchableOpacity
              key={g.user.id}
              onPress={() => onBubblePress(g)}
              activeOpacity={0.78}
              style={[s.avatarTap, i > 0 && { marginLeft: -OVERLAP }]}
            >
              <View style={s.avatarOuter}>
                {/* Gradient ring — always coloured, count=1 viewedCount=0 forces active state */}
                {/* TEST: ring hidden temporarily — <SegmentedRing count={1} size={RING_OUTER} strokeWidth={RING_STROKE} /> */}
                <View style={s.avatarCircle}>
                  <AvatarImage
                    uri={g.user.avatar}
                    size={AV_SIZE}
                    borderWidth={0}
                    borderColor="transparent"
                  />
                  {online && <OnlineRipple size={AV_SIZE} />}
                </View>
                {online && (
                  <View style={s.onlineBadgeWrap}>
                    <OnlineBadge />
                  </View>
                )}
              </View>
            </TouchableOpacity>
          )
        })}

        {/* ── "+N" — keeps the bar from flooding the screen past 7 avatars ── */}
        {!avatarsExpanded && hiddenAvatarsCount > 0 && (
          <TouchableOpacity
            onPress={() => setAvatarsExpanded(true)}
            activeOpacity={0.78}
            style={[s.avatarTap, { marginLeft: -OVERLAP }]}
          >
            <View style={s.moreCircle}>
              <Text style={s.moreCircleTxt}>+{hiddenAvatarsCount}</Text>
            </View>
          </TouchableOpacity>
        )}
      </ScrollView>
    </View>
  )
})

const s = StyleSheet.create({

  /* ── Normal bar ───────────────────────────────────────────────────────────── */
  wrapper: {
    position: 'absolute',
    top: 0, left: 0, right: 0,
    zIndex: 40,
  },
  barScroll: { flex: 1 },
  barContent: {
    paddingLeft:     16,
    paddingRight:    20,
    paddingVertical: 10,
    alignItems:      'center',
    flexDirection:   'row',
  },

  // ── Avatar tap target (includes optional badge below) ────────────────────
  avatarTap: {
    alignItems: 'center',
  },

  // ── Outer ring container — NOT overflow:hidden so ring shows ─────────────
  avatarOuter: {
    width:           RING_OUTER,
    height:          RING_OUTER,
    alignItems:      'center',
    justifyContent:  'center',
  },

  // ── Clipped avatar circle ─────────────────────────────────────────────────
  avatarCircle: {
    width:           AV_SIZE,
    height:          AV_SIZE,
    borderRadius:    AV_SIZE / 2,
    overflow:        'hidden',
    backgroundColor: '#2A2A2A',
  },

  // ── "+N" bubble — tap to reveal avatars past MAX_VISIBLE_AVATARS ─────────
  moreCircle: {
    width:           RING_OUTER,
    height:          RING_OUTER,
    borderRadius:    RING_OUTER / 2,
    alignItems:      'center',
    justifyContent:  'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth:     1.3,
    borderColor:     'rgba(255,255,255,0.35)',
  },
  moreCircleTxt: {
    fontSize:      15,
    fontFamily:    fonts.semiBold,
    color:         '#fff',
    letterSpacing: -0.2,
  },

  // ── Online badge ──────────────────────────────────────────────────────────
  onlineBadgeWrap: {
    position:   'absolute',
    bottom:     -2,
    left:       0,
    right:      0,
    alignItems: 'center',
    zIndex:     10,
  },
  onlineBadge: {
    borderRadius:      4,
    paddingHorizontal: 3,
    paddingVertical:   1,
  },
  onlineBadgeTxt: {
    fontSize:      6.5,
    fontFamily:    fonts.bold,
    color:         '#fff',
    letterSpacing: 0.2,
  },

  // ── Add button — kept clear of the overlapping avatars ───────────────────
  addWrap: {
    marginRight: 14,
  },
  addPlaceholder: {
    flex:            1,
    alignItems:      'center',
    justifyContent:  'center',
    backgroundColor: '#2A2A2A',
  },
  addBadge: {
    position:        'absolute',
    bottom:          0,
    right:           0,
    width:           BADGE_SIZE,
    height:          BADGE_SIZE,
    borderRadius:    BADGE_SIZE / 2,
    backgroundColor: '#000',
    alignItems:      'center',
    justifyContent:  'center',
  },

  /* ── Search panel ─────────────────────────────────────────────────────────── */
  searchPanel: {
    position: 'absolute',
    top: 0, left: 0, right: 0,
    zIndex: 40,
    backgroundColor: 'rgba(0,0,0,0.88)',
    paddingBottom: 14,
  },
  searchRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, marginBottom: 12, gap: 12,
  },
  searchField: {
    flex: 1, flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.11)',
    borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.16)',
    paddingHorizontal: 12, paddingVertical: 9, gap: 8,
  },
  searchInput: {
    flex: 1, fontFamily: fonts.regular, fontSize: 15, color: '#fff', padding: 0,
  },
  cancelText: {
    fontFamily: fonts.semiBold, fontSize: 15, color: 'rgba(255,255,255,0.88)',
  },

  /* ── Bubbles row (search mode) ─────────────────────────────────────────────── */
  bubbleScroll:  { flexGrow: 0 },
  bubbleContent: { paddingHorizontal: 16, gap: 14, alignItems: 'flex-start', paddingBottom: 2 },
  bubble: { alignItems: 'center', gap: 5, width: BUBBLE_SIZE + 14 },
  bubbleRing: {
    borderRadius: (BUBBLE_SIZE + 6) / 2, borderWidth: 2,
    borderColor: colors.primary, padding: 2,
  },
  bubbleRingActive: { borderColor: '#FFB173' },
  bubbleName: {
    color: 'rgba(255,255,255,0.82)', fontFamily: fonts.medium,
    fontSize: 11, textAlign: 'center', maxWidth: BUBBLE_SIZE + 12,
  },
  emptyWrap: {
    paddingVertical: 18, paddingHorizontal: 12,
    alignItems: 'center', justifyContent: 'center', width: 280,
  },
  emptyTxt: { color: 'rgba(255,255,255,0.38)', fontFamily: fonts.regular, fontSize: 13 },
})
