import React, { memo } from 'react'
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
} from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
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

const BUBBLE_SIZE = 64

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

        {/* Left — create */}
        <TouchableOpacity onPress={onCreatePress} activeOpacity={0.7}>
          <LinearGradient
            colors={['rgba(8,8,40,0.10)', 'rgba(16,16,64,0.12)']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={s.createBtn}
          >
            <Ionicons name="add" size={26} color="rgba(255,255,255,0.92)" />
          </LinearGradient>
        </TouchableOpacity>

        <View style={s.spacer} />

        {/* Right — search */}
        <TouchableOpacity onPress={onSearchPress} activeOpacity={0.7}>
          <LinearGradient
            colors={['rgba(8,8,40,0.10)', 'rgba(16,16,64,0.12)']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={s.searchBtn}
          >
            <Search size={26} strokeWidth={2} color="rgba(255,255,255,0.92)" />
          </LinearGradient>
        </TouchableOpacity>

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
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingVertical: 10,
  },
  createBtn: {
    width: 38, height: 38, borderRadius: 19,
    alignItems: 'center', justifyContent: 'center',
  },
  spacer: { flex: 1 },
  searchBtn: {
    width: 38, height: 38, borderRadius: 19,
    alignItems: 'center', justifyContent: 'center',
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
