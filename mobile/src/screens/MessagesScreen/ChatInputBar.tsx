import React, { useRef, useEffect } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  Animated, Platform,
} from 'react-native'
import * as Haptics from 'expo-haptics'
import { Ionicons } from '@expo/vector-icons'
import { colors, fonts } from '../../theme'

interface ReplyPreview {
  senderName: string
  content: string | null
}

interface Props {
  value: string
  onChange: (t: string) => void
  onSend: () => void
  onSendFile: (uri: string, mimeType: string, fileName: string) => Promise<void>
  otherUserId: string
  replyingTo: ReplyPreview | null
  onCancelReply: () => void
  onSchedulePress?: () => void
}

export default function ChatInputBar({
  value, onChange, onSend,
  replyingTo, onCancelReply, onSchedulePress,
}: Props) {
  const hasText   = value.trim().length > 0
  const sendScale = useRef(new Animated.Value(1)).current

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
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    onSend()
  }

  return (
    <View style={s.container}>

      {/* Reply preview banner */}
      {replyingTo && (
        <View style={s.replyBanner}>
          <View style={s.replyAccent} />
          <View style={s.replyTexts}>
            <Text style={s.replyName}>{replyingTo.senderName}</Text>
            <Text style={s.replyContent} numberOfLines={1}>
              {replyingTo.content ?? '📎 Ficheiro'}
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

        {/* + attachment button */}
        <TouchableOpacity style={s.attachBtn} activeOpacity={0.7}>
          <Ionicons name="add" size={22} color={colors.primary} />
        </TouchableOpacity>

        {/* Text input */}
        <View style={s.inputWrap}>
          <TextInput
            style={s.input}
            placeholder="Mensagem..."
            placeholderTextColor={colors.gray400}
            value={value}
            onChangeText={onChange}
            multiline
            returnKeyType="default"
            textAlignVertical="center"
          />
        </View>

        {/* Clock / schedule button */}
        <TouchableOpacity
          onPress={onSchedulePress}
          hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}
          activeOpacity={0.65}
        >
          <Ionicons name="time-outline" size={22} color={colors.gray400} />
        </TouchableOpacity>

        {/* Send button */}
        <Animated.View style={{ transform: [{ scale: sendScale }] }}>
          <TouchableOpacity
            style={[s.sendBtn, hasText ? s.sendBtnActive : s.sendBtnIdle]}
            onPress={handleSend}
            disabled={!hasText}
            activeOpacity={0.75}
          >
            <Ionicons
              name="send"
              size={17}
              color={hasText ? colors.white : colors.gray400}
              style={s.sendIcon}
            />
          </TouchableOpacity>
        </Animated.View>

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
    paddingBottom: Platform.OS === 'ios' ? 8 : 10,
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
  replyTexts:  { flex: 1, gap: 1 },
  replyName:   { fontSize: 12, fontFamily: fonts.semiBold, color: colors.primary },
  replyContent:{ fontSize: 12, fontFamily: fonts.regular, color: colors.gray500 },
  replyClose:  { padding: 4, borderRadius: 12, backgroundColor: `${colors.gray400}18` },

  // Row
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },

  // + button
  attachBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F2F2F7',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },

  // Input
  inputWrap: {
    flex: 1,
    height: 40,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: colors.gray200,
    backgroundColor: '#F9F9FB',
    paddingHorizontal: 14,
    justifyContent: 'center',
  },
  input: {
    fontSize: 15,
    fontFamily: fonts.regular,
    color: colors.gray800,
    padding: 0,
    margin: 0,
    lineHeight: 20,
    maxHeight: 80,
  },

  // Send button
  sendBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  sendBtnActive: {
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
  sendBtnIdle: {
    backgroundColor: '#F2F2F7',
  },
  sendIcon: { marginLeft: 2 },
})
