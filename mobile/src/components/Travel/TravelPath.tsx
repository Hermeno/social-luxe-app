import React, { useEffect, useRef } from 'react'
import { View, Text, StyleSheet, Animated } from 'react-native'
import Svg, { Path, Circle, Defs, LinearGradient as SvgGrad, Stop, G } from 'react-native-svg'
import { TravelNode } from '../../types'
import { fonts } from '../../theme'

// ── Constants ─────────────────────────────────────────────────────────────────
const PATH_W        = 80     // total width of the component
const BASE_X        = 30     // spine center x
const MAX_WIGGLE    = 10     // max horizontal deviation per node
const NODE_SPACING  = 64     // vertical distance between nodes
const NODE_R_BASE   = 3.5
const NODE_R_MAX    = 8
const PAD_TOP       = 28
const PAD_BOT       = 28
const DOT_COLOR     = '#FFFFFF'
const HALO_COLOR    = '#FFD060'
const LINE_COLOR_A  = '#FFD060'   // bright gold — pops against deep navy
const LINE_COLOR_B  = '#FFEFAA'

// Radius grows logarithmically with total interactions, capped at NODE_R_MAX
function nodeRadius(node: TravelNode): number {
  const total = node.views + node.likes + node.comments
  if (total === 0) return NODE_R_BASE
  return Math.min(NODE_R_MAX, NODE_R_BASE + Math.log(1 + total) * 1.4)
}

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

// ── Hand-drawn path: dense points with organic wobble + midpoint Q-bezier smooth ─
function smoothThroughPoints(pts: Array<{ x: number; y: number }>): string {
  if (pts.length < 2) return ''
  let d = `M ${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)}`
  for (let i = 1; i < pts.length - 1; i++) {
    const mx = ((pts[i].x + pts[i + 1].x) / 2).toFixed(1)
    const my = ((pts[i].y + pts[i + 1].y) / 2).toFixed(1)
    d += ` Q ${pts[i].x.toFixed(1)},${pts[i].y.toFixed(1)} ${mx},${my}`
  }
  d += ` L ${pts[pts.length - 1].x.toFixed(1)},${pts[pts.length - 1].y.toFixed(1)}`
  return d
}

function buildHanddrawnPath(
  positions: Array<{ x: number; y: number }>,
  rng: () => number,
): string {
  if (positions.length < 2) return ''
  const pts: Array<{ x: number; y: number }> = [{ ...positions[0] }]
  for (let seg = 0; seg < positions.length - 1; seg++) {
    const a = positions[seg]
    const b = positions[seg + 1]
    const segH = b.y - a.y
    const steps = Math.max(6, Math.round(segH / 22))
    for (let i = 1; i <= steps; i++) {
      const t = i / steps
      pts.push({
        x: a.x + t * (b.x - a.x) + (rng() - 0.5) * 14,
        y: a.y + t * segH,
      })
    }
  }
  return smoothThroughPoints(pts)
}

function buildHanddrawnTail(
  startX: number, startY: number, endY: number,
  rng: () => number,
): string {
  const steps = Math.max(6, Math.round((endY - startY) / 22))
  const pts: Array<{ x: number; y: number }> = []
  for (let i = 0; i <= steps; i++) {
    const t = i / steps
    pts.push({ x: startX + (rng() - 0.5) * 10, y: startY + t * (endY - startY) })
  }
  return smoothThroughPoints(pts)
}

// ── Component ─────────────────────────────────────────────────────────────────
interface Props {
  postId:     string
  nodes:      TravelNode[]
  containerH: number
}

export default function TravelPath({ postId, nodes, containerH }: Props) {
  if (nodes.length === 0) return null

  const rng    = seededRng(postId)
  const svgH   = containerH
  const usable = svgH - PAD_TOP - PAD_BOT
  const gradId = `tg_${postId.slice(0, 8)}`

  // Distribute nodes across full container height
  const positions = nodes.map((_, i) => ({
    x: BASE_X + (rng() - 0.5) * MAX_WIGGLE * 2,
    y: nodes.length === 1
      ? PAD_TOP + usable * 0.18           // origin node sits near the top
      : PAD_TOP + i * usable / (nodes.length - 1),
  }))

  const pathD = buildHanddrawnPath(positions, rng)

  // Wavy dashed tail — origin-only post: hints the route is just beginning
  const tailD = nodes.length === 1
    ? buildHanddrawnTail(positions[0].x, positions[0].y, svgH - PAD_BOT, rng)
    : ''

  // Fade-in animation — one Animated.Value per node, keyed by countryCode so new
  // countries animate in without resetting existing ones.
  const animMap = useRef<Record<string, Animated.Value>>({}).current

  nodes.forEach((n) => {
    if (!animMap[n.countryCode]) animMap[n.countryCode] = new Animated.Value(0)
  })

  useEffect(() => {
    const animations = nodes.map((n, i) =>
      Animated.timing(animMap[n.countryCode], {
        toValue:         1,
        duration:        400,
        delay:           i * 120,
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

        {/* Soft glow shadow — wider, dimmer, same path */}
        {nodes.length > 1 && (
          <Path d={pathD} stroke={LINE_COLOR_A} strokeWidth={7}
            strokeLinecap="round" strokeLinejoin="round" fill="none" opacity={0.18} />
        )}
        {/* Gold hand-drawn path */}
        {nodes.length > 1 && (
          <Path d={pathD} stroke={`url(#${gradId})`} strokeWidth={2.5}
            strokeLinecap="round" strokeLinejoin="round" fill="none" />
        )}

        {/* Tail — single origin node: solid organic, faded */}
        {nodes.length === 1 && (
          <Path d={tailD} stroke={LINE_COLOR_A} strokeWidth={7}
            strokeLinecap="round" fill="none" opacity={0.12} />
        )}
        {nodes.length === 1 && (
          <Path d={tailD} stroke={LINE_COLOR_A} strokeWidth={2}
            strokeLinecap="round" fill="none" opacity={0.40} />
        )}

        {nodes.map((node, i) => {
          const pos    = positions[i]
          const r      = nodeRadius(node)
          const active = node.views + node.likes + node.comments > 0
          return (
            <G key={node.countryCode}>
              {/* Soft outer bloom */}
              <Circle cx={pos.x} cy={pos.y} r={r + 7}
                fill={HALO_COLOR} opacity={active ? 0.14 : 0.07} />
              {/* Sharp halo ring */}
              <Circle cx={pos.x} cy={pos.y} r={r + 3.5}
                fill="none" stroke={HALO_COLOR} strokeWidth={1.2}
                opacity={active ? 0.65 : 0.30} />
              {/* White core */}
              <Circle cx={pos.x} cy={pos.y} r={r}
                fill={DOT_COLOR} stroke={LINE_COLOR_A} strokeWidth={1.2}
                opacity={active ? 1 : 0.72} />
            </G>
          )
        })}
      </Svg>

      {/* Country labels — rendered as RN Text (better font support) */}
      {nodes.map((node, i) => (
        <Animated.View
          key={node.countryCode}
          style={[s.labelWrap, { top: positions[i].y - 10, opacity: animMap[node.countryCode] }]}
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
