import React, { useEffect, useState, useRef, useCallback } from 'react'
import {
  View, Text, FlatList, Image, StyleSheet,
  KeyboardAvoidingView, Platform, Animated, Pressable, TouchableOpacity, Modal,
} from 'react-native'
import * as Haptics from 'expo-haptics'
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Message, MessageReaction } from '../../types'
import * as msgService from '../../services/message.service'
import { useAuthStore } from '../../store/auth.store'
import { useOnlineStore } from '../../store/online.store'
import { getSocket } from '../../socket'
import { AppStackParams } from '../../navigation/AppNavigator'
import { colors, spacing, radius, fonts } from '../../theme'
import ChatHeader from './ChatHeader'
import ChatInputBar from './ChatInputBar'
import { API_BASE } from '../../config'

type Route = RouteProp<AppStackParams, 'Chat'>
const CHAT_BG  = '#FFFFFF'

const REACTION_EMOJIS = ['❤️', '😂', '😮', '😢', '🔥', '👏']

function formatTime(dateStr: string) {
  const d = new Date(dateStr)
  return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
}

function formatDateLabel(dateStr: string) {
  const d   = new Date(dateStr)
  const now = new Date()
  const diff = Math.floor((now.getTime() - d.getTime()) / 86400000)
  if (diff === 0) return 'Hoje'
  if (diff === 1) return 'Ontem'
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })
}

function sameDay(a: string, b: string) {
  const da = new Date(a), db = new Date(b)
  return da.getFullYear() === db.getFullYear()
    && da.getMonth() === db.getMonth()
    && da.getDate() === db.getDate()
}

// ── Animated typing dots ──────────────────────────────────────────────────────
function TypingBubble() {
  const dots = [useRef(new Animated.Value(0)).current,
                useRef(new Animated.Value(0)).current,
                useRef(new Animated.Value(0)).current]

  useEffect(() => {
    const anims = dots.map((dot, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(i * 160),
          Animated.timing(dot, { toValue: -5, duration: 260, useNativeDriver: true }),
          Animated.timing(dot, { toValue: 0,  duration: 260, useNativeDriver: true }),
          Animated.delay(320),
        ]),
      ),
    )
    anims.forEach((a) => a.start())
    return () => anims.forEach((a) => a.stop())
  }, [])

  return (
    <View style={t.typingWrap}>
      <View style={t.typingBubble}>
        {dots.map((dot, i) => (
          <Animated.View key={i} style={[t.dot, { transform: [{ translateY: dot }] }]} />
        ))}
      </View>
    </View>
  )
}

// ── Reaction picker overlay ───────────────────────────────────────────────────
function EmojiPicker({ onPick, onClose }: { onPick: (e: string) => void; onClose: () => void }) {
  return (
    <Pressable style={t.emojiOverlay} onPress={onClose}>
      <View style={t.emojiRow}>
        {REACTION_EMOJIS.map((emoji) => (
          <TouchableOpacity key={emoji} style={t.emojiBtn} onPress={() => onPick(emoji)}>
            <Text style={t.emojiText}>{emoji}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </Pressable>
  )
}

// ── Reply quote ───────────────────────────────────────────────────────────────
function ReplyQuote({ replyTo, mine }: { replyTo: NonNullable<Message['replyTo']>; mine: boolean }) {
  return (
    <View style={[t.replyQuote, mine ? t.replyQuoteMine : t.replyQuoteTheirs]}>
      <Text style={t.replyQuoteName}>{replyTo.sender.name}</Text>
      <Text style={t.replyQuoteText} numberOfLines={1}>{replyTo.content ?? '🎤 Voz'}</Text>
    </View>
  )
}

// ── Message bubble ────────────────────────────────────────────────────────────
interface BubbleProps {
  msg: Message
  mine: boolean
  isFirst: boolean
  isLast: boolean
  myUserId: string
  onLongPress: (msg: Message) => void
  onReply: (msg: Message) => void
}

function MessageBubble({ msg, mine, isFirst, isLast, myUserId, onLongPress, onReply }: BubbleProps) {
  const mediaUri = msg.mediaUrl
    ? (msg.mediaUrl.startsWith('http') ? msg.mediaUrl : `${API_BASE}${msg.mediaUrl}`)
    : null

  const myReaction = msg.reactions?.find((r) => r.userId === myUserId)?.emoji
  const allReactions = msg.reactions ?? []

  return (
    <View style={[t.row, mine ? t.rowRight : t.rowLeft, !isLast && t.rowCompact]}>
      <View style={{ alignItems: mine ? 'flex-end' : 'flex-start' }}>
        <Pressable
          onLongPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); onLongPress(msg) }}
          delayLongPress={350}
        >
          <View style={[
            t.bubble,
            mine ? t.bubbleMine : t.bubbleTheirs,
            isFirst && mine  && t.bubbleMineFirst,
            isFirst && !mine && t.bubbleTheirsFirst,
            isLast  && mine  && t.bubbleMineLast,
            isLast  && !mine && t.bubbleTheirsLast,
          ]}>
            {msg.replyTo && <ReplyQuote replyTo={msg.replyTo} mine={mine} />}
            {mediaUri && (
              <Image source={{ uri: mediaUri }} style={t.mediaBubble} resizeMode="cover" />
            )}
            {msg.content ? (
              <Text style={[t.msgText, mine ? t.msgMine : t.msgTheirs]}>{msg.content}</Text>
            ) : null}
            <View style={t.metaRow}>
              <Text style={[t.time, mine && t.timeMine]}>{formatTime(msg.createdAt)}</Text>
              {mine && <Text style={t.tick}>{msg.readAt ? '✓✓' : '✓'}</Text>}
            </View>
          </View>
        </Pressable>

        {/* Reactions strip */}
        {allReactions.length > 0 && (
          <View style={[t.reactStrip, mine ? t.reactStripRight : t.reactStripLeft]}>
            {[...new Set(allReactions.map((r) => r.emoji))].map((e) => (
              <Text key={e} style={t.reactEmoji}>{e}</Text>
            ))}
            {allReactions.length > 1 && (
              <Text style={t.reactCount}>{allReactions.length}</Text>
            )}
          </View>
        )}

        {/* Reply action — appears below bubble on long press */}
        <TouchableOpacity style={t.replyBtn} onPress={() => onReply(msg)}>
          <Text style={t.replyBtnText}>Responder</Text>
        </TouchableOpacity>
      </View>
    </View>
  )
}

// ── Date separator ────────────────────────────────────────────────────────────
function DateSep({ label }: { label: string }) {
  return (
    <View style={t.dateSepWrap}>
      <View style={t.dateLine} />
      <Text style={t.dateSepTxt}>{label}</Text>
      <View style={t.dateLine} />
    </View>
  )
}

// ── Screen ────────────────────────────────────────────────────────────────────
export default function ChatScreen() {
  const { user }   = useAuthStore()
  const route      = useRoute<Route>()
  const nav        = useNavigation()
  const { userId, userName, userAvatar } = route.params
  const [messages, setMessages] = useState<Message[]>([])
  const [text, setText]         = useState('')
  const [isTyping, setIsTyping] = useState(false)
  const [replyingTo, setReplyingTo] = useState<Message | null>(null)
  const [emojiTargetMsg, setEmojiTargetMsg] = useState<Message | null>(null)
  const listRef     = useRef<FlatList>(null)
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const { bottom, top } = useSafeAreaInsets()
  const isOnline        = useOnlineStore((s) => s.isOnline(userId))

  useEffect(() => {
    msgService.getMessages(userId).then((m) => setMessages(m.reverse())).catch(() => {})
  }, [userId])

  useEffect(() => {
    const socket = getSocket()
    if (!socket) return

    function onNewMessage(msg: Message) {
      if (
        (msg.senderId === userId   && msg.receiverId === user?.id) ||
        (msg.senderId === user?.id && msg.receiverId === userId)
      ) {
        setMessages((prev) => [...prev, msg])
        setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 80)
        if (msg.senderId === userId)
          socket?.emit('message:read', { messageId: msg.id, senderId: userId })
      }
    }

    function onTyping({ fromUserId, isTyping: t }: { fromUserId: string; isTyping: boolean }) {
      if (fromUserId === userId) setIsTyping(t)
    }

    function onReaction({ messageId, emoji, removed, userId: reactorId }: any) {
      setMessages((prev) => prev.map((m) => {
        if (m.id !== messageId) return m
        const reactions = (m.reactions ?? []).filter((r) => r.userId !== reactorId)
        return { ...m, reactions: removed ? reactions : [...reactions, { emoji, userId: reactorId }] }
      }))
    }

    socket.on('message:new', onNewMessage)
    socket.on('message:typing', onTyping)
    socket.on('message:reaction', onReaction)
    return () => {
      socket.off('message:new', onNewMessage)
      socket.off('message:typing', onTyping)
      socket.off('message:reaction', onReaction)
    }
  }, [userId, user?.id])

  const handleTextChange = useCallback((val: string) => {
    setText(val)
    const socket = getSocket()
    if (!socket) return
    socket.emit('message:typing', { toUserId: userId, isTyping: val.length > 0 })
    if (typingTimer.current) clearTimeout(typingTimer.current)
    typingTimer.current = setTimeout(() => {
      socket.emit('message:typing', { toUserId: userId, isTyping: false })
    }, 2000)
  }, [userId])

  async function handleSend() {
    if (!text.trim()) return
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    const replyToId = replyingTo?.id
    const msg = await msgService.sendMessage(userId, text.trim(), undefined, replyToId)
    setMessages((prev) => [...prev, msg])
    setText('')
    setReplyingTo(null)
    getSocket()?.emit('message:typing', { toUserId: userId, isTyping: false })
    setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 80)
  }

  async function handleReact(emoji: string) {
    if (!emojiTargetMsg) return
    const messageId = emojiTargetMsg.id
    setEmojiTargetMsg(null)
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    try {
      const result = await msgService.reactToMessage(messageId, emoji)
      setMessages((prev) => prev.map((m) => {
        if (m.id !== messageId) return m
        const reactions = (m.reactions ?? []).filter((r) => r.userId !== user?.id)
        return { ...m, reactions: result.removed ? reactions : [...reactions, { emoji, userId: user!.id }] }
      }))
    } catch {}
  }

  type Item =
    | { kind: 'msg'; msg: Message; mine: boolean; isFirst: boolean; isLast: boolean }
    | { kind: 'date'; label: string; key: string }

  const items: Item[] = []
  messages.forEach((msg, i) => {
    const prev = messages[i - 1]
    const next = messages[i + 1]
    const mine = msg.senderId === user?.id

    if (!prev || !sameDay(prev.createdAt, msg.createdAt)) {
      items.push({ kind: 'date', label: formatDateLabel(msg.createdAt), key: `sep-${msg.id}` })
    }

    const isFirst = !prev || prev.senderId !== msg.senderId || !sameDay(prev.createdAt, msg.createdAt)
    const isLast  = !next || next.senderId !== msg.senderId || !sameDay(msg.createdAt, next.createdAt)

    items.push({ kind: 'msg', msg, mine, isFirst, isLast })
  })

  return (
    <KeyboardAvoidingView
      style={[t.screen, { paddingTop: top }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
    >
      <ChatHeader
        userName={userName}
        avatarUri={userAvatar ?? null}
        isOnline={isOnline}
        isTyping={isTyping}
        onBack={() => nav.goBack()}
      />

      <FlatList
        ref={listRef}
        data={items}
        keyExtractor={(item) => item.kind === 'msg' ? item.msg.id : item.key}
        style={t.list}
        contentContainerStyle={t.listContent}
        showsVerticalScrollIndicator={false}
        onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
        renderItem={({ item }) =>
          item.kind === 'date'
            ? <DateSep label={item.label} />
            : <MessageBubble
                msg={item.msg}
                mine={item.mine}
                isFirst={item.isFirst}
                isLast={item.isLast}
                myUserId={user?.id ?? ''}
                onLongPress={setEmojiTargetMsg}
                onReply={setReplyingTo}
              />
        }
      />

      {isTyping && <TypingBubble />}

      <ChatInputBar
        value={text}
        onChange={handleTextChange}
        onSend={handleSend}
        paddingBottom={bottom + 4}
        otherUserId={userId}
        replyingTo={replyingTo ? {
          senderName: replyingTo.sender.name,
          content: replyingTo.content,
        } : null}
        onCancelReply={() => setReplyingTo(null)}
      />

      {/* Emoji reaction overlay */}
      {emojiTargetMsg && (
        <Modal transparent animationType="fade" visible onRequestClose={() => setEmojiTargetMsg(null)}>
          <EmojiPicker onPick={handleReact} onClose={() => setEmojiTargetMsg(null)} />
        </Modal>
      )}
    </KeyboardAvoidingView>
  )
}

// ── Styles ────────────────────────────────────────────────────────────────────
const MINE_COLOR   = '#0A0A0A'
const THEIRS_COLOR = '#FFFFFF'
const R = 18

const t = StyleSheet.create({
  screen:      { flex: 1, backgroundColor: CHAT_BG },
  list:        { flex: 1 },
  listContent: { paddingHorizontal: spacing.md, paddingVertical: spacing.md, gap: 2 },

  row:        { flexDirection: 'row', marginBottom: 2 },
  rowRight:   { justifyContent: 'flex-end' },
  rowLeft:    { justifyContent: 'flex-start' },
  rowCompact: { marginBottom: 1 },

  bubble: {
    maxWidth: '78%',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: R,
  },
  bubbleMine:         { backgroundColor: MINE_COLOR },
  bubbleTheirs:       { backgroundColor: THEIRS_COLOR },
  bubbleMineFirst:    { borderTopRightRadius: 4 },
  bubbleMineLast:     { borderBottomRightRadius: 4 },
  bubbleTheirsFirst:  { borderTopLeftRadius: 4 },
  bubbleTheirsLast:   { borderBottomLeftRadius: 4 },

  mediaBubble: { width: 200, height: 200, borderRadius: R - 4, marginBottom: 4 },

  msgText:   { fontSize: 15, lineHeight: 21, fontFamily: fonts.regular },
  msgMine:   { color: '#FFFFFF' },
  msgTheirs: { color: colors.gray800 },

  metaRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 3, marginTop: 2 },
  time:    { fontSize: 10, color: 'rgba(0,0,0,0.35)', fontFamily: fonts.regular },
  timeMine:{ color: 'rgba(255,255,255,0.5)' },
  tick:    { fontSize: 10, color: '#4FC3F7', fontFamily: fonts.regular },

  // Reply quote inside bubble
  replyQuote:       { borderLeftWidth: 3, paddingLeft: 8, marginBottom: 6 },
  replyQuoteMine:   { borderLeftColor: 'rgba(255,255,255,0.5)' },
  replyQuoteTheirs: { borderLeftColor: colors.primary },
  replyQuoteName:   { fontSize: 11, fontFamily: fonts.semiBold, color: colors.primary, marginBottom: 1 },
  replyQuoteText:   { fontSize: 12, fontFamily: fonts.regular, color: 'rgba(0,0,0,0.5)' },

  // Reactions strip
  reactStrip:      { flexDirection: 'row', alignItems: 'center', gap: 2, marginTop: 3, paddingHorizontal: 6, paddingVertical: 2, backgroundColor: colors.white, borderRadius: 12, elevation: 1, shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 2 },
  reactStripRight: { alignSelf: 'flex-end' },
  reactStripLeft:  { alignSelf: 'flex-start' },
  reactEmoji:      { fontSize: 14 },
  reactCount:      { fontSize: 11, color: colors.gray600, fontFamily: fonts.medium },

  // Reply button (always visible but tiny so it doesn't clutter)
  replyBtn:     { paddingVertical: 1, paddingHorizontal: 4, marginTop: 2 },
  replyBtnText: { fontSize: 10, color: 'rgba(0,0,0,0.3)', fontFamily: fonts.regular },

  // Emoji picker overlay
  emojiOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center' },
  emojiRow:     { flexDirection: 'row', gap: 6, backgroundColor: colors.white, borderRadius: 40, paddingHorizontal: 16, paddingVertical: 12, elevation: 8 },
  emojiBtn:     { padding: 6 },
  emojiText:    { fontSize: 28 },

  // Date separator
  dateSepWrap: { flexDirection: 'row', alignItems: 'center', marginVertical: 12, gap: 8 },
  dateLine:    { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: 'rgba(0,0,0,0.15)' },
  dateSepTxt:  {
    fontSize: 11, color: 'rgba(0,0,0,0.4)', fontFamily: fonts.medium,
    backgroundColor: '#EBEBEB', paddingHorizontal: 10, paddingVertical: 3,
    borderRadius: 10,
  },

  // Typing bubble
  typingWrap:   { paddingHorizontal: spacing.md, paddingBottom: 4 },
  typingBubble: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: THEIRS_COLOR, alignSelf: 'flex-start',
    paddingHorizontal: 16, paddingVertical: 12, borderRadius: R,
    borderTopLeftRadius: 4,
  },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.gray400 },
})
