/**
 * Regulador de um valor. Tocar salta para o ponto tocado, arrastar afina a
 * partir daí — é o gesto que se espera de uma barra destas.
 */
import React, { useCallback, useMemo, useRef, useState } from 'react'
import { PanResponder, StyleSheet, View } from 'react-native'

interface Props {
  value: number
  min: number
  max: number
  onChange: (v: number) => void
  /** Reguladores que vão de negativo a positivo ganham marca no zero. */
  bipolar?: boolean
}

const KNOB = 22
const clamp = (v: number, lo: number, hi: number) => Math.min(Math.max(v, lo), hi)

export default function Slider({ value, min, max, onChange, bipolar = false }: Props) {
  const [width, setWidth] = useState(0)

  const widthRef  = useRef(0)
  const anchorRef = useRef(value)
  const rangeRef  = useRef({ min, max })
  const onChangeRef = useRef(onChange)

  widthRef.current = width
  rangeRef.current = { min, max }
  onChangeRef.current = onChange

  const emit = useCallback((v: number) => {
    const { min: lo, max: hi } = rangeRef.current
    onChangeRef.current(clamp(v, lo, hi))
  }, [])

  const responder = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderTerminationRequest: () => false,
    onPanResponderGrant: (e) => {
      const w = widthRef.current
      if (w <= 0) return
      const { min: lo, max: hi } = rangeRef.current
      const at = lo + (clamp(e.nativeEvent.locationX, 0, w) / w) * (hi - lo)
      anchorRef.current = at
      emit(at)
    },
    onPanResponderMove: (_e, g) => {
      const w = widthRef.current
      if (w <= 0) return
      const { min: lo, max: hi } = rangeRef.current
      emit(anchorRef.current + (g.dx / w) * (hi - lo))
    },
  }), [emit])

  const pct = max > min ? clamp((value - min) / (max - min), 0, 1) : 0
  const zero = max > min ? clamp((0 - min) / (max - min), 0, 1) : 0
  const knobX = pct * width

  // A barra cheia arranca do zero nos reguladores bipolares, para se ver de
  // relance para que lado a foto foi puxada.
  const fillFrom = bipolar ? Math.min(pct, zero) : 0
  const fillTo   = bipolar ? Math.max(pct, zero) : pct

  return (
    <View
      style={s.hit}
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
      {...responder.panHandlers}
    >
      <View style={s.track} pointerEvents="none" />
      {bipolar && <View style={[s.zero, { left: zero * width }]} pointerEvents="none" />}
      <View
        pointerEvents="none"
        style={[s.fill, { left: fillFrom * width, width: Math.max(0, (fillTo - fillFrom) * width) }]}
      />
      <View style={[s.knob, { left: knobX - KNOB / 2 }]} pointerEvents="none" />
    </View>
  )
}

const s = StyleSheet.create({
  hit:   { height: 44, justifyContent: 'center' },
  track: { height: 3, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.18)' },
  fill:  { position: 'absolute', height: 3, borderRadius: 2, backgroundColor: '#FF7A1C' },
  zero:  { position: 'absolute', width: 1, height: 11, backgroundColor: 'rgba(255,255,255,0.4)' },
  knob:  {
    position: 'absolute',
    width: KNOB, height: KNOB, borderRadius: KNOB / 2,
    backgroundColor: '#FFFFFF',
  },
})
