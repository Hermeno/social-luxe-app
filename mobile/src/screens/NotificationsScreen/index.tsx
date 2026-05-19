import React from 'react'
import { View, Text, StyleSheet, FlatList } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { colors, spacing } from '../../theme'

const MOCK_NOTIFICATIONS = [
  { id: '1', icon: 'heart', color: '#FF4B6E', text: 'curtiu sua publicação', time: '2m', name: 'Asal Design' },
  { id: '2', icon: 'chatbubble-ellipses', color: '#3B82F6', text: 'comentou: "que incrível!"', time: '10m', name: 'Maria Silva' },
  { id: '3', icon: 'people', color: '#10B981', text: 'quer ser seu amigo por 7 dias', time: '1h', name: 'Carlos Mendes' },
  { id: '4', icon: 'arrow-redo', color: '#F59E0B', text: 'compartilhou seu post', time: '3h', name: 'Lydia Donin' },
]

export default function NotificationsScreen() {
  const { top } = useSafeAreaInsets()

  return (
    <View style={[s.container, { paddingTop: top }]}>
      <Text style={s.title}>Notificações</Text>
      <FlatList
        data={MOCK_NOTIFICATIONS}
        keyExtractor={(n) => n.id}
        renderItem={({ item }) => (
          <View style={s.row}>
            <View style={[s.iconWrap, { backgroundColor: `${item.color}20` }]}>
              <Ionicons name={item.icon as any} size={20} color={item.color} />
            </View>
            <View style={s.info}>
              <Text style={s.text}>
                <Text style={s.bold}>{item.name} </Text>
                {item.text}
              </Text>
              <Text style={s.time}>{item.time}</Text>
            </View>
          </View>
        )}
        showsVerticalScrollIndicator={false}
      />
    </View>
  )
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.white },
  title: { fontSize: 20, fontWeight: '700' as const, color: colors.gray800, paddingHorizontal: spacing.md, paddingBottom: spacing.md },
  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.md, paddingVertical: spacing.sm, gap: spacing.md },
  iconWrap: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center' },
  info: { flex: 1 },
  text: { fontSize: 14, color: colors.gray800, lineHeight: 20 },
  bold: { fontWeight: '700' as const },
  time: { fontSize: 11, color: colors.gray400, marginTop: 2 },
})
