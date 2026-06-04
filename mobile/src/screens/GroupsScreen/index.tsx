import React, { useEffect, useState } from 'react'
import {
  View,
  Text,
  FlatList,
  Image,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useNavigation } from '@react-navigation/native'
import { StackNavigationProp } from '@react-navigation/stack'
import { Ionicons } from '@expo/vector-icons'
import { getMyGroups, Group } from '../../services/group.service'
import { AppStackParams } from '../../navigation/AppNavigator'
import { colors, fonts, spacing, radius } from '../../theme'
import { getCache, setCache } from '../../db/database'
import { isConnected } from '../../services/netinfo.service'

type Nav = StackNavigationProp<AppStackParams>

function timeAgo(date: string) {
  const diff = Date.now() - new Date(date).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 60) return `${m}m`
  if (m < 1440) return `${Math.floor(m / 60)}h`
  return `${Math.floor(m / 1440)}d`
}

export default function GroupsScreen() {
  const nav = useNavigation<Nav>()
  const { top, bottom } = useSafeAreaInsets()
  const [groups, setGroups] = useState<Group[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    async function run() {
      const cached = await getCache<Group[]>('my_groups')
      if (!cancelled && cached) { setGroups(cached); setLoading(false) }
      if (!isConnected()) { setLoading(false); return }
      try {
        const fresh = await getMyGroups()
        if (!cancelled) { setGroups(fresh); setLoading(false) }
        setCache('my_groups', fresh).catch(() => {})
      } catch { if (!cancelled) setLoading(false) }
    }
    run()
    return () => { cancelled = true }
  }, [])

  return (
    <View style={[s.container, { paddingTop: top }]}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => nav.goBack()} style={s.backBtn}>
          <Ionicons name="chevron-back" size={26} color={colors.gray800} />
        </TouchableOpacity>
        <Text style={s.title}>Grupos</Text>
        <View style={{ width: 36 }} />
      </View>

      {loading ? (
        <View style={s.center}>
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      ) : (
        <FlatList
          data={groups}
          keyExtractor={(g) => g.id}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={s.list}
          ListEmptyComponent={
            <View style={s.center}>
              <Ionicons name="people-outline" size={56} color={colors.gray200} />
              <Text style={s.emptyText}>Nenhum grupo ainda</Text>
              <Text style={s.emptySubtext}>Crie um grupo para conversar com amigos</Text>
            </View>
          }
          renderItem={({ item }) => (
            <TouchableOpacity
              style={s.row}
              onPress={() => nav.navigate('GroupChat', { groupId: item.id, groupName: item.name })}
              activeOpacity={0.8}
            >
              <View style={s.groupAvatar}>
                <Ionicons name="people" size={26} color="rgba(255,255,255,0.6)" />
              </View>
              <View style={s.info}>
                <Text style={s.groupName}>{item.name}</Text>
                <Text style={s.lastMsg} numberOfLines={1}>
                  {item.lastMessage?.content ?? 'Nenhuma mensagem'}
                </Text>
              </View>
              <View style={s.right}>
                {item.lastMessage && (
                  <Text style={s.time}>{timeAgo(item.lastMessage.createdAt)}</Text>
                )}
                <View style={s.memberBadge}>
                  <Ionicons name="person-outline" size={11} color="rgba(255,255,255,0.5)" />
                  <Text style={s.memberCount}>{item.memberCount}</Text>
                </View>
              </View>
            </TouchableOpacity>
          )}
        />
      )}

      <TouchableOpacity
        style={[s.fab, { bottom: bottom + spacing.lg }]}
        onPress={() => nav.navigate('CreateGroup')}
        activeOpacity={0.85}
      >
        <Ionicons name="add" size={28} color={colors.white} />
      </TouchableOpacity>
    </View>
  )
}

const s = StyleSheet.create({
  container:    { flex: 1, backgroundColor: colors.white },
  header:       {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
  },
  backBtn:      { width: 36 },
  title:        { color: colors.gray800, fontFamily: fonts.bold, fontSize: 20 },
  center:       { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md, paddingTop: 80 },
  emptyText:    { color: colors.gray800, fontFamily: fonts.semiBold, fontSize: 18 },
  emptySubtext: { color: colors.gray400, fontFamily: fonts.regular, fontSize: 13, textAlign: 'center', paddingHorizontal: 40 },
  list:         { paddingHorizontal: spacing.md, paddingTop: spacing.sm, paddingBottom: 100 },
  row:          {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: spacing.md, gap: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.gray200,
  },
  groupAvatar:  {
    width: 52, height: 52, borderRadius: 26,
    backgroundColor: colors.gray100,
    alignItems: 'center', justifyContent: 'center',
  },
  info:         { flex: 1, gap: 3 },
  groupName:    { color: colors.gray800, fontFamily: fonts.semiBold, fontSize: 15 },
  lastMsg:      { color: colors.gray400, fontFamily: fonts.regular, fontSize: 12 },
  right:        { alignItems: 'flex-end', gap: 4 },
  time:         { color: colors.gray400, fontFamily: fonts.regular, fontSize: 11 },
  memberBadge:  { flexDirection: 'row', alignItems: 'center', gap: 3 },
  memberCount:  { color: colors.gray400, fontFamily: fonts.regular, fontSize: 11 },
  fab:          {
    position: 'absolute', right: spacing.lg,
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: colors.primary,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 12,
    elevation: 8,
  },
})
