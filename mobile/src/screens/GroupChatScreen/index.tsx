import React, { useEffect, useState, useRef } from 'react'
import {
  View,
  Text,
  FlatList,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native'
import { Ionicons } from '@expo/vector-icons'
import { getGroupMessages, sendGroupMessage, GroupMessage } from '../../services/group.service'
import { getSocket } from '../../socket'
import { useAuthStore } from '../../store/auth.store'
import { AppStackParams } from '../../navigation/AppNavigator'
import { colors, fonts, spacing, radius } from '../../theme'
import VoiceRecorder from '../../components/VoiceRecorder'
import VoicePlayer from '../../components/VoicePlayer'
import AvatarImage from '../../components/AvatarImage'
import { API_BASE } from '../../config'


type Route = RouteProp<AppStackParams, 'GroupChat'>

function timeLabel(date: string) {
  return new Date(date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

export default function GroupChatScreen() {
  const nav = useNavigation()
  const route = useRoute<Route>()
  const { groupId, groupName } = route.params
  const { user } = useAuthStore()
  const { top, bottom } = useSafeAreaInsets()
  const [messages, setMessages] = useState<GroupMessage[]>([])
  const [text, setText] = useState('')
  const listRef = useRef<FlatList>(null)

  useEffect(() => {
    getGroupMessages(groupId).then((msgs) => setMessages(msgs.reverse())).catch(() => {})

    const socket = getSocket()
    if (socket) {
      socket.emit('group:join', { groupId })
      socket.on('group:message:new', (msg: GroupMessage) => {
        if (msg.groupId === groupId) {
          setMessages((prev) => [...prev, msg])
          setTimeout(() => listRef.current?.scrollToEnd(), 80)
        }
      })
    }

    return () => {
      socket?.off('group:message:new')
      socket?.emit('group:leave', { groupId })
    }
  }, [groupId])

  async function handleSend() {
    if (!text.trim()) return
    const t = text
    setText('')
    try {
      const msg = await sendGroupMessage(groupId, t)
      setMessages((prev) => [...prev, msg])
      setTimeout(() => listRef.current?.scrollToEnd(), 80)
    } catch {}
  }

  async function handleVoice(uri: string) {
    try {
      const msg = await sendGroupMessage(groupId, undefined, uri)
      setMessages((prev) => [...prev, msg])
      setTimeout(() => listRef.current?.scrollToEnd(), 80)
    } catch {}
  }

  const isMine = (msg: GroupMessage) => msg.senderId === user?.id

  return (
    <KeyboardAvoidingView
      style={[s.container, { paddingTop: top }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={s.header}>
        <TouchableOpacity onPress={() => nav.goBack()} style={s.backBtn}>
          <Ionicons name="chevron-back" size={26} color={colors.gray800} />
        </TouchableOpacity>
        <View style={s.groupIcon}>
          <Ionicons name="people" size={20} color={colors.gray400} />
        </View>
        <View style={s.headerInfo}>
          <Text style={s.headerName}>{groupName}</Text>
        </View>
      </View>

      <FlatList
        ref={listRef}
        data={messages}
        keyExtractor={(m) => m.id}
        contentContainerStyle={s.list}
        showsVerticalScrollIndicator={false}
        onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
        renderItem={({ item }) => {
          const mine = isMine(item)
          return (
            <View style={[s.msgRow, mine ? s.msgRowMine : s.msgRowTheirs]}>
              {!mine && <AvatarImage uri={item.sender.avatar} size={32} />}
              <View style={[s.bubble, mine ? s.bubbleMine : s.bubbleTheirs]}>
                {!mine && <Text style={s.senderName}>{item.sender.name}</Text>}
                {item.mediaUrl ? (
                  <VoicePlayer uri={`${API_BASE}${item.mediaUrl}`} />
                ) : (
                  <Text style={[s.bubbleText, mine ? s.textMine : s.textTheirs]}>
                    {item.content}
                  </Text>
                )}
                <Text style={s.msgTime}>{timeLabel(item.createdAt)}</Text>
              </View>
            </View>
          )
        }}
      />

      <View style={[s.inputRow, { paddingBottom: bottom + 8 }]}>
        <TextInput
          style={s.input}
          placeholder="Mensagem..."
          placeholderTextColor={colors.gray400}
          value={text}
          onChangeText={setText}
          multiline
        />
        {text.trim().length > 0 ? (
          <TouchableOpacity style={s.sendBtn} onPress={handleSend}>
            <Ionicons name="send" size={18} color={colors.white} />
          </TouchableOpacity>
        ) : (
          <VoiceRecorder onRecordingComplete={handleVoice} />
        )}
      </View>
    </KeyboardAvoidingView>
  )
}

const s = StyleSheet.create({
  container:    { flex: 1, backgroundColor: colors.white },
  header:       {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.gray200,
    gap: spacing.sm,
  },
  backBtn:      { width: 36 },
  groupIcon:    {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: colors.gray100,
    alignItems: 'center', justifyContent: 'center',
  },
  headerInfo:   { flex: 1 },
  headerName:   { color: colors.gray800, fontFamily: fonts.semiBold, fontSize: 16 },
  list:         { padding: spacing.md, gap: spacing.sm },
  msgRow:       { flexDirection: 'row', alignItems: 'flex-end', gap: 8, marginBottom: spacing.sm },
  msgRowMine:   { justifyContent: 'flex-end' },
  msgRowTheirs: { justifyContent: 'flex-start' },
  bubble:       { maxWidth: '75%', borderRadius: radius.lg, padding: spacing.sm, gap: 4 },
  bubbleMine:   { backgroundColor: colors.primary },
  bubbleTheirs: { backgroundColor: colors.gray100 },
  senderName:   { color: colors.gray400, fontFamily: fonts.semiBold, fontSize: 11 },
  bubbleText:   { fontSize: 14, lineHeight: 20 },
  textMine:     { color: colors.white, fontFamily: fonts.regular },
  textTheirs:   { color: colors.gray800, fontFamily: fonts.regular },
  msgTime:      { color: colors.gray400, fontFamily: fonts.regular, fontSize: 10, alignSelf: 'flex-end' },
  inputRow:     {
    flexDirection: 'row', alignItems: 'flex-end',
    paddingHorizontal: spacing.md, paddingTop: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.gray200,
    gap: spacing.sm,
  },
  input:        {
    flex: 1, backgroundColor: colors.gray100, borderRadius: radius.lg,
    paddingHorizontal: spacing.md, paddingVertical: 10,
    color: colors.gray800, fontFamily: fonts.regular, fontSize: 15,
    maxHeight: 100,
  },
  sendBtn:      {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: colors.primary,
    alignItems: 'center', justifyContent: 'center',
  },
})
