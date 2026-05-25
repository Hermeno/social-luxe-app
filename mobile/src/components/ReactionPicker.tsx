import React, { useRef, useEffect, useState } from 'react'
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  TouchableWithoutFeedback,
} from 'react-native'
import { reactToPost, ReactionType } from '../services/reaction.service'
import { colors, fonts, radius, spacing } from '../theme'

interface Props {
  postId: string
  onClose: () => void
  currentReaction?: ReactionType
}

const REACTIONS: { type: ReactionType; emoji: string; label: string }[] = [
  { type: 'HEART', emoji: '❤️', label: 'HEART' },
  { type: 'FIRE',  emoji: '🔥', label: 'FIRE'  },
  { type: 'LAUGH', emoji: '😂', label: 'LAUGH' },
  { type: 'WOW',   emoji: '😮', label: 'WOW'   },
  { type: 'SAD',   emoji: '😢', label: 'SAD'   },
  { type: 'CLAP',  emoji: '👏', label: 'CLAP'  },
]

export default function ReactionPicker({ postId, onClose, currentReaction }: Props) {
  const scaleAnim = useRef(new Animated.Value(0.5)).current
  const opacityAnim = useRef(new Animated.Value(0)).current
  const [anonymous, setAnonymous] = useState(false)
  const bounceAnims = useRef(REACTIONS.map(() => new Animated.Value(1))).current

  useEffect(() => {
    Animated.parallel([
      Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true, speed: 20, bounciness: 12 }),
      Animated.timing(opacityAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
    ]).start()
  }, [])

  async function handleReact(type: ReactionType, bounceAnim: Animated.Value) {
    Animated.sequence([
      Animated.spring(bounceAnim, { toValue: 1.4, useNativeDriver: true, speed: 40, bounciness: 12 }),
      Animated.spring(bounceAnim, { toValue: 1,   useNativeDriver: true, speed: 20, bounciness: 4  }),
    ]).start()
    try {
      await reactToPost(postId, type, anonymous)
    } catch {}
    setTimeout(onClose, 180)
  }

  return (
    <TouchableWithoutFeedback onPress={onClose}>
      <View style={s.overlay}>
        <TouchableWithoutFeedback>
          <Animated.View
            style={[
              s.pill,
              { transform: [{ scale: scaleAnim }], opacity: opacityAnim },
            ]}
          >
            <View style={s.emojisRow}>
              {REACTIONS.map(({ type, emoji, label }, i) => (
                <TouchableOpacity
                  key={type}
                  onPress={() => handleReact(type, bounceAnims[i])}
                  style={[s.emojiBtn, currentReaction === type && s.emojiActive]}
                  activeOpacity={0.75}
                >
                  <Animated.Text
                    style={[s.emoji, { transform: [{ scale: bounceAnims[i] }] }]}
                  >
                    {emoji}
                  </Animated.Text>
                  <Text style={s.emojiLabel}>{label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity
              style={s.anonRow}
              onPress={() => setAnonymous((a) => !a)}
              activeOpacity={0.75}
            >
              <View style={[s.checkbox, anonymous && s.checkboxActive]}>
                {anonymous && <Text style={s.checkmark}>✓</Text>}
              </View>
              <Text style={s.anonText}>Reagir anonimamente 👻</Text>
            </TouchableOpacity>
          </Animated.View>
        </TouchableWithoutFeedback>
      </View>
    </TouchableWithoutFeedback>
  )
}

const s = StyleSheet.create({
  overlay:      {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.55)',
    zIndex: 200,
    justifyContent: 'flex-end',
    alignItems: 'flex-end',
    paddingRight: 60,
    paddingBottom: 200,
  },
  pill:         {
    backgroundColor: '#1C1C1C',
    borderRadius: radius.xl,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.6,
    shadowRadius: 20,
    elevation: 20,
  },
  emojisRow:    { flexDirection: 'row', gap: 4 },
  emojiBtn:     {
    alignItems: 'center', padding: 8, borderRadius: radius.md,
  },
  emojiActive:  { backgroundColor: 'rgba(255,75,110,0.2)' },
  emoji:        { fontSize: 28 },
  emojiLabel:   { color: 'rgba(255,255,255,0.5)', fontFamily: fonts.regular, fontSize: 9, marginTop: 2 },
  anonRow:      { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: 4 },
  checkbox:     {
    width: 18, height: 18, borderRadius: 4,
    borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.3)',
    alignItems: 'center', justifyContent: 'center',
  },
  checkboxActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  checkmark:    { color: colors.white, fontSize: 12, fontFamily: fonts.bold },
  anonText:     { color: 'rgba(255,255,255,0.65)', fontFamily: fonts.regular, fontSize: 12 },
})
