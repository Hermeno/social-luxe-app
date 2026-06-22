import React, { useEffect, useCallback, useState } from 'react'
import { View, TouchableOpacity, StyleSheet, Text } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { Post } from '../../types'
import { useTravelState } from './useTravelState'
import TravelPath    from './TravelPath'
import TravelObjects from './TravelObjects'
import TravelStats   from './TravelStats'
import * as travelService from '../../services/travel.service'
import { fonts } from '../../theme'

interface Props {
  post:     Post
  isActive: boolean
}

export default function Travel({ post, isActive }: Props) {
  const { state, dispatch } = useTravelState()
  const [statsOpen, setStatsOpen] = useState(false)

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
  if (nodes.length === 0 && objects.length === 0) return null

  const pickerOpen = state.phase === 'ADDING_OBJECT'

  return (
    <>
      {/* ── Travel path — left side overlay ── */}
      {nodes.length > 0 && (
        <View style={s.pathOverlay} pointerEvents="none">
          <TravelPath postId={post.id} nodes={nodes} />
        </View>
      )}

      {/* ── Stats toggle button — top-right ── */}
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

      {/* ── Stats panel (collapsible) ── */}
      {statsOpen && (
        <View style={s.statsPanel}>
          <TravelStats stats={stats} />
        </View>
      )}

      {/* ── Objects strip — bottom-left ── */}
      <View style={s.objectsArea}>
        <TravelObjects
          postId={post.id}
          postOwnerId={post.userId}
          objects={objects}
          pickerOpen={pickerOpen}
          removingId={state.removingId}
          onOpenPicker={() => dispatch({ type: 'OPEN_PICKER' })}
          onClosePicker={() => dispatch({ type: 'CLOSE_PICKER' })}
          onAdd={handleAdd}
          onRemove={handleRemove}
        />
      </View>
    </>
  )
}

const s = StyleSheet.create({
  // Path overlay — absolute left edge
  pathOverlay: {
    position: 'absolute',
    left:     8,
    top:      '15%',
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

  // Objects strip — bottom-left, above PostInfo
  objectsArea: {
    position: 'absolute',
    bottom:   '28%',
    left:     12,
    right:    80,
    zIndex:   6,
  },
})
