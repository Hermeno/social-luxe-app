import React, { memo, useEffect, useMemo } from 'react'
import {
  View, Text, TextInput, TouchableOpacity,
  ScrollView, StyleSheet, useWindowDimensions,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import FeedIcon from '../../components/FeedIcon'
import Icon from '../../components/Icon'
import AvatarImage from '../../components/AvatarImage'
import Wordmark from '../../components/Wordmark'
import { colors, fonts, typography } from '../../theme'
import { useAuthStore } from '../../store/auth.store'
import { type SocialPreviewUser, useSocialPreviewStore } from '../../store/socialPreview.store'
import { useT } from '../../i18n'
import { Post } from '../../types'

export interface FeedUserGroup {
  user: Post['user']
  posts: Post[]
}

const SEARCH_AVATAR_SIZE = 54
const FRIEND_AVATAR_SIZE = 20
const FRIEND_OVERLAP = 8

function uniquePeople(...groups: SocialPreviewUser[][]): SocialPreviewUser[] {
  const seen = new Set<string>()
  const people: SocialPreviewUser[] = []
  groups.flat().forEach((person) => {
    if (!person?.id || seen.has(person.id)) return
    seen.add(person.id)
    people.push(person)
  })
  return people.slice(0, 3)
}

function FriendFaces({ people }: { people: SocialPreviewUser[] }) {
  if (people.length === 0) return null

  return (
    <View
      style={s.friendFaces}
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      {people.map((person, index) => (
        <View
          key={person.id}
          style={[
            s.friendFace,
            index > 0 && { marginLeft: -FRIEND_OVERLAP },
            { zIndex: people.length - index },
          ]}
        >
          <AvatarImage
            uri={person.avatar}
            name={person.name}
            size={FRIEND_AVATAR_SIZE}
            borderWidth={0}
            borderColor="transparent"
          />
        </View>
      ))}
    </View>
  )
}

export interface FeedHeaderProps {
  filteredGroups: FeedUserGroup[]
  activeUserId: string | undefined
  searchMode: boolean
  searchQuery: string
  immersive: boolean
  circleInvite: boolean
  onSearchClose: () => void
  onSearchChange: (query: string) => void
  onBubblePress: (group: FeedUserGroup) => void
  onCirclePress: () => void
  onRestoreNavigation: () => void
}

export default memo(function FeedHeader({
  filteredGroups,
  activeUserId,
  searchMode,
  searchQuery,
  immersive,
  circleInvite,
  onSearchClose,
  onSearchChange,
  onBubblePress,
  onCirclePress,
  onRestoreNavigation,
}: FeedHeaderProps) {
  const { top } = useSafeAreaInsets()
  const { width } = useWindowDimensions()
  const t = useT()
  const currentUser = useAuthStore((state) => state.user)
  const followers = useSocialPreviewStore((state) => state.followers)
  const following = useSocialPreviewStore((state) => state.following)
  const loadSocialPreview = useSocialPreviewStore((state) => state.load)
  const friends = useMemo(
    () => uniquePeople(following, followers),
    [followers, following],
  )
  // Em ecrãs compactos, duas caras preservam a história social sem apertar
  // a assinatura nem truncar o CTA. A partir de 360pt cabem as três.
  const visibleFriends = width < 360 ? friends.slice(0, 2) : friends

  useEffect(() => {
    if (currentUser?.id) loadSocialPreview(currentUser.id).catch(() => {})
  }, [currentUser?.id, loadSocialPreview])

  if (searchMode) {
    return (
      <View style={[s.searchPanel, { paddingTop: top }]}>
        <View style={s.searchRow}>
          <View style={s.searchField}>
            <Icon name="search" size={19} color="#66666C" strokeWidth={1.9} />
            <TextInput
              autoFocus
              placeholder={t.feed_search_ph}
              placeholderTextColor="#89898F"
              value={searchQuery}
              onChangeText={onSearchChange}
              style={s.searchInput}
              returnKeyType="search"
              autoCapitalize="none"
              autoCorrect={false}
              selectionColor={colors.primary}
              accessibilityLabel={t.feed_search_ph}
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity
                style={s.clearSearch}
                onPress={() => onSearchChange('')}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel={t.cancel}
              >
                <Icon name="close" size={14} color="#6F6F75" strokeWidth={2} />
              </TouchableOpacity>
            )}
          </View>

          <TouchableOpacity
            style={s.cancelButton}
            onPress={onSearchClose}
            hitSlop={6}
            accessibilityRole="button"
            accessibilityLabel={t.cancel}
          >
            <Text style={s.cancelText}>{t.cancel}</Text>
          </TouchableOpacity>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={s.peopleScroll}
          contentContainerStyle={s.peopleContent}
          keyboardShouldPersistTaps="handled"
        >
          {filteredGroups.length === 0 ? (
            <View style={s.emptySearch}>
              <Text style={s.emptySearchText}>{t.feed_no_users}</Text>
            </View>
          ) : (
            filteredGroups.map((group) => {
              const active = group.user.id === activeUserId
              return (
                <TouchableOpacity
                  key={group.user.id}
                  style={s.person}
                  onPress={() => {
                    onBubblePress(group)
                    onSearchChange('')
                  }}
                  activeOpacity={0.78}
                  accessibilityRole="button"
                  accessibilityLabel={group.user.name}
                  accessibilityState={{ selected: active }}
                >
                  <View style={[s.personAvatarRing, active && s.personAvatarRingActive]}>
                    <AvatarImage
                      uri={group.user.avatar}
                      name={group.user.name}
                      size={SEARCH_AVATAR_SIZE}
                      borderWidth={0}
                      borderColor="transparent"
                    />
                  </View>
                  <Text style={[s.personName, active && s.personNameActive]} numberOfLines={1}>
                    {group.user.name.split(' ')[0]}
                  </Text>
                  <View style={[s.personMarker, active && s.personMarkerActive]} />
                </TouchableOpacity>
              )
            })
          )}
        </ScrollView>
      </View>
    )
  }

  return (
    <View style={[s.topRoot, { height: top + 60 }]} pointerEvents="box-none">
      <View style={[s.topRow, { marginTop: top + 4 }]} pointerEvents="box-none">
        <View style={s.restoreSlot}>
          {immersive && (
            <TouchableOpacity
              style={s.restoreButton}
              onPress={onRestoreNavigation}
              activeOpacity={0.68}
              hitSlop={4}
              accessibilityRole="button"
              accessibilityLabel={t.feed_show_navigation}
            >
              <Icon name="arrow-left" size={20} color="#FFFFFF" strokeWidth={2} />
            </TouchableOpacity>
          )}
        </View>

        <Wordmark height={22} color="#FFFFFF" />

        <View style={s.topSpacer} />

        <TouchableOpacity
          style={s.circleButton}
          onPress={onCirclePress}
          activeOpacity={0.72}
          hitSlop={{ top: 4, bottom: 4, left: 3, right: 3 }}
          accessibilityRole="button"
          accessibilityLabel={circleInvite ? `${t.feed_top_circle}, ${t.pending}` : t.feed_top_circle}
        >
          <FriendFaces people={visibleFriends} />

          <View style={s.circleMark}>
            <FeedIcon name="circle" size={17} color="#FFFFFF" weight="medium" />
            <View style={s.circlePlus}>
              <Icon name="plus" size={10} color="#FFFFFF" strokeWidth={2.5} />
            </View>
          </View>

          <Text style={s.circleButtonText} numberOfLines={1}>{t.circle_errTitle}</Text>

          {circleInvite && (
            <View style={s.inviteBadge}>
              <Icon name="camera" size={9} color="#FFFFFF" strokeWidth={2.3} />
            </View>
          )}
        </TouchableOpacity>
      </View>
    </View>
  )
})

const s = StyleSheet.create({
  topRoot: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 40,
  },
  topRow: {
    height: 44,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  restoreSlot: {
    width: 44,
    height: 44,
  },
  restoreButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  topSpacer: { flex: 1, minWidth: 2 },
  circleButton: {
    flexShrink: 1,
    minHeight: 44,
    maxWidth: 150,
    paddingLeft: 3,
    paddingRight: 2,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    overflow: 'visible',
  },
  friendFaces: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  friendFace: {
    width: FRIEND_AVATAR_SIZE + 2,
    height: FRIEND_AVATAR_SIZE + 2,
    borderRadius: (FRIEND_AVATAR_SIZE + 2) / 2,
    padding: 1,
    backgroundColor: '#FFFFFF',
  },
  circleMark: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  circlePlus: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 12,
    height: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  circleButtonText: {
    flexShrink: 1,
    color: '#FFFFFF',
    fontFamily: fonts.semiBold,
    fontSize: typography.secondary,
    lineHeight: 17,
    letterSpacing: -0.2,
    textShadowColor: 'rgba(0,0,0,0.55)',
    textShadowRadius: 3,
    textShadowOffset: { width: 0, height: 1 },
  },
  inviteBadge: {
    position: 'absolute',
    top: -4,
    right: -3,
    width: 17,
    height: 17,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    borderWidth: 1.5,
    borderColor: '#11161A',
  },

  searchPanel: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 50,
    backgroundColor: '#FCFCFA',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#DDDCD8',
  },
  searchRow: {
    minHeight: 64,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  searchField: {
    flex: 1,
    height: 48,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: 16,
    backgroundColor: '#F0F0ED',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#E0DFDB',
  },
  searchInput: {
    flex: 1,
    height: 48,
    padding: 0,
    color: '#151518',
    fontFamily: fonts.medium,
    fontSize: typography.body,
    letterSpacing: -0.25,
  },
  clearSearch: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#DEDEDA',
  },
  cancelButton: {
    minHeight: 44,
    justifyContent: 'center',
  },
  cancelText: {
    color: '#19191C',
    fontFamily: fonts.semiBold,
    fontSize: typography.secondary,
    letterSpacing: -0.15,
  },
  peopleScroll: { flexGrow: 0 },
  peopleContent: {
    minHeight: 94,
    paddingHorizontal: 14,
    paddingTop: 6,
    paddingBottom: 12,
    alignItems: 'flex-start',
    gap: 12,
  },
  person: {
    width: SEARCH_AVATAR_SIZE + 16,
    alignItems: 'center',
    gap: 4,
  },
  personAvatarRing: {
    padding: 2,
    borderRadius: (SEARCH_AVATAR_SIZE + 6) / 2,
    borderWidth: 1.5,
    borderColor: '#D5D4D0',
  },
  personAvatarRingActive: {
    borderWidth: 2,
    borderColor: colors.primary,
  },
  personName: {
    maxWidth: SEARCH_AVATAR_SIZE + 14,
    color: '#66666A',
    fontFamily: fonts.medium,
    fontSize: typography.meta,
    lineHeight: 14,
    textAlign: 'center',
  },
  personNameActive: {
    color: '#161619',
    fontFamily: fonts.semiBold,
  },
  personMarker: {
    width: 12,
    height: 2,
    borderRadius: 1,
    backgroundColor: 'transparent',
  },
  personMarkerActive: { backgroundColor: colors.primary },
  emptySearch: {
    width: 280,
    minHeight: 72,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptySearchText: {
    color: '#77777C',
    fontFamily: fonts.medium,
    fontSize: typography.secondary,
  },
})
