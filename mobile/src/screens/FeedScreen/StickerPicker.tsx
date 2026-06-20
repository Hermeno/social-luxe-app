import React, { useState, useRef, useEffect } from 'react'
import {
  View, Text, TouchableOpacity, ScrollView, StyleSheet, Modal,
  TextInput, KeyboardAvoidingView, Platform, Animated, Pressable,
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
  const insets = useSafeAreaInsets()
  const [categoryIdx, setCategoryIdx] = useState(0)
  const [composingMsg, setComposingMsg] = useState(false)
  const [msgText, setMsgText] = useState('')

  // Slide-down animation: starts off-screen above, springs into place
  const slideAnim = useRef(new Animated.Value(-700)).current

  useEffect(() => {
    if (visible) {
      slideAnim.setValue(-700)
      Animated.spring(slideAnim, {
        toValue: 0,
        useNativeDriver: true,
        speed: 16,
        bounciness: 3,
      }).start()
    }
  }, [visible])

  const cat = CATEGORIES[categoryIdx]

  function handleClose() {
    // Slide back up then notify parent
    Animated.timing(slideAnim, {
      toValue: -700,
      duration: 200,
      useNativeDriver: true,
    }).start(() => {
      setComposingMsg(false)
      setMsgText('')
      onClose()
    })
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
    <Modal visible={visible} transparent animationType="none" onRequestClose={handleClose}>
      {/* Full-screen backdrop — tapping outside closes the picker */}
      <Pressable style={StyleSheet.absoluteFill} onPress={handleClose} />

      {/* Sheet drops from top */}
      <Animated.View
        style={[s.sheet, { paddingTop: insets.top + 6, transform: [{ translateY: slideAnim }] }]}
      >
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>

          {/* Header row */}
          <View style={s.headerRow}>
            <Text style={s.title}>
              {composingMsg ? 'Escrever mensagem' : 'Adicionar sticker'}
            </Text>
            <TouchableOpacity onPress={handleClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <View style={s.closeBtn}>
                <Ionicons name="close" size={18} color="#666" />
              </View>
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
              {/* ── Message special button ── */}
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

          {/* Drag indicator at the bottom */}
          <View style={s.bottomHandle} />
        </KeyboardAvoidingView>
      </Animated.View>
    </Modal>
  )
}

const s = StyleSheet.create({
  sheet: {
    position: 'absolute',
    top: 0, left: 0, right: 0,
    backgroundColor: '#fff',
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
    maxHeight: '72%',
    // Shadow below the sheet
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 20,
    elevation: 16,
  },
  headerRow: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 12, paddingTop: 4,
  },
  title: { fontFamily: fonts.semiBold, fontSize: 16, color: '#111' },
  closeBtn: {
    width: 30, height: 30, borderRadius: 15,
    backgroundColor: '#F0F0F0',
    alignItems: 'center', justifyContent: 'center',
  },

  // ── Message special button ────────────────────────────────────────────────
  msgSpecialBtn: {
    flexDirection: 'row', alignItems: 'center',
    marginHorizontal: 14, marginBottom: 10,
    backgroundColor: '#FFF4F7',
    borderRadius: 14,
    padding: 12, gap: 10,
    borderWidth: 1, borderColor: '#FFDDE6',
  },
  msgSpecialIcon:  { fontSize: 26 },
  msgSpecialTexts: { flex: 1 },
  msgSpecialTitle: { fontFamily: fonts.semiBold, fontSize: 14, color: '#1A1A1A' },
  msgSpecialSub:   { fontFamily: fonts.regular, fontSize: 11, color: colors.gray600, marginTop: 1 },

  // ── Category tabs ─────────────────────────────────────────────────────────
  catScroll:      { flexGrow: 0 },
  catContent:     { paddingHorizontal: 14, gap: 6, paddingBottom: 10 },
  catTab: {
    alignItems: 'center', gap: 3,
    paddingHorizontal: 10, paddingVertical: 6,
    borderRadius: 12,
    backgroundColor: '#F4F4F6',
  },
  catTabActive:   { backgroundColor: colors.primary + '18' },
  catTabGift:     { backgroundColor: '#FFF8E7' },
  catIcon:        { fontSize: 18 },
  catLabel:       { fontFamily: fonts.medium, fontSize: 10, color: colors.gray600 },
  catLabelActive: { color: colors.primary },

  // ── Gift / explosion banner ───────────────────────────────────────────────
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
  emoji: { fontSize: 30 },

  // ── Bottom handle ─────────────────────────────────────────────────────────
  bottomHandle: {
    width: 38, height: 4, borderRadius: 2,
    backgroundColor: '#DDDDE0',
    alignSelf: 'center',
    marginVertical: 10,
  },

  // ── Message compose ───────────────────────────────────────────────────────
  composeWrap:  { paddingHorizontal: 16, paddingBottom: 8 },
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
  sendBtnTxt:     { fontFamily: fonts.semiBold, fontSize: 14, color: '#fff' },
})
