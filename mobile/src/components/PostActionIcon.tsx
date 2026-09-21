import React from 'react'
import { StyleSheet, View } from 'react-native'
import FeedIcon, { type FeedIconName } from './FeedIcon'
import { FEED_GLYPH } from '../screens/FeedScreen/tokens'

export type PostActionIconName = 'like' | 'comment' | 'repost' | 'share' | 'options' | 'author-posts'

interface Props {
  name: PostActionIconName
  /** Espaço reservado no layout; o desenho fica limitado a `FEED_GLYPH`. */
  size: number
  color: string
  selected?: boolean
}

const GLYPH = {
  like: 'heart',
  comment: 'chat-outline',
  repost: 'repost',
  share: 'share',
  options: 'option',
  'author-posts': 'author-posts',
} satisfies Record<PostActionIconName, FeedIconName>

/** Desenho mais discreto nas duas feeds, mantendo a caixa e os centros originais. */
export default function PostActionIcon({ name, size, color, selected = false }: Props) {
  return (
    <View style={[s.frame, { width: size, height: size }]} pointerEvents="none">
      <FeedIcon
        name={name === 'like' && selected ? 'heart-solid' : GLYPH[name]}
        size={Math.min(size, FEED_GLYPH)}
        color={color}
      />
    </View>
  )
}

const s = StyleSheet.create({
  frame: { alignItems: 'center', justifyContent: 'center' },
})
