import React from 'react'
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native'

import Icon from '../../components/Icon'
import Wordmark from '../../components/Wordmark'
import { useT } from '../../i18n'
import { colors, spacing } from '../../theme'

/** Altura da linha do cabeçalho, sem a área segura. */
export const HOME_HEADER_HEIGHT = 52
const ACTION = 44
const CREATE = 38

interface Props {
  onSearch: () => void
  onCreate: () => void
}

/**
 * O cabeçalho da Home: assinatura à esquerda, duas acções à direita.
 *
 * A assinatura é o `Wordmark` que já existe — o PNG oficial com alfa, tingido
 * pela prop `color`. Não é texto escrito à mão nem um logo novo: é o mesmo asset
 * que a splash, o login e o Sobre desenham, aqui a preto sobre branco.
 *
 * Os dois ícones vêm dos SVG oficiais do projecto (`search`, `plus`). O `+` leva
 * fundo preto cheio porque é a única acção primária desta página; a lupa fica em
 * traço, porque procurar é uma passagem, não um destino. Dois botões cheios lado
 * a lado deixariam de ter hierarquia entre si.
 */
export default function HomeHeader({ onSearch, onCreate }: Props) {
  const t = useT()

  return (
    <View style={s.row}>
      <Wordmark height={30} color={colors.gray800} />

      <View style={s.actions}>
        <TouchableOpacity
          style={s.action}
          onPress={onSearch}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel={t.feed_top_search}
        >
          <Icon name="search" size={24} color={colors.gray800} strokeWidth={1.9} absoluteStrokeWidth />
        </TouchableOpacity>

        <TouchableOpacity
          style={s.create}
          onPress={onCreate}
          activeOpacity={0.82}
          accessibilityRole="button"
          accessibilityLabel={t.feed_create}
        >
          <Icon name="plus" size={20} color={colors.white} strokeWidth={2} absoluteStrokeWidth />
        </TouchableOpacity>
      </View>
    </View>
  )
}

const s = StyleSheet.create({
  row: {
    height: HOME_HEADER_HEIGHT,
    paddingHorizontal: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  actions: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  // 44 de alvo à volta de um glifo de 24: o desenho fica leve e o toque não.
  action: { width: ACTION, height: ACTION, alignItems: 'center', justifyContent: 'center' },
  create: {
    width: CREATE,
    height: CREATE,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: CREATE / 2,
    backgroundColor: colors.gray800,
  },
})
