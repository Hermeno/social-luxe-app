import React from 'react'
import { View } from 'react-native'
import AvatarImage from './AvatarImage'
import { colors } from '../theme'

interface Props {
  aUri: string | null | undefined
  aName?: string | null
  bUri: string | null | undefined
  bName?: string | null
  size?: number           // top-left avatar size
  secondarySize?: number  // bottom-right avatar size; defaults to `size`
  wrapWidth?: number
  wrapHeight?: number
  borderWidth?: number
}

export default function DuoAvatar({
  aUri, aName, bUri, bName,
  size = 54, secondarySize, wrapWidth, wrapHeight, borderWidth = 2,
}: Props) {
  const bSize = secondarySize ?? size
  const w = wrapWidth ?? size + 14
  const h = wrapHeight ?? size

  return (
    <View style={{ width: w, height: h, position: 'relative', flexShrink: 0 }}>
      <View style={{
        position: 'absolute', top: 0, left: 0, borderRadius: size / 2,
        borderWidth, borderColor: colors.white, overflow: 'hidden',
      }}>
        <AvatarImage uri={aUri} name={aName} size={size} />
      </View>
      <View style={{
        position: 'absolute', bottom: 0, right: 0, borderRadius: bSize / 2,
        borderWidth, borderColor: colors.white, overflow: 'hidden',
      }}>
        <AvatarImage uri={bUri} name={bName} size={bSize} />
      </View>
    </View>
  )
}
