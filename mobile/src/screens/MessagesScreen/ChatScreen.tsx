import React, { useEffect, useState, useRef } from 'react'
import { View, Text, FlatList, Image, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native'
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Message } from '../../types'
import * as msgService from '../../services/message.service'
import { useAuthStore } from '../../store/auth.store'
import { AppStackParams } from '../../navigation/AppNavigator'
import { colors, spacing, radius } from '../../theme'
import ChatHeader from './ChatHeader'
import ChatInputBar from './ChatInputBar'

type Route = RouteProp<AppStackParams, 'Chat'>

export default function ChatScreen() {
  const { user } = useAuthStore()
  const route = useRoute<Route>()
  const nav = useNavigation()
  const { userId, userName, userAvatar } = route.params
  const [messages, setMessages] = useState<Message[]>([])
  const [text, setText] = useState('')
  const listRef = useRef<FlatList>(null)
  const { bottom, top } = useSafeAreaInsets()
  const avatarUri = userAvatar ?? `https://ui-avatars.com/api/?name=${userName}&background=FF4B6E&color=fff`

  useEffect(() => {
    msgService.getMessages(userId).then((m) => setMessages(m.reverse())).catch(() => {})
  }, [userId])

  async function handleSend() {
    if (!text.trim()) return
    const msg = await msgService.sendMessage(userId, text)
    setMessages((prev) => [...prev, msg])
    setText('')
    setTimeout(() => listRef.current?.scrollToEnd(), 100)
  }

  const isMine = (msg: Message) => msg.senderId === user?.id

  return (
    <KeyboardAvoidingView style={[s.container, { paddingTop: top }]} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ChatHeader userName={userName} avatarUri={avatarUri} onBack={() => nav.goBack()} />
      <FlatList ref={listRef} data={messages} keyExtractor={(m) => m.id}
        renderItem={({ item }) => (
          <View style={[s.bubble, isMine(item) ? s.myBubble : s.theirBubble]}>
            {item.mediaUrl && <Image source={{ uri: `http://192.168.43.184:3000${item.mediaUrl}` }} style={s.mediaBubble} />}
            {item.content && <Text style={[s.bubbleText, isMine(item) ? s.myText : s.theirText]}>{item.content}</Text>}
          </View>
        )}
        contentContainerStyle={s.list} showsVerticalScrollIndicator={false}
      />
      <ChatInputBar value={text} onChange={setText} onSend={handleSend} paddingBottom={bottom + 8} />
    </KeyboardAvoidingView>
  )
}

const s = StyleSheet.create({
  container:   { flex: 1, backgroundColor: colors.white },
  list:        { padding: spacing.md, gap: spacing.sm },
  bubble:      { maxWidth: '75%', borderRadius: radius.lg, padding: spacing.sm, marginBottom: spacing.xs },
  myBubble:    { alignSelf: 'flex-end', backgroundColor: colors.dark },
  theirBubble: { alignSelf: 'flex-start', backgroundColor: colors.gray100 },
  bubbleText:  { fontSize: 14 },
  myText:      { color: colors.white },
  theirText:   { color: colors.gray800 },
  mediaBubble: { width: 180, height: 180, borderRadius: radius.md, marginBottom: 4 },
})
