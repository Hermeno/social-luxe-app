import React, { useRef, useEffect, memo } from 'react'
import {
  View,
  Text,
  TextInput,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Animated,
} from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { Search } from 'lucide-react-native'
import { colors, fonts, spacing } from '../../theme'
import AvatarImage from '../../components/AvatarImage'
import SegmentedRing from '../../components/SegmentedRing'
import { useOnlineStore } from '../../store/online.store'
import { useT } from '../../i18n'
import { Post } from '../../types'

export interface FeedUserGroup {
  user: Post['user']
  posts: Post[]
}

// ─── Ripple rings (online indicator clipped inside the avatar circle) ─────────
const NUM_RINGS       = 3
const RIPPLE_DURATION = 1800
const RIPPLE_STAGGER  = 520

function RippleRings({ size }: { size: number }) {
  const anims = [
    useRef(new Animated.Value(0)).current,
    useRef(new Animated.Value(0)).current,
    useRef(new Animated.Value(0)).current,
  ]
  useEffect(() => {
    const loops = anims.map((anim, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(i * RIPPLE_STAGGER),
          Animated.timing(anim, { toValue: 1, duration: RIPPLE_DURATION, useNativeDriver: true }),
          Animated.timing(anim, { toValue: 0, duration: 0, useNativeDriver: true }),
          Animated.delay((NUM_RINGS - 1 - i) * RIPPLE_STAGGER),
        ]),
      ),
    )
    loops.forEach((l) => l.start())
    return () => loops.forEach((l) => l.stop())
  }, [])

  return (
    <>
      {anims.map((anim, i) => {
        const scale   = anim.interpolate({ inputRange: [0, 1], outputRange: [0, 1] })
        const opacity = anim.interpolate({ inputRange: [0, 0.1, 0.5, 1], outputRange: [0, 0.95, 0.65, 0] })
        return (
          <Animated.View
            key={i}
            style={{
              position: 'absolute',
              width: size, height: size, borderRadius: size / 2,
              backgroundColor: 'rgba(255,255,255,0.92)',
              opacity, transform: [{ scale }],
            }}
          />
        )
      })}
    </>
  )
}

// ─── Bubble item ──────────────────────────────────────────────────────────────
const RING_SIZE   = 84
const AVATAR_SIZE = 70

const BubbleItem = memo(function BubbleItem({
  item, isActive, viewedCount, index, onPress, onNamePress, transparent = false,
}: {
  item: FeedUserGroup
  isActive: boolean
  viewedCount: number
  index: number
  onPress: () => void
  onNamePress: () => void
  transparent?: boolean
}) {
  const t            = useT()
  const isOnlineUser = useOnlineStore((s) => s.isOnline(item.user.id))
  const opacity      = useRef(new Animated.Value(0)).current
  const entryY       = useRef(new Animated.Value(14)).current
  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 280, delay: index * 55, useNativeDriver: true }),
      Animated.spring(entryY, { toValue: 0, speed: 18, bounciness: 7, delay: index * 55, useNativeDriver: true } as any),
    ]).start()
  }, [])

  return (
    <Animated.View style={[bs.item, { opacity, transform: [{ translateY: entryY }] }]}>
      <TouchableOpacity onPress={onPress} activeOpacity={0.75}>
        <View style={bs.ringContainer}>
          <View style={bs.ringWrap}>
            <SegmentedRing
              count={item.posts.length}
              viewedCount={viewedCount}
              size={RING_SIZE}
            />
            <View style={bs.avatarCenter}>
              <View style={{ width: AVATAR_SIZE, height: AVATAR_SIZE, borderRadius: AVATAR_SIZE / 2, overflow: 'hidden' }}>
                <AvatarImage uri={item.user.avatar} size={AVATAR_SIZE} />
                {isOnlineUser && (
                  <View style={StyleSheet.absoluteFillObject} pointerEvents="none">
                    <RippleRings size={AVATAR_SIZE} />
                  </View>
                )}
              </View>
            </View>
          </View>

          {isOnlineUser && (
            <View style={bs.onlineBadgeWrap}>
              <LinearGradient
                colors={['#CA2851', '#FF6766', '#FFB173']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={bs.onlineBadge}
              >
                <Text style={bs.onlineBadgeText}>{t.feed_online}</Text>
              </LinearGradient>
            </View>
          )}
        </View>
      </TouchableOpacity>

      <TouchableOpacity onPress={onNamePress} activeOpacity={0.6} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
        <Text style={[bs.name, isActive && bs.nameActive, transparent && bs.nameTransparent]} numberOfLines={1}>
          {item.user.name.split(' ')[0]}
        </Text>
      </TouchableOpacity>
    </Animated.View>
  )
})

// ─── FeedHeader ───────────────────────────────────────────────────────────────
export interface FeedHeaderProps {
  filteredGroups: FeedUserGroup[]
  viewedIds: Set<string>
  bubblesRef: React.RefObject<FlatList | null>
  activeUserId: string | undefined
  searchMode: boolean
  searchQuery: string
  onSearchClose: () => void
  onSearchChange: (q: string) => void
  onBubblePress: (group: FeedUserGroup) => void
  onNamePress: (userId: string) => void
  onCreatePress: () => void
  transparent?: boolean
}

export default function FeedHeader({
  filteredGroups,
  viewedIds,
  bubblesRef,
  activeUserId,
  searchMode,
  searchQuery,
  onSearchClose,
  onSearchChange,
  onBubblePress,
  onNamePress,
  onCreatePress,
  transparent = false,
}: FeedHeaderProps) {
  const { top } = useSafeAreaInsets()
  const t = useT()

  return (
    <View style={[hs.wrapper, transparent && { backgroundColor: 'transparent' }]}>
      {/* ── Search bar (visible when searchMode is active) ───────────────── */}
      {searchMode && (
        <View style={[hs.searchBar, { paddingTop: top + 4 }]}>
          <View style={[hs.searchField, transparent && hs.searchFieldGlass]}>
            <Search size={15} strokeWidth={2} color={transparent ? 'rgba(255,255,255,0.6)' : colors.gray400} />
            <TextInput
              autoFocus
              placeholder={t.feed_search_ph}
              placeholderTextColor={transparent ? 'rgba(255,255,255,0.45)' : colors.gray400}
              value={searchQuery}
              onChangeText={onSearchChange}
              style={[hs.searchInput, transparent && { color: '#fff' }]}
              returnKeyType="search"
            />
          </View>
          <TouchableOpacity
            onPress={onSearchClose}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Text style={[hs.searchCancel, transparent && { color: 'rgba(255,255,255,0.92)' }]}>{t.cancel}</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* ── Bubbles row ──────────────────────────────────────────────────── */}
      <FlatList
        ref={bubblesRef}
        horizontal
        data={filteredGroups}
        keyExtractor={(g) => g.user.id}
        showsHorizontalScrollIndicator={false}
        style={hs.bubbleRow}
        contentContainerStyle={[hs.bubbleList, { paddingTop: searchMode ? 6 : top + 8 }]}
        onScrollToIndexFailed={() => {}}
        ListHeaderComponent={
          !searchMode ? (
            <TouchableOpacity style={bs.item} onPress={onCreatePress} activeOpacity={0.75}>
              <View style={bs.ringContainer}>
                <LinearGradient
                  colors={['#CA2851', '#FF6766', '#FFB173']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={bs.createCircle}
                >
                  <Ionicons name="add" size={28} color={colors.white} />
                </LinearGradient>
              </View>
              <Text style={[bs.name, transparent && bs.nameTransparent]}>{t.feed_create}</Text>
            </TouchableOpacity>
          ) : null
        }
        renderItem={({ item, index }) => (
          <BubbleItem
            item={item}
            isActive={activeUserId === item.user.id}
            viewedCount={item.posts.filter((p: { id: string }) => viewedIds.has(p.id)).length}
            index={index}
            onPress={() => onBubblePress(item)}
            onNamePress={() => onNamePress(item.user.id)}
            transparent={transparent}
          />
        )}
        ListEmptyComponent={
          <View style={hs.noBubbles}>
            <Text style={[hs.noBubblesText, transparent && { color: 'rgba(255,255,255,0.65)' }]}>
              {searchQuery ? t.feed_no_results : t.feed_no_posts}
            </Text>
          </View>
        }
      />
    </View>
  )
}

// ─── Bubble styles ────────────────────────────────────────────────────────────
const bs = StyleSheet.create({
  item: { alignItems: 'center', gap: 6, width: RING_SIZE },
  ringContainer: {
    width: RING_SIZE, height: RING_SIZE,
    alignItems: 'center', justifyContent: 'center',
    overflow: 'visible',
  },
  ringWrap: {
    width: RING_SIZE, height: RING_SIZE,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarCenter: { position: 'absolute', alignItems: 'center', justifyContent: 'center' },
  onlineBadgeWrap: {
    position: 'absolute', bottom: -9, left: 0, right: 0, alignItems: 'center',
  },
  onlineBadge: {
    borderRadius: 6, paddingHorizontal: 6, paddingVertical: 3,
    borderWidth: 1.5, borderColor: colors.white,
  },
  onlineBadgeText: { color: colors.white, fontSize: 8, fontFamily: fonts.bold, letterSpacing: 0.6 },
  name: { color: '#1A1A1A', fontFamily: fonts.medium, fontSize: 11, textAlign: 'center', letterSpacing: -0.1 },
  nameActive: { color: '#1A1A1A' },
  nameTransparent: { color: 'rgba(255,255,255,0.9)' },
  createCircle: {
    width: AVATAR_SIZE, height: AVATAR_SIZE, borderRadius: AVATAR_SIZE / 2,
    alignItems: 'center', justifyContent: 'center',
  },
})

// ─── Header / search styles ───────────────────────────────────────────────────
const hs = StyleSheet.create({
  wrapper: { backgroundColor: colors.white },

  searchBar: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: spacing.md, paddingBottom: 8, gap: 12,
  },
  searchField: {
    flex: 1, flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.gray100, borderRadius: 12,
    paddingHorizontal: 12, paddingVertical: 9, gap: 8,
  },
  searchFieldGlass: { backgroundColor: 'rgba(255,255,255,0.15)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' },
  searchInput: {
    flex: 1, fontFamily: fonts.regular, fontSize: 15,
    color: colors.gray800, padding: 0,
  },
  searchCancel: { fontFamily: fonts.semiBold, fontSize: 15, color: colors.primary },

  bubbleRow:  { flexGrow: 0, flexShrink: 0 },
  bubbleList: { paddingHorizontal: 12, paddingBottom: 10, gap: 8 },

  noBubbles:     { paddingHorizontal: 20, paddingVertical: 30 },
  noBubblesText: { color: colors.gray400, fontFamily: fonts.regular, fontSize: 13 },
})
