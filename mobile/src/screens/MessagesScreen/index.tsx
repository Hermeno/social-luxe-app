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
import { getConnections, Connection } from '../../services/follow.service'
import { getViewedPostIds } from '../../db/database'
import { AppStackParams } from '../../navigation/AppNavigator'
import { fonts } from '../../theme'
import AvatarImage from '../../components/AvatarImage'
import SegmentedRing from '../../components/SegmentedRing'

type Nav = StackNavigationProp<AppStackParams>

const RING = 54
const AVA  = 44

function timeAgo(date: string) {
  const diff = Date.now() - new Date(date).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1)  return 'agora'
  if (m < 60) return `${m}m`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h`
  return `${Math.floor(h / 24)}d`
}

// ─── Conversation row ─────────────────────────────────────────────────────────
function ConvoRow({ item, viewedIds, onPress, index }: {
  item: Connection; viewedIds: Set<string>; onPress: () => void; index: number
}) {
  const hasMsg      = !!item.lastMessage
  const unread      = item.unreadCount > 0
  const hasPosts    = item.postIds.length > 0
  const viewedCount = item.postIds.filter((id) => viewedIds.has(id)).length

  const opacity    = useRef(new Animated.Value(0)).current
  const translateY = useRef(new Animated.Value(8)).current

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity,    { toValue: 1, duration: 260, delay: index * 35, useNativeDriver: true }),
      Animated.timing(translateY, { toValue: 0, duration: 260, delay: index * 35, useNativeDriver: true }),
    ]).start()
  }, [])

  const preview = hasMsg
    ? (item.lastMessage!.content ?? 'Ficheiro de media')
    : 'Sem mensagens ainda'

  return (
    <Animated.View style={{ opacity, transform: [{ translateY }] }}>
      <TouchableOpacity style={s.row} onPress={onPress} activeOpacity={0.65}>

        {/* Avatar + ring */}
        <View style={s.avatarWrap}>
          {hasPosts ? (
            <>
              <SegmentedRing count={item.postIds.length} viewedCount={viewedCount} size={RING} strokeWidth={2} />
              <View style={s.avatarInner}><AvatarImage uri={item.user.avatar} size={AVA} /></View>
            </>
          ) : (
            <AvatarImage uri={item.user.avatar} size={AVA} />
          )}
        </View>

        {/* Text */}
        <View style={s.info}>
          <View style={s.topRow}>
            <Text style={[s.name, unread && s.nameBold]} numberOfLines={1}>{item.user.name}</Text>
            {hasMsg && (
              <Text style={[s.time, unread && s.timeActive]}>
                {timeAgo(item.lastMessage!.createdAt)}
              </Text>
            )}
          </View>
          <Text style={[s.preview, unread && s.previewBold, !hasMsg && s.previewMuted]} numberOfLines={1}>
            {preview}
          </Text>
        </View>

        {/* Unread indicator */}
        {unread ? (
          <View style={s.dot}>
            <Text style={s.dotTxt}>{item.unreadCount > 9 ? '9+' : item.unreadCount}</Text>
          </View>
        ) : hasMsg ? (
          <Ionicons name="checkmark-done" size={16} color="#C8C8C8" />
        ) : null}

      </TouchableOpacity>
    </Animated.View>
  )
}

// ─── Screen ───────────────────────────────────────────────────────────────────
export default function MessagesScreen() {
  const nav     = useNavigation<Nav>()
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

      {/* ── Header ────────────────────────────────────────────────── */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => nav.goBack()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Ionicons name="chevron-back" size={26} color="#1A1A1A" />
        </TouchableOpacity>

        <View style={s.titleWrap}>
          <Text style={s.title}>Mensagens</Text>
          {totalUnread > 0 && <View style={s.unreadPill}><Text style={s.unreadPillTxt}>{totalUnread}</Text></View>}
        </View>

        {/* Find friends — neutral icon */}
        <TouchableOpacity
          onPress={() => nav.navigate('Search')}
          style={s.searchBtn}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="search-outline" size={22} color="#1A1A1A" />
        </TouchableOpacity>
      </View>

      {/* ── List ──────────────────────────────────────────────────── */}
      <FlatList
        data={connections}
        keyExtractor={(c) => c.user.id}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={s.list}
        ItemSeparatorComponent={() => (
          <View style={s.sep} />
        )}
        renderItem={({ item, index }) => (
          <ConvoRow
            item={item}
            viewedIds={viewedIds}
            index={index}
            onPress={() => nav.navigate('Chat', {
              userId: item.user.id,
              userName: item.user.name,
              userAvatar: item.user.avatar,
            })}
          />
        )}
        ListEmptyComponent={
          <View style={s.empty}>
            <View style={s.emptyCircle}>
              <Ionicons name="chatbubble-ellipses-outline" size={36} color="#C0C0C8" />
            </View>
            <Text style={s.emptyTitle}>Sem conversas</Text>
            <Text style={s.emptySub}>Segue pessoas para poder enviar mensagens</Text>
            <TouchableOpacity style={s.findBtn} onPress={() => nav.navigate('Search')}>
              <Text style={s.findBtnText}>Encontrar pessoas</Text>
            </TouchableOpacity>
          </View>
        }
      />
    </View>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const RING_OFFSET = 16 + RING + 14  // left edge of sep line

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#fff' },

  /* header */
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#EAEAEA',
    gap: 12,
  },
  titleWrap:     { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 },
  title:         { fontSize: 22, fontFamily: fonts.bold, color: '#1A1A1A', letterSpacing: -0.5 },
  unreadPill:    { backgroundColor: '#4C8CE4', borderRadius: 10, paddingHorizontal: 7, paddingVertical: 2, minWidth: 20, alignItems: 'center' },
  unreadPillTxt: { fontSize: 11, fontFamily: fonts.bold, color: '#fff' },
  searchBtn:     { padding: 4 },

  /* list */
  list: { paddingBottom: 60 },
  sep:  { height: StyleSheet.hairlineWidth, backgroundColor: '#EAEAEA', marginLeft: RING_OFFSET },

  /* row */
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingVertical: 12,
    gap: 14,
    backgroundColor: '#fff',
  },

  /* avatar */
  avatarWrap:  { width: RING, height: RING, alignItems: 'center', justifyContent: 'center' },
  avatarInner: { position: 'absolute' },

  /* text */
  info:    { flex: 1, gap: 3 },
  topRow:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },

  name:        { fontSize: 15, fontFamily: fonts.semiBold, color: '#1A1A1A', flex: 1, letterSpacing: -0.1 },
  nameBold:    { fontFamily: fonts.bold },

  time:        { fontSize: 12, fontFamily: fonts.regular, color: '#ABABAB' },
  timeActive:  { color: '#4C8CE4', fontFamily: fonts.medium },

  preview:      { fontSize: 13, fontFamily: fonts.regular, color: '#ABABAB' },
  previewBold:  { fontFamily: fonts.medium, color: '#555' },
  previewMuted: { fontStyle: 'italic' },

  /* unread dot */
  dot:    { minWidth: 20, height: 20, borderRadius: 10, backgroundColor: '#4C8CE4', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 5 },
  dotTxt: { fontSize: 11, fontFamily: fonts.bold, color: '#fff' },

  /* empty */
  empty:       { alignItems: 'center', paddingTop: 100, paddingHorizontal: 48, gap: 10 },
  emptyCircle: { width: 72, height: 72, borderRadius: 36, backgroundColor: '#F5F5F7', alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
  emptyTitle:  { fontSize: 17, fontFamily: fonts.semiBold, color: '#333' },
  emptySub:    { fontSize: 14, fontFamily: fonts.regular, color: '#ABABAB', textAlign: 'center', lineHeight: 21 },
  findBtn:     { marginTop: 8, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 8, backgroundColor: '#1A1A1A' },
  findBtnText: { fontSize: 14, fontFamily: fonts.semiBold, color: '#fff' },
})
