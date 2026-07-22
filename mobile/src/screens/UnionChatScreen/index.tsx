import React, { useEffect, useState, useRef, useCallback } from 'react'
import {
  View, Text, FlatList, StyleSheet, TouchableOpacity,
  TextInput, Platform, ActivityIndicator,
  Animated, Alert, Modal, Switch,
} from 'react-native'
import { KeyboardAvoidingView } from 'react-native-keyboard-controller'
import { Image } from 'expo-image'
import { Ionicons } from '@expo/vector-icons'
import { LinearGradient } from 'expo-linear-gradient'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useNavigation, useRoute, RouteProp, useFocusEffect } from '@react-navigation/native'
import { StackNavigationProp } from '@react-navigation/stack'
import { colors, fonts } from '../../theme'
import * as unionService from '../../services/union.service'
import { useUnionStore } from '../../store/union.store'
import { useAuthStore } from '../../store/auth.store'
import { getSocket } from '../../socket'
import { AppStackParams } from '../../navigation/AppNavigator'
import { Union, UnionMessage, TogetherStatus } from '../../types'
import { useT } from '../../i18n'

type Nav   = StackNavigationProp<AppStackParams>
type Route = RouteProp<AppStackParams, 'UnionChat'>

const MINE_COLOR   = '#CA2851'
const THEIRS_COLOR = '#F0F2F5'

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
}

function sameDay(a: string, b: string) {
  const da = new Date(a), db = new Date(b)
  return da.getFullYear() === db.getFullYear() && da.getMonth() === db.getMonth() && da.getDate() === db.getDate()
}

// ─── Typing Bubble ────────────────────────────────────────────────────────────
function TypingBubble() {
  const dots = [useRef(new Animated.Value(0)).current, useRef(new Animated.Value(0)).current, useRef(new Animated.Value(0)).current]
  useEffect(() => {
    const anims = dots.map((dot, i) => Animated.loop(Animated.sequence([
      Animated.delay(i * 160),
      Animated.timing(dot, { toValue: -5, duration: 260, useNativeDriver: true }),
      Animated.timing(dot, { toValue: 0,  duration: 260, useNativeDriver: true }),
      Animated.delay(320),
    ])))
    anims.forEach((a) => a.start())
    return () => anims.forEach((a) => a.stop())
  }, [])
  return (
    <View style={t.wrap}>
      {dots.map((dot, i) => (
        <Animated.View key={i} style={[t.dot, { transform: [{ translateY: dot }] }]} />
      ))}
    </View>
  )
}

// ─── Dual Avatar header ───────────────────────────────────────────────────────
function DualAvatar({ union }: { union: Union }) {
  return (
    <View style={s.dualAvatar}>
      {union.memberA.avatar
        ? <Image source={{ uri: union.memberA.avatar }} style={s.dualAvatarA} contentFit="cover" />
        : <View style={[s.dualAvatarA, s.avatarFallback]}><Ionicons name="person" size={12} color={colors.gray400} /></View>
      }
      {union.memberB.avatar
        ? <Image source={{ uri: union.memberB.avatar }} style={s.dualAvatarB} contentFit="cover" />
        : <View style={[s.dualAvatarB, s.avatarFallback]}><Ionicons name="person" size={12} color={colors.gray400} /></View>
      }
    </View>
  )
}

// ─── Message Bubble ───────────────────────────────────────────────────────────
function Bubble({ msg, isMine, showSender }: { msg: UnionMessage; isMine: boolean; showSender: boolean }) {
  const union = msg.fromUnion
  return (
    <View style={[s.bubbleWrap, isMine ? s.bubbleWrapMine : s.bubbleWrapTheirs]}>
      {!isMine && showSender && (
        <View style={s.senderRow}>
          <DualAvatar union={union as Union} />
          <Text style={s.senderName}>{union.name}</Text>
        </View>
      )}
      <View style={[s.bubble, isMine ? s.bubbleMine : s.bubbleTheirs]}>
        {msg.content ? (
          <Text style={[s.bubbleTxt, isMine ? s.bubbleTxtMine : s.bubbleTxtTheirs]}>
            {msg.content}
          </Text>
        ) : null}
        <Text style={[s.bubbleTime, isMine ? s.bubbleTimeMine : s.bubbleTimeTheirs]}>
          {formatTime(msg.createdAt)}
          {isMine && (
            <Text style={s.readMark}> {msg.readAt ? ' ✓✓' : ' ✓'}</Text>
          )}
        </Text>
      </View>
    </View>
  )
}

// ─── Overlapping avatar pair (for Modo Juntos banner) ─────────────────────────
function OverlapPair({ avatarA, avatarB, nameA, nameB }: {
  avatarA: string | null; avatarB: string | null
  nameA: string; nameB: string
}) {
  function AV({ uri, name, style }: { uri: string | null; name: string; style: object }) {
    if (uri) return <Image source={{ uri }} style={style as any} contentFit="cover" />
    return (
      <View style={[style as any, { backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' }]}>
        <Text style={{ fontFamily: fonts.bold, fontSize: 12, color: '#fff' }}>{name.charAt(0)}</Text>
      </View>
    )
  }
  return (
    <View style={{ width: 48, height: 36, position: 'relative' }}>
      <AV uri={avatarA} name={nameA} style={j.ovA} />
      <AV uri={avatarB} name={nameB} style={j.ovB} />
    </View>
  )
}

// ─── Modo Juntos banner ───────────────────────────────────────────────────────
function JuntosBanner({
  myUnion, together, myId,
  onToggleConsent, onToggleVisibility,
}: {
  myUnion: Union
  together: TogetherStatus
  myId: string
  onToggleConsent: (val: boolean) => void
  onToggleVisibility: (val: 'private' | 'public') => void
}) {
  const t = useT()
  const [open, setOpen] = useState(false)
  const iConsented     = together.memberConsents[myId] ?? false
  const otherMemberId  = myUnion.memberA.id === myId ? myUnion.memberB.id : myUnion.memberA.id
  const partnerName    = myUnion.memberA.id === myId ? myUnion.memberB.name : myUnion.memberA.name
  const partnerConsent = together.memberConsents[otherMemberId] ?? false
  const bothConsented  = iConsented && partnerConsent
  const isPublic       = together.visibility === 'public'

  return (
    <>
      {/* Banner pill */}
      <TouchableOpacity style={j.pill} onPress={() => setOpen(true)} activeOpacity={0.88}>
        <OverlapPair
          avatarA={myUnion.memberA.avatar} nameA={myUnion.memberA.name}
          avatarB={myUnion.memberB.avatar} nameB={myUnion.memberB.name}
        />
        <View style={{ flex: 1 }}>
          <Text style={j.pillTitle}>{t.un_together_now}</Text>
          <Text style={j.pillSub}>
            {bothConsented && isPublic ? t.un_visible_all_emoji : t.un_only_two_emoji}
          </Text>
        </View>
        <Ionicons name="chevron-up" size={14} color={colors.primary} />
      </TouchableOpacity>

      {/* Options modal */}
      <Modal visible={open} transparent animationType="slide">
        <TouchableOpacity style={j.overlay} activeOpacity={1} onPress={() => setOpen(false)} />
        <View style={j.sheet}>
          {/* Header */}
          <View style={j.sheetHeader}>
            <OverlapPair
              avatarA={myUnion.memberA.avatar} nameA={myUnion.memberA.name}
              avatarB={myUnion.memberB.avatar} nameB={myUnion.memberB.name}
            />
            <View style={{ flex: 1 }}>
              <Text style={j.sheetTitle}>{t.un_together_mode}</Text>
              <Text style={j.sheetSub}>{myUnion.name} {myUnion.label ? `· ${myUnion.label}` : ''}</Text>
            </View>
            <TouchableOpacity onPress={() => setOpen(false)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="close" size={20} color={colors.gray500} />
            </TouchableOpacity>
          </View>

          {/* Consent row */}
          <View style={j.row}>
            <View style={{ flex: 1 }}>
              <Text style={j.rowLabel}>{t.un_enable_me}</Text>
              <Text style={j.rowSub}>
                {partnerConsent ? `✓ ${partnerName} ${t.un_partner_enabled}` : `${t.un_wait_partner_a} ${partnerName} ${t.un_wait_partner_b}`}
              </Text>
            </View>
            <Switch
              value={iConsented}
              onValueChange={onToggleConsent}
              trackColor={{ false: colors.gray200, true: colors.primary }}
              thumbColor="#fff"
            />
          </View>

          {/* Status indicators */}
          <View style={j.statusRow}>
            <View style={[j.dot, { backgroundColor: iConsented ? colors.primary : colors.gray200 }]} />
            <Text style={j.statusTxt}>{myUnion.memberA.name}</Text>
            <View style={[j.dot, { backgroundColor: partnerConsent ? colors.primary : colors.gray200 }]} />
            <Text style={j.statusTxt}>{myUnion.memberB.name}</Text>
          </View>

          {/* Visibility (only when both consented) */}
          {bothConsented && (
            <View style={j.visRow}>
              <TouchableOpacity
                style={[j.visBtn, !isPublic && j.visBtnActive]}
                onPress={() => onToggleVisibility('private')}
                activeOpacity={0.8}
              >
                <Ionicons name="lock-closed" size={16} color={!isPublic ? '#fff' : colors.gray500} />
                <Text style={[j.visBtnTxt, !isPublic && j.visBtnTxtActive]}>{t.un_only_us}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[j.visBtn, isPublic && j.visBtnActive, { backgroundColor: isPublic ? colors.primary : undefined }]}
                onPress={() => onToggleVisibility('public')}
                activeOpacity={0.8}
              >
                <Ionicons name="earth" size={16} color={isPublic ? '#fff' : colors.gray500} />
                <Text style={[j.visBtnTxt, isPublic && j.visBtnTxtActive]}>{t.un_visible_all}</Text>
              </TouchableOpacity>
            </View>
          )}

          {!bothConsented && (
            <Text style={j.hint}>{t.un_both_enable_hint}</Text>
          )}
        </View>
      </Modal>
    </>
  )
}

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function UnionChatScreen() {
  const nav    = useNavigation<Nav>()
  const route  = useRoute<Route>()
  const insets = useSafeAreaInsets()
  const t      = useT()
  const me     = useAuthStore((s) => s.user)
  const { myUnions, clearUnread } = useUnionStore()

  const [messages,       setMessages]       = useState<UnionMessage[]>([])
  const [loading,        setLoading]        = useState(true)
  const [loadingMore,    setLoadingMore]    = useState(false)
  const [hasMore,        setHasMore]        = useState(true)
  const [text,           setText]           = useState('')
  const [sending,        setSending]        = useState(false)
  const [isTyping,       setIsTyping]       = useState(false)
  const [otherUnion,     setOtherUnion]     = useState<Union | null>(null)
  const [togetherStatus, setTogetherStatus] = useState<TogetherStatus | null>(null)

  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const listRef     = useRef<FlatList>(null)

  // Find MY union for this chat (the one I'm a member of that's chatting with the other)
  const myUnion = myUnions.find((u) => u.id === route.params.unionId) ?? null

  // ─── Load messages ─────────────────────────────────────────────────────────
  const loadMessages = useCallback(async (before?: string) => {
    if (!myUnion || !route.params.otherUnionId) return
    try {
      const msgs = await unionService.getUnionMessages(myUnion.id, route.params.otherUnionId, before)
      if (!before) {
        setMessages(msgs)
        setHasMore(msgs.length === 30)
        // Load other union info from the first message
        if (msgs.length > 0) {
          const other = msgs[0].fromUnionId === myUnion.id
            ? null // need to fetch
            : msgs[0].fromUnion as Union
          if (other) setOtherUnion(other)
        }
      } else {
        setMessages((prev) => [...prev, ...msgs])
        setHasMore(msgs.length === 30)
      }
    } catch {}
  }, [myUnion, route.params.otherUnionId])

  useEffect(() => {
    const init = async () => {
      setLoading(true)
      await loadMessages()
      setLoading(false)
      // Mark read
      if (myUnion && route.params.otherUnionId) {
        unionService.markUnionRead(route.params.otherUnionId, myUnion.id).catch(() => {})
        clearUnread(`${route.params.otherUnionId}|${myUnion.id}`)
      }
    }
    init()
  }, [])

  // ─── Socket ────────────────────────────────────────────────────────────────
  useFocusEffect(useCallback(() => {
    const socket = getSocket()
    if (!socket || !myUnion) return

    // Enter / leave together presence
    socket.emit('union:chat:enter', { unionId: myUnion.id })

    const onNewMsg = ({ message }: { message: UnionMessage }) => {
      if (message.toUnionId !== myUnion.id) return
      setMessages((prev) => [message, ...prev])
      unionService.markUnionRead(message.fromUnionId, myUnion.id).catch(() => {})
      socket.emit('union:message:read', { fromUnionId: message.fromUnionId, toUnionId: myUnion.id })
    }

    const onTyping = ({ fromUnionId, isTyping: t }: { fromUnionId: string; isTyping: boolean }) => {
      if (fromUnionId === route.params.otherUnionId) setIsTyping(t)
    }

    const onRead = () => {
      setMessages((prev) => prev.map((m) => m.fromUnionId === myUnion.id && !m.readAt
        ? { ...m, readAt: new Date().toISOString() } : m))
    }

    const onTogether = (status: TogetherStatus) => {
      if (status.unionId === myUnion.id) setTogetherStatus(status)
    }

    socket.on('union:message:new',   onNewMsg)
    socket.on('union:typing',        onTyping)
    socket.on('union:message:read',  onRead)
    socket.on('union:together:status', onTogether)

    return () => {
      socket.emit('union:chat:leave', { unionId: myUnion.id })
      socket.off('union:message:new',   onNewMsg)
      socket.off('union:typing',        onTyping)
      socket.off('union:message:read',  onRead)
      socket.off('union:together:status', onTogether)
      setTogetherStatus(null)
    }
  }, [myUnion]))

  // ─── Send ──────────────────────────────────────────────────────────────────
  async function handleSend() {
    const content = text.trim()
    if (!content || !myUnion || !route.params.otherUnionId || sending) return
    setText('')
    setSending(true)

    const temp: UnionMessage = {
      id: `temp-${Date.now()}`,
      fromUnionId: myUnion.id,
      toUnionId:   route.params.otherUnionId,
      fromUnion:   myUnion as any,
      content,
      mediaUrl:    null,
      readAt:      null,
      createdAt:   new Date().toISOString(),
    }
    setMessages((prev) => [temp, ...prev])

    try {
      const saved = await unionService.sendUnionMessage(myUnion.id, route.params.otherUnionId, content)
      setMessages((prev) => prev.map((m) => m.id === temp.id ? saved : m))
    } catch {
      setMessages((prev) => prev.filter((m) => m.id !== temp.id))
      Alert.alert(t.error, t.un_send_fail)
    } finally { setSending(false) }
  }

  // ─── Together consent / visibility ────────────────────────────────────────
  function handleToggleConsent(val: boolean) {
    const socket = getSocket()
    if (!socket || !myUnion) return
    socket.emit('union:together:consent', {
      unionId: myUnion.id, consent: val,
      visibility: togetherStatus?.visibility ?? 'private',
    })
  }

  function handleToggleVisibility(val: 'private' | 'public') {
    const socket = getSocket()
    if (!socket || !myUnion) return
    socket.emit('union:together:consent', {
      unionId: myUnion.id,
      consent: togetherStatus?.memberConsents[me?.id ?? ''] ?? false,
      visibility: val,
    })
  }

  // ─── Typing emission ───────────────────────────────────────────────────────
  function handleTextChange(v: string) {
    setText(v)
    const socket = getSocket()
    if (!socket || !myUnion || !route.params.otherUnionId) return
    socket.emit('union:typing', { fromUnionId: myUnion.id, toUnionId: route.params.otherUnionId, isTyping: true })
    if (typingTimer.current) clearTimeout(typingTimer.current)
    typingTimer.current = setTimeout(() => {
      socket.emit('union:typing', { fromUnionId: myUnion.id, toUnionId: route.params.otherUnionId, isTyping: false })
    }, 2000)
  }

  // ─── Render ────────────────────────────────────────────────────────────────
  const displayName = otherUnion?.name ?? route.params.unionName ?? t.un_union

  return (
    <KeyboardAvoidingView style={s.root} behavior="padding">
      {/* Header */}
      <LinearGradient colors={['#fff', '#fff']} style={[s.header, { paddingTop: insets.top + 4 }]}>
        <TouchableOpacity style={s.backBtn} onPress={() => nav.goBack()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Ionicons name="chevron-back" size={22} color={colors.black} />
        </TouchableOpacity>

        <View style={s.headerCenter}>
          {otherUnion
            ? <DualAvatar union={otherUnion} />
            : <View style={s.headerAvatarPlaceholder}><Ionicons name="people" size={18} color={colors.gray400} /></View>
          }
          <View>
            <Text style={s.headerName} numberOfLines={1}>{displayName}</Text>
            {isTyping && <Text style={s.typingLabel}>{t.un_typing}</Text>}
          </View>
        </View>

        <TouchableOpacity
          style={s.infoBtn}
          onPress={() => nav.navigate('UnionProfile', { unionId: route.params.otherUnionId ?? route.params.unionId })}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="information-circle-outline" size={22} color={colors.black} />
        </TouchableOpacity>
      </LinearGradient>

      {/* Modo Juntos banner */}
      {myUnion && togetherStatus?.bothPresent && (
        <JuntosBanner
          myUnion={myUnion}
          together={togetherStatus}
          myId={me?.id ?? ''}
          onToggleConsent={handleToggleConsent}
          onToggleVisibility={handleToggleVisibility}
        />
      )}

      {/* Messages */}
      {loading ? (
        <View style={s.loadingWrap}><ActivityIndicator size="large" color={colors.primary} /></View>
      ) : (
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(m) => m.id}
          inverted
          contentContainerStyle={s.list}
          showsVerticalScrollIndicator={false}
          onEndReached={() => {
            if (!hasMore || loadingMore || messages.length === 0) return
            setLoadingMore(true)
            const oldest = messages[messages.length - 1]
            loadMessages(oldest.createdAt).finally(() => setLoadingMore(false))
          }}
          onEndReachedThreshold={0.2}
          ListFooterComponent={loadingMore ? <ActivityIndicator size="small" color={colors.primary} style={{ marginVertical: 16 }} /> : null}
          renderItem={({ item, index }) => {
            const isMine     = item.fromUnionId === myUnion?.id
            const next       = messages[index - 1]
            const prev       = messages[index + 1]
            const showSender = !isMine && (!prev || prev.fromUnionId !== item.fromUnionId)
            const showDate   = !next || !sameDay(item.createdAt, next.createdAt)

            return (
              <>
                {showDate && (
                  <View style={s.dateSep}>
                    <Text style={s.dateSepTxt}>{new Date(item.createdAt).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long' })}</Text>
                  </View>
                )}
                <Bubble msg={item} isMine={isMine} showSender={showSender} />
              </>
            )
          }}
        />
      )}

      {/* Input */}
      <View style={[s.inputRow, { paddingBottom: insets.bottom + 8 }]}>
        <View style={s.inputWrap}>
          <TextInput
            style={s.input}
            placeholder={t.chat_input_ph}
            placeholderTextColor={colors.gray400}
            value={text}
            onChangeText={handleTextChange}
            multiline
            maxLength={1000}
          />
        </View>
        <TouchableOpacity
          style={[s.sendBtn, (!text.trim() || sending) && s.sendBtnOff]}
          onPress={handleSend}
          disabled={!text.trim() || sending}
          activeOpacity={0.85}
        >
          {sending
            ? <ActivityIndicator size="small" color="#fff" />
            : <Ionicons name="send" size={17} color="#fff" />
          }
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  )
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#FFFFFF' },

  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 12, paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.gray100,
  },
  backBtn:              { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  infoBtn:              { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  headerCenter:         { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10, paddingLeft: 4 },
  headerAvatarPlaceholder: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.gray100, alignItems: 'center', justifyContent: 'center' },
  headerName:           { fontFamily: fonts.semiBold, fontSize: 15, color: colors.black, maxWidth: 200 },
  typingLabel:          { fontFamily: fonts.regular, fontSize: 12, color: colors.gray500 },

  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  list:        { paddingHorizontal: 12, paddingVertical: 16, gap: 4 },

  // Dual avatar
  dualAvatar: { width: 40, height: 40, position: 'relative' },
  dualAvatarA: { width: 28, height: 28, borderRadius: 14, position: 'absolute', top: 0, left: 0, borderWidth: 1.5, borderColor: '#fff' },
  dualAvatarB: { width: 28, height: 28, borderRadius: 14, position: 'absolute', bottom: 0, right: 0, borderWidth: 1.5, borderColor: '#fff' },
  avatarFallback: { backgroundColor: colors.gray100, alignItems: 'center', justifyContent: 'center' },

  // Bubbles
  bubbleWrap:       { marginVertical: 2 },
  bubbleWrapMine:   { alignItems: 'flex-end' },
  bubbleWrapTheirs: { alignItems: 'flex-start' },

  senderRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4, marginLeft: 4 },
  senderName: { fontFamily: fonts.semiBold, fontSize: 11, color: colors.gray500 },

  bubble:       { maxWidth: '78%', borderRadius: 18, paddingHorizontal: 14, paddingVertical: 9 },
  bubbleMine:   { backgroundColor: MINE_COLOR, borderBottomRightRadius: 4 },
  bubbleTheirs: { backgroundColor: THEIRS_COLOR, borderBottomLeftRadius: 4 },
  bubbleTxt:    { fontFamily: fonts.regular, fontSize: 15, lineHeight: 22 },
  bubbleTxtMine:   { color: '#fff' },
  bubbleTxtTheirs: { color: colors.black },
  bubbleTime:      { fontFamily: fonts.regular, fontSize: 10, marginTop: 3, alignSelf: 'flex-end' },
  bubbleTimeMine:   { color: 'rgba(255,255,255,0.65)' },
  bubbleTimeTheirs: { color: colors.gray400 },
  readMark: { fontSize: 10 },

  // Date separator
  dateSep:    { alignItems: 'center', marginVertical: 12 },
  dateSepTxt: { fontFamily: fonts.medium, fontSize: 12, color: colors.gray400, backgroundColor: '#F5F5F5', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 12 },

  // Input
  inputRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, paddingHorizontal: 12, paddingTop: 8, backgroundColor: '#fff', borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.gray100 },
  inputWrap: { flex: 1, backgroundColor: colors.gray100, borderRadius: 22, paddingHorizontal: 14, paddingVertical: 8, minHeight: 42, justifyContent: 'center' },
  input:     { fontFamily: fonts.regular, fontSize: 15, color: colors.black, maxHeight: 100, padding: 0 },
  sendBtn:   { width: 42, height: 42, borderRadius: 21, backgroundColor: MINE_COLOR, alignItems: 'center', justifyContent: 'center' },
  sendBtnOff: { opacity: 0.35 },
})

const t = StyleSheet.create({
  wrap: { flexDirection: 'row', gap: 4, paddingHorizontal: 14, paddingVertical: 10, backgroundColor: THEIRS_COLOR, borderRadius: 18, borderBottomLeftRadius: 4, alignSelf: 'flex-start', marginLeft: 12 },
  dot:  { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.gray400 },
})

// ── Modo Juntos styles ─────────────────────────────────────────────────────────
const j = StyleSheet.create({
  // Overlapping avatars
  ovA: { width: 28, height: 28, borderRadius: 14, position: 'absolute', top: 0, left: 0, borderWidth: 2, borderColor: '#fff', zIndex: 2 },
  ovB: { width: 28, height: 28, borderRadius: 14, position: 'absolute', top: 8, left: 14, borderWidth: 2, borderColor: '#fff', zIndex: 1 },

  // Banner pill
  pill: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: '#FFF0F4',
    borderBottomWidth: 1, borderBottomColor: `${colors.primary}20`,
    paddingHorizontal: 16, paddingVertical: 10,
  },
  pillTitle: { fontFamily: fonts.semiBold, fontSize: 13, color: colors.primary },
  pillSub:   { fontFamily: fonts.regular, fontSize: 11, color: colors.gray500, marginTop: 1 },

  // Modal overlay + sheet
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)' },
  sheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    paddingHorizontal: 20, paddingTop: 24, paddingBottom: 40,
    gap: 18,
  },
  sheetHeader: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  sheetTitle:  { fontFamily: fonts.bold, fontSize: 17, color: colors.black },
  sheetSub:    { fontFamily: fonts.regular, fontSize: 13, color: colors.gray500 },

  // Consent row
  row:     { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: colors.gray100, borderRadius: 16, padding: 14 },
  rowLabel: { fontFamily: fonts.semiBold, fontSize: 15, color: colors.black },
  rowSub:   { fontFamily: fonts.regular,  fontSize: 12, color: colors.gray500, marginTop: 2 },

  // Status dots
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dot:       { width: 10, height: 10, borderRadius: 5 },
  statusTxt: { fontFamily: fonts.medium, fontSize: 13, color: colors.gray600, marginRight: 8 },

  // Visibility buttons
  visRow: { flexDirection: 'row', gap: 10 },
  visBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7,
    height: 44, borderRadius: 22,
    borderWidth: 1.5, borderColor: colors.gray200, backgroundColor: colors.white,
  },
  visBtnActive:   { backgroundColor: '#1A1A1A', borderColor: '#1A1A1A' },
  visBtnTxt:      { fontFamily: fonts.semiBold, fontSize: 13, color: colors.gray600 },
  visBtnTxtActive:{ color: '#fff' },

  hint: { fontFamily: fonts.regular, fontSize: 12, color: colors.gray400, textAlign: 'center' },
})
