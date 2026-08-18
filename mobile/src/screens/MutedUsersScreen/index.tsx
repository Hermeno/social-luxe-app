import React, { useCallback, useState } from 'react'
import {
  ActivityIndicator, FlatList, StyleSheet, Text, TouchableOpacity, View,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useFocusEffect, useNavigation } from '@react-navigation/native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import AvatarImage from '../../components/AvatarImage'
import { getCache, setCache } from '../../db/database'
import { useT } from '../../i18n'
import {
  getMutedUsers,
  MUTED_USER_IDS_CACHE_KEY,
  MUTED_USERS_CACHE_KEY,
  type MutedUser,
  unmuteUser,
} from '../../services/mute.service'
import { fonts } from '../../theme'
import { toast } from '../../utils/toast'

const TEXT = '#1A1A1A'
const SECONDARY = '#6E6E73'
const MUTED = '#ABABAB'
const BRAND = '#FF7A1C'
const BORDER = '#E5E5EA'
const WHITE = '#FFFFFF'
const SURFACE = '#F9F9FB'
const SEPARATOR = '#F0F0F3'
const CARD_BORDER = '#EDEDF1'

export default function MutedUsersScreen() {
  const nav = useNavigation()
  const { top, bottom } = useSafeAreaInsets()
  const t = useT()
  const [users, setUsers] = useState<MutedUser[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<string | null>(null)

  useFocusEffect(useCallback(() => {
    let active = true
    setLoading(true)
    ;(async () => {
      const cached = await getCache<MutedUser[]>(MUTED_USERS_CACHE_KEY).catch(() => null)
      if (active && cached) {
        setUsers(cached)
        setLoading(false)
      }
      try {
        const fresh = await getMutedUsers()
        if (!active) return
        setUsers(fresh)
        setCache(MUTED_USERS_CACHE_KEY, fresh).catch(() => {})
        setCache(MUTED_USER_IDS_CACHE_KEY, fresh.map((user) => user.id)).catch(() => {})
      } catch {
        // O cache continua utilizável offline.
      } finally {
        if (active) setLoading(false)
      }
    })()
    return () => { active = false }
  }, []))

  async function handleUnmute(user: MutedUser) {
    if (busy) return
    setBusy(user.id)
    try {
      await unmuteUser(user.id)
      setUsers((current) => {
        const next = current.filter((item) => item.id !== user.id)
        setCache(MUTED_USERS_CACHE_KEY, next).catch(() => {})
        setCache(MUTED_USER_IDS_CACHE_KEY, next.map((item) => item.id)).catch(() => {})
        return next
      })
      toast.success(t.mute_unmuted_title, t.mute_unmuted_message.replace('{name}', user.name))
    } catch {
      toast.error(t.error, t.mute_unmute_fail)
    } finally {
      setBusy(null)
    }
  }

  function statusLabel(user: MutedUser): string {
    if (!user.expiresAt) return t.mute_forever_label
    const date = new Date(user.expiresAt).toLocaleDateString(undefined, {
      day: '2-digit', month: 'short', year: 'numeric',
    })
    return t.mute_until.replace('{date}', date)
  }

  return (
    <View style={s.screen}>
      <View style={[s.header, { paddingTop: top + 8 }]}>
        <TouchableOpacity
          onPress={() => nav.goBack()}
          style={s.backBtn}
          hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}
        >
          <Ionicons name="chevron-back" size={20} color={TEXT} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>{t.mute_list_title}</Text>
      </View>

      {loading ? (
        <View style={s.center}><ActivityIndicator color={BRAND} /></View>
      ) : users.length === 0 ? (
        <View style={s.empty}>
          <View style={s.emptyIcon}>
            <Ionicons name="eye-off-outline" size={30} color="#C0C0C8" />
          </View>
          <Text style={s.emptyTitle}>{t.mute_empty_title}</Text>
          <Text style={s.emptySub}>{t.mute_empty_sub}</Text>
        </View>
      ) : (
        <FlatList
          data={users}
          keyExtractor={(user) => user.id}
          contentContainerStyle={[s.content, { paddingBottom: bottom + 32 }]}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={(
            <Text style={s.sectionLabel}>
              {users.length} {users.length === 1 ? t.blk_person : t.blk_people}
            </Text>
          )}
          renderItem={({ item, index }) => (
            <View style={[s.row, index === 0 && s.rowFirst, index === users.length - 1 && s.rowLast]}>
              <AvatarImage uri={item.avatar} name={item.name} size={44} />
              <View style={s.identity}>
                <Text style={s.name} numberOfLines={1}>{item.name}</Text>
                <Text style={s.status} numberOfLines={1}>{statusLabel(item)}</Text>
              </View>
              <TouchableOpacity
                style={s.unmuteBtn}
                onPress={() => handleUnmute(item)}
                disabled={busy !== null}
                activeOpacity={0.8}
                accessibilityRole="button"
                accessibilityLabel={`${t.mute_show_again}: ${item.name}`}
              >
                {busy === item.id
                  ? <ActivityIndicator size="small" color={BRAND} />
                  : <Text style={s.unmuteTxt}>{t.mute_show_again}</Text>}
              </TouchableOpacity>
            </View>
          )}
          ItemSeparatorComponent={() => <View style={s.separator} />}
        />
      )}
    </View>
  )
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: SURFACE },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingBottom: 12 },
  backBtn: { width: 40, height: 40, borderRadius: 999, backgroundColor: WHITE, borderWidth: 1, borderColor: BORDER, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { flex: 1, fontFamily: fonts.extraBold, fontSize: 22, letterSpacing: -0.5, color: TEXT },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { paddingHorizontal: 16, paddingTop: 4 },
  sectionLabel: { paddingLeft: 6, paddingBottom: 10, fontFamily: fonts.bold, fontSize: 11, color: MUTED, letterSpacing: 1, textTransform: 'uppercase' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 11, backgroundColor: WHITE, borderLeftWidth: 1, borderRightWidth: 1, borderColor: CARD_BORDER },
  rowFirst: { borderTopWidth: 1, borderTopLeftRadius: 18, borderTopRightRadius: 18 },
  rowLast: { borderBottomWidth: 1, borderBottomLeftRadius: 18, borderBottomRightRadius: 18 },
  separator: { height: 1, backgroundColor: SEPARATOR },
  identity: { flex: 1, minWidth: 0 },
  name: { fontFamily: fonts.semiBold, fontSize: 15, color: TEXT },
  status: { marginTop: 2, fontFamily: fonts.regular, fontSize: 11.5, color: SECONDARY },
  unmuteBtn: { minWidth: 82, paddingHorizontal: 12, paddingVertical: 7, alignItems: 'center', borderWidth: 1.4, borderColor: BRAND, borderRadius: 18 },
  unmuteTxt: { fontFamily: fonts.bold, fontSize: 12.5, color: BRAND },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 6, paddingHorizontal: 40 },
  emptyIcon: { width: 72, height: 72, marginBottom: 8, borderRadius: 36, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F0F0F3' },
  emptyTitle: { fontFamily: fonts.bold, fontSize: 17, color: TEXT },
  emptySub: { fontFamily: fonts.regular, fontSize: 13.5, lineHeight: 20, textAlign: 'center', color: SECONDARY },
})
