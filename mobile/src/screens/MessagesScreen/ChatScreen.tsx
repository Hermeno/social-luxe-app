import React, { useEffect, useState, useRef, useCallback, useMemo } from 'react'
import {
  View, Text, FlatList, StyleSheet, ActivityIndicator,
  Keyboard, Platform, Animated, Pressable, TouchableOpacity, Modal, StatusBar, AppState,
  ScrollView, Alert, TextInput,
} from 'react-native'
import { Image } from 'expo-image'
import { Ionicons } from '@expo/vector-icons'
import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio'
import { RouteProp, useNavigation, useRoute, useFocusEffect } from '@react-navigation/native'
import { StackNavigationProp } from '@react-navigation/stack'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Message, MessageReaction, Pairing, PairingType } from '../../types'
import * as msgService from '../../services/message.service'
import * as pairingService from '../../services/pairing.service'
import { useAuthStore } from '../../store/auth.store'
import { useOnlineStore } from '../../store/online.store'
import { useMessageBadgeStore } from '../../store/messageBadge.store'
import { getSocket } from '../../socket'
import { AppStackParams } from '../../navigation/AppNavigator'
import { colors, spacing, radius, fonts } from '../../theme'
import ChatHeader from './ChatHeader'
import ChatInputBar from './ChatInputBar'
import ScheduleMessageModal from './ScheduleMessageModal'
import * as scheduledSvc from '../../services/scheduledMessages.service'
import Toast from 'react-native-toast-message'
import { API_BASE } from '../../config'
import {
  getCachedMessages,
  getCachedConnections,
  cacheMessages,
  upsertCachedMessage,
  replacePendingMessage,
  updateCachedConnection,
  getSyncMeta,
  setSyncMeta,
} from '../../db/database'
import { isConnected } from '../../services/netinfo.service'
import { useT } from '../../i18n'
import AvatarImage from '../../components/AvatarImage'

type Route  = RouteProp<AppStackParams, 'Chat'>
type NavProp = StackNavigationProp<AppStackParams>

const CHAT_BG        = '#FFFFFF'
const MINE_COLOR     = '#CA2851'
const THEIRS_COLOR   = '#F0F2F5'
const REACTION_EMOJIS = ['❤️', '😂', '😮', '😢', '🔥', '👏']

const PAIRING_TYPE_OPTIONS: { type: PairingType; emoji: string; label: string }[] = [
  { type: 'AMIGOS',    emoji: '🤝', label: 'Amigos' },
  { type: 'AMORES',    emoji: '💕', label: 'Amores' },
  { type: 'IRMAOS',    emoji: '👯', label: 'Irmãos' },
  { type: 'BESTS',     emoji: '✨', label: 'Bests' },
  { type: 'BONITONAS', emoji: '💅', label: 'Bonitonas' },
  { type: 'GEMEAS',    emoji: '🫂', label: 'Gémeas' },
  { type: 'OUTRO',     emoji: '✍️', label: 'Outro...' },
]

function formatTime(dateStr: string) {
  const d = new Date(dateStr)
  return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
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

// ── Audio player ─────────────────────────────────────────────────────────────
const WAVE_BARS  = 30
const WAVE_BAR_W = 2.5
const WAVE_H     = 22

function getWaveform(seed: string): number[] {
  let h = 5381
  for (let i = 0; i < seed.length; i++) h = ((h << 5) + h) ^ seed.charCodeAt(i)
  return Array.from({ length: WAVE_BARS }, (_, i) => {
    const v = Math.abs(Math.sin((h & 0xffff) * 0.0001 + i * 0.85) * Math.cos(i * 0.4 + 0.5))
    return Math.max(0.15, Math.min(1, v * 2.2))
  })
}

function fmtSec(s: number) {
  const ss = Math.max(0, Math.floor(s))
  return `${Math.floor(ss / 60)}:${String(ss % 60).padStart(2, '0')}`
}

function AudioPlayer({ uri, mine, pending }: { uri: string; mine: boolean; pending: boolean }) {
  const player  = useAudioPlayer(uri)
  const status  = useAudioPlayerStatus(player)

  const playing   = status.playing ?? false
  const duration  = status.duration ?? 0
  const pos       = status.currentTime ?? 0
  const buffering = (status as any).isBuffering ?? (status as any).buffering ?? false
  const progress  = duration > 0 ? Math.min(1, pos / duration) : 0
  const filled    = Math.floor(progress * WAVE_BARS)
  const isLoading = !playing && duration === 0 && !pending

  const waveform = useMemo(() => getWaveform(uri), [uri])

  function handlePlayPause() {
    if (playing) { player.pause(); return }
    if (duration > 0 && pos >= duration - 0.05) player.seekTo(0)
    player.play()
  }

  const btnBg     = mine ? 'rgba(255,255,255,0.22)' : colors.primary
  const fillColor = mine ? '#fff'                   : colors.primary
  const emptyColor= mine ? 'rgba(255,255,255,0.28)' : 'rgba(0,0,0,0.13)'
  const timeColor = mine ? 'rgba(255,255,255,0.78)' : colors.gray500
  const iconColor = '#fff'

  return (
    <View style={t.audio}>
      {/* Play / Pause / Loading */}
      <TouchableOpacity
        onPress={handlePlayPause}
        style={[t.audioBtn, { backgroundColor: btnBg }]}
        disabled={pending || buffering}
        activeOpacity={0.75}
      >
        {buffering || (playing && duration === 0)
          ? <ActivityIndicator size="small" color={iconColor} />
          : <Ionicons
              name={playing ? 'pause' : 'play'}
              size={16}
              color={iconColor}
              style={playing ? undefined : { marginLeft: 2 }}
            />
        }
      </TouchableOpacity>

      {/* Waveform */}
      <View style={t.waveform}>
        {waveform.map((h, i) => (
          <View
            key={i}
            style={{
              width: WAVE_BAR_W,
              height: WAVE_H * h,
              borderRadius: 2,
              backgroundColor: i < filled ? fillColor : emptyColor,
            }}
          />
        ))}
      </View>

      {/* Time */}
      <Text style={[t.audioTime, { color: timeColor }]}>
        {pos > 0.05 ? fmtSec(pos) : (duration > 0 ? fmtSec(duration) : '--:--')}
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
  partnerAvatar: string | null
  partnerName: string
  myAvatar: string | null
  myName: string
  onLongPress: (msg: Message) => void
  onReply: (msg: Message) => void
}

function MessageBubble({ msg, mine, isFirst, isLast, myUserId, partnerAvatar, partnerName, myAvatar, myName, onLongPress, onReply }: BubbleProps) {
  const mediaUri = msg.mediaUrl
    ? (msg.mediaUrl.startsWith('http') || msg.mediaUrl.startsWith('file://')
        ? msg.mediaUrl
        : `${API_BASE}${msg.mediaUrl}`)
    : null

  const allReactions = msg.reactions ?? []
  const isAudio = !!msg.content?.match(/\.(m4a|mp3|aac|wav|ogg)$/i)
  const isFile  = !isAudio && !mediaUri && !!msg.content && !!msg.content.match(/\.(pdf|doc|docx|xls|xlsx|ppt|pptx|txt|zip|rar)$/i)
  const isText  = !!msg.content && !isFile && !isAudio

  return (
    // FIX: row must be flex:1 so that maxWidth:'80%' on bubbleOuter
    // is relative to the full screen width — prevents text going vertical
    <View style={[t.row, mine ? t.rowRight : t.rowLeft, !isLast && t.rowCompact]}>
      {!mine && (
        <View style={t.msgAvatarWrap}>
          <AvatarImage uri={partnerAvatar} name={partnerName} size={24} borderWidth={0} borderColor="transparent" />
        </View>
      )}
      <View style={[t.bubbleOuter, mine ? t.bubbleOuterMine : t.bubbleOuterTheirs]}>

        <Pressable
          onLongPress={() => { onLongPress(msg) }}
          delayLongPress={350}
          onPress={() => onReply(msg)}
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

            {mediaUri && !isAudio && (
              <Image
                source={{ uri: mediaUri }}
                style={t.mediaBubble}
                contentFit="cover"
                cachePolicy="disk"
                recyclingKey={mediaUri}
                transition={100}
              />
            )}

            {isAudio && (
              <AudioPlayer
                key={mediaUri ?? msg.content!}
                uri={mediaUri ?? msg.content!}
                mine={mine}
                pending={!!msg._pending}
              />
            )}

            {isFile && <FileCard fileName={msg.content!} mine={mine} />}

            {isText && (
              <Text style={[t.msgText, mine ? t.msgMine : t.msgTheirs]}>
                {msg.content}
              </Text>
            )}

            {/* Time + status — inline at bottom-right */}
            <View style={[t.metaRow, mine ? t.metaRowMine : t.metaRowTheirs]}>
              <Text style={[t.time, mine ? t.timeMine : t.timeTheirs]}>
                {formatTime(msg.createdAt)}
              </Text>
              {mine && (
                msg._failed
                  ? <Ionicons name="alert-circle"    size={12} color="#FF6B6B" />
                  : msg._pending
                    ? <Ionicons name="checkmark"      size={12} color="rgba(255,255,255,0.4)" />
                    : msg.readAt
                      ? <Ionicons name="checkmark-done" size={12} color="#7DD3FC" />
                      : <Ionicons name="checkmark-done" size={12} color="rgba(255,255,255,0.55)" />
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
      {mine && (
        <View style={t.msgAvatarWrap}>
          <AvatarImage uri={myAvatar} name={myName} size={24} borderWidth={0} borderColor="transparent" />
        </View>
      )}
    </View>
  )
}

// ── Date separator ────────────────────────────────────────────────────────────
function DateSep({ label }: { label: string }) {
  return (
    <View style={t.dateSepWrap}>
      <Text style={t.dateSepTxt}>{label}</Text>
    </View>
  )
}

// ── Screen ────────────────────────────────────────────────────────────────────
type LocalMessage = Message & { _pending?: boolean; _failed?: boolean }

export default function ChatScreen() {
  const tr         = useT()
  const { user }   = useAuthStore()
  const route      = useRoute<Route>()
  const nav        = useNavigation<NavProp>()
  const { userId, userName, userAvatar, partnerHasPosts = false } = route.params

  const [messages, setMessages]         = useState<LocalMessage[]>([])
  const [text, setText]                 = useState('')
  const [isTyping, setIsTyping]         = useState(false)
  const [replyingTo, setReplyingTo]     = useState<Message | null>(null)
  const [emojiTargetMsg, setEmojiTargetMsg]   = useState<Message | null>(null)
  const [contextMenuMsg, setContextMenuMsg]   = useState<Message | null>(null)
  const [editingMsg, setEditingMsg]           = useState<Message | null>(null)
  const [showScheduler, setShowScheduler]     = useState(false)
  const [scheduledMsg, setScheduledMsg]       = useState<scheduledSvc.ScheduledMessage | null>(null)
  const [loadingMore, setLoadingMore]   = useState(false)
  const [hasMorePages, setHasMorePages] = useState(false)
  const oldestMsgAtRef = useRef<string | undefined>(undefined)

  // ── Pairing (persistent relationship tag) ──────────────────────────────────
  const [pairing, setPairing]             = useState<Pairing | null>(null)
  const [pairingPickerOpen, setPairingPickerOpen] = useState(false)
  const [customizingPairing, setCustomizingPairing] = useState(false)
  const [customPairingLabel, setCustomPairingLabel] = useState('')

  const listRef     = useRef<FlatList>(null)
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const { bottom, top } = useSafeAreaInsets()
  const isOnline        = useOnlineStore((s) => s.isOnline(userId))

  // ── Keyboard offset — replaces KeyboardAvoidingView to avoid stuck-padding bug ─
  const kbAnim = useRef(new Animated.Value(0)).current

  useEffect(() => {
    // iOS only: the window doesn't resize, so we pad the layout by the keyboard
    // height ourselves. On Android the window already resizes (adjustResize) —
    // padding on top of that doubled the offset and threw the input bar to the
    // top of the screen, leaving the keyboard alone at the bottom.
    if (Platform.OS !== 'ios') return

    const sub1 = Keyboard.addListener('keyboardWillShow', (e) => {
      const safeHeight = Math.max(0, e.endCoordinates.height - bottom)
      Animated.timing(kbAnim, {
        toValue: safeHeight,
        duration: e.duration ?? 250,
        useNativeDriver: false,
      }).start()
    })

    const sub2 = Keyboard.addListener('keyboardWillHide', (e) => {
      Animated.timing(kbAnim, {
        toValue: 0,
        duration: e.duration ?? 250,
        useNativeDriver: false,
      }).start()
    })

    return () => { sub1.remove(); sub2.remove() }
  }, [bottom])

  const formatDateLabel = useCallback((dateStr: string) => {
    const d    = new Date(dateStr)
    const now  = new Date()
    const diff = Math.floor((now.getTime() - d.getTime()) / 86400000)
    if (diff === 0) return tr.time_today
    if (diff === 1) return tr.time_yesterday
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })
  }, [t])

  // ── Load: SQLite first → background network sync (5-min TTL) ────────────
  const loadMessages = useCallback(async (ignoreCache = false) => {
    const SYNC_TTL = 5 * 60 * 1000
    const syncKey  = `chat_sync_${userId}`

    const [cached, lastSyncStr] = await Promise.all([
      getCachedMessages(userId).catch(() => [] as LocalMessage[]),
      getSyncMeta(syncKey).catch(() => null),
    ])

    if (cached.length > 0) {
      setMessages(cached)
    }

    const cacheAge = lastSyncStr ? Date.now() - parseInt(lastSyncStr, 10) : Infinity
    if (!ignoreCache && cached.length > 0 && cacheAge < SYNC_TTL) return

    if (!isConnected()) return
    try {
      // No cursor on initial load → newest 30 messages
      const fresh = await msgService.getMessages(userId)
      const sorted = [...fresh].reverse()
      setHasMorePages(fresh.length >= 30)
      if (sorted.length > 0) {
        oldestMsgAtRef.current = sorted[0].createdAt
      }

      setMessages((prev) => {
        const pendingLocal   = prev.filter((m) => m._pending || m._failed)
        const freshIds       = new Set(sorted.map((m) => m.id))
        const pending        = pendingLocal.filter((m) => !freshIds.has(m.id))
        const prevNonPending = prev.filter((m) => !m._pending && !m._failed)
        const prevIds        = new Set(prevNonPending.map((m) => m.id))
        const hasNew         = sorted.some((m) => !prevIds.has(m.id))
        if (!hasNew && pending.length === pendingLocal.length) return prev
        const olderCached = prevNonPending.filter((m) => !freshIds.has(m.id))
        const merged = [...olderCached, ...sorted, ...pending]
        merged.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
        return merged
      })

      await Promise.all([
        cacheMessages(userId, sorted).catch(() => {}),
        setSyncMeta(syncKey, String(Date.now())).catch(() => {}),
      ])

      // Clear unread badge for this conversation
      const conns = await getCachedConnections().catch(() => [])
      const conn  = conns.find((c) => c.user.id === userId)
      if (conn?.unreadCount) {
        useMessageBadgeStore.getState().clearConversation(conn.unreadCount)
        updateCachedConnection(userId, { unreadCount: 0 }).catch(() => {})
      }
    } catch {}
  }, [userId])

  // ── Load older messages (cursor-based, no page-shift duplicates) ───────────
  const loadMoreMessages = useCallback(async () => {
    if (loadingMore || !hasMorePages || !isConnected()) return
    const cursor = oldestMsgAtRef.current
    if (!cursor) return
    setLoadingMore(true)
    try {
      const older = await msgService.getMessages(userId, cursor)
      if (older.length === 0) { setHasMorePages(false); setLoadingMore(false); return }
      const sorted = [...older].reverse()
      if (sorted.length > 0) oldestMsgAtRef.current = sorted[0].createdAt
      setMessages((prev) => {
        const prevIds = new Set(prev.map((m) => m.id))
        const newOnes = sorted.filter((m) => !prevIds.has(m.id))
        if (newOnes.length === 0) { setHasMorePages(false); return prev }
        const merged = [...newOnes, ...prev]
        merged.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
        return merged
      })
      await cacheMessages(userId, sorted).catch(() => {})
      if (older.length < 30) setHasMorePages(false)
    } catch {}
    setLoadingMore(false)
  }, [loadingMore, hasMorePages, userId])

  useEffect(() => {
    loadMessages()
  }, [loadMessages])

  // Reload messages when app comes back from background (catches missed messages while inactive)
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') loadMessages(true)
    })
    return () => sub.remove()
  }, [loadMessages])

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

      listRef.current?.scrollToOffset({ offset: 0, animated: true })

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

    function onEdited(msg: Message) {
      setMessages((prev) => prev.map((m) => m.id === msg.id ? { ...m, content: msg.content } : m))
    }

    function onDeleted({ messageId }: { messageId: string }) {
      setMessages((prev) => prev.filter((m) => m.id !== messageId))
    }

    // ── pairing events ──────────────────────────────────────────────────────
    function involvesThisChat(p: Pairing) {
      return p.userA.id === userId || p.userB.id === userId
    }
    function onPairingInvited({ pairing: p }: { pairing: Pairing }) {
      if (involvesThisChat(p)) setPairing(p)
    }
    function onPairingActive({ pairing: p }: { pairing: Pairing }) {
      if (involvesThisChat(p)) setPairing(p)
    }
    function onPairingEnded({ pairing: p }: { pairing: Pairing }) {
      if (involvesThisChat(p)) setPairing(null)
    }

    socket.on('message:new',      onNewMessage)
    socket.on('message:typing',   onTyping)
    socket.on('message:reaction', onReaction)
    socket.on('message:edited',   onEdited)
    socket.on('message:deleted',  onDeleted)
    socket.on('pairing:invited',  onPairingInvited)
    socket.on('pairing:active',   onPairingActive)
    socket.on('pairing:ended',    onPairingEnded)

    return () => {
      socket.off('message:new',      onNewMessage)
      socket.off('message:typing',   onTyping)
      socket.off('message:reaction', onReaction)
      socket.off('message:edited',   onEdited)
      socket.off('message:deleted',  onDeleted)
      socket.off('pairing:invited',  onPairingInvited)
      socket.off('pairing:active',   onPairingActive)
      socket.off('pairing:ended',    onPairingEnded)
    }
  }, [userId, user?.id, userName])

  // Pairing is persistent (DB-backed), so fetch it whenever this chat is focused —
  // unlike the old ephemeral live-status, a socket-only sync would miss updates
  // that happened while this screen wasn't mounted.
  useFocusEffect(
    useCallback(() => {
      pairingService.getMyPairing()
        .then((p) => setPairing(p && (p.userA.id === userId || p.userB.id === userId) ? p : null))
        .catch(() => {})
    }, [userId]),
  )

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

  // ── Scheduled messages ────────────────────────────────────────────────────
  const loadScheduled = useCallback(async () => {
    const msgs = await scheduledSvc.getFor(userId)
    setScheduledMsg(msgs.length > 0 ? msgs[0] : null)
  }, [userId])

  async function handleScheduleMessage(content: string, scheduledAt: Date) {
    await scheduledSvc.add(userId, userName, content, scheduledAt)
    await loadScheduled()
    const time = scheduledAt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
    const label = scheduledAt.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })
    Toast.show({
      type: 'success',
      text1: tr.chat_scheduled_ok,
      text2: `${label} às ${time}`,
      visibilityTime: 3500,
    })
  }

  async function handleCancelScheduled() {
    if (!scheduledMsg) return
    await scheduledSvc.cancel(scheduledMsg.id)
    setScheduledMsg(null)
    setShowScheduler(false)
    Toast.show({ type: 'info', text1: tr.chat_sched_cancelled, visibilityTime: 2500 })
  }

  const checkAndSendDue = useCallback(async () => {
    const due = await scheduledSvc.getDue(userId)
    for (const sm of due) {
      try {
        const sent = await msgService.sendMessage(sm.receiverId, sm.content)
        await scheduledSvc.markSent(sm.id)
        setScheduledMsg(null)

        setMessages((prev) => {
          if (prev.find((m) => m.id === sent.id)) return prev
          return [...prev, sent]
        })
        upsertCachedMessage(userId, sent).catch(() => {})
        listRef.current?.scrollToOffset({ offset: 0, animated: true })

        Toast.show({
          type: 'success',
          text1: tr.chat_sched_sent,
          text2: sm.content.length > 40 ? sm.content.slice(0, 40) + '...' : sm.content,
          visibilityTime: 3000,
        })
      } catch (err: any) {
        const status = err?.response?.status
        if (status === 404 || status === 410) {
          // Receiver account was deleted — cancel and notify
          await scheduledSvc.markCancelled(sm.id, 'user_deleted')
          setScheduledMsg(null)
          Toast.show({
            type: 'error',
            text1: tr.chat_sched_cancelled,
            text2: tr.chat_deleted_acc_msg2,
            visibilityTime: 4000,
          })
        }
      }
    }
  }, [userId])

  // Check on screen focus + load scheduled state
  useFocusEffect(useCallback(() => {
    checkAndSendDue()
    loadScheduled()
    scheduledSvc.cleanup().catch(() => {})
  }, [checkAndSendDue, loadScheduled]))

  // Check every 30 seconds while screen is open + on app foreground
  useEffect(() => {
    const interval = setInterval(checkAndSendDue, 30_000)
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') checkAndSendDue()
    })
    return () => {
      clearInterval(interval)
      sub.remove()
    }
  }, [checkAndSendDue])

  // ── Pairing — persistent relationship tag, needs the other side to accept ──
  function handleInvitePairing() {
    setCustomizingPairing(false)
    setCustomPairingLabel('')
    setPairingPickerOpen(true)
  }

  async function handleSelectPairingType(type: PairingType, customLabel?: string) {
    setPairingPickerOpen(false)
    try {
      const p = await pairingService.invitePairing(userId, type, customLabel)
      setPairing(p)
    } catch (e: any) {
      Alert.alert('Não foi possível', e.message ?? 'Tenta novamente.')
    }
  }

  async function handleAcceptPairing() {
    if (!pairing) return
    try {
      const p = await pairingService.respondPairing(pairing.id, true)
      setPairing(p)
    } catch (e: any) {
      Alert.alert('Não foi possível', e.message ?? 'Tenta novamente.')
    }
  }

  async function handleDeclinePairing() {
    if (!pairing) return
    try {
      await pairingService.respondPairing(pairing.id, false)
      setPairing(null)
    } catch (e: any) {
      Alert.alert('Não foi possível', e.message ?? 'Tenta novamente.')
    }
  }

  function handleEndPairing() {
    if (!pairing) return
    const isPending = pairing.status === 'PENDING'
    Alert.alert(
      isPending ? 'Cancelar convite?' : 'Desfazer par?',
      isPending ? 'O convite deixa de estar pendente.' : 'Isto termina o vínculo entre vocês.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: isPending ? 'Cancelar convite' : 'Desfazer', style: 'destructive',
          onPress: async () => {
            try {
              await pairingService.endPairing(pairing.id)
              setPairing(null)
            } catch (e: any) {
              Alert.alert('Não foi possível', e.message ?? 'Tenta novamente.')
            }
          },
        },
      ],
    )
  }

  // ── Send: optimistic → API → confirm ──────────────────────────────────────
  async function handleSendFile(fileUri: string, mimeType: string, fileName: string) {
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
    listRef.current?.scrollToOffset({ offset: 0, animated: true })

    try {
      const sent = await msgService.sendMessage(userId, isImage ? undefined : fileName, fileUri, undefined, mimeType, fileName)
      setMessages((prev) => prev.map((m) => m.id === tempId ? sent : m))
      await replacePendingMessage(tempId, sent, userId).catch(() => {})
    } catch (err: any) {
      setMessages((prev) => prev.map((m) =>
        m.id === tempId ? { ...m, _pending: false, _failed: true } : m,
      ))
      if (err?.response?.status === 404 || err?.response?.status === 410) {
        Toast.show({ type: 'error', text1: tr.chat_deleted_acc, text2: tr.chat_deleted_acc_msg, visibilityTime: 3500 })
      }
    }
  }

  async function handleSendAudio(uri: string, durationMs: number) {
    const tempId   = `pending-audio-${Date.now()}`
    const fileName = `audio_${Date.now()}.m4a`

    const optimistic: LocalMessage = {
      id:         tempId,
      senderId:   user!.id,
      receiverId: userId,
      content:    fileName,
      mediaUrl:   uri,   // local URI — lets AudioPlayer play immediately
      readAt:     null,
      replyToId:  null,
      createdAt:  new Date().toISOString(),
      sender:   { id: user!.id, name: user!.name ?? '', avatar: user!.avatar ?? null },
      receiver: { id: userId, name: userName, avatar: userAvatar ?? null },
      replyTo:  null,
      _pending: true,
    }

    setMessages((prev) => [...prev, optimistic])
    upsertCachedMessage(userId, optimistic as unknown as Message).catch(() => {})
    pushToInbox(tempId, '🎤 Áudio', optimistic.createdAt)
    listRef.current?.scrollToOffset({ offset: 0, animated: true })

    try {
      const sent = await msgService.sendMessage(userId, fileName, uri, undefined, 'audio/m4a', fileName)
      // Prefer server mediaUrl (Cloudinary) but fall back to local URI if server didn't return one
      const finalMediaUrl = sent.mediaUrl ?? uri
      setMessages((prev) => prev.map((m) =>
        m.id === tempId ? { ...sent, mediaUrl: finalMediaUrl, receiver: optimistic.receiver } : m,
      ))
      await replacePendingMessage(tempId, { ...sent, mediaUrl: finalMediaUrl }, userId).catch(() => {})
    } catch {
      setMessages((prev) => prev.map((m) =>
        m.id === tempId ? { ...m, _pending: false, _failed: true } : m,
      ))
    }
  }

  async function handleDeleteMessage(messageId: string) {
    try {
      await msgService.deleteMessage(messageId)
      setMessages((prev) => prev.filter((m) => m.id !== messageId))
    } catch {
      Toast.show({ type: 'error', text1: 'Falha ao excluir mensagem', visibilityTime: 2500 })
    }
  }

  function handleMessageLongPress(msg: Message) {
    Keyboard.dismiss()   // fecha o teclado do input antes do menu (evita conflito de foco)
    setContextMenuMsg(msg)
  }

  // O agendador é um Modal com KeyboardAvoidingView — abri-lo com o teclado do
  // chat ainda ativo faz os dois lutarem e a tela piscar. Fecha o teclado antes.
  function openScheduler() {
    Keyboard.dismiss()
    setShowScheduler(true)
  }

  async function handleSend() {
    // Edit mode: update existing message instead of sending a new one
    if (editingMsg) {
      const content = text.trim()
      if (!content) return
      const msgId = editingMsg.id
      setEditingMsg(null)
      setText('')
      try {
        const updated = await msgService.editMessage(msgId, content)
        setMessages((prev) => prev.map((m) => m.id === msgId ? { ...m, content: updated.content } : m))
      } catch {
        Toast.show({ type: 'error', text1: 'Falha ao editar mensagem', visibilityTime: 2500 })
      }
      return
    }

    const content = text.trim()
    if (!content) return

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
    listRef.current?.scrollToOffset({ offset: 0, animated: true })

    try {
      const sent = await msgService.sendMessage(userId, content, undefined, replyToId)
      setMessages((prev) => prev.map((m) => m.id === tempId ? sent : m))
      await replacePendingMessage(tempId, sent, userId).catch(() => {})
    } catch (err: any) {
      setMessages((prev) => prev.map((m) =>
        m.id === tempId ? { ...m, _pending: false, _failed: true } : m,
      ))
      upsertCachedMessage(userId, { ...optimistic, _pending: false, _failed: true } as unknown as Message).catch(() => {})
      if (err?.response?.status === 404 || err?.response?.status === 410) {
        Toast.show({ type: 'error', text1: tr.chat_deleted_acc, text2: tr.chat_deleted_acc_msg, visibilityTime: 3500 })
      }
    }
  }

  async function handleReact(emoji: string) {
    if (!emojiTargetMsg) return
    const messageId = emojiTargetMsg.id
    setEmojiTargetMsg(null)
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
    <View style={[t.screen, { paddingTop: top }]}>
      <Animated.View style={{ flex: 1, paddingBottom: kbAnim }}>
        <ChatHeader
          userName={userName}
          avatarUri={userAvatar ?? null}
          hasPosts={partnerHasPosts}
          isOnline={isOnline}
          isTyping={isTyping}
          onBack={() => nav.goBack()}
          onSchedule={openScheduler}
          onProfilePress={() => nav.navigate('Profile', { userId })}
          hasScheduled={!!scheduledMsg}
          pairing={pairing}
          myUserId={user?.id ?? ''}
          onInvitePairing={handleInvitePairing}
          onAcceptPairing={handleAcceptPairing}
          onDeclinePairing={handleDeclinePairing}
          onEndPairing={handleEndPairing}
        />

        {/* ── Pairing banner — active relationship tag ────────────────────── */}
        {pairing?.status === 'ACTIVE' && (
          <View style={t.pairingBanner}>
            <View style={t.pairingBannerDot} />
            <Text style={t.pairingBannerTxt} numberOfLines={1}>
              {userName.split(' ')[0]} e {user?.name?.split(' ')[0] ?? 'tu'} são {pairingService.pairingLabel(pairing)}
            </Text>
            <TouchableOpacity onPress={handleEndPairing} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Text style={t.pairingBannerAction}>Desfazer</Text>
            </TouchableOpacity>
          </View>
        )}

        <View style={t.wallpaper}>
          <FlatList
            ref={listRef}
            data={[...items].reverse()}
            keyExtractor={(item) => item.kind === 'msg' ? item.msg.id : item.key}
            style={t.list}
            contentContainerStyle={t.listContent}
            showsVerticalScrollIndicator={false}
            inverted
            onEndReached={loadMoreMessages}
            onEndReachedThreshold={0.3}
            ListFooterComponent={loadingMore ? (
              <ActivityIndicator size="small" color="#999" style={{ paddingVertical: 14 }} />
            ) : null}
            renderItem={({ item }) =>
              item.kind === 'date'
                ? <DateSep label={item.label} />
                : <MessageBubble
                    msg={item.msg}
                    mine={item.mine}
                    isFirst={item.isFirst}
                    isLast={item.isLast}
                    myUserId={user?.id ?? ''}
                    partnerAvatar={userAvatar ?? null}
                    partnerName={userName}
                    myAvatar={user?.avatar ?? null}
                    myName={user?.name ?? ''}
                    onLongPress={handleMessageLongPress}
                    onReply={setReplyingTo}
                  />
            }
          />

          {isTyping && <TypingBubble />}
        </View>

        {editingMsg && (
          <View style={t.editBanner}>
            <Ionicons name="pencil-outline" size={14} color={colors.primary} />
            <Text style={t.editBannerText} numberOfLines={1}>
              Editando: {editingMsg.content}
            </Text>
            <TouchableOpacity
              onPress={() => { setEditingMsg(null); setText('') }}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="close" size={16} color={colors.gray400} />
            </TouchableOpacity>
          </View>
        )}

        <ChatInputBar
          value={text}
          onChange={handleTextChange}
          onSend={handleSend}
          onSendFile={handleSendFile}
          onSendAudio={handleSendAudio}
          otherUserId={userId}
          replyingTo={replyingTo ? {
            senderName: replyingTo.sender.name,
            content: replyingTo.content,
          } : null}
          onCancelReply={() => setReplyingTo(null)}
          onSchedulePress={openScheduler}
          bottomInset={bottom}
        />

        {/* Context menu (long-press) */}
        {contextMenuMsg && (
          <Modal transparent animationType="fade" visible onRequestClose={() => setContextMenuMsg(null)}>
            <Pressable style={t.emojiOverlay} onPress={() => setContextMenuMsg(null)}>
              <View style={t.ctxMenu}>
                <TouchableOpacity style={t.ctxItem} onPress={() => {
                  setEmojiTargetMsg(contextMenuMsg)
                  setContextMenuMsg(null)
                }}>
                  <Ionicons name="happy-outline" size={20} color={colors.gray600} />
                  <Text style={t.ctxLabel}>Reagir</Text>
                </TouchableOpacity>

                <TouchableOpacity style={t.ctxItem} onPress={() => {
                  setReplyingTo(contextMenuMsg)
                  setContextMenuMsg(null)
                }}>
                  <Ionicons name="arrow-undo-outline" size={20} color={colors.gray600} />
                  <Text style={t.ctxLabel}>Responder</Text>
                </TouchableOpacity>

                {contextMenuMsg.senderId === user?.id && contextMenuMsg.content && (
                  <TouchableOpacity style={t.ctxItem} onPress={() => {
                    setEditingMsg(contextMenuMsg)
                    setText(contextMenuMsg.content ?? '')
                    setContextMenuMsg(null)
                  }}>
                    <Ionicons name="pencil-outline" size={20} color={colors.gray600} />
                    <Text style={t.ctxLabel}>Editar</Text>
                  </TouchableOpacity>
                )}

                {contextMenuMsg.senderId === user?.id && (
                  <TouchableOpacity style={[t.ctxItem, t.ctxItemDanger]} onPress={() => {
                    handleDeleteMessage(contextMenuMsg.id)
                    setContextMenuMsg(null)
                  }}>
                    <Ionicons name="trash-outline" size={20} color="#FF3B30" />
                    <Text style={[t.ctxLabel, t.ctxLabelDanger]}>Excluir</Text>
                  </TouchableOpacity>
                )}
              </View>
            </Pressable>
          </Modal>
        )}

        {/* Emoji reaction picker */}
        {emojiTargetMsg && (
          <Modal transparent animationType="fade" visible onRequestClose={() => setEmojiTargetMsg(null)}>
            <EmojiPicker onPick={handleReact} onClose={() => setEmojiTargetMsg(null)} />
          </Modal>
        )}

        <ScheduleMessageModal
          visible={showScheduler}
          receiverName={userName.split(' ')[0]}
          existingMessage={scheduledMsg}
          onClose={() => setShowScheduler(false)}
          onSchedule={handleScheduleMessage}
          onCancelScheduled={handleCancelScheduled}
        />

        <Modal
          visible={pairingPickerOpen}
          transparent
          animationType="fade"
          onRequestClose={() => setPairingPickerOpen(false)}
        >
          <Pressable style={t.pickerOverlay} onPress={() => setPairingPickerOpen(false)}>
            <Pressable style={t.pickerCard} onPress={() => {}}>
              <Text style={t.pickerTitle}>Formar par com {userName.split(' ')[0]}</Text>
              <Text style={t.pickerSub}>{userName.split(' ')[0]} vai precisar de aceitar o convite.</Text>

              {PAIRING_TYPE_OPTIONS.map((opt) => (
                <TouchableOpacity
                  key={opt.type}
                  style={t.pickerOption}
                  onPress={() => opt.type === 'OUTRO' ? setCustomizingPairing(true) : handleSelectPairingType(opt.type)}
                >
                  <Text style={t.pickerOptionEmoji}>{opt.emoji}</Text>
                  <Text style={t.pickerOptionTxt}>{opt.label}</Text>
                </TouchableOpacity>
              ))}

              {customizingPairing && (
                <View style={t.pickerCustomRow}>
                  <TextInput
                    style={t.pickerCustomInput}
                    placeholder="Escreve o vínculo..."
                    placeholderTextColor={colors.gray400}
                    value={customPairingLabel}
                    onChangeText={setCustomPairingLabel}
                    maxLength={24}
                    autoFocus
                  />
                  <TouchableOpacity
                    disabled={!customPairingLabel.trim()}
                    onPress={() => handleSelectPairingType('OUTRO', customPairingLabel.trim())}
                  >
                    <Text style={[t.pickerCustomSend, !customPairingLabel.trim() && { opacity: 0.35 }]}>Enviar</Text>
                  </TouchableOpacity>
                </View>
              )}
            </Pressable>
          </Pressable>
        </Modal>
      </Animated.View>

    </View>
  )
}

// ── Styles ─────────────────────────────────────────────────────────────────────
const R = 18   // base border radius

const t = StyleSheet.create({
  screen:      { flex: 1, backgroundColor: CHAT_BG },
  wallpaper:   { flex: 1, backgroundColor: CHAT_BG },
  list:        { flex: 1, backgroundColor: 'transparent' },
  listContent: { paddingHorizontal: 12, paddingTop: 12, paddingBottom: 16 },

  // ── Row: must be flex:1 so maxWidth on bubbleOuter works against full width ──
  row:        { flex: 1, flexDirection: 'row', marginBottom: 4, alignItems: 'flex-end' },
  rowRight:   { justifyContent: 'flex-end' },
  rowLeft:    { justifyContent: 'flex-start' },
  rowCompact: { marginBottom: 1 },

  // ── Message avatar (always visible beside every bubble) ──────────────────
  msgAvatarWrap: {
    width: 24,
    height: 24,
    borderRadius: 12,
    overflow: 'hidden',
    flexShrink: 0,
    marginHorizontal: 4,
  },

  // ── Outer wrapper — constrain to 80% of screen width (fixes vertical text) ──
  bubbleOuter:      { maxWidth: '80%' },
  bubbleOuterMine:  { alignItems: 'flex-end' },
  bubbleOuterTheirs:{ alignItems: 'flex-start' },

  // ── Bubble ────────────────────────────────────────────────────────────────
  bubble: {
    borderRadius: R,
    paddingHorizontal: 13,
    paddingTop: 9,
    paddingBottom: 7,
  },
  bubbleMine: {
    backgroundColor: MINE_COLOR,
    ...Platform.select({
      ios:     { shadowColor: MINE_COLOR, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.28, shadowRadius: 6 },
      android: { elevation: 2 },
    }),
  },
  bubbleTheirs: {
    backgroundColor: THEIRS_COLOR,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(0,0,0,0.07)',
    ...Platform.select({
      ios:     { shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.08, shadowRadius: 4 },
      android: { elevation: 1 },
    }),
  },

  // Tail corners: flatten one corner to hint at message direction
  bubbleMineFirst:   { borderTopRightRadius: 4 },
  bubbleMineLast:    { borderBottomRightRadius: 4 },
  bubbleTheirsFirst: { borderTopLeftRadius: 4 },
  bubbleTheirsLast:  { borderBottomLeftRadius: 4 },
  bubblePending:     { opacity: 0.55 },

  mediaBubble: { width: 220, height: 220, borderRadius: R - 4, marginBottom: 5 },

  // ── Audio player ─────────────────────────────────────────────────────────
  audio: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingVertical: 2, minWidth: 210,
  },
  audioBtn: {
    width: 36, height: 36, borderRadius: 18,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  waveform: {
    flex: 1,
    height: WAVE_H,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 1.5,
  },
  audioTime: { fontSize: 12, fontFamily: fonts.medium, minWidth: 36, textAlign: 'right' },

  // ── Text ─────────────────────────────────────────────────────────────────
  msgText:   {
    fontSize: 15,
    lineHeight: 22,
    fontFamily: fonts.regular,
    flexShrink: 1,   // ensures text wraps horizontally, never collapses
  },
  msgMine:   { color: '#FFFFFF' },
  msgTheirs: { color: '#1A1A1A' },

  // ── Meta row (time + tick) ────────────────────────────────────────────────
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 3,
    marginTop: 3,
  },
  metaRowMine:   {},
  metaRowTheirs: {},
  time:       { fontSize: 10, fontFamily: fonts.regular },
  timeMine:   { color: 'rgba(255,255,255,0.6)' },
  timeTheirs: { color: 'rgba(0,0,0,0.35)' },

  // ── Reply quote ───────────────────────────────────────────────────────────
  replyQuote: {
    borderLeftWidth: 3, paddingLeft: 8, paddingVertical: 3,
    marginBottom: 7, borderRadius: 4,
  },
  replyQuoteMine:      { borderLeftColor: 'rgba(255,255,255,0.7)', backgroundColor: 'rgba(255,255,255,0.12)' },
  replyQuoteTheirs:    { borderLeftColor: colors.primary,          backgroundColor: `${colors.primary}0F` },
  replyQuoteName:      { fontSize: 11, fontFamily: fonts.semiBold, color: colors.primary, marginBottom: 1 },
  replyQuoteNameMine:  { color: 'rgba(255,255,255,0.85)' },
  replyQuoteText:      { fontSize: 12, fontFamily: fonts.regular, color: 'rgba(0,0,0,0.4)' },
  replyQuoteTextMine:  { color: 'rgba(255,255,255,0.65)' },

  // ── Reactions ─────────────────────────────────────────────────────────────
  reactStrip: {
    flexDirection: 'row', alignItems: 'center', gap: 2,
    marginTop: 3, paddingHorizontal: 8, paddingVertical: 3,
    backgroundColor: colors.white, borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth, borderColor: colors.gray200,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.08, shadowRadius: 3 },
      android: { elevation: 1 },
    }),
  },
  reactStripRight: { alignSelf: 'flex-end' },
  reactStripLeft:  { alignSelf: 'flex-start' },
  reactEmoji:      { fontSize: 13 },
  reactCount:      { fontSize: 11, color: colors.gray600, fontFamily: fonts.semiBold },

  // ── Emoji picker ──────────────────────────────────────────────────────────
  emojiOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center' },
  emojiRow: {
    flexDirection: 'row', gap: 2, backgroundColor: colors.white,
    borderRadius: 48, paddingHorizontal: 12, paddingVertical: 10,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 12 },
      android: { elevation: 8 },
    }),
  },
  emojiBtn:  { padding: 8 },
  emojiText: { fontSize: 26 },

  // ── Date separator ────────────────────────────────────────────────────────
  dateSepWrap: { justifyContent: 'center', alignItems: 'center', marginVertical: 14 },
  dateLine:    { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: 'rgba(0,0,0,0.08)' },
  dateSepTxt:  {
    fontSize: 12, color: '#ABABAB', fontFamily: fonts.medium,
    backgroundColor: '#F2F2F7', paddingHorizontal: 12, paddingVertical: 4,
    borderRadius: 10,
  },

  // ── Edit banner ───────────────────────────────────────────────────────────
  editBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: `${colors.primary}0D`,
    paddingHorizontal: 14, paddingVertical: 8,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: `${colors.primary}30`,
  },
  editBannerText: { flex: 1, fontSize: 13, fontFamily: fonts.regular, color: colors.gray600 },

  // ── Context menu ──────────────────────────────────────────────────────────
  ctxMenu: {
    backgroundColor: colors.white,
    borderRadius: 16,
    minWidth: 200,
    overflow: 'hidden',
    ...Platform.select({
      ios:     { shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.18, shadowRadius: 16 },
      android: { elevation: 10 },
    }),
  },
  ctxItem: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    paddingHorizontal: 20, paddingVertical: 15,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.gray100,
  },
  ctxItemDanger: { borderBottomWidth: 0 },
  ctxLabel:      { fontSize: 15, fontFamily: fonts.medium, color: colors.gray800 },
  ctxLabelDanger:{ color: '#FF3B30' },

  // ── Typing dots ───────────────────────────────────────────────────────────
  typingWrap:   { paddingHorizontal: 12, paddingBottom: 4 },
  typingBubble: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: THEIRS_COLOR,
    alignSelf: 'flex-start',
    paddingHorizontal: 16, paddingVertical: 12,
    borderRadius: R, borderTopLeftRadius: 4,
    borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(0,0,0,0.07)',
  },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.gray400 },

  // ── Pairing banner ────────────────────────────────────────────────────────
  pairingBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(0,0,0,0.08)',
  },
  pairingBannerDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.primary },
  pairingBannerTxt: {
    flex: 1,
    fontSize: 12.5,
    fontFamily: fonts.semiBold,
    color: colors.gray800,
    letterSpacing: 0.1,
  },
  pairingBannerAction: {
    fontSize: 12,
    fontFamily: fonts.semiBold,
    color: colors.gray400,
    textDecorationLine: 'underline',
  },

  // ── Pairing type picker ───────────────────────────────────────────────────
  pickerOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center', alignItems: 'center', padding: 24,
  },
  pickerCard: {
    width: '100%', maxWidth: 360,
    backgroundColor: colors.white, borderRadius: 24,
    padding: 20, gap: 4,
  },
  pickerTitle: { fontSize: 16, fontFamily: fonts.semiBold, color: colors.gray800, letterSpacing: -0.2 },
  pickerSub:   { fontSize: 12.5, fontFamily: fonts.regular, color: colors.gray400, marginBottom: 10 },
  pickerOption: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 12, paddingHorizontal: 10,
    borderRadius: 14,
  },
  pickerOptionEmoji: { fontSize: 20, width: 26, textAlign: 'center' },
  pickerOptionTxt:   { fontSize: 14.5, fontFamily: fonts.medium, color: colors.gray800 },
  pickerCustomRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    marginTop: 6, paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.gray200,
  },
  pickerCustomInput: {
    flex: 1, fontSize: 14, fontFamily: fonts.regular, color: colors.gray800,
    borderWidth: 1.3, borderColor: '#0A0A0A', borderRadius: 14,
    paddingHorizontal: 14, paddingVertical: 9,
  },
  pickerCustomSend: { fontSize: 14, fontFamily: fonts.semiBold, color: '#0A0A0A' },
})
