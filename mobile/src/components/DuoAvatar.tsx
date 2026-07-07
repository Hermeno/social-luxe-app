import React from 'react'
import { View } from 'react-native'
import AvatarImage from './AvatarImage'
import { colors } from '../theme'

interface Props {
  aUri: string | null | undefined
  aName?: string | null
  bUri: string | null | undefined
  bName?: string | null
  size?: number
  overlap?: number   // how much the second avatar tucks behind the first, in px
  borderWidth?: number
}

export default function DuoAvatar({
  aUri, aName, bUri, bName, size = 40, overlap = 14, borderWidth = 2,
}: Props) {
  const ringStyle = {
    borderRadius: size / 2,
    borderWidth,
    borderColor: colors.white,
    overflow: 'hidden' as const,
  }

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', flexShrink: 0 }}>
      <View style={[ringStyle, { zIndex: 2 }]}>
        <AvatarImage uri={aUri} name={aName} size={size} />
      </View>
      <View style={[ringStyle, { marginLeft: -overlap, zIndex: 1 }]}>
        <AvatarImage uri={bUri} name={bName} size={size} />
      </View>
    </View>
  )
}
