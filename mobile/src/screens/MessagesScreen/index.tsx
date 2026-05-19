import React, { useEffect, useState } from 'react'
import { View, Text, FlatList, Image, TouchableOpacity, StyleSheet } from 'react-native'
import { useNavigation } from '@react-navigation/native'
import { StackNavigationProp } from '@react-navigation/stack'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Message } from '../../types'
import * as msgService from '../../services/message.service'
import { useAuthStore } from '../../store/auth.store'
import { AppStackParams } from '../../navigation/AppNavigator'
import { colors, spacing } from '../../theme'

type Nav = StackNavigationProp<AppStackParams>

function timeAgo(date: string) {
  const d = new Date(date)
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

export default function MessagesScreen() {
  const nav = useNavigation<Nav>()
  const { user } = useAuthStore()
  const [conversations, setConversations] = useState<Message[]>([])
  const { top } = useSafeAreaInsets()

  useEffect(() => {
    msgService.getConversations().then(setConversations).catch(() => {})
  }, [])

  function getOther(msg: Message) {
    return msg.senderId === user?.id ? msg.receiver : msg.sender
  }

  return (
    <View style={[s.container, { paddingTop: top }]}>
      <Text style={s.title}>Mensagens</Text>
      <FlatList data={conversations} keyExtractor={(m) => m.id}
        renderItem={({ item }) => {
          const other = getOther(item) as Message['sender']
          const avatarUri = other.avatar ?? `https://ui-avatars.com/api/?name=${other.name}&background=FF4B6E&color=fff`
          return (
            <TouchableOpacity style={s.row} onPress={() => (nav as any).navigate('Chat', { userId: other.id, userName: other.name, userAvatar: other.avatar })}>
              <Image source={{ uri: avatarUri }} style={s.avatar} />
              <View style={s.info}>
                <Text style={s.name}>{other.name}</Text>
                <Text style={s.preview} numberOfLines={1}>{item.content ?? '📷 Mídia'}</Text>
              </View>
              <Text style={s.time}>{timeAgo(item.createdAt)}</Text>
            </TouchableOpacity>
          )
        }}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={<Text style={s.empty}>Nenhuma conversa ainda</Text>}
      />
    </View>
  )
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.white },
  title: { fontSize: 20, fontWeight: '700' as const, color: colors.gray800, paddingHorizontal: spacing.md, paddingBottom: spacing.md },
  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.md, paddingVertical: spacing.sm, gap: spacing.md },
  avatar: { width: 52, height: 52, borderRadius: 26 },
  info: { flex: 1 },
  name: { fontSize: 14, fontWeight: '600' as const, color: colors.gray800 },
  preview: { fontSize: 12, color: colors.gray400, marginTop: 2 },
  time: { fontSize: 11, color: colors.gray400 },
  empty: { fontSize: 14, color: colors.gray400, textAlign: 'center', marginTop: spacing.xxl },
})
