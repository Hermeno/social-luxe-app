import React, { memo } from 'react'
import { Pressable, StyleSheet, Text } from 'react-native'

import { useT } from '../../i18n'
import { useAuthStore } from '../../store/auth.store'
import { useFollowStore } from '../../store/follow.store'
import type { Post } from '../../types'
import { fonts, radius, spacing } from '../../theme'
import { homeType, pageInk, pageLine } from '../FeedScreen/tokens'

/**
 * Seguir quem publicou, na linha de identidade da Home.
 *
 * A mesma cápsula do convite do Círculo — a página só tem esta forma de botão —
 * e a mesma leitura da imersiva: seguir é tinta cheia, já seguir é tinta
 * apagada. Nunca cor de marca: aqui ela está reservada aos anéis de identidade,
 * e um botão colorido na lista puxava mais o olho do que a fotografia.
 *
 * Não aparece nas minhas publicações, nos anúncios, nem antes de se saber quem
 * eu sigo — um rótulo errado por meio segundo é pior do que nenhum botão.
 */
function HomeFollow({ post }: { post: Post }) {
  const t = useT()
  const myId = useAuthStore((state) => state.user?.id)
  const loaded = useFollowStore((state) => state.loaded)
  const following = useFollowStore((state) => state.followingIds.has(post.user.id))

  if (!myId || !loaded || post.user.id === myId || post.isAnnouncement) return null

  return (
    <Pressable
      onPress={() => {
        useFollowStore.getState()
          .toggle(post.user.id, 'forever', { name: post.user.name, avatar: post.user.avatar ?? null })
          .catch(() => {})
      }}
      // 30 de altura à vista, 44 ao dedo.
      hitSlop={{ top: 7, bottom: 7 }}
      style={({ pressed }) => [s.button, pressed && s.pressed]}
      accessibilityRole="button"
      accessibilityLabel={`${following ? t.following : t.follow} ${post.user.name}`}
      accessibilityState={{ selected: following }}
    >
      <Text
        style={[s.label, following && s.labelFollowing]}
        numberOfLines={1}
        maxFontSizeMultiplier={1.3}
      >
        {following ? t.following : t.follow}
      </Text>
    </Pressable>
  )
}

export default memo(HomeFollow)

const s = StyleSheet.create({
  button: {
    height: 30,
    minWidth: 72,
    paddingHorizontal: spacing.sm2,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: pageLine,
  },
  pressed: { opacity: 0.7 },
  // A família traz o peso: um `fontWeight` por cima de uma fonte própria não
  // engrossa nada no Android.
  label: { ...homeType.caption, fontFamily: fonts.bold, color: pageInk.primary },
  labelFollowing: { fontFamily: fonts.medium, color: pageInk.muted },
})
