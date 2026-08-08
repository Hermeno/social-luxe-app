import React from 'react'
import { View, StyleSheet, TouchableOpacity } from 'react-native'
import AvatarImage from '../../components/AvatarImage'

export type CommenterThumb = { id: string; name: string; avatar: string | null }

const SIZE = 26
const OVERLAP = 9      // quanto cada avatar entra por cima do anterior
const MAX = 5

/**
 * Quem comentou o post visível — avatares redondos sobrepostos, no topo da feed.
 * O primeiro fica por cima: lê-se da esquerda para a direita como uma fila.
 */
export default function CommenterStack({
  commenters,
  onPress,
}: {
  commenters: CommenterThumb[]
  onPress?: () => void
}) {
  const shown = commenters.slice(0, MAX)
  if (shown.length === 0) return null

  return (
    <TouchableOpacity
      style={s.row}
      onPress={onPress}
      disabled={!onPress}
      activeOpacity={0.75}
      accessibilityRole="button"
      accessibilityLabel={`${commenters.length} a comentar: ${shown.map((c) => c.name).join(', ')}`}
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
          <AvatarImage
            uri={c.avatar}
            name={c.name}
            size={SIZE}
            borderWidth={1.5}
            borderColor="#FFFFFF"
          />
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
    // A sombra separa os anéis brancos de fundos claros da foto.
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 3,
    borderRadius: SIZE / 2,
  },
})
