import React, { useState } from 'react'
import {
  View, Text, TouchableOpacity, ScrollView, StyleSheet, Modal,
  TextInput, KeyboardAvoidingView, Platform,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { colors, fonts } from '../../theme'

export interface StickerChoice {
  emoji: string
  type: 'emoji' | 'message' | 'gift'
  content?: string
}

// ─── Emoji lists ──────────────────────────────────────────────────────────────

const CONQUISTAS  = ['🏆','👑','👸','💎','⭐','🌟','🚀','🎯','🔥','🥇','🥈','🥉','🎖','🏅','💯']
const AMOR        = ['❤️','🥰','😍','🤗','💋','😭','😂','🤣','😎','🤯','😱','🥹','😇','🤩','🫶']
const CELEBRACAO  = ['🎉','🎊','🍾','🎂','🎈','🥳','✨','🎆','🎇','🌠']   // explode
const FAMA        = ['👑','🎬','📸','🌎','🔥','💰','🛥','💼','🏛','🦅']
const MOTIVACAO   = ['💪','🧠','📚','⚡','🏹','🚴','🌱','🏔','🛡','🔑']
const COMUNIDADE  = ['🤝','👏','🙌','💬','📢','🔄','💖','🫂','🌍','📣']
const MEMES       = ['🤡','🐐','🍿','💀','🧃','🐸','🧠','🦄','🥔','🐵']
const LUXEE       = ['💎','👑','🚀','🔥','⭐','🎭','🏆','🌟','🎬','💰','⚡','🌎','🦅','🎯','💯','🛡','🔑','👏','🎊','👑']

const CATEGORIES: { label: string; icon: string; gift?: true; emojis: string[] }[] = [
  { label: 'Conquistas', icon: '🏆',  emojis: CONQUISTAS },
  { label: 'Amor',       icon: '❤️',  emojis: AMOR },
  { label: 'Celebração', icon: '🎉',  gift: true, emojis: CELEBRACAO },
  { label: 'Fama',       icon: '🌟',  emojis: FAMA },
  { label: 'Motivação',  icon: '💪',  emojis: MOTIVACAO },
  { label: 'Comunidade', icon: '🤝',  emojis: COMUNIDADE },
  { label: 'Memes',      icon: '🤡',  emojis: MEMES },
  { label: 'Luxee',      icon: '👑',  gift: true, emojis: LUXEE },
]

// ─── Component ───────────────────────────────────────────────────────────────

interface Props {
  visible: boolean
  onClose: () => void
  onSelect: (choice: StickerChoice) => void
}

export default function StickerPicker({ visible, onClose, onSelect }: Props) {
  const { bottom } = useSafeAreaInsets()
  const [categoryIdx, setCategoryIdx] = useState(0)
  const [composingMsg, setComposingMsg] = useState(false)
  const [msgText, setMsgText] = useState('')

  const cat = CATEGORIES[categoryIdx]

  function handleClose() {
    setComposingMsg(false)
    setMsgText('')
    onClose()
  }

  function handleSendMessage() {
    if (!msgText.trim()) return
    onSelect({ emoji: '💌', type: 'message', content: msgText.trim() })
    setComposingMsg(false)
    setMsgText('')
    onClose()
  }

  function handleEmojiSelect(emoji: string) {
    onSelect({ emoji, type: cat.gift ? 'gift' : 'emoji' })
    onClose()
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleClose}>
      <TouchableOpacity style={s.backdrop} activeOpacity={1} onPress={handleClose} />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={[s.sheet, { paddingBottom: Math.max(bottom, 12) }]}>

          {/* Handle + title */}
          <View style={s.handle} />
          <View style={s.headerRow}>
            <Text style={s.title}>
              {composingMsg ? 'Escrever mensagem' : 'Adicionar sticker'}
            </Text>
            <TouchableOpacity onPress={handleClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="close" size={22} color={colors.gray600} />
            </TouchableOpacity>
          </View>

          {composingMsg ? (
            /* ── Message compose view ── */
            <View style={s.composeWrap}>
              <View style={s.msgHint}>
                <Text style={s.msgHintEmoji}>💌</Text>
                <Text style={s.msgHintText}>Sua mensagem ficará colada no post para todos verem</Text>
              </View>
              <TextInput
                style={s.msgInput}
                placeholder="Escreva algo..."
                placeholderTextColor={colors.gray400}
                value={msgText}
                onChangeText={setMsgText}
                multiline
                maxLength={120}
                autoFocus
              />
              <Text style={s.charCount}>{msgText.length}/120</Text>
              <View style={s.composeActions}>
                <TouchableOpacity style={s.cancelBtn} onPress={() => { setComposingMsg(false); setMsgText('') }}>
                  <Text style={s.cancelBtnTxt}>Voltar</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[s.sendBtn, !msgText.trim() && s.sendBtnDisabled]}
                  onPress={handleSendMessage}
                  disabled={!msgText.trim()}
                >
                  <Text style={s.sendBtnTxt}>Adicionar 💌</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <>
              {/* ── Mensagem special button ── */}
              <TouchableOpacity style={s.msgSpecialBtn} onPress={() => setComposingMsg(true)} activeOpacity={0.8}>
                <Text style={s.msgSpecialIcon}>💌</Text>
                <View style={s.msgSpecialTexts}>
                  <Text style={s.msgSpecialTitle}>Deixar mensagem</Text>
                  <Text style={s.msgSpecialSub}>Escreva algo que fica visível no post</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={colors.gray400} />
              </TouchableOpacity>

              {/* ── Category tabs ── */}
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={s.catScroll}
                contentContainerStyle={s.catContent}
              >
                {CATEGORIES.map((c, i) => (
                  <TouchableOpacity
                    key={c.label}
                    onPress={() => setCategoryIdx(i)}
                    style={[
                      s.catTab,
                      categoryIdx === i && s.catTabActive,
                      c.gift && categoryIdx === i && s.catTabGift,
                    ]}
                    activeOpacity={0.7}
                  >
                    <Text style={s.catIcon}>{c.icon}</Text>
                    <Text style={[s.catLabel, categoryIdx === i && s.catLabelActive]}>{c.label}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              {/* ── Explosion hint for gift categories ── */}
              {cat.gift && (
                <View style={s.giftBanner}>
                  <Text style={s.giftBannerText}>🎆 Explode com fogos de artifício ao clicar!</Text>
                </View>
              )}

              {/* ── Emoji grid ── */}
              <ScrollView showsVerticalScrollIndicator={false} style={s.gridScroll}>
                <View style={s.grid}>
                  {cat.emojis.map((emoji, idx) => (
                    <TouchableOpacity
                      key={`${emoji}-${idx}`}
                      style={s.emojiBtn}
                      onPress={() => handleEmojiSelect(emoji)}
                      activeOpacity={0.6}
                    >
                      <Text style={s.emoji}>{emoji}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>
            </>
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  )
}

const s = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  sheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '72%',
  },
  handle: {
    width: 38, height: 4, borderRadius: 2,
    backgroundColor: '#DDDDE0',
    alignSelf: 'center',
    marginTop: 10, marginBottom: 6,
  },
  headerRow: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20, paddingBottom: 10,
  },
  title: { fontFamily: fonts.semiBold, fontSize: 16, color: '#111' },

  // ── Message special button ─────────────────────────────────────────────────
  msgSpecialBtn: {
    flexDirection: 'row', alignItems: 'center',
    marginHorizontal: 14, marginBottom: 10,
    backgroundColor: '#FFF4F7',
    borderRadius: 14,
    padding: 12, gap: 10,
    borderWidth: 1, borderColor: '#FFDDE6',
  },
  msgSpecialIcon: { fontSize: 26 },
  msgSpecialTexts: { flex: 1 },
  msgSpecialTitle: { fontFamily: fonts.semiBold, fontSize: 14, color: '#1A1A1A' },
  msgSpecialSub:   { fontFamily: fonts.regular, fontSize: 11, color: colors.gray600, marginTop: 1 },

  // ── Category tabs ──────────────────────────────────────────────────────────
  catScroll:   { flexGrow: 0 },
  catContent:  { paddingHorizontal: 14, gap: 6, paddingBottom: 10 },
  catTab: {
    alignItems: 'center', gap: 3,
    paddingHorizontal: 10, paddingVertical: 6,
    borderRadius: 12,
    backgroundColor: '#F4F4F6',
  },
  catTabActive: { backgroundColor: colors.primary + '18' },
  catTabGift:   { backgroundColor: '#FFF8E7' },
  catIcon:      { fontSize: 18 },
  catLabel:     { fontFamily: fonts.medium, fontSize: 10, color: colors.gray600 },
  catLabelActive: { color: colors.primary },

  // ── Gift / explosion banner ────────────────────────────────────────────────
  giftBanner: {
    marginHorizontal: 14, marginBottom: 6,
    backgroundColor: '#FFFBEB',
    borderRadius: 10, paddingHorizontal: 12, paddingVertical: 7,
    borderWidth: 1, borderColor: '#FDE68A',
  },
  giftBannerText: { fontFamily: fonts.medium, fontSize: 12, color: '#92400E' },

  // ── Emoji grid ────────────────────────────────────────────────────────────
  gridScroll: { flexShrink: 1 },
  grid: {
    flexDirection: 'row', flexWrap: 'wrap',
    paddingHorizontal: 12, paddingBottom: 8,
  },
  emojiBtn: {
    width: '14.28%',
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emoji: { fontSize: 28 },

  // ── Message compose ───────────────────────────────────────────────────────
  composeWrap: { paddingHorizontal: 16, paddingBottom: 8 },
  msgHint: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: '#F0F4FF', borderRadius: 12,
    padding: 12, marginBottom: 14,
  },
  msgHintEmoji: { fontSize: 24 },
  msgHintText:  { flex: 1, fontFamily: fonts.regular, fontSize: 12, color: '#3B4A6B', lineHeight: 16 },
  msgInput: {
    backgroundColor: '#F5F5F7', borderRadius: 14,
    padding: 14, fontSize: 15, fontFamily: fonts.regular,
    color: '#111', textAlignVertical: 'top', minHeight: 100,
    maxHeight: 160,
  },
  charCount: {
    fontFamily: fonts.regular, fontSize: 11, color: colors.gray400,
    textAlign: 'right', marginTop: 4, marginBottom: 12,
  },
  composeActions: { flexDirection: 'row', gap: 10 },
  cancelBtn: {
    flex: 1, paddingVertical: 13, borderRadius: 12,
    backgroundColor: '#EAEAEA', alignItems: 'center',
  },
  cancelBtnTxt: { fontFamily: fonts.semiBold, fontSize: 14, color: colors.gray600 },
  sendBtn: {
    flex: 2, paddingVertical: 13, borderRadius: 12,
    backgroundColor: colors.primary, alignItems: 'center',
  },
  sendBtnDisabled: { opacity: 0.45 },
  sendBtnTxt: { fontFamily: fonts.semiBold, fontSize: 14, color: '#fff' },
})
