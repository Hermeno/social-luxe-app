import React, { memo } from 'react'
import { Pressable, StyleSheet, Text } from 'react-native'

import useCircleJoinAction, { performCircleJoinAction } from '../../hooks/useCircleJoinAction'
import { useT } from '../../i18n'
import type { Post } from '../../types'
import { colors, fonts, radius, spacing } from '../../theme'
import { toast } from '../../utils/toast'
import { homeType, pageInk } from '../FeedScreen/tokens'

/**
 * O convite de um Círculo na Home, no fim da linha "Capturado juntos".
 *
 * A mesma decisão que a imersiva mostra por baixo da figura, em versão de
 * página: um botão curto de cor sólida. Não aparece para quem
 * já está no Círculo nem para quem não conhece ninguém dele — aí a linha fica
 * só com quem lá esteve.
 */
function HomeCircleJoin({ post }: { post: Post }) {
  const t = useT()
  const action = useCircleJoinAction(post)
  if (action.kind === 'none') return null

  const label = action.kind === 'review'
    ? (action.count === 1
      ? t.circleJoin_reviewShort_one
      : t.circleJoin_reviewShort_many.replace('{count}', String(action.count)))
    : action.kind === 'pending'
      ? t.circleJoin_pending
      : t.circleJoin_joinShort
  const a11y = action.kind === 'review'
    ? (action.count === 1
      ? t.circleJoin_review_one
      : t.circleJoin_review_many.replace('{count}', String(action.count)))
    : action.kind === 'pending' ? t.circleJoin_pending : t.circleJoin_join

  return (
    <Pressable
      onPress={() => {
        performCircleJoinAction(action, t, (message) => toast.error(t.circle_errTitle, message)).catch(() => {})
      }}
      style={({ pressed }) => [s.button, action.kind === 'pending' && s.buttonMuted, pressed && s.pressed]}
      hitSlop={{ top: 6, bottom: 6 }}
      accessibilityRole="button"
      accessibilityLabel={a11y}
      accessibilityHint={action.kind === 'join' ? t.circleJoin_cameraHint : undefined}
    >
      <Text
        style={[s.label, action.kind === 'pending' && s.labelMuted]}
        numberOfLines={1}
        maxFontSizeMultiplier={1.3}
      >
        {label}
      </Text>
    </Pressable>
  )
}

export default memo(HomeCircleJoin)

const s = StyleSheet.create({
  button: {
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.sm2,
    borderRadius: radius.full,
    backgroundColor: pageInk.primary,
  },
  buttonMuted: { backgroundColor: '#4D545C' },
  pressed: { opacity: 0.7 },
  // A família já traz o peso: um `fontWeight` por cima de uma fonte própria
  // não engrossa nada no Android.
  label: { ...homeType.context, fontFamily: fonts.bold, color: colors.white },
  labelMuted: { fontFamily: fonts.medium, color: colors.white },
})
