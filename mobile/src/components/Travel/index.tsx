import React, { useEffect, useCallback, useState } from 'react'
import { View, TouchableOpacity, StyleSheet, Text, Dimensions } from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { Post } from '../../types'
import { useTravelState } from './useTravelState'
import TravelPath    from './TravelPath'
import TravelObjects from './TravelObjects'
import TravelStats   from './TravelStats'
import * as travelService from '../../services/travel.service'
import { fonts } from '../../theme'

const SCREEN_H = Dimensions.get('window').height

interface Props {
  post:     Post
  isActive: boolean
}

export default function Travel({ post, isActive }: Props) {
  const { state, dispatch } = useTravelState()
  const [statsOpen, setStatsOpen] = useState(false)
  const insets      = useSafeAreaInsets()
  // Top: skip status bar + FeedHeader bubble row (~90px)
  // Bottom: leave room for PostInfo (~200px above safe-area bottom)
  const topOffset   = insets.top + 90
  const bottomClear = insets.bottom + 200
  const stripH      = Math.min(460, Math.max(180, SCREEN_H - topOffset - bottomClear))

  // Lazy-load travel data when post becomes active
  useEffect(() => {
    if (!isActive || !post.isTravelEnabled) return
    if (state.phase !== 'IDLE') return

    dispatch({ type: 'LOAD' })
    travelService.getTravelData(post.id)
      .then((data) => dispatch({ type: 'LOAD_OK', data }))
      .catch((e)   => dispatch({ type: 'LOAD_ERR', error: e?.message ?? 'Erro' }))
  }, [isActive, post.id])

  // Reset when post changes
  useEffect(() => {
    dispatch({ type: 'RESET' })
  }, [post.id])

  const handleAdd = useCallback(async (emoji: string) => {
    try {
      const obj = await travelService.addObject(post.id, emoji, 'emoji')
      dispatch({ type: 'ADD_OBJECT', object: obj })
    } catch {}
  }, [post.id])

  const handleRemove = useCallback(async (objectId: string) => {
    dispatch({ type: 'REMOVE_START', id: objectId })
    try {
      await travelService.removeObject(objectId)
      dispatch({ type: 'REMOVE_OK', id: objectId })
    } catch {
      dispatch({ type: 'REMOVE_ERR' })
    }
  }, [])

  // Nothing to show until data is loaded
  if (!post.isTravelEnabled) return null
  if (state.phase === 'IDLE' || state.phase === 'LOADING' || !state.data) return null
  if (state.phase === 'ERROR') return null

  const { nodes, objects, stats } = state.data

  // Separate the creator's caption from regular emoji objects
  const captionObj   = objects.find((o) => o.type === 'caption')
  const emojiObjects = objects.filter((o) => o.type !== 'caption')

  if (nodes.length === 0 && emojiObjects.length === 0 && !captionObj) return null

  const pickerOpen = state.phase === 'ADDING_OBJECT'

  return (
    <>
      {/* ── Travel pill — deep night capsule, safe between header and PostInfo ── */}
      {nodes.length > 0 && (
        <>
          <LinearGradient
            colors={['rgba(4,10,52,0.97)', 'rgba(8,18,62,0.94)', 'rgba(18,30,80,0.82)']}
            style={[s.travelGradient, { top: topOffset, height: stripH }]}
            start={{ x: 0, y: 0 }}
            end={{ x: 0, y: 1 }}
            pointerEvents="none"
          />
          <View
            style={[s.travelPathLayer, { top: topOffset, height: stripH }]}
            pointerEvents="none"
          >
            <TravelPath postId={post.id} nodes={nodes} containerH={stripH} />
          </View>
        </>
      )}

      {/* ── Stats toggle button — top-right ── */}
      {nodes.length > 0 && (
        <View style={s.statsBtn}>
          <TouchableOpacity
            onPress={() => setStatsOpen((o) => !o)}
            activeOpacity={0.8}
            style={s.statsBtnInner}
          >
            <Text style={s.statsCountry}>🌍</Text>
            <Text style={s.statsCount}>{stats.totalCountries}</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* ── Stats panel (collapsible) ── */}
      {statsOpen && (
        <View style={s.statsPanel}>
          <TravelStats stats={stats} />
        </View>
      )}

      {/* ── Travel caption banner (motivo da viagem) ── */}
      {captionObj && (
        <View style={s.captionBanner} pointerEvents="none">
          <Text style={s.captionEmoji}>🌍</Text>
          <Text style={s.captionText} numberOfLines={2}>{captionObj.value}</Text>
        </View>
      )}

      {/* ── Objects strip — bottom-left ── */}
      {emojiObjects.length > 0 && (
        <View style={s.objectsArea}>
          <TravelObjects
            postId={post.id}
            postOwnerId={post.userId}
            objects={emojiObjects}
            pickerOpen={pickerOpen}
            removingId={state.removingId}
            onOpenPicker={() => dispatch({ type: 'OPEN_PICKER' })}
            onClosePicker={() => dispatch({ type: 'CLOSE_PICKER' })}
            onAdd={handleAdd}
            onRemove={handleRemove}
          />
        </View>
      )}
    </>
  )
}

const s = StyleSheet.create({
  // Deep-night capsule — height set inline via dynamic calculation
  travelGradient: {
    position:           'absolute',
    left:               10,
    width:              54,
    borderRadius:       12,
    zIndex:             5,
  },
  // Path layer — same bounds, no overflow clip so labels peek right
  travelPathLayer: {
    position: 'absolute',
    left:     10,
    width:    54,
    zIndex:   5,
  },

  // Stats globe button — top right
  statsBtn: {
    position: 'absolute',
    top:      12,
    right:    12,
    zIndex:   6,
  },
  statsBtnInner: {
    flexDirection:   'row',
    alignItems:      'center',
    gap:             4,
    backgroundColor: 'rgba(0,0,0,0.45)',
    borderRadius:    20,
    paddingHorizontal: 10,
    paddingVertical:   5,
  },
  statsCountry: { fontSize: 14 },
  statsCount: {
    fontSize:   12,
    fontFamily: fonts.bold,
    color:      '#fff',
  },

  // Stats panel — below the button
  statsPanel: {
    position: 'absolute',
    top:      48,
    right:    12,
    zIndex:   7,
  },

  // Motivo da viagem — above the objects strip
  captionBanner: {
    position:    'absolute',
    bottom:      '32%',
    left:        12,
    right:       80,
    zIndex:      6,
    flexDirection:   'row',
    alignItems:      'flex-start',
    gap:             5,
    backgroundColor: 'rgba(0,0,0,0.42)',
    borderRadius:    10,
    paddingHorizontal: 10,
    paddingVertical:    7,
  },
  captionEmoji: { fontSize: 13, lineHeight: 18 },
  captionText: {
    flex:       1,
    fontSize:   12,
    fontFamily: fonts.medium,
    color:      'rgba(255,255,255,0.92)',
    lineHeight: 17,
    letterSpacing: -0.1,
    textShadowColor:  'rgba(0,0,0,0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius:  2,
  },

  // Objects strip — bottom-left, above PostInfo
  objectsArea: {
    position: 'absolute',
    bottom:   '28%',
    left:     12,
    right:    80,
    zIndex:   6,
  },
})
