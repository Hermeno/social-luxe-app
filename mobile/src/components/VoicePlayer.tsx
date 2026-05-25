import React, { useState, useEffect, useRef } from 'react'
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio'
import { colors, fonts } from '../theme'

interface Props {
  uri: string
}

const BAR_COUNT = 18

export default function VoicePlayer({ uri }: Props) {
  const player  = useAudioPlayer({ uri })
  const status  = useAudioPlayerStatus(player)
  const [playing, setPlaying] = useState(false)
  const barAnims = useRef(
    Array.from({ length: BAR_COUNT }, () => new Animated.Value(0.25 + Math.random() * 0.75)),
  ).current
  const waveLoop = useRef<Animated.CompositeAnimation | null>(null)

  useEffect(() => {
    if (status.didJustFinish) {
      setPlaying(false)
      stopWave()
    }
  }, [status.didJustFinish])

  function startWave() {
    waveLoop.current = Animated.loop(
      Animated.parallel(
        barAnims.map((anim) =>
          Animated.sequence([
            Animated.timing(anim, {
              toValue: 0.2 + Math.random() * 0.8,
              duration: 200 + Math.random() * 300,
              useNativeDriver: true,
            }),
            Animated.timing(anim, {
              toValue: 0.2 + Math.random() * 0.8,
              duration: 200 + Math.random() * 300,
              useNativeDriver: true,
            }),
          ]),
        ),
      ),
    )
    waveLoop.current.start()
  }

  function stopWave() {
    waveLoop.current?.stop()
    barAnims.forEach((a, i) =>
      Animated.timing(a, {
        toValue: 0.25 + (i % 3) * 0.25,
        duration: 150,
        useNativeDriver: true,
      }).start(),
    )
  }

  function togglePlay() {
    if (playing) {
      player.pause()
      setPlaying(false)
      stopWave()
    } else {
      player.play()
      setPlaying(true)
      startWave()
    }
  }

  function formatMs(ms: number) {
    const s = Math.floor(ms / 1000)
    const m = Math.floor(s / 60)
    return `${m}:${(s % 60).toString().padStart(2, '0')}`
  }

  const durationMs  = (status.duration ?? 0) * 1000
  const positionMs  = (status.currentTime ?? 0) * 1000
  const progress    = durationMs > 0 ? positionMs / durationMs : 0

  return (
    <View style={s.container}>
      <TouchableOpacity onPress={togglePlay} style={s.playBtn} activeOpacity={0.8}>
        <Ionicons name={playing ? 'pause' : 'play'} size={18} color={colors.white} />
      </TouchableOpacity>

      <View style={s.waveWrap}>
        {barAnims.map((anim, i) => (
          <Animated.View
            key={i}
            style={[
              s.bar,
              {
                transform: [{ scaleY: anim }],
                backgroundColor:
                  i / BAR_COUNT <= progress
                    ? colors.white
                    : 'rgba(255,255,255,0.3)',
              },
            ]}
          />
        ))}
      </View>

      <Text style={s.duration}>
        {durationMs > 0 ? formatMs(playing ? positionMs : durationMs) : '0:00'}
      </Text>
    </View>
  )
}

const s = StyleSheet.create({
  container: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    minWidth: 180,
  },
  playBtn:   {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center', justifyContent: 'center',
  },
  waveWrap:  { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 2, height: 28 },
  bar:       { width: 3, height: 20, borderRadius: 2 },
  duration:  { color: 'rgba(255,255,255,0.6)', fontFamily: fonts.regular, fontSize: 11, minWidth: 32, textAlign: 'right' },
})
