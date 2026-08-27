import React from 'react'
import { View, StyleSheet, TouchableOpacity } from 'react-native'
import AvatarImage from '../../components/AvatarImage'
import { radius } from '../../theme'

export type CommenterThumb = { id: string; name: string; avatar: string | null }

const SIZE = 18
const OVERLAP = 5      // contexto social discreto, sem competir com o autor
const MAX = 3

/**
 * Contexto social compacto junto à legenda do momento.
 * O primeiro avatar fica por cima, lendo-se da esquerda para a direita.
 */
export default function CommenterStack({
  commenters,
  onPress,
  accessibilityLabel,
}: {
  commenters: CommenterThumb[]
  onPress?: () => void
  accessibilityLabel?: string
}) {
  const shown = commenters.slice(0, MAX)
  if (shown.length === 0) return null

  return (
    <TouchableOpacity
      style={s.row}
      onPress={onPress}
      disabled={!onPress}
      hitSlop={8}
      activeOpacity={0.75}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? shown.map((c) => c.name).join(', ')}
    >
      {shown.map((c, i) => (
        <View
          key={c.id}
          style={[
            s.slot,
            i > 0 && { marginLeft: -OVERLAP },
            // Primeiro por cima — o zIndex desce para a direita.
            { zIndex: MAX - i },
          ]}
        >
          <AvatarImage uri={c.avatar} name={c.name} size={SIZE} />
        </View>
      ))}
    </TouchableOpacity>
  )
}

const s = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
  },
  slot: {
    borderRadius: radius.full,
    overflow: 'hidden',
  },
})
