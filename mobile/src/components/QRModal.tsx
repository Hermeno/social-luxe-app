import React from 'react'
import { Modal, View, Text, TouchableOpacity, StyleSheet, SafeAreaView, Share } from 'react-native'
import QRCode from 'react-native-qrcode-svg'
import { Ionicons } from '@expo/vector-icons'
import { colors, fonts, spacing, radius } from '../theme'

interface Props {
  visible: boolean
  userId: string
  userName: string
  onClose: () => void
}

export default function QRModal({ visible, userId, userName, onClose }: Props) {
  const value = `luxe://profile/${userId}`

  function handleShare() {
    Share.share({ message: `Segue-me no Luxe! ${value}` }).catch(() => {})
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={s.container}>
        <View style={s.header}>
          <Text style={s.title}>Meu QR Code</Text>
          <TouchableOpacity onPress={onClose} hitSlop={{ top: 12, right: 12, bottom: 12, left: 12 }}>
            <Ionicons name="close" size={22} color={colors.gray600} />
          </TouchableOpacity>
        </View>

        <View style={s.body}>
          <View style={s.qrWrap}>
            <QRCode value={value} size={220} color={colors.gray800} backgroundColor={colors.white} />
          </View>
          <Text style={s.name}>{userName}</Text>
          <Text style={s.hint}>Mostre este código para que alguém te siga</Text>

          <TouchableOpacity style={s.shareBtn} onPress={handleShare} activeOpacity={0.85}>
            <Ionicons name="share-outline" size={18} color={colors.white} />
            <Text style={s.shareBtnText}>Partilhar link</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </Modal>
  )
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.white },
  header:    {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.md, paddingVertical: spacing.md,
    borderBottomWidth: 1, borderBottomColor: colors.gray100,
  },
  title:     { fontSize: 16, fontFamily: fonts.bold, color: colors.gray800 },
  body:      { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.xl, gap: spacing.md },
  qrWrap:    { padding: 20, backgroundColor: colors.white, borderRadius: radius.lg, elevation: 4, shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 12 },
  name:      { fontSize: 20, fontFamily: fonts.bold, color: colors.gray800, marginTop: spacing.md },
  hint:      { fontSize: 13, fontFamily: fonts.regular, color: colors.gray400, textAlign: 'center' },
  shareBtn:  { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.primary, borderRadius: radius.md, paddingHorizontal: spacing.xl, paddingVertical: 12, marginTop: spacing.sm },
  shareBtnText: { fontSize: 15, fontFamily: fonts.semiBold, color: colors.white },
})
