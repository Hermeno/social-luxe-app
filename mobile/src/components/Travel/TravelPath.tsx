import React, { useEffect, useRef } from 'react'
import { View, Text, StyleSheet, Animated } from 'react-native'
import Svg, { Path, Circle, Defs, LinearGradient as SvgGrad, Stop } from 'react-native-svg'
import { TravelNode } from '../../types'
import { fonts } from '../../theme'

// ── Constants ─────────────────────────────────────────────────────────────────
const PATH_W        = 72     // total width of the component
const BASE_X        = 30     // spine center x
const MAX_WIGGLE    = 10     // max horizontal deviation per node
const NODE_SPACING  = 64     // vertical distance between nodes
const NODE_R        = 4      // node dot radius
const PAD_TOP       = 20
const PAD_BOT       = 20
const DOT_COLOR     = '#CA2851'
const LINE_COLOR_A  = '#CA2851'
const LINE_COLOR_B  = '#FFB173'

// ── Seeded PRNG (mulberry32) ───────────────────────────────────────────────────
function seededRng(seed: string) {
  let h = 0
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(31, h) + seed.charCodeAt(i) | 0
  }
  return function () {
    h ^= h >>> 16; h = Math.imul(h, 0x45d9f3b) | 0
    h ^= h >>> 16; h = Math.imul(h, 0x45d9f3b) | 0
    h ^= h >>> 16
    return ((h >>> 0) / 0xffffffff)
  }
}

// ── Country flag from ISO code ────────────────────────────────────────────────
function countryFlag(code: string): string {
  return [...code.toUpperCase()]
    .map((c) => String.fromCodePoint(c.charCodeAt(0) + 127397))
    .join('')
}

// ── Build SVG path string ─────────────────────────────────────────────────────
function buildPath(
  positions: Array<{ x: number; y: number }>,
  rng: () => number,
): string {
  if (positions.length < 2) return ''
  let d = `M ${positions[0].x} ${positions[0].y}`
  for (let i = 1; i < positions.length; i++) {
    const p = positions[i - 1]
    const c = positions[i]
    const midY = (p.y + c.y) / 2
    const cp1x = p.x + (rng() - 0.5) * 18
    const cp2x = c.x + (rng() - 0.5) / 18
    d += ` C ${cp1x.toFixed(1)},${(midY - 10).toFixed(1)} ${cp2x.toFixed(1)},${(midY + 10).toFixed(1)} ${c.x.toFixed(1)},${c.y.toFixed(1)}`
  }
  return d
}

// ── Component ─────────────────────────────────────────────────────────────────
interface Props {
  postId: string
  nodes:  TravelNode[]
}

export default function TravelPath({ postId, nodes }: Props) {
  if (nodes.length === 0) return null

  const rng = seededRng(postId)

  const svgH    = PAD_TOP + nodes.length * NODE_SPACING + PAD_BOT
  const gradId  = `tg_${postId.slice(0, 8)}`

  // Compute x positions with seeded wiggle
  const positions = nodes.map((_, i) => ({
    x: BASE_X + (rng() - 0.5) * MAX_WIGGLE * 2,
    y: PAD_TOP + i * NODE_SPACING,
  }))

  const pathD = buildPath(positions, rng)

  // Fade-in animation for each node (staggered)
  const fadeAnims = useRef(nodes.map(() => new Animated.Value(0))).current

  useEffect(() => {
    const animations = fadeAnims.map((anim, i) =>
      Animated.timing(anim, {
        toValue:        1,
        duration:       400,
        delay:          i * 120,
        useNativeDriver: true,
      })
    )
    Animated.parallel(animations).start()
  }, [nodes.length])

  return (
    <View style={[s.container, { height: svgH }]} pointerEvents="none">
      {/* SVG path + node dots */}
      <Svg width={PATH_W} height={svgH} style={StyleSheet.absoluteFill}>
        <Defs>
          <SvgGrad id={gradId} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0"   stopColor={LINE_COLOR_A} stopOpacity={0.9} />
            <Stop offset="1"   stopColor={LINE_COLOR_B} stopOpacity={0.7} />
          </SvgGrad>
        </Defs>

        {nodes.length > 1 && (
          <Path
            d={pathD}
            stroke={`url(#${gradId})`}
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
        )}

        {positions.map((pos) => (
          <Circle
            key={pos.y}
            cx={pos.x}
            cy={pos.y}
            r={NODE_R}
            fill={DOT_COLOR}
          />
        ))}
      </Svg>

      {/* Country labels — rendered as RN Text (better font support) */}
      {nodes.map((node, i) => (
        <Animated.View
          key={node.countryCode}
          style={[s.labelWrap, { top: positions[i].y - 10, opacity: fadeAnims[i] }]}
        >
          <Text style={s.flag}>{countryFlag(node.countryCode)}</Text>
          <Text style={s.label} numberOfLines={1}>
            {node.countryName.length > 9 ? node.countryName.slice(0, 9) + '…' : node.countryName}
          </Text>
        </Animated.View>
      ))}
    </View>
  )
}

const s = StyleSheet.create({
  container: {
    width:    PATH_W + 60,   // extra space for labels
    position: 'relative',
  },
  labelWrap: {
    position:   'absolute',
    left:       PATH_W - 4,
    flexDirection: 'row',
    alignItems:    'center',
    gap:           2,
  },
  flag:  { fontSize: 10 },
  label: {
    fontSize:   8,
    fontFamily: fonts.semiBold,
    color:      'rgba(255,255,255,0.88)',
    letterSpacing: 0.1,
    textShadowColor:  'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius:  2,
  },
})
