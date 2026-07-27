import React, { memo, useRef, useEffect } from 'react'
import {
  View, Text, TextInput, TouchableOpacity,
  ScrollView, StyleSheet, Animated, Easing,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useNavigation } from '@react-navigation/native'
import { Ionicons } from '@expo/vector-icons'
import { Search } from 'lucide-react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { colors, fonts } from '../../theme'
import AvatarImage from '../../components/AvatarImage'
import SegmentedRing from '../../components/SegmentedRing'
import LiveRing from '../../components/LiveRing'
import { useOnlineStore } from '../../store/online.store'
import { useAuthStore } from '../../store/auth.store'
import { useT } from '../../i18n'
import { useFocusEffect } from '@react-navigation/native'
import { getIncomingHalves } from '../../services/half.service'
import { Post } from '../../types'
import { API_BASE } from '../../config'

export interface FeedUserGroup {
  user: Post['user']
  posts: Post[]
}

// ── Geometria — um só peso de anel em toda a app ────────────────────────────
// O anel respira longe do avatar (RING_GAP) e o traço é sempre RING_STROKE.
// Tudo o resto deriva de AV_SIZE, para a fila escalar como uma peça só.
const AV_SIZE      = 72
const RING_STROKE  = 3.6
const RING_COLOR   = colors.ring
const RING_GAP     = 3     // folga entre avatar e anel
const RING_OUTER   = Math.round(AV_SIZE + (RING_GAP + RING_STROKE) * 2)   // ~76
const TILE_W       = RING_OUTER + 4
const TILE_GAP     = 14
const DOT_SIZE     = 15
const BADGE_SIZE   = 21
const BUBBLE_SIZE  = 56
const CLUSTER_AV   = 34   // avatar no grupo compacto do topo (barra de vidro)
const ONLINE_THRESH = 5 * 60 * 1000


function resolveAvatar(uri: string | null | undefined): string | null {
  if (!uri) return null
  return uri.startsWith('http') || uri.startsWith('file://') ? uri : `${API_BASE}${uri}`
}

function isOnlineByLastSeen(lastSeen?: string | null): boolean {
  if (!lastSeen) return false
  return Date.now() - new Date(lastSeen).getTime() < ONLINE_THRESH
}

export interface FeedHeaderProps {
  filteredGroups:  FeedUserGroup[]
  activeUserId:    string | undefined
  searchMode:      boolean
  searchQuery:     string
  onSearchClose:   () => void
  onSearchChange:  (q: string) => void
  onSearchPress:   () => void
  onBubblePress:   (group: FeedUserGroup) => void
  onCreatePress:   () => void
}

export default memo(function FeedHeader({
  filteredGroups, activeUserId,
  searchMode, searchQuery,
  onSearchClose, onSearchChange, onSearchPress,
  onBubblePress, onCreatePress,
}: FeedHeaderProps) {
  const { top } = useSafeAreaInsets()
  const nav = useNavigation<any>()
  const t = useT()
  const isSocketOnline = useOnlineStore((s) => s.isOnline)
  const currentUser    = useAuthStore((s) => s.user)
  const [halvesCount, setHalvesCount] = React.useState(0)

  // Respirar — o avatar de quem está no ecrã pulsa devagar, para o topo não
  // parecer morto. Loop suave por native driver.
  const breathe = useRef(new Animated.Value(0)).current
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(breathe, { toValue: 1, duration: 1900, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(breathe, { toValue: 0, duration: 1900, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ]),
    )
    loop.start()
    return () => loop.stop()
  }, [breathe])
  const breatheScale = breathe.interpolate({ inputRange: [0, 1], outputRange: [1, 1.05] })

  // Quantas metades esperam por mim — recontado a cada volta ao feed
  useFocusEffect(
    React.useCallback(() => {
      getIncomingHalves().then((hs) => setHalvesCount(hs.length)).catch(() => {})
    }, []),
  )

  /* ── Search panel — replaces the rail in-flow, post card stays below ─────── */
  if (searchMode) {
    return (
      <View style={[s.wrapper, { paddingTop: top + 8 }]}>
        <View style={s.searchRow}>
          <View style={s.searchField}>
            <Search size={14} strokeWidth={2} color="rgba(0,0,0,0.40)" />
            <TextInput
              autoFocus
              placeholder={t.feed_search_ph}
              placeholderTextColor="rgba(0,0,0,0.35)"
              value={searchQuery}
              onChangeText={onSearchChange}
              style={s.searchInput}
              returnKeyType="search"
              autoCapitalize="none"
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => onSearchChange('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Ionicons name="close-circle" size={17} color="rgba(0,0,0,0.30)" />
              </TouchableOpacity>
            )}
          </View>
          <TouchableOpacity onPress={onSearchClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Text style={s.cancelText}>{t.cancel}</Text>
          </TouchableOpacity>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={s.bubbleScroll}
          contentContainerStyle={s.bubbleContent}
          keyboardShouldPersistTaps="handled"
        >
          {filteredGroups.length === 0 ? (
            <View style={s.emptyWrap}>
              <Text style={s.emptyTxt}>{t.feed_no_users}</Text>
            </View>
          ) : (
            filteredGroups.map((g) => {
              const isActive = g.user.id === activeUserId
              return (
                <TouchableOpacity key={g.user.id} style={s.bubble}
                  onPress={() => { onBubblePress(g); onSearchChange('') }} activeOpacity={0.78}>
                  <View style={[s.bubbleRing, isActive && s.bubbleRingActive]}>
                    <AvatarImage uri={g.user.avatar} name={g.user.name} size={BUBBLE_SIZE} borderWidth={0} borderColor="transparent" />
                  </View>
                  <Text style={s.bubbleName} numberOfLines={1}>{g.user.name.split(' ')[0]}</Text>
                </TouchableOpacity>
              )
            })
          )}
        </ScrollView>
        <View style={s.divider} />
      </View>
    )
  }

  /* ── Barra de vidro fosco com os avatares redondos por cima ──────────────── */
  return (
    <View style={[s.glassBar, { paddingTop: top + 6 }]}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={s.railContent}
      >
        {/* Criar — o teu avatar + badge */}
        <TouchableOpacity onPress={onCreatePress} activeOpacity={0.72} style={s.tile}>
          <View style={s.ringWrap}>
            <View style={s.glassNeutralRing} />
            <View style={s.avatarCircle}>
              {currentUser?.avatar ? (
                <AvatarImage uri={resolveAvatar(currentUser.avatar)} name={currentUser.name} size={AV_SIZE} borderWidth={0} borderColor="transparent" />
              ) : (
                <View style={s.addPlaceholder}><Ionicons name="person" size={26} color="rgba(0,0,0,0.35)" /></View>
              )}
            </View>
            <View style={s.addBadge}><Ionicons name="add" size={13} color="#fff" /></View>
          </View>
          <Text style={s.glassTileName} numberOfLines={1}>{t.feed_create}</Text>
        </TouchableOpacity>

        {/* Metades — só quando alguém espera por ti */}
        {halvesCount > 0 && (
          <TouchableOpacity onPress={() => nav.navigate('Halves')} activeOpacity={0.72} style={s.tile}>
            <View style={s.ringWrap}>
              <View style={s.glassActiveRing} />
              <View style={[s.avatarCircle, s.halvesCircle]}>
                <Ionicons name="contrast" size={26} color="#1A1A1A" />
              </View>
              <View style={s.halvesBadge}><Text style={s.halvesBadgeTxt}>{halvesCount > 9 ? '9+' : halvesCount}</Text></View>
            </View>
            <Text style={s.glassTileName} numberOfLines={1}>Metades</Text>
          </TouchableOpacity>
        )}

        {/* Quem publicou — avatares redondos com anel claro (sobre o vídeo) */}
        {filteredGroups.map((g) => {
          const online   = isSocketOnline(g.user.id) || isOnlineByLastSeen(g.user.lastSeen)
          const isActive = g.user.id === activeUserId
          return (
            <TouchableOpacity key={g.user.id} onPress={() => onBubblePress(g)} activeOpacity={0.72} style={s.tile}>
              <View style={s.ringWrap}>
                {isActive ? (
                  // Quem está no ecrã: anel de gradiente que roda (vivo)
                  <LiveRing size={RING_OUTER} strokeWidth={RING_STROKE} color={colors.primary} />
                ) : (
                  <SegmentedRing count={g.posts.length} size={RING_OUTER} strokeWidth={RING_STROKE} color="rgba(202,40,81,0.7)" />
                )}
                <Animated.View style={[s.avatarCircle, isActive && { transform: [{ scale: breatheScale }] }]}>
                  <AvatarImage uri={g.user.avatar} name={g.user.name} size={AV_SIZE} borderWidth={0} borderColor="transparent" />
                </Animated.View>
                {online && <View style={s.onlineDot} />}
              </View>
              <Text style={[s.glassTileName, isActive && s.glassTileNameActive]} numberOfLines={1}>
                {g.user.name.split(' ')[0]}
              </Text>
            </TouchableOpacity>
          )
        })}
      </ScrollView>

    </View>
  )
})

const s = StyleSheet.create({
  halvesCircle: {
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#F2F2F5',
  },
  halvesBadge: {
    position: 'absolute', top: 0, right: 0,
    minWidth: 18, height: 18, borderRadius: 9,
    paddingHorizontal: 5,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#CA2851',
    borderWidth: 2, borderColor: '#fff',
  },
  halvesBadgeTxt: {
    color: '#fff', fontSize: 10, fontFamily: fonts.bold,
    includeFontPadding: false,
  },


  /* ── Rail — pure white stage above the dark feed ──────────────────────────── */
  // Barra de pesquisa — overlay branco no topo (só no modo de pesquisa)
  wrapper: {
    position: 'absolute',
    top: 0, left: 0, right: 0,
    zIndex: 45,
    backgroundColor: colors.white,
  },
  railContent: {
    paddingHorizontal: 14,
    paddingTop:        6,
    paddingBottom:     10,
    flexDirection:     'row',
    alignItems:        'flex-start',
    gap:               TILE_GAP,
  },
  divider: {
    height:          StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(0,0,0,0.10)',
  },

  // ── Barra de vidro fosco (overlay sobre o vídeo) ──────────────────────────
  glassBar: {
    position: 'absolute',
    top: 0, left: 0, right: 0,
    zIndex: 40,
    overflow: 'hidden',
  },
  glassHairline: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(0,0,0,0.07)',
  },
  // Anel neutro do "Criar" — claro, sobre o vidro escuro
  glassNeutralRing: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    borderRadius: RING_OUTER / 2,
    borderWidth: RING_STROKE,
    borderColor: colors.ringMuted,
  },
  glassActiveRing: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    borderRadius: RING_OUTER / 2,
    borderWidth: RING_STROKE,
    borderColor: 'rgba(202,40,81,0.85)',
  },
  // Nome — por defeito discreto; só o da pessoa cujo post está no ecrã acende.
  // A hierarquia diz "é isto que estás a ver" sem precisar de outra cor.
  glassTileName: {
    color: 'rgba(0,0,0,0.55)',
    fontFamily: fonts.medium,
    fontSize: 11.5,
    letterSpacing: -0.2,
    maxWidth: TILE_W + 6,
    marginTop: -2,   // puxa o nome para junto do avatar (o anel deixa folga)
    textAlign: 'center',
  },
  glassTileNameActive: {
    color: '#111114',
    fontFamily: fonts.semiBold,
  },

  // ── Tile — ring + avatar + first name ─────────────────────────────────────
  tile: {
    width:      TILE_W,
    alignItems: 'center',
    gap:        6,
  },
  ringWrap: {
    width:          RING_OUTER,
    height:         RING_OUTER,
    alignItems:     'center',
    justifyContent: 'center',
  },
  avatarCircle: {
    width:           AV_SIZE,
    height:          AV_SIZE,
    borderRadius:    AV_SIZE / 2,
    overflow:        'hidden',
    backgroundColor: '#EAEAEA',
  },
  // Um só peso de anel na fila inteira — RING_STROKE. Se um anel fosse mais
  // grosso do que outro, a fila deixava de se ler como um conjunto.
  activeRing: {
    position:     'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    borderRadius: RING_OUTER / 2,
    borderWidth:  RING_STROKE,
    borderColor:  RING_COLOR,
  },
  neutralRing: {
    position:     'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    borderRadius: RING_OUTER / 2,
    borderWidth:  RING_STROKE,
    borderColor:  colors.ringMuted,
  },
  tileName: {
    color:         'rgba(0,0,0,0.55)',
    fontFamily:    fonts.medium,
    fontSize:      10.5,
    letterSpacing: 0.1,
    maxWidth:      TILE_W,
    textAlign:     'center',
  },
  tileNameActive: {
    color:      colors.black,
    fontFamily: fonts.semiBold,
  },

  // ── Presence dot — rimmed so it reads on any avatar ──────────────────────
  onlineDot: {
    position:        'absolute',
    right:           3,
    bottom:          3,
    width:           DOT_SIZE,
    height:          DOT_SIZE,
    borderRadius:    DOT_SIZE / 2,
    backgroundColor: colors.success,
    borderWidth:     2,
    borderColor:     colors.white,
  },

  // ── Create tile details ───────────────────────────────────────────────────
  addPlaceholder: {
    width:           AV_SIZE,
    height:          AV_SIZE,
    alignItems:      'center',
    justifyContent:  'center',
    backgroundColor: '#EAEAEA',
  },
  addBadge: {
    position:        'absolute',
    bottom:          -1,
    right:           -1,
    width:           BADGE_SIZE,
    height:          BADGE_SIZE,
    borderRadius:    BADGE_SIZE / 2,
    alignItems:      'center',
    justifyContent:  'center',
    borderWidth:     2,
    borderColor:     colors.white,
    backgroundColor: colors.primary,
  },

  /* ── Search panel ─────────────────────────────────────────────────────────── */
  searchRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, marginBottom: 12, gap: 12,
  },
  searchField: {
    flex: 1, flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.05)',
    borderRadius: 12, borderWidth: 1, borderColor: 'rgba(0,0,0,0.10)',
    paddingHorizontal: 12, paddingVertical: 9, gap: 8,
  },
  searchInput: {
    flex: 1, fontFamily: fonts.regular, fontSize: 15, color: colors.black, padding: 0,
  },
  cancelText: {
    fontFamily: fonts.semiBold, fontSize: 15, color: colors.black,
  },

  /* ── Bubbles row (search mode) ─────────────────────────────────────────────── */
  bubbleScroll:  { flexGrow: 0 },
  bubbleContent: { paddingHorizontal: 16, gap: 14, alignItems: 'flex-start', paddingBottom: 12 },
  bubble: { alignItems: 'center', gap: 5, width: BUBBLE_SIZE + 14 },
  // Mesmo peso da fila do feed — os anéis da pesquisa tinham 1.6 e o activo
  // 2.2, o que fazia a fila parecer irregular consoante quem estava no ecrã.
  bubbleRing: {
    borderRadius: (BUBBLE_SIZE + 6) / 2, borderWidth: RING_STROKE,
    borderColor: RING_COLOR, padding: 2,
  },
  bubbleRingActive: { borderWidth: RING_STROKE },
  bubbleName: {
    color: 'rgba(0,0,0,0.75)', fontFamily: fonts.medium,
    fontSize: 11, textAlign: 'center', maxWidth: BUBBLE_SIZE + 12,
  },
  emptyWrap: {
    paddingVertical: 18, paddingHorizontal: 12,
    alignItems: 'center', justifyContent: 'center', width: 280,
  },
  emptyTxt: { color: 'rgba(0,0,0,0.40)', fontFamily: fonts.regular, fontSize: 13 },
})
