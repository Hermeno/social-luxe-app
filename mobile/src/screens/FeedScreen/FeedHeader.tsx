import React, { memo } from 'react'
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { Search } from 'lucide-react-native'
import { colors, fonts } from '../../theme'
import AvatarImage from '../../components/AvatarImage'
import { useT } from '../../i18n'
import { Post } from '../../types'

export interface FeedUserGroup {
  user: Post['user']
  posts: Post[]
}

const BUBBLE_SIZE   = 64
const AV_SIZE       = 44   // avatar size in the header bar
const ONLINE_THRESH = 5 * 60 * 1000  // 5 minutes

function isOnline(lastSeen?: string | null): boolean {
  if (!lastSeen) return false
  return Date.now() - new Date(lastSeen).getTime() < ONLINE_THRESH
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
  filteredGroups,
  viewedIds,
  activeUserId,
  searchMode,
  searchQuery,
  onSearchClose,
  onSearchChange,
  onSearchPress,
  onBubblePress,
  onCreatePress,
}: FeedHeaderProps) {
  const { top } = useSafeAreaInsets()
  const t = useT()

  /* ── Search panel ──────────────────────────────────────────────────────────── */
  if (searchMode) {
    return (
      <View style={[s.searchPanel, { paddingTop: top + 10 }]}>

        {/* Input row */}
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
              <TouchableOpacity
                onPress={() => onSearchChange('')}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name="close-circle" size={17} color="rgba(255,255,255,0.45)" />
              </TouchableOpacity>
            )}
          </View>
          <TouchableOpacity
            onPress={onSearchClose}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Text style={s.cancelText}>{t.cancel}</Text>
          </TouchableOpacity>
        </View>

        {/* Large avatar bubbles */}
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
              const allViewed = g.posts.every((p) => viewedIds.has(p.id))
              const isActive  = g.user.id === activeUserId
              return (
                <TouchableOpacity
                  key={g.user.id}
                  style={s.bubble}
                  onPress={() => { onBubblePress(g); onSearchChange('') }}
                  activeOpacity={0.78}
                >
                  <View style={[
                    s.bubbleRing,
                    allViewed  && s.bubbleRingViewed,
                    isActive   && s.bubbleRingActive,
                  ]}>
                    <AvatarImage uri={g.user.avatar} size={BUBBLE_SIZE} borderWidth={0} borderColor="transparent" />
                  </View>
                  <Text style={s.bubbleName} numberOfLines={1}>
                    {g.user.name.split(' ')[0]}
                  </Text>
                </TouchableOpacity>
              )
            })
          )}
        </ScrollView>

      </View>
    )
  }

  /* ── Normal bar ────────────────────────────────────────────────────────────── */
  return (
    <View style={[s.wrapper, { paddingTop: top }]} pointerEvents="box-none">
      <View style={s.bar}>

        {/* Left — fixed: create + search */}
        <View style={s.leftButtons}>
          <TouchableOpacity onPress={onCreatePress} activeOpacity={0.7} style={s.iconBtn}>
            <Ionicons name="add" size={26} color="rgba(255,255,255,0.92)" />
          </TouchableOpacity>
          <TouchableOpacity onPress={onSearchPress} activeOpacity={0.7} style={s.iconBtn}>
            <Search size={22} strokeWidth={2} color="rgba(255,255,255,0.92)" />
          </TouchableOpacity>
        </View>

        {/* Scrollable user avatars — all users with posts */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={s.avatarScroll}
          contentContainerStyle={s.avatarContent}
        >
          {filteredGroups.map((g) => {
            const allViewed = g.posts.every((p) => viewedIds.has(p.id))
            const isActive  = g.user.id === activeUserId
            const online    = isOnline(g.user.lastSeen)
            return (
              <TouchableOpacity
                key={g.user.id}
                style={s.avatarItem}
                onPress={() => onBubblePress(g)}
                activeOpacity={0.78}
              >
                <View style={[
                  s.avatarRing,
                  allViewed  && s.avatarRingViewed,
                  isActive   && s.avatarRingActive,
                ]}>
                  <AvatarImage uri={g.user.avatar} size={AV_SIZE} borderWidth={0} borderColor="transparent" />
                </View>
                {online && <View style={s.onlineDot} />}
              </TouchableOpacity>
            )
          })}
        </ScrollView>

      </View>
    </View>
  )
})

const s = StyleSheet.create({

  /* ── Normal bar ────────────────────────────────────────────────────────────── */
  wrapper: {
    position: 'absolute',
    top: 0, left: 0, right: 0,
    zIndex: 40,
  },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 14,
    paddingVertical: 8,
  },
  leftButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  iconBtn: {
    width: 36, height: 36, borderRadius: 18,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.28)',
  },
  avatarScroll: { flex: 1 },
  avatarContent: {
    paddingLeft: 10,
    paddingRight: 14,
    gap: 8,
    alignItems: 'center',
  },
  avatarItem: { alignItems: 'center' },
  avatarRing: {
    borderRadius: (AV_SIZE + 6) / 2,
    borderWidth: 2.5,
    // Palette: #FF6766 (soft red) for users with new posts
    borderColor: '#FF6766',
    padding: 2,
  },
  // All posts viewed → faint border
  avatarRingViewed: { borderColor: 'rgba(255,255,255,0.20)' },
  // Currently active → #FFB173 (orange from palette)
  avatarRingActive: { borderColor: '#FFB173' },
  onlineDot: {
    position: 'absolute',
    bottom: 1,
    right: 1,
    width: 9,
    height: 9,
    borderRadius: 5,
    // #CA2851 (primary red from palette) as online color
    backgroundColor: '#4CD964',
    borderWidth: 1.5,
    borderColor: '#000',
  },

  /* ── Search panel ──────────────────────────────────────────────────────────── */
  searchPanel: {
    position: 'absolute',
    top: 0, left: 0, right: 0,
    zIndex: 40,
    backgroundColor: 'rgba(0,0,0,0.88)',
    paddingBottom: 14,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginBottom: 12,
    gap: 12,
  },
  searchField: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.11)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.16)',
    paddingHorizontal: 12,
    paddingVertical: 9,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontFamily: fonts.regular,
    fontSize: 15,
    color: '#fff',
    padding: 0,
  },
  cancelText: {
    fontFamily: fonts.semiBold,
    fontSize: 15,
    color: 'rgba(255,255,255,0.88)',
  },

  /* bubbles row */
  bubbleScroll:  { flexGrow: 0 },
  bubbleContent: {
    paddingHorizontal: 16,
    gap: 14,
    alignItems: 'flex-start',
    paddingBottom: 2,
  },
  bubble: {
    alignItems: 'center',
    gap: 5,
    width: BUBBLE_SIZE + 14,
  },
  bubbleRing: {
    borderRadius: (BUBBLE_SIZE + 6) / 2,
    borderWidth: 2.5,
    borderColor: colors.primary,
    padding: 2,
  },
  bubbleRingViewed: {
    borderColor: 'rgba(255,255,255,0.2)',
  },
  bubbleRingActive: {
    borderColor: '#FFB173',
  },
  bubbleName: {
    color: 'rgba(255,255,255,0.82)',
    fontFamily: fonts.medium,
    fontSize: 11,
    textAlign: 'center',
    maxWidth: BUBBLE_SIZE + 12,
  },

  /* empty state */
  emptyWrap: {
    paddingVertical: 18,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
    width: 280,
  },
  emptyTxt: {
    color: 'rgba(255,255,255,0.38)',
    fontFamily: fonts.regular,
    fontSize: 13,
  },
})
