import React from 'react'
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native'

import { colors, radius } from '../theme'
import AvatarImage from './AvatarImage'
import BrandAvatarRing from './BrandAvatarRing'

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
  ringWidth = 2,
  gap = 2,
  ringVisible = true,
  wellColor = colors.feedSurface,
  elevated = false,
  style,
}: Props) {
  const outerSize = avatarSize + (ringWidth + gap) * 2
  const wellSize = avatarSize + gap * 2

  return (
    <View
      style={[
        s.outer,
        { width: outerSize, height: outerSize },
        ringVisible && elevated && s.elevated,
        style,
      ]}
    >
      <BrandAvatarRing
        size={outerSize}
        strokeWidth={ringWidth}
        visible={ringVisible}
        style={s.ring}
      />

      <View
        style={[
          s.well,
          {
            width: wellSize,
            height: wellSize,
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
    </View>
  )
}

const s = StyleSheet.create({
  outer: {
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ring: { position: 'absolute', top: 0, left: 0 },
  well: {
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
