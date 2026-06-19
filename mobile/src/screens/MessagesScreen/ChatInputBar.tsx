import React, { useRef, useEffect, useState } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  Animated, Platform, Alert,
} from 'react-native'
import * as Haptics from 'expo-haptics'
import * as ImagePicker from 'expo-image-picker'
import { useAudioRecorder, AudioModule, RecordingPresets } from 'expo-audio'
import { Ionicons } from '@expo/vector-icons'
import { colors, fonts } from '../../theme'
import { useT } from '../../i18n'

interface ReplyPreview {
  senderName: string
  content: string | null
}

interface Props {
  value: string
  onChange: (t: string) => void
  onSend: () => void
  onSendFile: (uri: string, mimeType: string, fileName: string) => Promise<void>
  onSendAudio: (uri: string, durationMs: number) => Promise<void>
  otherUserId: string
  replyingTo: ReplyPreview | null
  onCancelReply: () => void
  onSchedulePress?: () => void
  bottomInset?: number
}

function fmtMs(ms: number) {
  const s = Math.floor(ms / 1000)
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

export default function ChatInputBar({
  value, onChange, onSend, onSendFile, onSendAudio,
  replyingTo, onCancelReply, onSchedulePress,
  bottomInset = 0,
}: Props) {
  const t = useT()
  const hasText   = value.trim().length > 0
  const sendScale = useRef(new Animated.Value(1)).current
  const recPulse  = useRef(new Animated.Value(1)).current

  // ── Recording ───────────────────────────────────────────────────────────────
  const recorder       = useAudioRecorder(RecordingPresets.HIGH_QUALITY)
  const [isRec, setIsRec]       = useState(false)
  const [recMs, setRecMs]       = useState(0)
  const recStartRef = useRef(0)
  const recTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Pulsing red dot while recording
  useEffect(() => {
    if (!isRec) { recPulse.setValue(1); return }
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(recPulse, { toValue: 0.35, duration: 600, useNativeDriver: true }),
      Animated.timing(recPulse, { toValue: 1,   duration: 600, useNativeDriver: true }),
    ]))
    loop.start()
    return () => loop.stop()
  }, [isRec])

  async function startRecording() {
    try {
      const perm = await AudioModule.requestRecordingPermissionsAsync()
      if (!perm.granted) {
        Alert.alert('Permissão necessária', 'Permite acesso ao microfone para enviar áudios.')
        return
      }
      await recorder.prepareToRecordAsync()
      await recorder.record()
      recStartRef.current = Date.now()
      setIsRec(true)
      setRecMs(0)
      recTimerRef.current = setInterval(() => setRecMs(Date.now() - recStartRef.current), 100)
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    } catch {}
  }

  async function stopRecording() {
    if (recTimerRef.current) { clearInterval(recTimerRef.current); recTimerRef.current = null }
    const durationMs = Date.now() - recStartRef.current
    setIsRec(false)
    setRecMs(0)
    try {
      await recorder.stop()
      // Give the recorder a tick to flush the URI
      await new Promise<void>((r) => setTimeout(r, 80))
      const uri = recorder.uri
      if (!uri || durationMs < 600) {
        if (durationMs >= 600) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning)
        return
      }
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
      await onSendAudio(uri, durationMs)
    } catch (e) {
      console.warn('[AudioRec] stopRecording error:', e)
    }
  }

  // ── Send button pop animation ────────────────────────────────────────────────
  const prevHasText = useRef(hasText)
  useEffect(() => {
    if (hasText && !prevHasText.current) {
      Animated.sequence([
        Animated.spring(sendScale, { toValue: 1.18, useNativeDriver: true, speed: 40, bounciness: 8 }),
        Animated.spring(sendScale, { toValue: 1,    useNativeDriver: true, speed: 40, bounciness: 4 }),
      ]).start()
    }
    prevHasText.current = hasText
  }, [hasText])

  function handleSend() {
    if (!hasText) return
    onSend()
  }

  async function handleAttach() {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (status !== 'granted') {
      Alert.alert('Permission required', 'Allow access to photos to send images.')
      return
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.85,
      allowsMultipleSelection: false,
    })
    if (result.canceled || !result.assets?.length) return
    const asset    = result.assets[0]
    const uri      = asset.uri
    const mimeType = asset.mimeType ?? 'image/jpeg'
    const fileName = asset.fileName ?? uri.split('/').pop() ?? 'image.jpg'
    await onSendFile(uri, mimeType, fileName)
  }

  const pb = Platform.OS === 'ios' ? 8 + bottomInset : 10

  return (
    <View style={[s.container, { paddingBottom: pb }]}>

      {/* Reply preview banner */}
      {replyingTo && (
        <View style={s.replyBanner}>
          <View style={s.replyAccent} />
          <View style={s.replyTexts}>
            <Text style={s.replyName}>{replyingTo.senderName}</Text>
            <Text style={s.replyContent} numberOfLines={1}>
              {replyingTo.content ?? t.chat_file}
            </Text>
          </View>
          <TouchableOpacity
            onPress={onCancelReply}
            style={s.replyClose}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="close" size={16} color={colors.gray400} />
          </TouchableOpacity>
        </View>
      )}

      {/* Input row */}
      <View style={s.row}>

        {/* + attachment */}
        <TouchableOpacity style={s.attachBtn} activeOpacity={0.7} onPress={handleAttach}>
          <Ionicons name="add" size={22} color={colors.primary} />
        </TouchableOpacity>

        {/* Text input */}
        <View style={s.inputWrap}>
          <TextInput
            style={s.input}
            placeholder={t.chat_input_ph}
            placeholderTextColor={colors.gray400}
            value={value}
            onChangeText={onChange}
            multiline
            returnKeyType="default"
            textAlignVertical="center"
          />
        </View>

        {/* Schedule */}
        <TouchableOpacity
          onPress={onSchedulePress}
          hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}
          activeOpacity={0.65}
        >
          <Ionicons name="time-outline" size={22} color={colors.gray400} />
        </TouchableOpacity>

        {/* Send button (mic hidden until audio is ready) */}
        {hasText && (
          <Animated.View style={{ transform: [{ scale: sendScale }] }}>
            <TouchableOpacity
              style={[s.actionBtn, s.actionBtnActive]}
              onPress={handleSend}
              activeOpacity={0.75}
            >
              <Ionicons name="send" size={17} color={colors.white} style={s.sendIcon} />
            </TouchableOpacity>
          </Animated.View>
        )}

      </View>
    </View>
  )
}

const s = StyleSheet.create({
  container: {
    backgroundColor: colors.white,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.gray200,
    paddingTop: 9,
    paddingHorizontal: 14,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -2 },
        shadowOpacity: 0.06,
        shadowRadius: 8,
      },
      android: { elevation: 4 },
    }),
  },

  // Reply banner
  replyBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: `${colors.primary}0D`,
    borderRadius: 10,
    marginBottom: 8,
    paddingVertical: 8,
    paddingRight: 10,
    overflow: 'hidden',
  },
  replyAccent: {
    width: 3,
    alignSelf: 'stretch',
    backgroundColor: colors.primary,
    marginRight: 10,
    borderTopRightRadius: 2,
    borderBottomRightRadius: 2,
  },
  replyTexts:   { flex: 1, gap: 1 },
  replyName:    { fontSize: 12, fontFamily: fonts.semiBold, color: colors.primary },
  replyContent: { fontSize: 12, fontFamily: fonts.regular, color: colors.gray500 },
  replyClose:   { padding: 4, borderRadius: 12, backgroundColor: `${colors.gray400}18` },

  // Row
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },

  // + button
  attachBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: '#F2F2F7',
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },

  // Input
  inputWrap: {
    flex: 1, height: 40,
    borderRadius: 22, borderWidth: 1, borderColor: colors.gray200,
    backgroundColor: '#F9F9FB',
    paddingHorizontal: 14, justifyContent: 'center',
  },
  input: {
    fontSize: 15, fontFamily: fonts.regular, color: colors.gray800,
    padding: 0, margin: 0, lineHeight: 20, maxHeight: 80,
  },

  // Recording overlay
  recRow: {
    flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10, paddingLeft: 4,
  },
  recDot: {
    width: 10, height: 10, borderRadius: 5, backgroundColor: '#CA2851',
  },
  recTimer: {
    fontFamily: fonts.semiBold, fontSize: 15, color: colors.gray800, letterSpacing: 0.5,
  },
  recHint: {
    fontFamily: fonts.regular, fontSize: 13, color: colors.gray400,
  },

  // Action button (send / mic)
  actionBtn: {
    width: 38, height: 38, borderRadius: 19,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  actionBtnActive: {
    backgroundColor: colors.primary,
    ...Platform.select({
      ios: {
        shadowColor: colors.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.4,
        shadowRadius: 8,
      },
      android: { elevation: 4 },
    }),
  },
  actionBtnIdle:      { backgroundColor: `${colors.primary}18` },
  actionBtnRecording: { backgroundColor: '#CA2851' },
  sendIcon: { marginLeft: 2 },
})
