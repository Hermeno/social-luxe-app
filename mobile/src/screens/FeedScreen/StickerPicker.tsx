import React, { useState, useRef, useEffect } from 'react'
import {
  View, Text, TouchableOpacity, ScrollView, StyleSheet, Modal,
  TextInput, KeyboardAvoidingView, Platform, Animated, Pressable,
  Dimensions, PanResponder,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { LinearGradient } from 'expo-linear-gradient'
import { colors, fonts } from '../../theme'

export interface StickerChoice {
  emoji:    string
  type:     'emoji' | 'message' | 'gift'
  content?: string
}

// ─── Emoji data ───────────────────────────────────────────────────────────────
const EMOJIS: { section: string; items: string[] }[] = [
  {
    section: 'Popular',
    items: ['❤️','🔥','😍','🥰','😂','🤣','😭','🤩','💯','👑','💎','✨','🚀','🎉','🥳','😎','🤯','😱','🥹','🫶','💋','🤗','🎯','⭐','🌟'],
  },
  {
    section: 'Mood',
    items: ['😀','😅','😊','🥲','😔','😤','😡','🤔','😴','🥱','🤑','😈','👿','💀','🤡','🐸','🦄','🐵','🧠','👁'],
  },
  {
    section: 'Celebração',
    items: ['🎊','🍾','🎂','🎈','🎆','🎇','🌠','🎁','🏆','🥇','🥈','🥉','🏅','🎖','🎗'],
  },
  {
    section: 'Vida',
    items: ['💪','🧘','🏃','🚴','🏋','⚽','🏀','🎮','🎨','🎵','🎬','📸','✈️','🌍','🌴'],
  },
]

const GIFTS: string[] = ['🎁','💝','💖','💗','💓','💞','💘','💟','🌹','🌺','🌸','💐','🍀','⭐','🌟','✨','💫','🎀','🎊','🎉']

interface Props {
  visible:  boolean
  onClose:  () => void
  onSelect: (choice: StickerChoice) => void
}

type Tab = 'emoji' | 'gift' | 'message'

const { height: SCREEN_H } = Dimensions.get('window')

export default function StickerPicker({ visible, onClose, onSelect }: Props) {
  const { bottom } = useSafeAreaInsets()
  const [tab,    setTab]    = useState<Tab>('emoji')
  const [msgText, setMsgText] = useState('')

  // Bottom sheet — slides up from off-screen, same feel as the comments sheet
  const slideY  = useRef(new Animated.Value(SCREEN_H)).current
  const dragY   = useRef(new Animated.Value(0)).current

  useEffect(() => {
    if (visible) {
      slideY.setValue(SCREEN_H)
      dragY.setValue(0)
      Animated.spring(slideY, {
        toValue:     0,
        speed:       18,
        bounciness:  4,
        useNativeDriver: true,
      }).start()
    }
  }, [visible])

  function close() {
    Animated.timing(slideY, { toValue: SCREEN_H, duration: 220, useNativeDriver: true })
      .start(() => { setMsgText(''); setTab('emoji'); onClose() })
  }

  // Drag the handle down to dismiss, like a native bottom sheet
  const panResponder = useRef(PanResponder.create({
    onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dy) > 4 && Math.abs(g.dy) > Math.abs(g.dx),
    onPanResponderMove: (_, g) => { if (g.dy > 0) dragY.setValue(g.dy) },
    onPanResponderRelease: (_, g) => {
      if (g.dy > 110 || g.vy > 1.2) {
        close()
      } else {
        Animated.spring(dragY, { toValue: 0, useNativeDriver: true, speed: 20, bounciness: 6 }).start()
      }
    },
  })).current

  function selectEmoji(emoji: string, type: 'emoji' | 'gift') {
    onSelect({ emoji, type })
    close()
  }

  function sendMessage() {
    const t = msgText.trim()
    if (!t) return
    onSelect({ emoji: '💌', type: 'message', content: t })
    close()
  }

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={close}>

      {/* Backdrop */}
      <Pressable style={StyleSheet.absoluteFill} onPress={close} />

      {/* Bottom sheet */}
      <Animated.View
        style={[
          s.sheet,
          { paddingBottom: bottom + 12, transform: [{ translateY: Animated.add(slideY, dragY) }] },
        ]}
      >
        {/* Drag handle — swipe down to dismiss */}
        <View {...panResponder.panHandlers} style={s.handleArea}>
          <View style={s.handle} />
        </View>

        {/* Header */}
        <View style={s.header}>
          <Text style={s.headerTitle}>Adicionar ao post</Text>
          <TouchableOpacity onPress={close} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <View style={s.closeBtn}>
              <Ionicons name="close" size={16} color="#666" />
            </View>
          </TouchableOpacity>
        </View>

        {/* Tab bar */}
        <View style={s.tabs}>
          <TabPill label="Emoji"     icon="😊" active={tab === 'emoji'}   onPress={() => setTab('emoji')} />
          <TabPill label="Presente"  icon="🎁" active={tab === 'gift'}    onPress={() => setTab('gift')}  gift />
          <TabPill label="Mensagem"  icon="💌" active={tab === 'message'} onPress={() => setTab('message')} />
        </View>

        {/* ── Emoji grid ── */}
        {tab === 'emoji' && (
          <ScrollView showsVerticalScrollIndicator={false} style={s.gridScroll} contentContainerStyle={s.gridContent}>
            {EMOJIS.map(section => (
              <View key={section.section}>
                <Text style={s.sectionLabel}>{section.section}</Text>
                <View style={s.grid}>
                  {section.items.map((emoji, i) => (
                    <TouchableOpacity
                      key={`${emoji}-${i}`}
                      style={s.emojiBtn}
                      onPress={() => selectEmoji(emoji, 'emoji')}
                      activeOpacity={0.55}
                    >
                      <Text style={s.emojiTxt}>{emoji}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            ))}
          </ScrollView>
        )}

        {/* ── Gift grid ── */}
        {tab === 'gift' && (
          <View>
            <View style={s.giftBanner}>
              <Text style={s.giftBannerTxt}>🎆 Explode em animação quando alguém tocar!</Text>
            </View>
            <ScrollView showsVerticalScrollIndicator={false} style={s.gridScroll} contentContainerStyle={s.gridContent}>
              <View style={s.grid}>
                {GIFTS.map((emoji, i) => (
                  <TouchableOpacity
                    key={`${emoji}-${i}`}
                    style={s.emojiBtn}
                    onPress={() => selectEmoji(emoji, 'gift')}
                    activeOpacity={0.55}
                  >
                    <Text style={s.emojiTxt}>{emoji}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>
          </View>
        )}

        {/* ── Message compose ── */}
        {tab === 'message' && (
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            <View style={s.msgWrap}>
              <View style={s.msgHintRow}>
                <Text style={s.msgHintEmoji}>💌</Text>
                <Text style={s.msgHintTxt}>
                  A tua mensagem fica visível no post para todos verem
                </Text>
              </View>
              <TextInput
                style={s.msgInput}
                placeholder="Escreve algo bonito..."
                placeholderTextColor={colors.gray400}
                value={msgText}
                onChangeText={setMsgText}
                multiline
                maxLength={120}
                autoFocus
                textAlignVertical="top"
              />
              <Text style={s.charCount}>{msgText.length}/120</Text>
              <LinearGradient
                colors={msgText.trim() ? ['#CA2851', '#FF6766'] : ['#ccc', '#ccc']}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                style={[s.sendGradient, !msgText.trim() && s.sendDisabled]}
              >
                <TouchableOpacity
                  style={s.sendBtn}
                  onPress={sendMessage}
                  disabled={!msgText.trim()}
                  activeOpacity={0.8}
                >
                  <Text style={s.sendBtnTxt}>Adicionar mensagem 💌</Text>
                </TouchableOpacity>
              </LinearGradient>
            </View>
          </KeyboardAvoidingView>
        )}

        <View style={s.bottomPad} />
      </Animated.View>
    </Modal>
  )
}

// ─── TabPill ──────────────────────────────────────────────────────────────────
function TabPill({ label, icon, active, onPress, gift }: {
  label: string; icon: string; active: boolean; onPress: () => void; gift?: boolean
}) {
  if (active) {
    return (
      <LinearGradient
        colors={gift ? ['#FF9F00', '#FF6766'] : ['#CA2851', '#FF6766']}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
        style={s.tabActive}
      >
        <TouchableOpacity style={s.tabInner} onPress={onPress} activeOpacity={0.8}>
          <Text style={s.tabIcon}>{icon}</Text>
          <Text style={s.tabLabelActive}>{label}</Text>
        </TouchableOpacity>
      </LinearGradient>
    )
  }
  return (
    <TouchableOpacity style={s.tab} onPress={onPress} activeOpacity={0.7}>
      <Text style={s.tabIcon}>{icon}</Text>
      <Text style={s.tabLabel}>{label}</Text>
    </TouchableOpacity>
  )
}

const s = StyleSheet.create({
  sheet: {
    position: 'absolute',
    bottom: 0, left: 0, right: 0,
    backgroundColor: '#fff',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    maxHeight: '78%',
    paddingTop: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -6 },
    shadowOpacity: 0.15,
    shadowRadius: 24,
    elevation: 20,
  },
  handleArea: {
    paddingTop: 8,
    paddingBottom: 12,
  },
  handle: {
    width: 36, height: 4, borderRadius: 2,
    backgroundColor: '#E0E0E0',
    alignSelf: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  headerTitle: {
    fontFamily: fonts.bold,
    fontSize: 17,
    color: '#111',
    letterSpacing: -0.3,
  },
  closeBtn: {
    width: 30, height: 30, borderRadius: 15,
    backgroundColor: '#F0F0F0',
    alignItems: 'center', justifyContent: 'center',
  },

  // ── Tabs ──────────────────────────────────────────────────────────────────
  tabs: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 20,
    marginBottom: 14,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingVertical: 9,
    borderRadius: 14,
    backgroundColor: '#F4F4F6',
  },
  tabActive: {
    flex: 1,
    borderRadius: 14,
    overflow: 'hidden',
  },
  tabInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingVertical: 9,
  },
  tabIcon:        { fontSize: 16 },
  tabLabel:       { fontFamily: fonts.semiBold, fontSize: 12, color: colors.gray500 },
  tabLabelActive: { fontFamily: fonts.semiBold, fontSize: 12, color: '#fff' },

  // ── Emoji grid ────────────────────────────────────────────────────────────
  gridScroll:   { maxHeight: 280 },
  gridContent:  { paddingHorizontal: 14, paddingBottom: 8 },
  sectionLabel: {
    fontFamily: fonts.semiBold,
    fontSize: 11,
    color: colors.gray400,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginTop: 8,
    marginBottom: 4,
    marginLeft: 4,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  emojiBtn: {
    width: '14.28%',
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emojiTxt: { fontSize: 32 },

  // ── Gift banner ───────────────────────────────────────────────────────────
  giftBanner: {
    marginHorizontal: 20,
    marginBottom: 10,
    backgroundColor: '#FFFBEB',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  giftBannerTxt: {
    fontFamily: fonts.medium,
    fontSize: 12,
    color: '#92400E',
  },

  // ── Message compose ───────────────────────────────────────────────────────
  msgWrap: { paddingHorizontal: 20, paddingBottom: 4 },
  msgHintRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#FFF4F7',
    borderRadius: 14,
    padding: 12,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#FFDDE6',
  },
  msgHintEmoji: { fontSize: 22 },
  msgHintTxt: {
    flex: 1,
    fontFamily: fonts.regular,
    fontSize: 12,
    color: '#6B3B50',
    lineHeight: 17,
  },
  msgInput: {
    backgroundColor: '#F5F5F7',
    borderRadius: 16,
    padding: 16,
    fontSize: 16,
    fontFamily: fonts.regular,
    color: '#111',
    minHeight: 100,
    maxHeight: 150,
    lineHeight: 24,
  },
  charCount: {
    fontFamily: fonts.regular,
    fontSize: 11,
    color: colors.gray400,
    textAlign: 'right',
    marginTop: 4,
    marginBottom: 14,
  },
  sendGradient: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  sendDisabled: { opacity: 0.45 },
  sendBtn: {
    paddingVertical: 15,
    alignItems: 'center',
  },
  sendBtnTxt: {
    fontFamily: fonts.bold,
    fontSize: 15,
    color: '#fff',
    letterSpacing: -0.2,
  },

  bottomPad: { height: 12 },
})
