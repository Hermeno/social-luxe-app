import React from 'react'
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native'

import Icon from '../../components/Icon'
import Wordmark from '../../components/Wordmark'
import { useT } from '../../i18n'
import { fonts, leading, spacing, typography } from '../../theme'
import { feedIcon, pageInk, pageLine } from '../FeedScreen/tokens'

/**
 * Altura do conteúdo do cabeçalho, sem a área segura de cima.
 *
 * 56 é a medida do Feed System, e não um arredondamento: com alvos de 48 lá
 * dentro sobram 4 de ar acima e abaixo — o suficiente para os comandos não
 * encostarem à linha divisória nem à barra de estado.
 */
export const HOME_HEADER_HEIGHT = 56

/**
 * O alvo de um comando do cabeçalho.
 *
 * 48 é o mínimo do Android (o iOS pede 44) e é o que a spec fixa para a
 * pesquisa e para `Criar`. Um só número para os dois: um cabeçalho com alvos de
 * tamanhos diferentes lê-se como dois controlos de importância diferente, e
 * aqui não são.
 */
const ACTION = 48

interface Props {
  onSearch: () => void
  onCreate: () => void
}

export default function HomeHeader({ onSearch, onCreate }: Props) {
  const t = useT()

  return (
    <View style={s.row}>
      <Wordmark height={42} color={pageInk.primary} />

      <View style={s.actions}>
        <TouchableOpacity
          style={s.action}
          onPress={onSearch}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel={t.feed_top_search}
        >
          <Icon name="search" size={feedIcon.control} color={pageInk.primary} />
        </TouchableOpacity>

        <TouchableOpacity
          style={s.create}
          onPress={onCreate}
          activeOpacity={0.65}
          accessibilityRole="button"
          accessibilityLabel={t.feed_create}
        >
          <Icon name="plus" size={feedIcon.small} color={pageInk.primary} />
          <Text style={s.createText} maxFontSizeMultiplier={1.8}>{t.feed_create}</Text>
        </TouchableOpacity>
      </View>
    </View>
  )
}

const s = StyleSheet.create({
  row: {
    height: HOME_HEADER_HEIGHT,
    // A régua da página, dos dois lados. À direita fica 2 mais curta porque o
    // alvo de 48 do último comando já traz ar próprio: encostá-lo a 16 punha a
    // tinta de `Criar` mais para dentro que a legenda por baixo dela.
    paddingLeft: spacing.md,
    paddingRight: spacing.sm2 + spacing.xxs,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    // O fio que separa o cabeçalho fixo do conteúdo que passa por baixo. Numa
    // página branca sem cartões é a única coisa que diz onde o scroll começa.
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: pageLine,
  },
  actions: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  action: { width: ACTION, height: ACTION, alignItems: 'center', justifyContent: 'center' },
  create: {
    minWidth: ACTION,
    minHeight: ACTION,
    flexDirection: 'row',
    gap: spacing.xs2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  createText: {
    fontFamily: fonts.semiBold,
    fontSize: typography.secondary,
    lineHeight: leading.secondary,
    color: pageInk.primary,
  },
})
