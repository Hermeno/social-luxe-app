import React from 'react'
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native'

import AuthorAvatar from '../../components/AuthorAvatar'
import AvatarImage from '../../components/AvatarImage'
import Icon from '../../components/Icon'
import { useT } from '../../i18n'
import type { ActiveCircle } from '../../services/circle.service'
import { colors, fonts, spacing, typography } from '../../theme'

const AVATAR = 62
const RING_WIDTH = 2
const RING_GAP = 3
const OUTER = AVATAR + (RING_WIDTH + RING_GAP) * 2
const ITEM_WIDTH = 76
const LABEL_GAP = spacing.xs2

/** Altura da fila, do topo do avatar ao fim do nome. */
export const HOME_CIRCLES_HEIGHT = OUTER + LABEL_GAP + 16

interface Props {
  circles: ActiveCircle[]
  me: { name: string; avatar: string | null } | null
  onCreate: () => void
  onOpen: (circle: ActiveCircle) => void
  onOpenMine: () => void
}

/**
 * A fila de Círculos no topo da Home.
 *
 * Três espécies de célula, por esta ordem, e a ordem é o argumento: **Criar**
 * primeiro, porque a Luxey pede que se faça antes de se ver; **Tu** a seguir,
 * como âncora de identidade; e depois quem tem Círculo a acontecer.
 *
 * A célula de criar não leva fotografia nem anel — é um vazio com um `+`, e é
 * dessa diferença que se percebe que não é uma pessoa. Dar-lhe anel cromático
 * poria uma acção a competir com gente real.
 *
 * O anel só acende no que está vivo. O `AuthorAvatar` reserva a caixa do anel
 * mesmo quando o esconde, portanto aceso e apagado medem o mesmo e a fila não
 * dança quando uma sessão fecha.
 */
export default function HomeCirclesRow({ circles, me, onCreate, onOpen, onOpenMine }: Props) {
  const t = useT()

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={s.content}
      style={s.row}
    >
      <TouchableOpacity
        style={s.item}
        onPress={onCreate}
        activeOpacity={0.72}
        accessibilityRole="button"
        accessibilityLabel={t.feed_create}
      >
        <View style={s.createDisc}>
          <Icon name="plus" size={24} color={colors.gray800} strokeWidth={1.9} absoluteStrokeWidth />
        </View>
        <Text style={s.label} numberOfLines={1}>{t.feed_create}</Text>
      </TouchableOpacity>

      {me && (
        <TouchableOpacity
          style={s.item}
          onPress={onOpenMine}
          activeOpacity={0.72}
          accessibilityRole="button"
          accessibilityLabel={t.home_circles_you}
        >
          <View style={s.face}>
            <AvatarImage uri={me.avatar} name={me.name} size={AVATAR} />
          </View>
          <Text style={s.label} numberOfLines={1}>{t.home_circles_you}</Text>
        </TouchableOpacity>
      )}

      {circles.map((circle) => (
        <TouchableOpacity
          key={circle.sessionId}
          style={s.item}
          onPress={() => onOpen(circle)}
          activeOpacity={0.72}
          accessibilityRole="button"
          accessibilityLabel={`${circle.host.name}, ${circle.memberCount}`}
        >
          <AuthorAvatar
            uri={circle.host.avatar}
            name={circle.host.name}
            avatarSize={AVATAR}
            ringWidth={RING_WIDTH}
            gap={RING_GAP}
            ringVisible={circle.live}
            wellColor={colors.white}
          />
          <Text style={[s.label, circle.live && s.labelLive]} numberOfLines={1}>
            {circle.host.name.split(' ')[0]}
          </Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
  )
}

const s = StyleSheet.create({
  row:     { flexGrow: 0 },
  content: { paddingHorizontal: spacing.md, gap: spacing.sm2, alignItems: 'flex-start' },
  item:    { width: ITEM_WIDTH, alignItems: 'center' },
  // Sem anel, o avatar ainda tem de medir a mesma caixa dos que o têm — senão a
  // fila fica com as cabeças a alturas diferentes.
  face: {
    width: OUTER,
    height: OUTER,
    alignItems: 'center',
    justifyContent: 'center',
  },
  createDisc: {
    width: OUTER,
    height: OUTER,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: OUTER / 2,
    backgroundColor: colors.gray100,
  },
  label: {
    marginTop: LABEL_GAP,
    maxWidth: ITEM_WIDTH,
    color: colors.gray500,
    fontFamily: fonts.medium,
    fontSize: typography.secondary,
    lineHeight: 16,
    textAlign: 'center',
  },
  labelLive: { color: colors.gray800, fontFamily: fonts.semiBold },
})
