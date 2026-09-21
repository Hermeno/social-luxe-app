import React, { memo } from 'react'
import {
  View, Text, TextInput, TouchableOpacity,
  ScrollView, StyleSheet,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import Icon from '../../components/Icon'
import AvatarImage from '../../components/AvatarImage'
import { colors, radius, sheet, spacing } from '../../theme'
import { feedGlyphShadow, feedIcon, feedInk, feedType } from './tokens'
import { useT } from '../../i18n'
import { Post } from '../../types'

export interface FeedUserGroup {
  user: Post['user']
  posts: Post[]
}

const SEARCH_AVATAR_SIZE = 46

/**
 * O alvo de sair da imersiva.
 *
 * 48 — o mínimo do Android e a medida que o Feed System fixa para o cromado de
 * topo, a mesma do menu e da pesquisa na Home. Sair de um ecrã é o comando que
 * menos pode falhar ao primeiro toque.
 */
const BACK_TARGET = 48

/**
 * A fila do voltar, medida a partir do fim da safe area.
 *
 * Exportada porque o cromado flutua por cima da mídia sem lhe roubar altura:
 * quem desenha na mídia e não quer ficar por baixo do voltar — ou quer assentar
 * na mesma linha que ele — lê daqui em vez de repetir os números.
 */
export const FEED_CHROME_ROW = { top: 4, height: BACK_TARGET } as const
/** Tudo o que o cromado ocupa abaixo da safe area, incluindo o ar por baixo da fila. */
export const FEED_CHROME_HEIGHT = BACK_TARGET + spacing.sm2

export interface FeedHeaderProps {
  filteredGroups: FeedUserGroup[]
  activeUserId: string | undefined
  searchMode: boolean
  searchQuery: string
  onSearchClose: () => void
  onSearchChange: (query: string) => void
  onBubblePress: (group: FeedUserGroup) => void
  onRestoreNavigation: () => void
}

export default memo(function FeedHeader({
  filteredGroups,
  activeUserId,
  searchMode,
  searchQuery,
  onSearchClose,
  onSearchChange,
  onBubblePress,
  onRestoreNavigation,
}: FeedHeaderProps) {
  const { top } = useSafeAreaInsets()
  const t = useT()

  if (searchMode) {
    return (
      <View style={[s.searchPanel, { paddingTop: top }]}>
        <View style={s.searchRow}>
          <View style={s.searchField}>
            <Icon name="search" size={feedIcon.control} color={sheet.inkMuted} />
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
                <Icon name="close" size={feedIcon.small} color={sheet.inkMuted} />
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
    <View style={[s.topRoot, { height: top + FEED_CHROME_HEIGHT }]} pointerEvents="box-none">
      {/* Só o voltar. A assinatura e o Criar viviam aqui quando esta era a
          primeira página da app; agora a primeira página é a Home e isto é um
          ecrã de visualização — o que a pessoa precisa aqui é de sair. */}
      <View style={[s.topRow, { marginTop: top + FEED_CHROME_ROW.top }]} pointerEvents="box-none">
        <TouchableOpacity
          style={s.restoreButton}
          onPress={onRestoreNavigation}
          activeOpacity={0.68}
          accessibilityRole="button"
          accessibilityLabel={t.feed_show_navigation}
        >
          <Icon name="arrow-left" size={feedIcon.control} color={feedInk.primary} />
        </TouchableOpacity>
      </View>
    </View>
  )
})

// O contorno do botão do Círculo vivia aqui, com doze linhas de raciocínio e
// zero utilizações desde que o botão saiu do topo. A regra que ele guardava —
// 1px a 46% de branco, `radius.md` — está em `feedLine.strong` e no botão de
// seguir, que é quem a pratica agora.

const s = StyleSheet.create({
  topRoot: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 40,
  },
  topRow: {
    height: BACK_TARGET,
    // A mesma régua do bloco do autor e do traço do tempo. Esteve em 12 e o
    // logo não alinhava com o nome que aparece por baixo dele.
    paddingHorizontal: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
  },
  restoreButton: {
    width: BACK_TARGET,
    height: BACK_TARGET,
    // O alvo é a caixa, não um `hitSlop` por cima de um botão de 36: com slop,
    // o que a pessoa vê e o que responde ao dedo são dois rectângulos
    // diferentes, e só um deles está alinhado com a régua da página.
    marginLeft: -(BACK_TARGET - feedIcon.control) / 2,
    alignItems: 'center',
    justifyContent: 'center',
    ...feedGlyphShadow,
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
