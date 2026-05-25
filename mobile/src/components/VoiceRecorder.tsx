import React, { useState, useRef, useEffect } from 'react'
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Alert,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useAudioRecorder, AudioModule, RecordingPresets } from 'expo-audio'
import { colors, fonts } from '../theme'

interface Props {
  onRecordingComplete: (uri: string) => void
}

export default function VoiceRecorder({ onRecordingComplete }: Props) {
  const recorder   = useAudioRecorder(RecordingPresets.HIGH_QUALITY)
  const [isRecording, setIsRecording] = useState(false)
  const [duration, setDuration]       = useState(0)
  const pulseAnim  = useRef(new Animated.Value(1)).current
  const timerRef   = useRef<ReturnType<typeof setInterval> | null>(null)
  const pulseLoop  = useRef<Animated.CompositeAnimation | null>(null)

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
      if (recorder.isRecording) recorder.stop().catch(() => {})
    }
  }, [])

  function startPulse() {
    pulseLoop.current = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.3, duration: 500, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1,   duration: 500, useNativeDriver: true }),
      ]),
    )
    pulseLoop.current.start()
  }

  function stopPulse() {
    pulseLoop.current?.stop()
    pulseAnim.setValue(1)
  }

  async function startRecording() {
    try {
      const status = await AudioModule.requestRecordingPermissionsAsync()
      if (!status.granted) {
        Alert.alert('Permissão necessária', 'Precisamos de acesso ao microfone.')
        return
      }
      await recorder.record()
      setIsRecording(true)
      setDuration(0)
      startPulse()
      timerRef.current = setInterval(() => setDuration((d) => d + 1), 1000)
    } catch {
      Alert.alert('Erro', 'Não foi possível iniciar a gravação.')
    }
  }

  async function stopRecording() {
    if (!recorder.isRecording) return
    setIsRecording(false)
    stopPulse()
    if (timerRef.current) clearInterval(timerRef.current)
    try {
      await recorder.stop()
      const uri = recorder.uri
      setDuration(0)
      if (uri) onRecordingComplete(uri)
    } catch {}
  }

  function formatTime(s: number) {
    const m = Math.floor(s / 60)
    const sec = s % 60
    return `${m}:${sec.toString().padStart(2, '0')}`
  }

  if (isRecording) {
    return (
      <View style={s.recordingRow}>
        <Animated.View style={[s.redDot, { transform: [{ scale: pulseAnim }] }]} />
        <Text style={s.timer}>{formatTime(duration)}</Text>
        <TouchableOpacity style={s.stopBtn} onPress={stopRecording} activeOpacity={0.8}>
          <Ionicons name="stop" size={18} color={colors.white} />
        </TouchableOpacity>
      </View>
    )
  }

  return (
    <TouchableOpacity
      style={s.micBtn}
      onLongPress={startRecording}
      activeOpacity={0.75}
      delayLongPress={150}
    >
      <Ionicons name="mic-outline" size={22} color={colors.white} />
    </TouchableOpacity>
  )
}

const s = StyleSheet.create({
  micBtn:       {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: '#2A2A2A',
    alignItems: 'center', justifyContent: 'center',
  },
  recordingRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  redDot:       { width: 10, height: 10, borderRadius: 5, backgroundColor: '#FF3B30' },
  timer:        { color: colors.white, fontFamily: fonts.medium, fontSize: 13, minWidth: 38 },
  stopBtn:      {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: '#FF3B30',
    alignItems: 'center', justifyContent: 'center',
  },
})
