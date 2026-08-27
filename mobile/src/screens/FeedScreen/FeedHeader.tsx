import React, { memo, useEffect, useMemo } from 'react'
import {
  View, Text, TextInput, TouchableOpacity,
  ScrollView, StyleSheet, useWindowDimensions,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import Icon from '../../components/Icon'
import AvatarImage from '../../components/AvatarImage'
import Wordmark from '../../components/Wordmark'
import { colors, fonts, leading, radius, sheet, spacing, typography } from '../../theme'
import { feedIcon, feedInk, feedLine, feedTextShadow, FEED_STROKE } from './tokens'
import { useAuthStore } from '../../store/auth.store'
import { type SocialPreviewUser, useSocialPreviewStore } from '../../store/socialPreview.store'
import { useT } from '../../i18n'
import { Post } from '../../types'

export interface FeedUserGroup {
  user: Post['user']
  posts: Post[]
}

const SEARCH_AVATAR_SIZE = 46
const FRIEND_AVATAR_SIZE = 18
const FRIEND_OVERLAP = 6

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
  onRelationPress: (mode: 'following' | 'followers') => void
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
  onRelationPress,
}: FeedHeaderProps) {
  const { top } = useSafeAreaInsets()
  const { width } = useWindowDimensions()
  const t = useT()
  const currentUser = useAuthStore((state) => state.user)
  const followers = useSocialPreviewStore((state) => state.followers)
  const following = useSocialPreviewStore((state) => state.following)
  const loadSocialPreview = useSocialPreviewStore((state) => state.load)
  // As caras eram `uniquePeople(following, followers)` — uma mistura das duas
  // listas. Enquanto não tinham legenda, misturar não custava nada; a partir do
  // momento em que uma palavra as descreve, tem de ser verdade. Por isso a fonte
  // passou a ser uma lista de cada vez: quem segues, se segues alguém; senão,
  // quem te segue. A palavra por baixo diz sempre qual das duas está ali.
  const relation: 'following' | 'followers' = following.length > 0 ? 'following' : 'followers'
  const relationPeople = relation === 'following' ? following : followers
  const friends = useMemo(() => uniquePeople(relationPeople), [relationPeople])
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
            <Icon name="search" size={feedIcon.control} color={sheet.inkMuted} strokeWidth={FEED_STROKE} absoluteStrokeWidth />
            <TextInput
              autoFocus
              placeholder={t.feed_search_ph}
              placeholderTextColor={sheet.inkMuted}
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
                <Icon name="close" size={feedIcon.small} color={sheet.inkMuted} strokeWidth={FEED_STROKE} absoluteStrokeWidth />
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
                  <View style={s.personAvatar}>
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
              <Icon name="arrow-left" size={feedIcon.control} color={feedInk.primary} strokeWidth={FEED_STROKE} absoluteStrokeWidth />
            </TouchableOpacity>
          )}
        </View>

        <View style={s.topInkShadow} pointerEvents="none">
          <Wordmark height={22} color={feedInk.primary} />
        </View>

        {/* As caras estavam dentro do botão Criar, sem nada que dissesse quem
            eram: liam-se como decoração do botão e tocar nelas abria a câmara.
            Agora são um alvo próprio, com a palavra ao lado a dizer o que estás
            a ver — e levam à lista de onde saíram.
            A palavra vem primeiro e as caras a seguir: lê-se "Seguindo: estes",
            que é a ordem em que a frase faz sentido. */}
        <View style={s.topActions} pointerEvents="box-none">
          {visibleFriends.length > 0 && (
            <TouchableOpacity
              style={s.relation}
              onPress={() => onRelationPress(relation)}
              activeOpacity={0.72}
              hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}
              accessibilityRole="button"
              accessibilityLabel={relation === 'following' ? t.following : t.followers}
            >
              <Text style={s.relationLabel} numberOfLines={1}>
                {relation === 'following' ? t.following : t.followers}
              </Text>
              <FriendFaces people={visibleFriends} />
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={s.circleButton}
            onPress={onCirclePress}
            activeOpacity={0.72}
            hitSlop={{ top: 4, bottom: 4, left: 3, right: 3 }}
            accessibilityRole="button"
            accessibilityLabel={circleInvite ? `${t.feed_create}, ${t.pending}` : t.feed_create}
          >
            {/* Um `+` e a palavra, e nada mais. O círculo com o `+` em emblema
                dizia duas coisas ao mesmo tempo — que era um círculo e que se
                acrescentava — e o Círculo passou a ter separador próprio na
                navegação de baixo. Aqui ficou só o que este botão faz: criar. */}
            <View style={s.circlePill}>
              <View style={s.topInkShadow}>
                <Icon name="plus" size={14} color={feedInk.primary} strokeWidth={1.5} absoluteStrokeWidth />
              </View>
              <Text style={s.circleButtonText} numberOfLines={1}>{t.feed_create}</Text>
            </View>

            {circleInvite && (
              <View style={s.inviteBadge}>
                <Icon name="camera" size={feedIcon.badge} color={feedInk.primary} strokeWidth={FEED_STROKE} absoluteStrokeWidth />
              </View>
            )}
          </TouchableOpacity>
        </View>
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
  borderColor: feedLine.strong,
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
    // A mesma régua do bloco do autor e do traço do tempo. Esteve em 12 e o
    // logo não alinhava com o nome que aparece por baixo dele.
    paddingHorizontal: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    // Centrado como um grupo, mas com três distâncias diferentes — é o que diz
    // ao olho o que pertence a quê:
    //
    //   assinatura  ──24──  [ caras ─12─ Criar ]
    //                          └ rótulo ─4─ rostos ┘
    //
    // 24 separa a assinatura das acções: são coisas de natureza diferente e a
    // distância tem de o dizer. 12 separa as caras do Criar, que também não são
    // a mesma coisa. 4 cola o rótulo aos rostos, que são.
    justifyContent: 'center',
    gap: spacing.lg,
  },
  topActions: {
    flexShrink: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm2,
  },
  restoreSlot: {
    position: 'absolute',
    left: spacing.md,
    top: 0,
    bottom: 0,
    width: 36,
    justifyContent: 'center',
  },
  restoreButton: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.36,
    shadowRadius: 2,
  },
  topInkShadow: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.36,
    shadowRadius: 2,
  },
  // A fila inteira: caras à esquerda, cápsula à direita. Sem fio — o fio é da
  // cápsula, para as caras ficarem soltas sobre a mídia em vez de emolduradas.
  relation: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    // Não encolhe: quem cede largura quando o ecrã aperta é o rótulo do Criar,
    // que já corta com reticências. Uma legenda cortada a meio não diz nada.
    flexShrink: 0,
  },
  relationLabel: {
    ...feedTextShadow,
    color: feedInk.muted,
    fontFamily: fonts.medium,
    fontSize: typography.meta,
    lineHeight: leading.meta,
    letterSpacing: -0.1,
  },
  circleButton: {
    flexShrink: 1,
    height: 36,
    maxWidth: 168,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs2,
    overflow: 'visible',
  },
  // Só o botão do Círculo leva o contorno.
  circlePill: {
    ...outline,
    flexShrink: 1,
    // 32 de desenho dentro de uma fila de 36: o `hitSlop` devolve os 44 de área
    // tátil. A cápsula fica menor que a altura da linha e lê-se como botão.
    height: 30,
    paddingLeft: spacing.xs2,
    paddingRight: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  friendFaces: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  friendFace: {
    width: FRIEND_AVATAR_SIZE,
    height: FRIEND_AVATAR_SIZE,
    borderRadius: radius.full,
    overflow: 'hidden',
  },
  circleButtonText: {
    flexShrink: 1,
    color: feedInk.primary,
    fontFamily: fonts.regular,
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: 0,
    ...feedTextShadow,
  },
  inviteBadge: {
    position: 'absolute',
    top: -4,
    right: -3,
    width: 17,
    height: 17,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accent,
    borderWidth: 1.5,
    borderColor: colors.feedSurface,
  },

  searchPanel: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 50,
    backgroundColor: sheet.surface,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: sheet.line,
  },
  searchRow: {
    minHeight: 64,
    paddingHorizontal: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm2,
  },
  searchField: {
    flex: 1,
    height: 48,
    paddingHorizontal: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm2,
    borderRadius: radius.lg,
    backgroundColor: sheet.surfaceSunk,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: sheet.line,
  },
  searchInput: {
    flex: 1,
    height: 48,
    padding: 0,
    color: sheet.ink,
    fontFamily: fonts.regular,
    fontSize: typography.body,
    letterSpacing: -0.25,
  },
  clearSearch: {
    width: 26,
    height: 26,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: sheet.line,
  },
  cancelButton: {
    minHeight: 44,
    justifyContent: 'center',
  },
  cancelText: {
    color: sheet.ink,
    fontFamily: fonts.regular,
    fontSize: typography.secondary,
    lineHeight: leading.secondary,
    letterSpacing: -0.15,
  },
  peopleScroll: { flexGrow: 0 },
  peopleContent: {
    minHeight: 86,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.xs2,
    paddingBottom: spacing.sm2,
    alignItems: 'flex-start',
    gap: spacing.sm2,
  },
  person: {
    width: SEARCH_AVATAR_SIZE + 14,
    alignItems: 'center',
    gap: spacing.xs,
  },
  personAvatar: {
    width: SEARCH_AVATAR_SIZE,
    height: SEARCH_AVATAR_SIZE,
    borderRadius: radius.full,
    overflow: 'hidden',
  },
  personName: {
    maxWidth: SEARCH_AVATAR_SIZE + 14,
    color: sheet.inkMuted,
    fontFamily: fonts.regular,
    fontSize: typography.meta,
    lineHeight: leading.meta,
    textAlign: 'center',
  },
  personNameActive: {
    color: sheet.ink,
    fontFamily: fonts.regular,
  },
  personMarker: {
    width: 12,
    height: 2,
    borderRadius: radius.full,
    backgroundColor: 'transparent',
  },
  personMarkerActive: { backgroundColor: sheet.ink },
  emptySearch: {
    width: 280,
    minHeight: 72,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptySearchText: {
    color: sheet.inkMuted,
    fontFamily: fonts.regular,
    fontSize: typography.secondary,
    lineHeight: leading.secondary,
  },
})
