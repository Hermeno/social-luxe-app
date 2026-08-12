import React from 'react'
import { View, StyleSheet, TouchableOpacity, ViewStyle } from 'react-native'
import AvatarImage from './AvatarImage'

export type StackedUser = { id: string; name: string; avatar: string | null }

/**
 * Fila de avatares sobrepostos.
 *
 * Diferente do `CommenterStack` da feed: aquele é um detalhe de 22px ao lado da
 * legenda, com regras próprias. Este é um elemento de cabeçalho, maior e com
 * contagem configurável, para as folhas brancas e o perfil.
 *
 * O primeiro fica por cima e lê-se da esquerda para a direita.
 */
export default function AvatarStack({
  users,
  max = 5,
  size = 32,
  overlap,
  ringColor = '#FFFFFF',
  onPress,
  accessibilityLabel,
  style,
}: {
  users: StackedUser[]
  max?: number
  size?: number
  /** Sobreposição em px. Por omissão, 34% do avatar — mantém a leitura a qualquer tamanho. */
  overlap?: number
  ringColor?: string
  onPress?: () => void
  accessibilityLabel?: string
  style?: ViewStyle
}) {
  const shown = users.slice(0, max)
  if (shown.length === 0) return null

  const bite = overlap ?? Math.round(size * 0.34)
  const ring = Math.max(1.5, size * 0.06)

  return (
    <TouchableOpacity
      style={[s.row, style]}
      onPress={onPress}
      disabled={!onPress}
      hitSlop={8}
      activeOpacity={0.75}
      accessibilityRole={onPress ? 'button' : 'image'}
      accessibilityLabel={accessibilityLabel ?? shown.map((u) => u.name).join(', ')}
    >
      {shown.map((u, i) => (
        <View
          key={u.id}
          style={[
            { borderRadius: size / 2 },
            i > 0 && { marginLeft: -bite },
            // Primeiro por cima — o zIndex desce para a direita.
            { zIndex: shown.length - i },
          ]}
        >
          <AvatarImage
            uri={u.avatar}
            name={u.name}
            size={size}
            borderWidth={ring}
            borderColor={ringColor}
          />
        </View>
      ))}
    </TouchableOpacity>
  )
}

const s = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start' },
})
