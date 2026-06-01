import React from 'react'
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useNavigation } from '@react-navigation/native'
import { Ionicons } from '@expo/vector-icons'
import { useNotificationStore, AppNotification } from '../../store/notification.store'
import { colors, fonts, spacing, radius } from '../../theme'

function timeAgo(date: string) {
  const diff = Date.now() - new Date(date).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 60) return `${m}m atrás`
  if (m < 1440) return `${Math.floor(m / 60)}h atrás`
  return `${Math.floor(m / 1440)}d atrás`
}

function notifIcon(type: AppNotification['type']): string {
  switch (type) {
    case 'like':         return 'heart'
    case 'comment':      return 'chatbubble'
    case 'reaction':     return 'happy'
    case 'message':      return 'paper-plane'
    case 'coin':         return 'diamond'
    case 'extend_vote':  return 'timer'
    default:             return 'notifications'
  }
}

function notifColor(type: AppNotification['type']): string {
  switch (type) {
    case 'like':         return '#4C8CE4'
    case 'comment':      return '#3B82F6'
    case 'reaction':     return '#F59E0B'
    case 'message':      return '#10B981'
    case 'coin':         return '#8B5CF6'
    case 'extend_vote':  return '#EC4899'
    default:             return '#6B7280'
  }
}

export default function NotificationsScreen() {
  const nav = useNavigation()
  const { top } = useSafeAreaInsets()
  const { notifications, badge, markAllRead } = useNotificationStore()

  return (
    <View style={[s.container, { paddingTop: top }]}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => nav.goBack()} style={s.backBtn}>
          <Ionicons name="chevron-back" size={26} color={colors.gray800} />
        </TouchableOpacity>
        <View style={s.titleWrap}>
          <Text style={s.title}>Notificações</Text>
          {badge > 0 && (
            <View style={s.badge}>
              <Text style={s.badgeText}>{badge > 99 ? '99+' : badge}</Text>
            </View>
          )}
        </View>
        {badge > 0 && (
          <TouchableOpacity onPress={markAllRead} activeOpacity={0.75}>
            <Text style={s.markAllText}>Marcar lido</Text>
          </TouchableOpacity>
        )}
      </View>

      <FlatList
        data={notifications}
        keyExtractor={(n) => n.id}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={s.list}
        ListEmptyComponent={
          <View style={s.center}>
            <Ionicons name="notifications-outline" size={56} color={colors.gray200} />
            <Text style={s.emptyText}>Sem notificações</Text>
            <Text style={s.emptySubtext}>Você está em dia com tudo!</Text>
          </View>
        }
        renderItem={({ item }: { item: AppNotification }) => (
          <View style={[s.notifRow, !item.read && s.notifUnread]}>
            <View style={[s.iconWrap, { backgroundColor: notifColor(item.type) + '22' }]}>
              <Ionicons
                name={notifIcon(item.type) as any}
                size={20}
                color={notifColor(item.type)}
              />
            </View>
            <View style={s.notifBody}>
              <Text style={s.notifMessage}>{item.message}</Text>
              <Text style={s.notifTime}>{timeAgo(item.createdAt)}</Text>
            </View>
            {!item.read && <View style={s.unreadDot} />}
          </View>
        )}
      />
    </View>
  )
}

const s = StyleSheet.create({
  container:    { flex: 1, backgroundColor: colors.white },
  header:       {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm, gap: spacing.sm,
  },
  backBtn:      { width: 36 },
  titleWrap:    { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 },
  title:        { color: colors.gray800, fontFamily: fonts.bold, fontSize: 20 },
  badge:        {
    backgroundColor: colors.primary, borderRadius: radius.full,
    paddingHorizontal: 7, paddingVertical: 2,
    minWidth: 22, alignItems: 'center',
  },
  badgeText:    { color: colors.white, fontFamily: fonts.bold, fontSize: 11 },
  markAllText:  { color: colors.primary, fontFamily: fonts.semiBold, fontSize: 13 },
  list:         { paddingHorizontal: spacing.md, paddingTop: spacing.sm, paddingBottom: 40 },
  center:       { alignItems: 'center', justifyContent: 'center', paddingTop: 80, gap: spacing.md },
  emptyText:    { color: colors.gray800, fontFamily: fonts.semiBold, fontSize: 18 },
  emptySubtext: { color: colors.gray400, fontFamily: fonts.regular, fontSize: 14 },
  notifRow:     {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.gray200,
  },
  notifUnread:  { backgroundColor: 'rgba(255,75,110,0.04)', marginHorizontal: -spacing.md, paddingHorizontal: spacing.md },
  iconWrap:     { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  notifBody:    { flex: 1, gap: 3 },
  notifMessage: { color: colors.gray800, fontFamily: fonts.regular, fontSize: 14, lineHeight: 20 },
  notifTime:    { color: colors.gray400, fontFamily: fonts.regular, fontSize: 11 },
  unreadDot:    { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.primary },
})
