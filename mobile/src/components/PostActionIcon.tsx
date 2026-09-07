import React from 'react'
import FeedIcon, { type FeedIconName } from './FeedIcon'

export type PostActionIconName = 'like' | 'comment' | 'repost' | 'share' | 'options' | 'author-posts'

interface Props {
  name: PostActionIconName
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

/** A mesma geometria nas duas feeds; o SVG define o traço e o equilíbrio óptico. */
export default function PostActionIcon({ name, size, color, selected = false }: Props) {
  return (
    <FeedIcon
      name={name === 'like' && selected ? 'heart-solid' : GLYPH[name]}
      size={size}
      color={color}
    />
  )
}
