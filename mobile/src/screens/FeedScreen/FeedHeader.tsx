import React, { memo } from 'react'
import {
  View, Text, TextInput, TouchableOpacity,
  ScrollView, StyleSheet,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import Icon from '../../components/Icon'
import AvatarImage from '../../components/AvatarImage'
import Wordmark from '../../components/Wordmark'
import { colors, radius, sheet, spacing } from '../../theme'
import { feedIcon, feedInk, feedLine, feedTextShadow, feedType, FEED_STROKE } from './tokens'
import { useT } from '../../i18n'
import { Post } from '../../types'

export interface FeedUserGroup {
  user: Post['user']
  posts: Post[]
}

const SEARCH_AVATAR_SIZE = 46

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
  const t = useT()

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
        <View style={s.brandGroup} pointerEvents="box-none">
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

          <View style={s.topInkShadow} pointerEvents="none">
            <Wordmark height={22} color={feedInk.primary} />
          </View>
        </View>

        <View style={s.topActions} pointerEvents="box-none">
          <TouchableOpacity
            style={s.circleButton}
            onPress={onCirclePress}
            activeOpacity={0.72}
            hitSlop={{ top: 4, bottom: 4, left: 3, right: 3 }}
            accessibilityRole="button"
            accessibilityLabel={circleInvite ? `${t.feed_create}, ${t.pending}` : t.feed_create}
          >
            <View style={s.circlePill}>
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
    // Duas âncoras estáveis: voltar/assinatura à esquerda e Criar à direita.
    // Sem conteúdo variável no meio, nenhuma largura volta a deslocar o logo.
    //
    //   [ voltar ─8─ assinatura ]  ── flex ──  [ Criar ]
    //
    justifyContent: 'space-between',
    gap: spacing.sm2,
  },
  brandGroup: {
    flexShrink: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  topActions: {
    flexDirection: 'row',
    alignItems: 'center',
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
  circleButton: {
    // Dois módulos tácteis de 44pt: cresce sem virar o elemento dominante.
    width: 88,
    height: 36,
    flexDirection: 'row',
    alignItems: 'center',
    overflow: 'visible',
  },
  // Só o botão do Círculo leva o contorno.
  circlePill: {
    ...outline,
    width: '100%',
    // 32 de desenho dentro de uma fila de 36: o `hitSlop` devolve os 44 de área
    // tátil. A cápsula fica menor que a altura da linha e lê-se como botão.
    height: 30,
    paddingHorizontal: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  circleButtonText: {
    // Sem tipo local: Criar é um controlo primário como Seguir e Get Started.
    ...feedType.primary,
    color: feedInk.primary,
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
    ...feedType.primary,
    color: sheet.ink,
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
    ...feedType.primary,
    color: sheet.ink,
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
    ...feedType.meta,
    color: sheet.inkMuted,
    textAlign: 'center',
  },
  personNameActive: {
    color: sheet.ink,
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
    ...feedType.primary,
    color: sheet.inkMuted,
  },
})
