import React, { useEffect, useState, useRef, useCallback } from 'react'
import {
  View, Text, FlatList, StyleSheet,
  KeyboardAvoidingView, Platform, Animated, Pressable, TouchableOpacity, Modal,
} from 'react-native'
import { Image } from 'expo-image'
import * as Haptics from 'expo-haptics'
import { Ionicons } from '@expo/vector-icons'
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
import {
  getCachedMessages,
  cacheMessages,
  upsertCachedMessage,
  replacePendingMessage,
  updateCachedConnection,
  getSyncMeta,
  setSyncMeta,
} from '../../db/database'
import { isConnected } from '../../services/netinfo.service'

type Route = RouteProp<AppStackParams, 'Chat'>

const CHAT_BG = '#FFFFFF'
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

// ── File card (documents, PDFs, etc.) ────────────────────────────────────────
function FileCard({ fileName, mine }: { fileName: string; mine: boolean }) {
  const ext = fileName.split('.').pop()?.toUpperCase() ?? 'FILE'
  return (
    <View style={[fc.wrap, mine ? fc.wrapMine : fc.wrapTheirs]}>
      <View style={fc.iconWrap}>
        <Ionicons name="document-text-outline" size={22} color={mine ? 'rgba(255,255,255,0.9)' : colors.primary} />
      </View>
      <View style={fc.info}>
        <Text style={[fc.name, mine && fc.nameMine]} numberOfLines={2}>{fileName}</Text>
        <Text style={[fc.ext, mine && fc.extMine]}>{ext}</Text>
      </View>
    </View>
  )
}

const fc = StyleSheet.create({
  wrap:      { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 4, paddingHorizontal: 2, maxWidth: 220 },
  wrapMine:  {},
  wrapTheirs:{},
  iconWrap:  { width: 40, height: 40, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' },
  info:      { flex: 1, gap: 2 },
  name:      { fontSize: 13, fontFamily: fonts.semiBold, color: colors.gray800 },
  nameMine:  { color: colors.white },
  ext:       { fontSize: 10, fontFamily: fonts.regular, color: colors.gray400, textTransform: 'uppercase', letterSpacing: 0.5 },
  extMine:   { color: 'rgba(255,255,255,0.6)' },
})

// ── Reply quote ───────────────────────────────────────────────────────────────
function ReplyQuote({ replyTo, mine }: { replyTo: NonNullable<Message['replyTo']>; mine: boolean }) {
  return (
    <View style={[t.replyQuote, mine ? t.replyQuoteMine : t.replyQuoteTheirs]}>
      <Text style={[t.replyQuoteName, mine && t.replyQuoteNameMine]}>{replyTo.sender.name}</Text>
      <Text style={[t.replyQuoteText, mine && t.replyQuoteTextMine]} numberOfLines={1}>
        {replyTo.content ?? '🎤 Voz'}
      </Text>
    </View>
  )
}

// ── Message bubble ────────────────────────────────────────────────────────────
interface BubbleProps {
  msg: Message & { _pending?: boolean; _failed?: boolean }
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
            msg._pending && t.bubblePending,
          ]}>
            {msg.replyTo && <ReplyQuote replyTo={msg.replyTo} mine={mine} />}
            {mediaUri && (
              <Image
                source={{ uri: mediaUri }}
                style={t.mediaBubble}
                contentFit="cover"
                cachePolicy="disk"
                recyclingKey={mediaUri}
                transition={100}
              />
            )}
            {/* Document / file attachment */}
            {!mediaUri && msg.content && msg.content.match(/\.(pdf|doc|docx|xls|xlsx|ppt|pptx|txt|zip|rar)$/i) && (
              <FileCard fileName={msg.content} mine={mine} />
            )}
            {msg.content && !msg.content.match(/\.(pdf|doc|docx|xls|xlsx|ppt|pptx|txt|zip|rar)$/i) ? (
              <Text style={[t.msgText, mine ? t.msgMine : t.msgTheirs]}>{msg.content}</Text>
            ) : !mediaUri && !msg.content ? null : null}
            <View style={t.metaRow}>
              <Text style={[t.time, mine && t.timeMine]}>{formatTime(msg.createdAt)}</Text>
              {mine && (
                msg._failed
                  ? <Ionicons name="alert-circle" size={12} color="#FF6B6B" />
                  : msg._pending
                    ? <Ionicons name="checkmark" size={13} color="rgba(255,255,255,0.35)" />
                    : msg.readAt
                      ? <Ionicons name="checkmark-done" size={13} color="#4FC3F7" />
                      : <Ionicons name="checkmark-done" size={13} color="rgba(255,255,255,0.5)" />
              )}
            </View>
          </View>
        </Pressable>

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
type LocalMessage = Message & { _pending?: boolean; _failed?: boolean }

export default function ChatScreen() {
  const { user }   = useAuthStore()
  const route      = useRoute<Route>()
  const nav        = useNavigation()
  const { userId, userName, userAvatar } = route.params

  const [messages, setMessages]         = useState<LocalMessage[]>([])
  const [text, setText]                 = useState('')
  const [isTyping, setIsTyping]         = useState(false)
  const [replyingTo, setReplyingTo]     = useState<Message | null>(null)
  const [emojiTargetMsg, setEmojiTargetMsg] = useState<Message | null>(null)

  const listRef     = useRef<FlatList>(null)
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const { bottom, top } = useSafeAreaInsets()
  const isOnline        = useOnlineStore((s) => s.isOnline(userId))

  // ── Load: SQLite first → background network sync (5-min TTL) ────────────
  useEffect(() => {
    let cancelled = false
    const SYNC_TTL = 5 * 60 * 1000 // 5 minutes
    const syncKey  = `chat_sync_${userId}`

    async function load() {
      // 1. Serve from SQLite immediately (zero latency)
      const [cached, lastSyncStr] = await Promise.all([
        getCachedMessages(userId).catch(() => [] as LocalMessage[]),
        getSyncMeta(syncKey).catch(() => null),
      ])

      if (!cancelled && cached.length > 0) {
        setMessages(cached)
        setTimeout(() => listRef.current?.scrollToEnd({ animated: false }), 50)
      }

      // 2. Skip API if cache is fresh (< 5 min) and we have messages
      const cacheAge = lastSyncStr ? Date.now() - parseInt(lastSyncStr, 10) : Infinity
      if (cached.length > 0 && cacheAge < SYNC_TTL) return

      // 3. Background: fetch latest page from server
      if (!isConnected()) return
      try {
        const fresh = await msgService.getMessages(userId, 1)
        if (cancelled) return
        const sorted = [...fresh].reverse()
        setMessages((prev) => {
          const pendingLocal = prev.filter((m) => m._pending || m._failed)
          const freshIds     = new Set(sorted.map((m) => m.id))
          const pending      = pendingLocal.filter((m) => !freshIds.has(m.id))
          const olderCached  = prev.filter((m) => !m._pending && !m._failed && !freshIds.has(m.id))
          const merged = [...olderCached, ...sorted, ...pending]
          merged.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
          return merged
        })
        await Promise.all([
          cacheMessages(userId, sorted).catch(() => {}),
          setSyncMeta(syncKey, String(Date.now())).catch(() => {}),
        ])
        setTimeout(() => listRef.current?.scrollToEnd({ animated: false }), 80)
      } catch {}
    }

    load()
    return () => { cancelled = true }
  }, [userId])

  // ── Socket events ──────────────────────────────────────────────────────────
  useEffect(() => {
    const socket = getSocket()
    if (!socket) return

    function onNewMessage(msg: Message) {
      const isThisConvo = (
        (msg.senderId === userId   && msg.receiverId === user?.id) ||
        (msg.senderId === user?.id && msg.receiverId === userId)
      )
      if (!isThisConvo) return

      setMessages((prev) => {
        if (prev.find((m) => m.id === msg.id)) return prev
        return [...prev, msg]
      })
      // Persist immediately to SQLite
      upsertCachedMessage(userId, msg).catch(() => {})

      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 80)

      if (msg.senderId === userId)
        getSocket()?.emit('message:read', { messageId: msg.id, senderId: userId })
    }

    function onTyping({ fromUserId, isTyping: t }: { fromUserId: string; isTyping: boolean }) {
      if (fromUserId === userId) setIsTyping(t)
    }

    function onReaction({ messageId, emoji, removed, userId: reactorId }: any) {
      setMessages((prev) => prev.map((m) => {
        if (m.id !== messageId) return m
        const reactions = (m.reactions ?? []).filter((r) => r.userId !== reactorId)
        const updated = { ...m, reactions: removed ? reactions : [...reactions, { emoji, userId: reactorId } as MessageReaction] }
        upsertCachedMessage(userId, updated).catch(() => {})
        return updated
      }))
    }

    socket.on('message:new',      onNewMessage)
    socket.on('message:typing',   onTyping)
    socket.on('message:reaction', onReaction)
    return () => {
      socket.off('message:new',      onNewMessage)
      socket.off('message:typing',   onTyping)
      socket.off('message:reaction', onReaction)
    }
  }, [userId, user?.id])

  // ── Typing indicator ───────────────────────────────────────────────────────
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

  // ── Update inbox immediately so MessagesScreen reflects sent message ─────────
  function pushToInbox(msgId: string, content: string | null, createdAt: string) {
    updateCachedConnection(
      userId,
      {
        lastMessage: { id: msgId, content, senderId: user!.id, readAt: null, createdAt },
        unreadCount: 0,
      },
      { user: { id: userId, name: userName, avatar: userAvatar ?? null }, postIds: [] },
    ).catch(() => {})
  }

  // ── Send: optimistic → API → confirm ──────────────────────────────────────
  async function handleSendFile(fileUri: string, mimeType: string, fileName: string) {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    const tempId = `pending-file-${Date.now()}`
    const isImage = mimeType.startsWith('image/')

    const optimistic: LocalMessage = {
      id:         tempId,
      senderId:   user!.id,
      receiverId: userId,
      content:    isImage ? null : fileName,
      mediaUrl:   isImage ? fileUri : null,
      readAt:     null,
      replyToId:  null,
      createdAt:  new Date().toISOString(),
      sender:     { id: user!.id, name: user!.name ?? '', avatar: user!.avatar ?? null },
      receiver:   { id: userId, name: userName, avatar: userAvatar ?? null },
      replyTo:    null,
      _pending:   true,
    }

    setMessages((prev) => [...prev, optimistic])
    upsertCachedMessage(userId, optimistic as unknown as Message).catch(() => {})
    pushToInbox(tempId, isImage ? null : fileName, optimistic.createdAt)
    setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 80)

    try {
      const sent = await msgService.sendMessage(userId, isImage ? undefined : fileName, fileUri, undefined, mimeType, fileName)
      setMessages((prev) => prev.map((m) => m.id === tempId ? sent : m))
      await replacePendingMessage(tempId, sent, userId).catch(() => {})
    } catch {
      setMessages((prev) => prev.map((m) =>
        m.id === tempId ? { ...m, _pending: false, _failed: true } : m,
      ))
    }
  }

  async function handleSend() {
    const content = text.trim()
    if (!content) return
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)

    const tempId   = `pending-${Date.now()}`
    const replyToId = replyingTo?.id

    const optimistic: LocalMessage = {
      id:         tempId,
      senderId:   user!.id,
      receiverId: userId,
      content,
      mediaUrl:   null,
      readAt:     null,
      replyToId:  replyToId ?? null,
      createdAt:  new Date().toISOString(),
      sender:     { id: user!.id, name: user!.name ?? '', avatar: user!.avatar ?? null },
      receiver:   { id: userId, name: userName, avatar: userAvatar ?? null },
      replyTo:    replyingTo ? {
        id: replyingTo.id,
        content: replyingTo.content,
        sender: { name: replyingTo.sender.name },
      } : null,
      _pending: true,
    }

    setMessages((prev) => [...prev, optimistic])
    upsertCachedMessage(userId, optimistic as unknown as Message).catch(() => {})
    // Update inbox immediately — conversation rises to top with last message
    pushToInbox(tempId, content, optimistic.createdAt)

    setText('')
    setReplyingTo(null)
    getSocket()?.emit('message:typing', { toUserId: userId, isTyping: false })
    setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 80)

    try {
      const sent = await msgService.sendMessage(userId, content, undefined, replyToId)
      setMessages((prev) => prev.map((m) => m.id === tempId ? sent : m))
      await replacePendingMessage(tempId, sent, userId).catch(() => {})
    } catch {
      setMessages((prev) => prev.map((m) =>
        m.id === tempId ? { ...m, _pending: false, _failed: true } : m,
      ))
      // Mark as failed in SQLite too
      upsertCachedMessage(userId, { ...optimistic, _pending: false, _failed: true } as unknown as Message).catch(() => {})
    }
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
        const updated = { ...m, reactions: result.removed ? reactions : [...reactions, { emoji, userId: user!.id } as MessageReaction] }
        upsertCachedMessage(userId, updated).catch(() => {})
        return updated
      }))
    } catch {}
  }

  // ── Build render list (messages + date separators) ─────────────────────────
  type Item =
    | { kind: 'msg'; msg: LocalMessage; mine: boolean; isFirst: boolean; isLast: boolean }
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
        onSendFile={handleSendFile}
        paddingBottom={bottom + 4}
        otherUserId={userId}
        replyingTo={replyingTo ? {
          senderName: replyingTo.sender.name,
          content: replyingTo.content,
        } : null}
        onCancelReply={() => setReplyingTo(null)}
      />

      {emojiTargetMsg && (
        <Modal transparent animationType="fade" visible onRequestClose={() => setEmojiTargetMsg(null)}>
          <EmojiPicker onPick={handleReact} onClose={() => setEmojiTargetMsg(null)} />
        </Modal>
      )}
    </KeyboardAvoidingView>
  )
}

// ── Styles ─────────────────────────────────────────────────────────────────────
const MINE_COLOR   = colors.primary   // Brand blue — "bom dia" looks clean and on-brand
const THEIRS_COLOR = '#F0F2F5'        // Warm light gray — softer than pure white
const R = 20

const t = StyleSheet.create({
  screen:      { flex: 1, backgroundColor: CHAT_BG },
  list:        { flex: 1 },
  listContent: { paddingHorizontal: 14, paddingVertical: spacing.md, gap: 1 },

  row:        { flexDirection: 'row', marginBottom: 3 },
  rowRight:   { justifyContent: 'flex-end' },
  rowLeft:    { justifyContent: 'flex-start' },
  rowCompact: { marginBottom: 1 },

  bubble: {
    maxWidth: '78%',
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: R,
  },
  // Mine: brand blue, sharp top-right corner on first, sharp bottom-right on last
  bubbleMine:   { backgroundColor: MINE_COLOR },
  bubbleTheirs: { backgroundColor: THEIRS_COLOR },
  bubbleMineFirst:    { borderTopRightRadius: 5 },
  bubbleMineLast:     { borderBottomRightRadius: 5 },
  bubbleTheirsFirst:  { borderTopLeftRadius: 5 },
  bubbleTheirsLast:   { borderBottomLeftRadius: 5 },
  bubblePending:      { opacity: 0.6 },

  mediaBubble: { width: 220, height: 220, borderRadius: R - 4, marginBottom: 4 },

  msgText:   { fontSize: 15, lineHeight: 22, fontFamily: fonts.regular, letterSpacing: 0.1 },
  msgMine:   { color: '#FFFFFF' },
  msgTheirs: { color: colors.gray800 },

  metaRow:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 4, marginTop: 3 },
  time:     { fontSize: 10, color: 'rgba(0,0,0,0.3)', fontFamily: fonts.regular },
  timeMine: { color: 'rgba(255,255,255,0.55)' },

  replyQuote: {
    borderLeftWidth: 3, paddingLeft: 9, paddingVertical: 2,
    marginBottom: 7, borderRadius: 2,
  },
  replyQuoteMine:   { borderLeftColor: 'rgba(255,255,255,0.6)', backgroundColor: 'rgba(255,255,255,0.1)' },
  replyQuoteTheirs: { borderLeftColor: colors.primary, backgroundColor: `${colors.primary}10` },
  replyQuoteName:   { fontSize: 11, fontFamily: fonts.semiBold, color: colors.primary, marginBottom: 1 },
  replyQuoteNameMine: { color: 'rgba(255,255,255,0.8)' },
  replyQuoteText:   { fontSize: 12, fontFamily: fonts.regular, color: 'rgba(0,0,0,0.45)' },
  replyQuoteTextMine: { color: 'rgba(255,255,255,0.6)' },

  reactStrip: {
    flexDirection: 'row', alignItems: 'center', gap: 2,
    marginTop: 4, paddingHorizontal: 7, paddingVertical: 3,
    backgroundColor: colors.white, borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth, borderColor: colors.gray200,
  },
  reactStripRight: { alignSelf: 'flex-end' },
  reactStripLeft:  { alignSelf: 'flex-start' },
  reactEmoji:      { fontSize: 14 },
  reactCount:      { fontSize: 11, color: colors.gray600, fontFamily: fonts.medium },

  emojiOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'center', alignItems: 'center' },
  emojiRow: {
    flexDirection: 'row', gap: 4, backgroundColor: colors.white,
    borderRadius: 44, paddingHorizontal: 14, paddingVertical: 10,
    borderWidth: StyleSheet.hairlineWidth, borderColor: colors.gray200,
  },
  emojiBtn:  { padding: 8 },
  emojiText: { fontSize: 26 },

  dateSepWrap: { flexDirection: 'row', alignItems: 'center', marginVertical: 16, gap: 10 },
  dateLine:    { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: 'rgba(0,0,0,0.1)' },
  dateSepTxt:  {
    fontSize: 11, color: 'rgba(0,0,0,0.35)', fontFamily: fonts.medium,
    backgroundColor: '#E8EAF0', paddingHorizontal: 12, paddingVertical: 4,
    borderRadius: 12,
  },

  typingWrap:   { paddingHorizontal: spacing.md, paddingBottom: 4 },
  typingBubble: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: THEIRS_COLOR, alignSelf: 'flex-start',
    paddingHorizontal: 16, paddingVertical: 12, borderRadius: R,
    borderTopLeftRadius: 4,
  },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.gray400 },
})
