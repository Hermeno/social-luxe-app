import React, { useState, useRef, useEffect } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  Modal, Pressable, ActivityIndicator, Animated, Platform,
} from 'react-native'
import * as Haptics from 'expo-haptics'
import * as ImagePicker from 'expo-image-picker'
import * as DocumentPicker from 'expo-document-picker'
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
  paddingBottom: number
  otherUserId: string
  replyingTo: ReplyPreview | null
  onCancelReply: () => void
}

export default function ChatInputBar({
  value, onChange, onSend, onSendFile, paddingBottom,
  replyingTo, onCancelReply,
}: Props) {
  const [showAttach,    setShowAttach]    = useState(false)
  const [uploadingFile, setUploadingFile] = useState(false)

  const hasText  = value.trim().length > 0
  const sendScale = useRef(new Animated.Value(1)).current

  // Bounce the send button when text appears for the first time
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

  async function pickImage() {
    setShowAttach(false)
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (status !== 'granted') return
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: 'images', quality: 0.85 })
    if (result.canceled || !result.assets[0]) return
    const asset = result.assets[0]
    setUploadingFile(true)
    try { await onSendFile(asset.uri, asset.mimeType ?? 'image/jpeg', asset.uri.split('/').pop() ?? 'photo.jpg') } catch {}
    setUploadingFile(false)
  }

  async function pickDocument() {
    setShowAttach(false)
    const result = await DocumentPicker.getDocumentAsync({ type: '*/*', copyToCacheDirectory: true })
    if (result.canceled || !result.assets?.[0]) return
    const asset = result.assets[0]
    setUploadingFile(true)
    try { await onSendFile(asset.uri, asset.mimeType ?? 'application/octet-stream', asset.name) } catch {}
    setUploadingFile(false)
  }

  return (
    <>
      <View style={[s.container, { paddingBottom: paddingBottom || 8 }]}>

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

          {/* Attach button */}
          <TouchableOpacity
            style={s.attachBtn}
            onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setShowAttach(true) }}
            disabled={uploadingFile}
            activeOpacity={0.65}
          >
            {uploadingFile
              ? <ActivityIndicator size="small" color={colors.primary} />
              : <Ionicons name="add" size={22} color={colors.gray500} />
            }
          </TouchableOpacity>

          {/* Text field */}
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

          {/* Send button — primary when has text, ghost when empty */}
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

      {/* Attachment sheet */}
      <Modal transparent animationType="slide" visible={showAttach} onRequestClose={() => setShowAttach(false)}>
        <Pressable style={s.overlay} onPress={() => setShowAttach(false)}>
          <View style={s.sheet}>
            <View style={s.sheetHandle} />
            <Text style={s.sheetTitle}>Enviar ficheiro</Text>

            <TouchableOpacity style={s.sheetRow} onPress={pickImage} activeOpacity={0.7}>
              <View style={[s.sheetIconWrap, { backgroundColor: '#EFF6FF' }]}>
                <Ionicons name="image-outline" size={22} color="#2563EB" />
              </View>
              <View style={s.sheetInfo}>
                <Text style={s.sheetLabel}>Foto ou imagem</Text>
                <Text style={s.sheetSub}>JPG, PNG, GIF da galeria</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={colors.gray300} />
            </TouchableOpacity>

            <View style={s.sheetDivider} />

            <TouchableOpacity style={s.sheetRow} onPress={pickDocument} activeOpacity={0.7}>
              <View style={[s.sheetIconWrap, { backgroundColor: '#FFF7ED' }]}>
                <Ionicons name="document-text-outline" size={22} color="#EA580C" />
              </View>
              <View style={s.sheetInfo}>
                <Text style={s.sheetLabel}>Documento</Text>
                <Text style={s.sheetSub}>PDF, Word, Excel e outros</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={colors.gray300} />
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>
    </>
  )
}

const s = StyleSheet.create({
  container: {
    backgroundColor: colors.white,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.gray200,
    paddingTop: 8,
    paddingHorizontal: 12,
    // Subtle elevation so the bar "floats" above the message list
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

  // ── Reply banner ──────────────────────────────────────────────────────────
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
  replyTexts: { flex: 1, gap: 1 },
  replyName:  { fontSize: 12, fontFamily: fonts.semiBold, color: colors.primary },
  replyContent: { fontSize: 12, fontFamily: fonts.regular, color: colors.gray500 },
  replyClose: {
    padding: 4,
    borderRadius: 12,
    backgroundColor: `${colors.gray400}18`,
  },

  // ── Input row ─────────────────────────────────────────────────────────────
  row: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
  },

  attachBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.gray100,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 1,
  },

  inputWrap: {
    flex: 1,
    backgroundColor: colors.gray100,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: colors.gray200,
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === 'ios' ? 9 : 6,
    minHeight: 40,
    maxHeight: 110,
    justifyContent: 'center',
  },
  input: {
    fontSize: 15,
    fontFamily: fonts.regular,
    color: colors.gray800,
    padding: 0,
    margin: 0,
    lineHeight: 20,
  },

  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 0,
  },
  sendBtnActive: {
    backgroundColor: colors.primary,
    ...Platform.select({
      ios: {
        shadowColor: colors.primary,
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.35,
        shadowRadius: 6,
      },
      android: { elevation: 4 },
    }),
  },
  sendBtnIdle: {
    backgroundColor: colors.gray100,
  },
  sendIcon: {
    marginLeft: 2,
  },

  // ── Attachment sheet ──────────────────────────────────────────────────────
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.white,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingBottom: 40,
    paddingTop: 14,
  },
  sheetHandle: {
    width: 36, height: 4, borderRadius: 2,
    backgroundColor: colors.gray200,
    alignSelf: 'center',
    marginBottom: 18,
  },
  sheetTitle: {
    fontSize: 14,
    fontFamily: fonts.semiBold,
    color: colors.gray400,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    paddingHorizontal: 24,
    marginBottom: 6,
  },
  sheetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 14,
    gap: 14,
  },
  sheetIconWrap: {
    width: 50, height: 50, borderRadius: 16,
    alignItems: 'center', justifyContent: 'center',
  },
  sheetInfo:    { flex: 1, gap: 2 },
  sheetLabel:   { fontSize: 15, fontFamily: fonts.semiBold, color: colors.gray800 },
  sheetSub:     { fontSize: 12, fontFamily: fonts.regular, color: colors.gray400 },
  sheetDivider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.gray200, marginHorizontal: 24 },
})
