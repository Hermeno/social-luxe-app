import React, { useRef } from 'react'
import { View, Text, StyleSheet, Animated, Pressable } from 'react-native'
import { AddIcon, HideIcon } from '../../components/icons'

// ─── ObjectBar ────────────────────────────────────────────────────────────────
// Os objetos flutuam sobre a publicação, na margem esquerda — simétricos à
// barra de ações da direita. Um toque pousa o objeto no post (e depois
// arrasta-se). O `+` abre o tabuleiro completo (prendas, mensagens); o último
// chip recolhe/mostra os objetos quando taparem a publicação.

const QUICK = ['❤️', '🔥', '😂', '✨', '👑']

interface Props {
  hidden: boolean
  onPick: (emoji: string) => void
  onMore: () => void
  onToggleHidden: () => void
}

// Chip com feedback físico próprio — encolhe no toque, salta ao soltar
function Chip({ children, onPress, dimmed }: {
  children: React.ReactNode
  onPress: () => void
  dimmed?: boolean
}) {
  const scale = useRef(new Animated.Value(1)).current

  function pressIn() {
    Animated.spring(scale, { toValue: 0.82, speed: 40, bounciness: 0, useNativeDriver: true }).start()
  }
  function pressOut() {
    Animated.spring(scale, { toValue: 1, speed: 24, bounciness: 12, useNativeDriver: true }).start()
  }

  return (
    <Pressable onPress={onPress} onPressIn={pressIn} onPressOut={pressOut} hitSlop={4}>
      <Animated.View style={[s.chip, dimmed && s.chipDimmed, { transform: [{ scale }] }]}>
        {children}
      </Animated.View>
    </Pressable>
  )
}

export default function ObjectBar({ hidden, onPick, onMore, onToggleHidden }: Props) {
  // Objetos recolhidos → só o controlo de repor, discreto, no mesmo sítio
  if (hidden) {
    return (
      <View style={s.rail} pointerEvents="box-none">
        <Chip onPress={onToggleHidden} dimmed>
          <HideIcon size={17} color="rgba(255,255,255,0.95)" />
        </Chip>
      </View>
    )
  }

  return (
    <View style={s.rail} pointerEvents="box-none">
      {QUICK.map((emoji) => (
        <Chip key={emoji} onPress={() => onPick(emoji)}>
          <Text style={s.emoji}>{emoji}</Text>
        </Chip>
      ))}

      <View style={s.sep} />

      <Chip onPress={onMore}>
        <AddIcon size={19} color="rgba(255,255,255,0.95)" />
      </Chip>
      <Chip onPress={onToggleHidden}>
        <HideIcon size={17} color="rgba(255,255,255,0.72)" />
      </Chip>
    </View>
  )
}

const s = StyleSheet.create({
  rail: {
    position: 'absolute',
    left: 10,
    top: '22%',
    zIndex: 15,
    alignItems: 'center',
    gap: 9,
  },
  chip: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(14,14,18,0.36)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.22)',
  },
  chipDimmed: {
    backgroundColor: 'rgba(14,14,18,0.6)',
  },
  emoji: {
    fontSize: 19,
    textShadowColor: 'rgba(0,0,0,0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  sep: {
    width: 18,
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(255,255,255,0.28)',
    marginVertical: 2,
  },
})
