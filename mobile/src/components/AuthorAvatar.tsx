import React from 'react'
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'

import { colors, gradients, radius } from '../theme'
import AvatarImage from './AvatarImage'

const CLEAR_RING = ['transparent', 'transparent'] as const

interface Props {
  uri: string | null | undefined
  name?: string | null
  avatarSize: number
  /** Espessura do traço cromático. */
  ringWidth?: number
  /** Respiro entre o traço e a fotografia. */
  gap?: number
  /** Mantém a mesma caixa quando o estado não pede anel. */
  ringVisible?: boolean
  wellColor?: string
  elevated?: boolean
  style?: StyleProp<ViewStyle>
}

/**
 * Avatar de quem publicou.
 *
 * A geometria fica centralizada aqui para o anel nunca variar de espessura,
 * ovalizar ou colar à fotografia entre diferentes superfícies da Feed.
 */
export default function AuthorAvatar({
  uri,
  name,
  avatarSize,
  ringWidth = 1.5,
  gap = 2,
  ringVisible = true,
  wellColor = colors.feedSurface,
  elevated = false,
  style,
}: Props) {
  const outerSize = avatarSize + (ringWidth + gap) * 2

  return (
    <View
      style={[
        s.outer,
        { width: outerSize, height: outerSize },
        ringVisible && elevated && s.elevated,
        style,
      ]}
    >
      <LinearGradient
        colors={ringVisible ? gradients.avatarRing : CLEAR_RING}
        start={{ x: 0.04, y: 0.08 }}
        end={{ x: 0.96, y: 0.92 }}
        style={[s.gradient, { padding: ringWidth }]}
      >
        <View
          style={[
            s.well,
            {
              padding: gap,
              backgroundColor: ringVisible ? wellColor : 'transparent',
            },
          ]}
        >
          <AvatarImage
            uri={uri}
            name={name}
            size={avatarSize}
            borderWidth={0}
            borderColor="transparent"
          />
        </View>
      </LinearGradient>
    </View>
  )
}

const s = StyleSheet.create({
  outer: {
    borderRadius: radius.full,
  },
  gradient: {
    flex: 1,
    borderRadius: radius.full,
  },
  well: {
    flex: 1,
    borderRadius: radius.full,
    overflow: 'hidden',
  },
  elevated: {
    shadowColor: colors.black,
    shadowOpacity: 0.24,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
    elevation: 2,
  },
})
