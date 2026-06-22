// ── State machine for the voice recording/preview/upload flow ────────────────
export type VoicePhase =
  | 'IDLE'
  | 'RECORDING'
  | 'PAUSED_RECORDING'
  | 'PREVIEW'
  | 'PLAYING'
  | 'PAUSED_PLAYBACK'
  | 'UPLOADING'
  | 'ERROR'

export interface VoiceState {
  phase:      VoicePhase
  elapsedMs:  number       // accumulated recording time (ms)
  uri:        string | null
  durationMs: number       // total recording duration (ms)
  error:      string | null
}

export const VOICE_INITIAL: VoiceState = {
  phase:      'IDLE',
  elapsedMs:  0,
  uri:        null,
  durationMs: 0,
  error:      null,
}

export type VoiceAction =
  | { type: 'START' }
  | { type: 'TICK';       ms: number }
  | { type: 'PAUSE_REC' }
  | { type: 'RESUME_REC' }
  | { type: 'STOP';       uri: string; durationMs: number }
  | { type: 'RESET' }
  | { type: 'PLAY' }
  | { type: 'PAUSE_PLAY' }
  | { type: 'RESUME_PLAY' }
  | { type: 'PLAY_ENDED' }
  | { type: 'SEND' }
  | { type: 'SEND_OK' }
  | { type: 'SEND_ERR';   error: string }
  | { type: 'RETRY' }
