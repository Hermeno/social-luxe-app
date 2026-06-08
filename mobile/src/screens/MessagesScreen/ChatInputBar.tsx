import React, { useState } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  Modal, Pressable, ActivityIndicator,
} from 'react-native'
import * as Haptics from 'expo-haptics'
import * as ImagePicker from 'expo-image-picker'
import * as DocumentPicker from 'expo-document-picker'
import { Ionicons } from '@expo/vector-icons'
import { colors, spacing, radius, fonts } from '../../theme'

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
  otherUserId, replyingTo, onCancelReply,
}: Props) {
  const [showAttach,    setShowAttach]    = useState(false)
  const [uploadingFile, setUploadingFile] = useState(false)

  async function pickImage() {
    setShowAttach(false)
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (status !== 'granted') return
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: 'images',
      quality: 0.85,
    })
    if (result.canceled || !result.assets[0]) return
    const asset = result.assets[0]
    const uri  = asset.uri
    const mime = asset.mimeType ?? 'image/jpeg'
    const name = uri.split('/').pop() ?? 'photo.jpg'
    setUploadingFile(true)
    try { await onSendFile(uri, mime, name) } catch {}
    setUploadingFile(false)
  }

  async function pickDocument() {
    setShowAttach(false)
    const result = await DocumentPicker.getDocumentAsync({
      type: '*/*',
      copyToCacheDirectory: true,
    })
    if (result.canceled || !result.assets?.[0]) return
    const asset = result.assets[0]
    setUploadingFile(true)
    try {
      await onSendFile(asset.uri, asset.mimeType ?? 'application/octet-stream', asset.name)
    } catch {}
    setUploadingFile(false)
  }

  return (
    <>
      <View style={[s.wrapper, { paddingBottom }]}>
        {replyingTo && (
          <View style={s.replyBar}>
            <View style={s.replyBarInner}>
              <Text style={s.replyBarName}>{replyingTo.senderName}</Text>
              <Text style={s.replyBarContent} numberOfLines={1}>
                {replyingTo.content ?? '…'}
              </Text>
            </View>
            <TouchableOpacity onPress={onCancelReply} hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}>
              <Ionicons name="close-circle" size={18} color={colors.gray400} />
            </TouchableOpacity>
          </View>
        )}

        <View style={s.row}>
          <TouchableOpacity
            onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setShowAttach(true) }}
            disabled={uploadingFile}
          >
            {uploadingFile
              ? <ActivityIndicator size="small" color={colors.primary} />
              : <Ionicons name="attach" size={22} color={colors.gray600} />
            }
          </TouchableOpacity>

          <TextInput
            style={s.input}
            placeholder="Escreva sua mensagem..."
            placeholderTextColor={colors.gray400}
            value={value}
            onChangeText={onChange}
            multiline
          />
          <TouchableOpacity style={s.send} onPress={onSend}>
            <Ionicons name="send" size={18} color={colors.white} />
          </TouchableOpacity>
        </View>
      </View>

      <Modal transparent animationType="slide" visible={showAttach} onRequestClose={() => setShowAttach(false)}>
        <Pressable style={s.sheetOverlay} onPress={() => setShowAttach(false)}>
          <View style={s.sheet}>
            <View style={s.sheetHandle} />
            <TouchableOpacity style={s.sheetRow} onPress={pickImage} activeOpacity={0.75}>
              <View style={[s.sheetIcon, { backgroundColor: '#E3F2FD' }]}>
                <Ionicons name="image-outline" size={22} color="#1565C0" />
              </View>
              <View style={s.sheetText}>
                <Text style={s.sheetLabel}>Foto ou Imagem</Text>
                <Text style={s.sheetSub}>JPG, PNG, GIF da galeria</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.gray400} />
            </TouchableOpacity>
            <View style={s.sheetDivider} />
            <TouchableOpacity style={s.sheetRow} onPress={pickDocument} activeOpacity={0.75}>
              <View style={[s.sheetIcon, { backgroundColor: '#FFF3E0' }]}>
                <Ionicons name="document-outline" size={22} color="#E65100" />
              </View>
              <View style={s.sheetText}>
                <Text style={s.sheetLabel}>Documento</Text>
                <Text style={s.sheetSub}>PDF, Word, Excel e outros</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.gray400} />
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>
    </>
  )
}

const s = StyleSheet.create({
  wrapper:  { borderTopWidth: StyleSheet.hairlineWidth, borderColor: colors.gray200 },
  row:      {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: spacing.md, paddingTop: spacing.sm, paddingBottom: spacing.sm,
    gap: spacing.sm,
  },
  input: {
    flex: 1, backgroundColor: colors.gray100, borderRadius: radius.full,
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
    fontSize: 14, color: colors.gray800, maxHeight: 100,
  },
  send: { backgroundColor: colors.dark, width: 38, height: 38, borderRadius: 19, justifyContent: 'center', alignItems: 'center' },

  replyBar:        { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.md, paddingVertical: 8, gap: 8, backgroundColor: colors.offWhite },
  replyBarInner:   { flex: 1, borderLeftWidth: 3, borderLeftColor: colors.primary, paddingLeft: 8 },
  replyBarName:    { fontSize: 12, fontFamily: fonts.semiBold, color: colors.primary },
  replyBarContent: { fontSize: 12, fontFamily: fonts.regular, color: colors.gray600 },

  sheetOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  sheet:        { backgroundColor: colors.white, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingBottom: 36, paddingTop: 12 },
  sheetHandle:  { width: 36, height: 4, borderRadius: 2, backgroundColor: colors.gray200, alignSelf: 'center', marginBottom: 20 },
  sheetRow:     { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 24, paddingVertical: 16, gap: 16 },
  sheetIcon:    { width: 48, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  sheetText:    { flex: 1, gap: 2 },
  sheetLabel:   { fontSize: 15, fontFamily: fonts.semiBold, color: colors.gray800 },
  sheetSub:     { fontSize: 12, fontFamily: fonts.regular, color: colors.gray400 },
  sheetDivider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.gray200, marginHorizontal: 24 },
})
