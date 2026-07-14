import { useReducer, useRef, useCallback, useEffect } from 'react'
import { Alert } from 'react-native'
import { useAudioRecorder, AudioModule, RecordingPresets } from 'expo-audio'
import { VoiceState, VoiceAction, VOICE_INITIAL } from './types'
import { useI18n } from '../../i18n'
import { PT } from '../../i18n/pt'
import { EN } from '../../i18n/en'

const tr = () => (useI18n.getState().lang === 'en' ? EN : PT)

// ── Reducer ───────────────────────────────────────────────────────────────────
function reducer(s: VoiceState, a: VoiceAction): VoiceState {
  switch (a.type) {
    case 'START':
      return { ...VOICE_INITIAL, phase: 'RECORDING' }
    case 'TICK':
      return s.phase === 'RECORDING' ? { ...s, elapsedMs: a.ms } : s
    case 'PAUSE_REC':
      return s.phase === 'RECORDING'        ? { ...s, phase: 'PAUSED_RECORDING' } : s
    case 'RESUME_REC':
      return s.phase === 'PAUSED_RECORDING' ? { ...s, phase: 'RECORDING' }        : s
    case 'STOP':
      return { ...s, phase: 'PREVIEW', uri: a.uri, durationMs: a.durationMs }
    case 'RESET':
      return VOICE_INITIAL
    case 'PLAY':
      return (s.phase === 'PREVIEW' || s.phase === 'PAUSED_PLAYBACK')
        ? { ...s, phase: 'PLAYING' }
        : s
    case 'PAUSE_PLAY':
      return s.phase === 'PLAYING' ? { ...s, phase: 'PAUSED_PLAYBACK' } : s
    case 'RESUME_PLAY':
      return s.phase === 'PAUSED_PLAYBACK' ? { ...s, phase: 'PLAYING' } : s
    case 'PLAY_ENDED':
      return { ...s, phase: 'PREVIEW' }
    case 'SEND':
      return s.uri ? { ...s, phase: 'UPLOADING', error: null } : s
    case 'SEND_OK':
      return VOICE_INITIAL
    case 'SEND_ERR':
      return { ...s, phase: 'ERROR', error: a.error }
    case 'RETRY':
      return { ...s, phase: 'UPLOADING', error: null }
    default:
      return s
  }
}

// ── Hook ─────────────────────────────────────────────────────────────────────
export interface VoiceRecorderControls {
  state:      VoiceState
  dispatch:   React.Dispatch<VoiceAction>
  start:      () => Promise<void>
  pauseRec:   () => Promise<void>
  resumeRec:  () => Promise<void>
  stopRec:    () => Promise<void>
  deleteRec:  (onConfirmed?: () => void) => void
  sendRec:    (cb: (uri: string, durationMs: number) => Promise<void>) => Promise<void>
}

export function useVoiceRecorder(): VoiceRecorderControls {
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY)
  const [state, dispatch] = useReducer(reducer, VOICE_INITIAL)

  // ── Precise timer using accumulated + segment tracking ────────────────────
  const timerRef       = useRef<ReturnType<typeof setInterval> | null>(null)
  const segStartRef    = useRef(0)
  const accumulatedRef = useRef(0)

  function startTick() {
    segStartRef.current = Date.now()
    timerRef.current = setInterval(() => {
      dispatch({ type: 'TICK', ms: accumulatedRef.current + (Date.now() - segStartRef.current) })
    }, 80)
  }

  function pauseTick() {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null }
    accumulatedRef.current += Date.now() - segStartRef.current
  }

  function resetTick() {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null }
    accumulatedRef.current = 0
    segStartRef.current = 0
  }

  // ── Cleanup on unmount ────────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      resetTick()
      try { if (recorder.isRecording) recorder.stop() } catch {}
    }
  }, [])

  // ── Actions ───────────────────────────────────────────────────────────────
  const start = useCallback(async () => {
    const perm = await AudioModule.requestRecordingPermissionsAsync()
    if (!perm.granted) {
      Alert.alert(tr().vr_mic_needed, tr().vr_mic_settings)
      return
    }
    try {
      await recorder.prepareToRecordAsync()
      await recorder.record()
      dispatch({ type: 'START' })
      startTick()
    } catch {
      Alert.alert(tr().error, tr().vr_rec_fail)
    }
  }, [recorder])

  const pauseRec = useCallback(async () => {
    try { await recorder.pause() } catch {}
    pauseTick()
    dispatch({ type: 'PAUSE_REC' })
  }, [recorder])

  const resumeRec = useCallback(async () => {
    try { await recorder.record() } catch {}
    dispatch({ type: 'RESUME_REC' })
    startTick()
  }, [recorder])

  const stopRec = useCallback(async () => {
    pauseTick()
    const durationMs = accumulatedRef.current
    resetTick()
    try {
      await recorder.stop()
      const uri = recorder.uri
      if (uri) dispatch({ type: 'STOP', uri, durationMs })
      else     dispatch({ type: 'RESET' })
    } catch {
      dispatch({ type: 'RESET' })
    }
  }, [recorder])

  const deleteRec = useCallback((onConfirmed?: () => void) => {
    Alert.alert(
      tr().vr_delete_title,
      tr().vr_delete_msg,
      [
        { text: tr().cancel, style: 'cancel' },
        {
          text: tr().vr_delete, style: 'destructive',
          onPress: async () => {
            resetTick()
            try { if (recorder.isRecording) await recorder.stop() } catch {}
            dispatch({ type: 'RESET' })
            onConfirmed?.()
          },
        },
      ],
    )
  }, [recorder])

  const sendRec = useCallback(async (
    cb: (uri: string, durationMs: number) => Promise<void>,
  ) => {
    if (!state.uri) return
    const uri = state.uri
    const dur = state.durationMs
    dispatch({ type: 'SEND' })
    try {
      await cb(uri, dur)
      dispatch({ type: 'SEND_OK' })
    } catch (e: any) {
      dispatch({ type: 'SEND_ERR', error: e?.message ?? 'Falha no envio. Tenta novamente.' })
    }
  }, [state.uri, state.durationMs])

  return { state, dispatch, start, pauseRec, resumeRec, stopRec, deleteRec, sendRec }
}
