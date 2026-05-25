import React, { useState, useCallback, useEffect, useRef } from 'react'
import {
  View, Text, FlatList, StyleSheet,
  TouchableOpacity, Animated,
} from 'react-native'
import { useNavigation } from '@react-navigation/native'
import { StackNavigationProp } from '@react-navigation/stack'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useFocusEffect } from '@react-navigation/native'
import { Ionicons } from '@expo/vector-icons'
import { useAuthStore } from '../../store/auth.store'
import { getConnections, Connection } from '../../services/follow.service'
import { getViewedPostIds } from '../../db/database'
import { AppStackParams } from '../../navigation/AppNavigator'
import { colors, spacing, fonts } from '../../theme'
import AvatarImage from '../../components/AvatarImage'
import SegmentedRing from '../../components/SegmentedRing'

type Nav = StackNavigationProp<AppStackParams>

const RING  = 58
const AVA   = 46

function timeAgo(date: string) {
  const diff = Date.now() - new Date(date).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1)  return 'agora'
  if (m < 60) return `${m}m`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h`
  return `${Math.floor(h / 24)}d`
}

// ─── Single row ───────────────────────────────────────────────────────────────
function ConvoRow({
  item,
  viewedIds,
  onPress,
  index,
}: {
  item: Connection
  viewedIds: Set<string>
  onPress: () => void
  index: number
}) {
  const hasMsg   = !!item.lastMessage
  const unread   = item.unreadCount > 0
  const hasPosts = item.postIds.length > 0
  const viewedCount = hasPosts
    ? item.postIds.filter((id) => viewedIds.has(id)).length
    : 0

  // Entrance animation
  const opacity = useRef(new Animated.Value(0)).current
  const translateY = useRef(new Animated.Value(12)).current
  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity,     { toValue: 1, duration: 280, delay: index * 40, useNativeDriver: true }),
      Animated.timing(translateY,  { toValue: 0, duration: 280, delay: index * 40, useNativeDriver: true }),
    ]).start()
  }, [])

  const preview = item.lastMessage
    ? (item.lastMessage.content ?? '🎤 Mensagem de voz')
    : 'Nova conexão · Diga olá 👋'

  return (
    <Animated.View style={{ opacity, transform: [{ translateY }] }}>
      <TouchableOpacity style={s.row} activeOpacity={0.7} onPress={onPress}>
        {/* Avatar with optional segmented ring */}
        <View style={s.ringWrap}>
          {hasPosts ? (
            <>
              <SegmentedRing
                count={item.postIds.length}
                viewedCount={viewedCount}
                size={RING}
                strokeWidth={2.5}
              />
              <View style={s.avatarCenter}>
                <AvatarImage uri={item.user.avatar} size={AVA} />
              </View>
            </>
          ) : (
            <View style={s.plainAvatar}>
              <AvatarImage uri={item.user.avatar} size={AVA} />
            </View>
          )}
        </View>

        {/* Text info */}
        <View style={s.info}>
          <View style={s.nameRow}>
            <Text style={[s.name, unread && s.nameUnread]} numberOfLines={1}>
              {item.user.name}
            </Text>
            {hasMsg && (
              <Text style={[s.time, unread && s.timeUnread]}>
                {timeAgo(item.lastMessage!.createdAt)}
              </Text>
            )}
          </View>
          <Text
            style={[s.preview, unread && s.previewUnread, !hasMsg && s.previewNew]}
            numberOfLines={1}
          >
            {preview}
          </Text>
        </View>

        {/* Unread badge */}
        {unread ? (
          <View style={s.badge}>
            <Text style={s.badgeTxt}>
              {item.unreadCount > 99 ? '99+' : item.unreadCount}
            </Text>
          </View>
        ) : hasMsg ? (
          <Ionicons name="checkmark-done-outline" size={16} color={colors.gray400} />
        ) : null}
      </TouchableOpacity>
    </Animated.View>
  )
}

// ─── Screen ───────────────────────────────────────────────────────────────────
export default function MessagesScreen() {
  const nav = useNavigation<Nav>()
  const { user } = useAuthStore()
  const { top } = useSafeAreaInsets()
  const [connections, setConnections] = useState<Connection[]>([])
  const [viewedIds, setViewedIds]     = useState<Set<string>>(new Set())

  async function load() {
    const [conns, viewed] = await Promise.all([
      getConnections().catch(() => [] as Connection[]),
      getViewedPostIds().catch(() => new Set<string>()),
    ])
    setConnections(conns)
    setViewedIds(viewed)
  }

  useFocusEffect(useCallback(() => { load() }, []))

  const totalUnread = connections.reduce((sum, c) => sum + c.unreadCount, 0)

  return (
    <View style={[s.screen, { paddingTop: top }]}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity
          onPress={() => nav.goBack()}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          style={s.backBtn}
        >
          <Ionicons name="chevron-back" size={28} color={colors.gray800} />
        </TouchableOpacity>

        <View style={s.headerCenter}>
          <Text style={s.title}>Mensagens</Text>
          {totalUnread > 0 && (
            <View style={s.headerBadge}>
              <Text style={s.headerBadgeTxt}>{totalUnread}</Text>
            </View>
          )}
        </View>

        <TouchableOpacity style={s.editBtn}>
          <Ionicons name="create-outline" size={24} color={colors.primary} />
        </TouchableOpacity>
      </View>

      <FlatList
        data={connections}
        keyExtractor={(c) => c.user.id}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={s.list}
        ItemSeparatorComponent={() => <View style={s.sep} />}
        renderItem={({ item, index }) => (
          <ConvoRow
            item={item}
            viewedIds={viewedIds}
            index={index}
            onPress={() => nav.navigate('Chat', {
              userId:     item.user.id,
              userName:   item.user.name,
              userAvatar: item.user.avatar,
            })}
          />
        )}
        ListEmptyComponent={
          <View style={s.empty}>
            <View style={s.emptyIcon}>
              <Ionicons name="chatbubbles-outline" size={44} color={colors.primary} />
            </View>
            <Text style={s.emptyTitle}>Nenhuma conexão ainda</Text>
            <Text style={s.emptySub}>Siga pessoas e elas te seguirão de volta para aparecer aqui</Text>
          </View>
        }
      />
    </View>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#FAFAFA' },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FAFAFA',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(0,0,0,0.08)',
  },
  backBtn:       { marginRight: 4 },
  headerCenter:  { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 },
  title:         { fontSize: 26, fontFamily: fonts.extraBold, color: colors.gray800, letterSpacing: -0.8 },
  headerBadge:   { backgroundColor: colors.primary, borderRadius: 12, paddingHorizontal: 8, paddingVertical: 2, minWidth: 24, alignItems: 'center' },
  headerBadgeTxt:{ fontSize: 12, fontFamily: fonts.bold, color: '#fff' },
  editBtn:       { padding: 4 },

  list: { paddingVertical: 8, paddingBottom: 40 },
  sep:  { height: StyleSheet.hairlineWidth, backgroundColor: 'rgba(0,0,0,0.06)', marginLeft: RING + 16 + 12 },

  // Row
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 11,
    gap: 12,
  },

  // Avatar area
  ringWrap:    { width: RING, height: RING, alignItems: 'center', justifyContent: 'center' },
  avatarCenter:{ position: 'absolute', alignItems: 'center', justifyContent: 'center' },
  plainAvatar: { width: RING, height: RING, alignItems: 'center', justifyContent: 'center' },

  // Text
  info:    { flex: 1, gap: 3 },
  nameRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },

  name:         { fontSize: 16, fontFamily: fonts.semiBold, color: colors.gray800, letterSpacing: -0.2, flex: 1 },
  nameUnread:   { fontFamily: fonts.bold, color: '#0A0A0A' },

  time:         { fontSize: 12, fontFamily: fonts.regular, color: colors.gray400 },
  timeUnread:   { fontFamily: fonts.semiBold, color: colors.primary },

  preview:       { fontSize: 14, fontFamily: fonts.regular, color: colors.gray400, letterSpacing: -0.1 },
  previewUnread: { fontFamily: fonts.medium, color: colors.gray600 },
  previewNew:    { fontStyle: 'italic', color: colors.gray400 },

  // Unread badge
  badge:    {
    minWidth: 22, height: 22, borderRadius: 11,
    backgroundColor: colors.primary,
    alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 6,
  },
  badgeTxt: { fontSize: 12, fontFamily: fonts.bold, color: '#fff' },

  // Empty state
  empty:      { alignItems: 'center', paddingTop: 80, paddingHorizontal: 40, gap: 12 },
  emptyIcon:  { width: 80, height: 80, borderRadius: 40, backgroundColor: `${colors.primary}15`, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  emptyTitle: { fontSize: 18, fontFamily: fonts.semiBold, color: colors.gray600, textAlign: 'center' },
  emptySub:   { fontSize: 14, fontFamily: fonts.regular, color: colors.gray400, textAlign: 'center', lineHeight: 21 },
})
