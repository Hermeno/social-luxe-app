import React, { useEffect, useRef, useState } from 'react'
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  Animated,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useNavigation } from '@react-navigation/native'
import { Ionicons } from '@expo/vector-icons'
import Svg, { Circle, Line, Text as SvgText, Image as SvgImage, Defs, ClipPath, Rect } from 'react-native-svg'
import { getFriends } from '../../services/friendship.service'
import { useAuthStore } from '../../store/auth.store'
import { Friendship } from '../../types'
import { colors, fonts, spacing } from '../../theme'
import { API_BASE } from '../../config'

const { width, height } = Dimensions.get('window')
const CENTER_X = width / 2
const CENTER_Y = height / 2 - 60
const ORBIT_R = 130
const CENTER_RADIUS = 36
const NODE_RADIUS = 26


const TIER_COLORS = ['#FF4B6E', '#FF8C42', '#FFD700', '#7EC8E3', '#B39DDB']

function resolveAvatar(avatar: string | null) {
  if (!avatar) return null
  return avatar.startsWith('http') ? avatar : `${API_BASE}${avatar}`
}

export default function FriendshipMapScreen() {
  const nav = useNavigation()
  const { top } = useSafeAreaInsets()
  const { user } = useAuthStore()
  const [friends, setFriends] = useState<Friendship[]>([])
  const [popup, setPopup] = useState<string | null>(null)
  const nodeAnims = useRef<Animated.Value[]>([])

  useEffect(() => {
    getFriends().then((data) => {
      setFriends(data)
      nodeAnims.current = data.map(() => new Animated.Value(0))
      const staggered = nodeAnims.current.map((anim, i) =>
        Animated.spring(anim, {
          toValue: 1,
          useNativeDriver: true,
          delay: i * 80,
          speed: 14,
          bounciness: 8,
        }),
      )
      Animated.parallel(staggered).start()
    }).catch(() => {})
  }, [])

  const displayed = friends.slice(0, 12)

  return (
    <View style={[s.container, { paddingTop: top }]}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => nav.goBack()} style={s.backBtn}>
          <Ionicons name="chevron-back" size={26} color={colors.white} />
        </TouchableOpacity>
        <Text style={s.title}>Sua Rede</Text>
        <View style={{ width: 36 }} />
      </View>

      <TouchableOpacity
        style={s.mapArea}
        activeOpacity={1}
        onPress={() => setPopup(null)}
      >
        <Svg width={width} height={height - 120}>
          <Defs>
            <ClipPath id="centerClip">
              <Circle cx={CENTER_X} cy={CENTER_Y} r={CENTER_RADIUS} />
            </ClipPath>
          </Defs>

          {displayed.map((f, i) => {
            const angle = (2 * Math.PI * i) / displayed.length - Math.PI / 2
            const nx = CENTER_X + ORBIT_R * Math.cos(angle)
            const ny = CENTER_Y + ORBIT_R * Math.sin(angle)
            const tierColor = TIER_COLORS[Math.min(i % 5, TIER_COLORS.length - 1)]
            return (
              <Line
                key={`line-${f.friendshipId}`}
                x1={CENTER_X} y1={CENTER_Y}
                x2={nx} y2={ny}
                stroke={tierColor}
                strokeWidth={1.5}
                strokeOpacity={0.4}
              />
            )
          })}

          <Circle cx={CENTER_X} cy={CENTER_Y} r={CENTER_RADIUS + 3} fill={colors.primary} opacity={0.25} />
          {resolveAvatar(user?.avatar ?? null) && (
            <SvgImage
              href={{ uri: resolveAvatar(user?.avatar ?? null)! }}
              x={CENTER_X - CENTER_RADIUS}
              y={CENTER_Y - CENTER_RADIUS}
              width={CENTER_RADIUS * 2}
              height={CENTER_RADIUS * 2}
              clipPath="url(#centerClip)"
              preserveAspectRatio="xMidYMid slice"
            />
          )}

          {displayed.map((f, i) => {
            const angle = (2 * Math.PI * i) / displayed.length - Math.PI / 2
            const nx = CENTER_X + ORBIT_R * Math.cos(angle)
            const ny = CENTER_Y + ORBIT_R * Math.sin(angle)
            const tierColor = TIER_COLORS[i % TIER_COLORS.length]
            const clipId = `clip-${f.friendshipId}`
            return (
              <React.Fragment key={f.friendshipId}>
                <Defs>
                  <ClipPath id={clipId}>
                    <Circle cx={nx} cy={ny} r={NODE_RADIUS} />
                  </ClipPath>
                </Defs>
                <Circle cx={nx} cy={ny} r={NODE_RADIUS + 2.5} fill={tierColor} opacity={0.35} />
                {resolveAvatar(f.friend.avatar) ? (
                  <SvgImage
                    href={{ uri: resolveAvatar(f.friend.avatar)! }}
                    x={nx - NODE_RADIUS}
                    y={ny - NODE_RADIUS}
                    width={NODE_RADIUS * 2}
                    height={NODE_RADIUS * 2}
                    clipPath={`url(#${clipId})`}
                    preserveAspectRatio="xMidYMid slice"
                    onPress={() => setPopup(popup === f.friend.id ? null : f.friend.id)}
                  />
                ) : (
                  <Circle
                    cx={nx} cy={ny} r={NODE_RADIUS}
                    fill="#2A2A2A"
                    onPress={() => setPopup(popup === f.friend.id ? null : f.friend.id)}
                  />
                )}
                {popup === f.friend.id && (
                  <React.Fragment>
                    <Rect
                      x={nx - 50}
                      y={ny - NODE_RADIUS - 34}
                      width={100}
                      height={26}
                      rx={8}
                      fill="#1A1A1A"
                    />
                    <SvgText
                      x={nx}
                      y={ny - NODE_RADIUS - 15}
                      textAnchor="middle"
                      fill={colors.white}
                      fontSize={12}
                      fontWeight="600"
                    >
                      {f.friend.name.split(' ')[0]}
                    </SvgText>
                  </React.Fragment>
                )}
              </React.Fragment>
            )
          })}
        </Svg>
      </TouchableOpacity>

      <View style={s.legend}>
        <Text style={s.legendText}>
          {friends.length} amigos na sua rede
        </Text>
      </View>
    </View>
  )
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#1A1A1A' },
  header:    {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
  },
  backBtn:   { width: 36 },
  title:     { color: colors.white, fontFamily: fonts.bold, fontSize: 20 },
  mapArea:   { flex: 1 },
  legend:    {
    paddingHorizontal: spacing.md, paddingBottom: 20,
    alignItems: 'center',
  },
  legendText:{ color: 'rgba(255,255,255,0.35)', fontFamily: fonts.regular, fontSize: 13 },
})
