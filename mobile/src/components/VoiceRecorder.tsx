import React, { useRef, useEffect, useState, useCallback } from 'react'
import {
  View, Text, TouchableOpacity, StyleSheet, Animated, ActivityIndicator,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio'
import { colors, fonts } from '../theme'
import { useT } from '../i18n'
import { useVoiceRecorder } from './VoiceMessage/useVoiceRecorder'
import { VoicePhase } from './VoiceMessage/types'

// ── Constants ─────────────────────────────────────────────────────────────────
const PRIMARY   = '#CA2851'
const REC_BARS  = 28
const PREV_BARS = 36
const BAR_H     = 22
const BAR_W     = 3
const GRAD      = ['#CA2851', '#FF6766', '#FFB173']

function fmtMs(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000))
  const m = Math.floor(s / 60)
  return `${String(m).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
}

// Seed-based static waveform (same algorithm as AudioPlayer in ChatScreen)
function genWave(seed: string, bars: number): number[] {
  let h = 5381
  for (let i = 0; i < seed.length; i++) h = ((h << 5) + h) ^ seed.charCodeAt(i)
  return Array.from({ length: bars }, (_, i) => {
    const v = Math.abs(Math.sin((h & 0xffff) * 0.0001 + i * 0.85) * Math.cos(i * 0.4 + 0.5))
    return Math.max(0.12, Math.min(1, v * 2.2))
  })
}

// ── Recording waveform ────────────────────────────────────────────────────────
// Each bar loops between its own high/low with a random speed.
// Targets are fixed at init so Animated.loop stays smooth without re-creation.
function RecordingWave({ active }: { active: boolean }) {
  const anims  = useRef(
    Array.from({ length: REC_BARS }, (_, i) => new Animated.Value(0.1 + (i % 5) * 0.12))
  ).current
  const params = useRef(
    Array.from({ length: REC_BARS }, () => ({
      high: 0.45 + Math.random() * 0.55,
      low:  0.06 + Math.random() * 0.18,
      dur:  170 + Math.random() * 260,
    }))
  ).current
  const loopsRef = useRef<Animated.CompositeAnimation[]>([])

  useEffect(() => {
    loopsRef.current.forEach(l => l.stop())
    loopsRef.current = []

    if (!active) {
      anims.forEach(a =>
        Animated.timing(a, { toValue: 0.2, duration: 220, useNativeDriver: true }).start()
      )
      return
    }

    loopsRef.current = anims.map((anim, i) => {
      const { high, low, dur } = params[i]
      const loop = Animated.loop(
        Animated.sequence([
          Animated.timing(anim, { toValue: high, duration: dur,        useNativeDriver: true }),
          Animated.timing(anim, { toValue: low,  duration: dur * 0.7,  useNativeDriver: true }),
        ])
      )
      // Stagger so bars don't all peak at the same time
      setTimeout(() => loop.start(), i * 18)
      return loop
    })

    return () => { loopsRef.current.forEach(l => l.stop()); loopsRef.current = [] }
  }, [active])

  return (
    <View style={w.wrap}>
      {anims.map((anim, i) => (
        <Animated.View
          key={i}
          style={[w.bar, { transform: [{ scaleY: anim }], backgroundColor: PRIMARY }]}
        />
      ))}
    </View>
  )
}

// ── Preview waveform (static heights, progress coloring) ──────────────────────
function PreviewWave({
  uri, progress,
}: { uri: string; progress: number }) {
  const heights = useRef(genWave(uri, PREV_BARS)).current
  return (
    <View style={w.wrap}>
      {heights.map((h, i) => {
        const played = i / PREV_BARS <= progress
        return (
          <View
            key={i}
            style={[
              w.bar,
              {
                height:          BAR_H * h,
                backgroundColor: played ? PRIMARY : 'rgba(202,40,81,0.22)',
              },
            ]}
          />
        )
      })}
    </View>
  )
}

const w = StyleSheet.create({
  wrap: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 2.5, height: BAR_H * 2 },
  bar:  { width: BAR_W, height: BAR_H, borderRadius: BAR_W / 2 },
})

// ── Icon button ───────────────────────────────────────────────────────────────
function IconBtn({
  name, size = 20, color = '#1A1A1A', onPress, bg, disabled,
}: {
  name: React.ComponentProps<typeof Ionicons>['name']
  size?: number
  color?: string
  onPress: () => void
  bg?: string
  disabled?: boolean
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.7}
      style={[b.btn, bg ? { backgroundColor: bg, borderRadius: 20, width: 36, height: 36 } : null]}
    >
      <Ionicons name={name} size={size} color={disabled ? 'rgba(0,0,0,0.25)' : color} />
    </TouchableOpacity>
  )
}

const b = StyleSheet.create({
  btn: { alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 },
})

// ── Main component ────────────────────────────────────────────────────────────
interface Props {
  /** Called with the local file URI and duration when the user taps Send */
  onSend:   (uri: string, durationMs: number) => Promise<void>
  /** Called when the user cancels in initial recording phase */
  onCancel: () => void
}

export default function VoiceRecorder({ onSend, onCancel }: Props) {
  const t = useT()
  const { state, dispatch, start, pauseRec, resumeRec, stopRec, deleteRec, sendRec } =
    useVoiceRecorder()

  // ── Playback (always called; null source = no audio loaded) ───────────────
  const [playSource, setPlaySource] = useState<{ uri: string } | null>(null)
  const player       = useAudioPlayer(playSource)
  const playerStatus = useAudioPlayerStatus(player)

  const phase = state.phase as VoicePhase

  // Sync play source when entering preview
  useEffect(() => {
    if (state.uri && (phase === 'PREVIEW' || phase === 'PLAYING' || phase === 'PAUSED_PLAYBACK')) {
      if (!playSource || playSource.uri !== state.uri) {
        setPlaySource({ uri: state.uri })
      }
    }
    if (phase === 'IDLE') setPlaySource(null)
  }, [phase, state.uri])

  // Detect natural end of playback
  useEffect(() => {
    if (playerStatus.didJustFinish) dispatch({ type: 'PLAY_ENDED' })
  }, [playerStatus.didJustFinish])

  // ── Start recording immediately on mount ──────────────────────────────────
  useEffect(() => { start() }, [])

  // ── Handlers ──────────────────────────────────────────────────────────────
  const handlePlay = useCallback(() => {
    player.play()
    dispatch({ type: phase === 'PAUSED_PLAYBACK' ? 'RESUME_PLAY' : 'PLAY' })
  }, [player, phase])

  const handlePausePlay = useCallback(() => {
    player.pause()
    dispatch({ type: 'PAUSE_PLAY' })
  }, [player])

  const handleReplay = useCallback(() => {
    player.seekTo(0)
    player.play()
    dispatch({ type: 'PLAY' })
  }, [player])

  const handleSend = useCallback(() => {
    sendRec(onSend)
  }, [sendRec, onSend])

  const handleDelete = useCallback(() => {
    deleteRec(onCancel)
  }, [deleteRec, onCancel])

  const handleRetry = useCallback(() => {
    dispatch({ type: 'RETRY' })
    sendRec(onSend)
  }, [sendRec, onSend])

  // Progress for preview waveform
  const durationSec = playerStatus.duration   ?? 0
  const posSec      = playerStatus.currentTime ?? 0
  const progress    = durationSec > 0 ? Math.min(1, posSec / durationSec) : 0
  const posMs       = posSec * 1000

  // ── UPLOADING ─────────────────────────────────────────────────────────────
  if (phase === 'UPLOADING') {
    return (
      <View style={s.row}>
        <ActivityIndicator size="small" color={PRIMARY} />
        <Text style={s.uploadTxt}>{t.vr_uploading}</Text>
      </View>
    )
  }

  // ── ERROR ─────────────────────────────────────────────────────────────────
  if (phase === 'ERROR') {
    return (
      <View style={s.row}>
        <Ionicons name="alert-circle" size={18} color="#FF3B30" />
        <Text style={[s.uploadTxt, { color: '#FF3B30', flex: 1 }]} numberOfLines={1}>
          {state.error ?? t.vr_send_fail}
        </Text>
        <TouchableOpacity onPress={handleRetry} style={s.retryBtn} activeOpacity={0.75}>
          <Text style={s.retryTxt}>{t.dn_try_again}</Text>
        </TouchableOpacity>
        <IconBtn name="trash-outline" size={18} color="#FF3B30" onPress={handleDelete} />
      </View>
    )
  }

  // ── RECORDING / PAUSED_RECORDING ──────────────────────────────────────────
  if (phase === 'RECORDING' || phase === 'PAUSED_RECORDING') {
    const isPaused = phase === 'PAUSED_RECORDING'
    return (
      <View style={s.row}>
        {/* Delete */}
        <IconBtn name="trash-outline" size={22} color="#FF3B30" onPress={handleDelete} />

        {/* Live waveform */}
        <RecordingWave active={!isPaused} />

        {/* Timer */}
        <Text style={s.timer}>{fmtMs(state.elapsedMs)}</Text>

        {/* Pause / Resume */}
        {isPaused
          ? <IconBtn name="mic"   size={24} color={PRIMARY}  onPress={resumeRec} />
          : <IconBtn name="pause" size={24} color="#1A1A1A"  onPress={pauseRec}  />
        }

        {/* Stop → enters preview */}
        <IconBtn name="stop-circle" size={32} color={PRIMARY} onPress={stopRec} />
      </View>
    )
  }

  // ── PREVIEW / PLAYING / PAUSED_PLAYBACK ───────────────────────────────────
  if (phase === 'PREVIEW' || phase === 'PLAYING' || phase === 'PAUSED_PLAYBACK') {
    const isPlaying = phase === 'PLAYING'
    const displayMs = isPlaying || phase === 'PAUSED_PLAYBACK' ? posMs : state.durationMs

    return (
      <View style={s.row}>
        {/* Delete */}
        <IconBtn name="trash-outline" size={22} color="#FF3B30" onPress={handleDelete} />

        {/* Preview waveform with playback progress */}
        <PreviewWave uri={state.uri!} progress={progress} />

        {/* Time */}
        <Text style={s.timer}>{fmtMs(displayMs)}</Text>

        {/* Play / Pause */}
        {isPlaying
          ? <IconBtn name="pause" size={24} color="#1A1A1A" onPress={handlePausePlay} />
          : <IconBtn name="play"  size={24} color={PRIMARY} onPress={handlePlay}      />
        }

        {/* Replay from start */}
        <IconBtn name="refresh" size={22} color="#1A1A1A" onPress={handleReplay} />

        {/* Send */}
        <TouchableOpacity onPress={handleSend} activeOpacity={0.8} style={s.sendBtn}>
          <Ionicons name="send" size={18} color="#fff" style={{ marginLeft: 2 }} />
        </TouchableOpacity>
      </View>
    )
  }

  return null
}

// ── Styles ─────────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  row: {
    flexDirection:  'row',
    alignItems:     'center',
    gap:            8,
    paddingVertical: 2,
  },

  timer: {
    fontSize:      13,
    fontFamily:    fonts.semiBold,
    color:         '#1A1A1A',
    letterSpacing: 0.5,
    minWidth:      38,
    textAlign:     'right',
  },

  sendBtn: {
    width:           42,
    height:          42,
    borderRadius:    21,
    backgroundColor: PRIMARY,
    alignItems:      'center',
    justifyContent:  'center',
    flexShrink:      0,
  },

  uploadTxt: {
    flex:       1,
    fontSize:   13,
    fontFamily: fonts.medium,
    color:      '#1A1A1A',
  },

  retryBtn: {
    backgroundColor: `${PRIMARY}15`,
    borderRadius:    8,
    paddingHorizontal: 10,
    paddingVertical:   5,
  },
  retryTxt: {
    fontSize:   12,
    fontFamily: fonts.semiBold,
    color:      PRIMARY,
  },
})
