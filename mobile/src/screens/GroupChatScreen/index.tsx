import React, { useEffect, useState, useRef } from 'react'
import {
  View, Text, FlatList, TextInput, TouchableOpacity,
  KeyboardAvoidingView, Platform, StyleSheet, ActivityIndicator,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native'
import { Ionicons } from '@expo/vector-icons'
import {
  getGroupMessages, sendGroupMessage, GroupMessage,
} from '../../services/group.service'
import { getSocket } from '../../socket'
import { useAuthStore } from '../../store/auth.store'
import { AppStackParams } from '../../navigation/AppNavigator'
import { colors, fonts, spacing, radius } from '../../theme'
import AvatarImage from '../../components/AvatarImage'
import GroupSettingsSheet from './GroupSettingsSheet'
import { getCache, setCache } from '../../db/database'
import { isConnected } from '../../services/netinfo.service'

type Route = RouteProp<AppStackParams, 'GroupChat'>

function timeLabel(date: string) {
  return new Date(date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

type LocalMessage = GroupMessage & { _pending?: boolean; _failed?: boolean }

// ── Reply quote displayed inside a bubble ──────────────────────────────────────
function ReplyQuote({ msg, mine }: { msg: GroupMessage['replyTo']; mine: boolean }) {
  if (!msg) return null
  return (
    <View style={[rq.wrap, mine ? rq.wrapMine : rq.wrapTheirs]}>
      <Text style={[rq.name, mine && rq.nameMine]}>{msg.sender.name}</Text>
      <Text style={[rq.text, mine && rq.textMine]} numberOfLines={1}>
        {msg.content ?? '…'}
      </Text>
    </View>
  )
}

const rq = StyleSheet.create({
  wrap:      { borderLeftWidth: 3, paddingLeft: 8, paddingVertical: 3, marginBottom: 6, borderRadius: 4 },
  wrapMine:  { borderLeftColor: 'rgba(255,255,255,0.6)', backgroundColor: 'rgba(255,255,255,0.12)' },
  wrapTheirs:{ borderLeftColor: colors.primary, backgroundColor: `${colors.primary}10` },
  name:      { fontSize: 11, fontFamily: fonts.semiBold, color: colors.primary, marginBottom: 1 },
  nameMine:  { color: 'rgba(255,255,255,0.85)' },
  text:      { fontSize: 12, fontFamily: fonts.regular, color: colors.gray600 },
  textMine:  { color: 'rgba(255,255,255,0.7)' },
})

// ── Main screen ────────────────────────────────────────────────────────────────
export default function GroupChatScreen() {
  const nav   = useNavigation()
  const route = useRoute<Route>()
  const { groupId, groupName, groupAvatar } = route.params
  const { user }        = useAuthStore()
  const { top, bottom } = useSafeAreaInsets()

  const [messages,     setMessages]     = useState<LocalMessage[]>([])
  const [text,         setText]         = useState('')
  const [loading,      setLoading]      = useState(true)
  const [showSettings, setShowSettings] = useState(false)
  const [currentName,  setCurrentName]  = useState(groupName)
  const [currentAvatar,setCurrentAvatar]= useState<string | null>(groupAvatar ?? null)
  const [replyingTo,   setReplyingTo]   = useState<LocalMessage | null>(null)
  const listRef  = useRef<FlatList>(null)
  const inputRef = useRef<TextInput>(null)

  const cacheKey = `group_messages:${groupId}`

  // ── Load: cache first → API ─────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false
    async function load() {
      const cached = await getCache<LocalMessage[]>(cacheKey).catch(() => null)
      if (cached?.length && !cancelled) {
        setMessages(cached)
        setLoading(false)
        setTimeout(() => listRef.current?.scrollToEnd({ animated: false }), 50)
      }
      if (!isConnected()) { setLoading(false); return }
      try {
        const fresh = await getGroupMessages(groupId)
        const sorted = [...fresh].reverse()
        if (!cancelled) {
          setMessages(sorted)
          setLoading(false)
          setCache(cacheKey, sorted).catch(() => {})
          setTimeout(() => listRef.current?.scrollToEnd({ animated: false }), 80)
        }
      } catch { if (!cancelled) setLoading(false) }
    }
    load()
    return () => { cancelled = true }
  }, [groupId])

  // ── Socket ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    const socket = getSocket()
    if (!socket) return

    socket.emit('group:join', { groupId })

    function onMessage({ groupId: gId, message }: { groupId: string; message: GroupMessage }) {
      if (gId !== groupId) return
      if (message.senderId === user?.id) return
      setMessages((prev) => {
        if (prev.find((m) => m.id === message.id)) return prev
        const next = [...prev, message]
        setCache(cacheKey, next).catch(() => {})
        return next
      })
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 80)
    }

    socket.on('group:message:new', onMessage)
    return () => {
      socket.off('group:message:new', onMessage)
      socket.emit('group:leave', { groupId })
    }
  }, [groupId])

  // ── Send ────────────────────────────────────────────────────────────────────
  async function handleSend() {
    const t = text.trim()
    if (!t) return
    const replying = replyingTo

    setText('')
    setReplyingTo(null)

    const tempId = `pending-${Date.now()}`
    const optimistic: LocalMessage = {
      id: tempId, groupId, senderId: user!.id, content: t,
      replyToId: replying?.id ?? null,
      replyTo: replying ? {
        id: replying.id,
        content: replying.content,
        sender: replying.sender,
      } : null,
      createdAt: new Date().toISOString(),
      sender: { id: user!.id, name: user!.name, avatar: user!.avatar ?? null },
      _pending: true,
    }

    setMessages((prev) => [...prev, optimistic])
    setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 60)

    try {
      const msg = await sendGroupMessage(groupId, t, replying?.id)
      setMessages((prev) => {
        const next = prev.map((m) => m.id === tempId ? msg : m)
        setCache(cacheKey, next).catch(() => {})
        return next
      })
    } catch {
      setMessages((prev) => prev.map((m) => m.id === tempId ? { ...m, _pending: false, _failed: true } : m))
    }
  }

  function startReply(msg: LocalMessage) {
    setReplyingTo(msg)
    inputRef.current?.focus()
  }

  const isMine = (msg: LocalMessage) => msg.senderId === user?.id

  return (
    <KeyboardAvoidingView
      style={[s.container, { paddingTop: top }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 24}
    >
      {/* ── Header ── */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => nav.goBack()} style={s.backBtn}>
          <Ionicons name="chevron-back" size={26} color={colors.gray800} />
        </TouchableOpacity>
        {currentAvatar
          ? <AvatarImage uri={currentAvatar} size={38} />
          : (
            <View style={s.groupIcon}>
              <Ionicons name="people" size={18} color={colors.gray400} />
            </View>
          )
        }
        <View style={s.headerInfo}>
          <Text style={s.headerName} numberOfLines={1}>{currentName}</Text>
        </View>
        <TouchableOpacity
          onPress={() => setShowSettings(true)}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="ellipsis-vertical" size={22} color={colors.gray800} />
        </TouchableOpacity>
      </View>

      {/* ── Messages ── */}
      {loading && messages.length === 0 ? (
        <View style={s.center}><ActivityIndicator color={colors.primary} /></View>
      ) : (
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(m) => m.id}
          contentContainerStyle={s.list}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
          renderItem={({ item }) => {
            const mine = isMine(item)
            return (
              <View style={[s.msgRow, mine ? s.msgRowMine : s.msgRowTheirs]}>
                {!mine && <AvatarImage uri={item.sender?.avatar ?? null} size={30} />}

                <View style={[s.bubble, mine ? s.bubbleMine : s.bubbleTheirs, item._pending && s.bubblePending]}>

                  {/* Sender name (group messages) */}
                  {!mine && (
                    <Text style={s.senderName}>{item.sender?.name ?? '…'}</Text>
                  )}

                  {/* Inline reply quote */}
                  {item.replyTo && <ReplyQuote msg={item.replyTo} mine={mine} />}

                  {/* Content */}
                  <Text style={[s.bubbleText, mine ? s.textMine : s.textTheirs]}>
                    {item.content}
                  </Text>

                  {/* Meta: time + status */}
                  <View style={s.metaRow}>
                    <Text style={[s.msgTime, mine && s.msgTimeMine]}>{timeLabel(item.createdAt)}</Text>
                    {mine && (
                      item._failed
                        ? <Ionicons name="alert-circle"  size={11} color="#FF6B6B" />
                        : item._pending
                          ? <Ionicons name="checkmark"     size={12} color="rgba(255,255,255,0.4)" />
                          : <Ionicons name="checkmark-done" size={12} color="rgba(255,255,255,0.6)" />
                    )}
                  </View>
                </View>

                {/* Reply button — visible on both sides */}
                <TouchableOpacity
                  style={[s.replyBtn, mine ? s.replyBtnMine : s.replyBtnTheirs]}
                  onPress={() => startReply(item)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Ionicons name="arrow-undo-outline" size={14} color={colors.gray400} />
                </TouchableOpacity>
              </View>
            )
          }}
        />
      )}

      {/* ── Reply preview bar ── */}
      {replyingTo && (
        <View style={s.replyBar}>
          <View style={s.replyBarLine} />
          <View style={s.replyBarContent}>
            <Text style={s.replyBarName}>{replyingTo.sender.name}</Text>
            <Text style={s.replyBarText} numberOfLines={1}>{replyingTo.content ?? '…'}</Text>
          </View>
          <TouchableOpacity onPress={() => setReplyingTo(null)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="close" size={18} color={colors.gray400} />
          </TouchableOpacity>
        </View>
      )}

      {/* ── Settings sheet ── */}
      <GroupSettingsSheet
        visible={showSettings}
        groupId={groupId}
        currentUserId={user?.id ?? ''}
        onClose={() => setShowSettings(false)}
        onGroupDeleted={() => { setShowSettings(false); nav.goBack() }}
        onGroupUpdated={(name, avatar) => {
          setCurrentName(name)
          if (avatar !== undefined) setCurrentAvatar(avatar)
          setShowSettings(false)
        }}
      />

      {/* ── Input ── */}
      <View style={[s.inputRow, { paddingBottom: bottom + 8 }]}>
        <TextInput
          ref={inputRef}
          style={s.input}
          placeholder="Mensagem..."
          placeholderTextColor={colors.gray400}
          value={text}
          onChangeText={setText}
          multiline
          returnKeyType="send"
          onSubmitEditing={handleSend}
        />
        <TouchableOpacity style={[s.sendBtn, !text.trim() && s.sendBtnDisabled]} onPress={handleSend} activeOpacity={0.8} disabled={!text.trim()}>
          <Ionicons name="send" size={18} color={colors.white} />
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  )
}

const s = StyleSheet.create({
  container:    { flex: 1, backgroundColor: '#FFFFFF' },
  center:       { flex: 1, alignItems: 'center', justifyContent: 'center' },

  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: spacing.md, paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.gray200,
    backgroundColor: colors.white, gap: spacing.sm,
  },
  backBtn:    { width: 36 },
  groupIcon:  { width: 38, height: 38, borderRadius: 19, backgroundColor: colors.gray200, alignItems: 'center', justifyContent: 'center' },
  headerInfo: { flex: 1 },
  headerName: { color: colors.gray800, fontFamily: fonts.semiBold, fontSize: 16, letterSpacing: -0.2 },

  list:  { padding: spacing.md, gap: 4, paddingBottom: 16 },

  // Message rows
  msgRow:      { flexDirection: 'row', alignItems: 'flex-end', gap: 6, marginBottom: 4 },
  msgRowMine:  { justifyContent: 'flex-end' },
  msgRowTheirs:{ justifyContent: 'flex-start' },

  // Bubbles
  bubble:       { maxWidth: '72%', borderRadius: 18, paddingHorizontal: 12, paddingVertical: 8, gap: 3 },
  bubbleMine:   { backgroundColor: colors.primary, borderBottomRightRadius: 4 },
  bubbleTheirs: { backgroundColor: '#F0F2F5', borderBottomLeftRadius: 4 },
  bubblePending:{ opacity: 0.6 },

  senderName: { color: colors.primary, fontFamily: fonts.semiBold, fontSize: 11, marginBottom: 2 },
  bubbleText: { fontSize: 15, lineHeight: 21 },
  textMine:   { color: colors.white, fontFamily: fonts.regular },
  textTheirs: { color: colors.gray800, fontFamily: fonts.regular },

  metaRow:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 3, marginTop: 2 },
  msgTime:     { color: 'rgba(0,0,0,0.3)', fontFamily: fonts.regular, fontSize: 10 },
  msgTimeMine: { color: 'rgba(255,255,255,0.5)' },

  // Reply button on each message
  replyBtn:      { alignSelf: 'center', padding: 4, opacity: 0.6 },
  replyBtnMine:  { order: -1 } as any,
  replyBtnTheirs:{ },

  // Reply preview bar (above input)
  replyBar: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: spacing.md, paddingVertical: 10,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.gray200,
    backgroundColor: `${colors.primary}08`,
    gap: 10,
  },
  replyBarLine:   { width: 3, height: 36, borderRadius: 2, backgroundColor: colors.primary },
  replyBarContent:{ flex: 1, gap: 2 },
  replyBarName:   { fontSize: 12, fontFamily: fonts.semiBold, color: colors.primary },
  replyBarText:   { fontSize: 12, fontFamily: fonts.regular, color: colors.gray600 },

  // Input
  inputRow: {
    flexDirection: 'row', alignItems: 'flex-end',
    paddingHorizontal: spacing.md, paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.gray200,
    backgroundColor: colors.white, gap: spacing.sm,
  },
  input: {
    flex: 1, backgroundColor: colors.gray100, borderRadius: radius.full,
    paddingHorizontal: spacing.md, paddingVertical: 10,
    color: colors.gray800, fontFamily: fonts.regular, fontSize: 15,
    maxHeight: 100,
  },
  sendBtn:         { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  sendBtnDisabled: { backgroundColor: colors.gray200 },
})
