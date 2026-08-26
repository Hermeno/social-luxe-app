import React, { memo, useEffect, useMemo } from 'react'
import {
  View, Text, TextInput, TouchableOpacity,
  ScrollView, StyleSheet, useWindowDimensions,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import Icon from '../../components/Icon'
import AvatarImage from '../../components/AvatarImage'
import Wordmark from '../../components/Wordmark'
import { colors, fonts, radius, typography } from '../../theme'
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
          accessibilityLabel={circleInvite ? `${t.feed_create}, ${t.pending}` : t.feed_create}
        >
          <FriendFaces people={visibleFriends} />

          {/* Um `+` e a palavra, e nada mais. O círculo com o `+` em emblema
              dizia duas coisas ao mesmo tempo — que era um círculo e que se
              acrescentava — e o Círculo passou a ter separador próprio na
              navegação de baixo. Aqui ficou só o que este botão faz: criar. */}
          <View style={s.circlePill}>
            <Icon name="plus" size={17} color="#FFFFFF" strokeWidth={2} absoluteStrokeWidth />
            <Text style={s.circleButtonText} numberOfLines={1}>{t.feed_create}</Text>
          </View>

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

/**
 * Contorno do botão do Círculo.
 *
 * Esteve em `hairlineWidth` (0.33px num @3x) e desaparecia sobre a mídia: fino
 * de mais não é elegante, é invisível. 1px é o mínimo que se lê como contorno
 * desenhado em qualquer fundo, e a 46% de branco firma-se sobre foto escura sem
 * virar linha dura sobre foto clara.
 *
 * O raio é `radius.md` e não `full`: uma cápsula de meia-altura lê-se como
 * etiqueta, e este é um botão. 12 sobre 32 de altura curva o canto o suficiente
 * para não ser um rectângulo, e pouco o bastante para continuar a ser botão.
 */
const outline = {
  borderWidth: 1,
  borderColor: 'rgba(255,255,255,0.46)',
  borderRadius: radius.md,
} as const

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
    width: 36,
    height: 44,
    justifyContent: 'center',
  },
  restoreButton: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  topSpacer: { flex: 1, minWidth: 2 },
  // A fila inteira: caras à esquerda, cápsula à direita. Sem fio — o fio é da
  // cápsula, para as caras ficarem soltas sobre a mídia em vez de emolduradas.
  circleButton: {
    flexShrink: 1,
    height: 36,
    maxWidth: 168,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    overflow: 'visible',
  },
  // Só o botão do Círculo leva o contorno.
  circlePill: {
    ...outline,
    flexShrink: 1,
    // 32 de desenho dentro de uma fila de 36: o `hitSlop` devolve os 44 de área
    // tátil. A cápsula fica menor que a altura da linha e lê-se como botão.
    height: 32,
    paddingLeft: 7,
    paddingRight: 11,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
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
