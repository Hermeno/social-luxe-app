import React from 'react'
import { View, StyleSheet, TouchableOpacity } from 'react-native'
import AvatarImage from '../../components/AvatarImage'

export type CommenterThumb = { id: string; name: string; avatar: string | null }

const SIZE = 22
const OVERLAP = 7      // compacto: contexto social, não uma segunda navegação
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
    // Sem anel branco, é a sombra que separa cada cara da que está por baixo e
    // da fotografia. Apertada ao contorno — raio curto e sem deslocamento — para
    // dar um bordo em vez de pousar o avatar acima da imagem.
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.45,
    shadowRadius: 2.5,
    elevation: 3,
    borderRadius: SIZE / 2,
  },
})
