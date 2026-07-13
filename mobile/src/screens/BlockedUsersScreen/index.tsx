import React, { useState, useEffect, useCallback } from 'react'
import {
  View, Text, StyleSheet, TouchableOpacity, FlatList, ActivityIndicator,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useNavigation } from '@react-navigation/native'
import { getBlockedUsers, unblockUser, BlockedUser } from '../../services/block.service'
import AvatarImage from '../../components/AvatarImage'
import { toast } from '../../utils/toast'
import { fonts } from '../../theme'
import { useT } from '../../i18n'

const T_C = '#1A1A1A'
const S   = '#6E6E73'
const M   = '#ABABAB'
const B   = '#CA2851'
const BD  = '#E5E5EA'
const BG  = '#FFFFFF'
const SX  = '#F9F9FB'
const SEP = '#F0F0F3'
const CARD_BD = '#EDEDF1'

export default function BlockedUsersScreen() {
  const nav = useNavigation()
  const { top, bottom } = useSafeAreaInsets()
  const t = useT()

  const [users,   setUsers]   = useState<BlockedUser[]>([])
  const [loading, setLoading] = useState(true)
  const [busy,    setBusy]    = useState<string | null>(null)

  const load = useCallback(async () => {
    try { setUsers(await getBlockedUsers()) } catch {}
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [])

  async function handleUnblock(u: BlockedUser) {
    if (busy) return
    setBusy(u.id)
    try {
      await unblockUser(u.id)
      setUsers((prev) => prev.filter((x) => x.id !== u.id))
      toast.success(t.blk_okTitle, `${u.name.split(' ')[0]} — ${t.blk_okTitle.toLowerCase()}`)
    } catch {
      toast.error(t.error, t.blk_fail)
    }
    setBusy(null)
  }

  return (
    <View style={s.screen}>
      <View style={[s.header, { paddingTop: top + 8 }]}>
        <TouchableOpacity onPress={() => nav.goBack()} style={s.backBtn} hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}>
          <Ionicons name="chevron-back" size={20} color={T_C} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>{t.blk_title}</Text>
      </View>

      {loading ? (
        <View style={s.center}><ActivityIndicator color={B} /></View>
      ) : users.length === 0 ? (
        <View style={s.empty}>
          <View style={s.emptyIcon}><Ionicons name="ban-outline" size={30} color="#C0C0C8" /></View>
          <Text style={s.emptyTitle}>{t.blk_emptyTitle}</Text>
          <Text style={s.emptySub}>{t.blk_emptySub}</Text>
        </View>
      ) : (
        <FlatList
          data={users}
          keyExtractor={(u) => u.id}
          contentContainerStyle={[s.content, { paddingBottom: bottom + 32 }]}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={<Text style={s.sectionLabel}>{users.length} {users.length === 1 ? t.blk_person : t.blk_people}</Text>}
          renderItem={({ item, index }) => (
            <View style={[s.row, index === 0 && s.rowFirst, index === users.length - 1 && s.rowLast]}>
              <AvatarImage uri={item.avatar} name={item.name} size={44} />
              <Text style={s.name} numberOfLines={1}>{item.name}</Text>
              <TouchableOpacity
                style={s.unblockBtn}
                onPress={() => handleUnblock(item)}
                disabled={busy === item.id}
                activeOpacity={0.8}
              >
                {busy === item.id
                  ? <ActivityIndicator size="small" color={B} />
                  : <Text style={s.unblockTxt}>{t.blk_unblock}</Text>}
              </TouchableOpacity>
            </View>
          )}
          ItemSeparatorComponent={() => <View style={s.sep} />}
        />
      )}
    </View>
  )
}

const s = StyleSheet.create({
  screen:  { flex: 1, backgroundColor: SX },
  header:  { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingBottom: 12 },
  backBtn: { width: 40, height: 40, borderRadius: 999, backgroundColor: BG, borderWidth: 1, borderColor: BD, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontFamily: fonts.extraBold, fontSize: 22, letterSpacing: -0.5, color: T_C },

  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { paddingHorizontal: 16, paddingTop: 4 },
  sectionLabel: { fontFamily: fonts.bold, fontSize: 11, color: M, letterSpacing: 1, textTransform: 'uppercase', paddingLeft: 6, paddingBottom: 10 },

  row: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: BG, paddingHorizontal: 14, paddingVertical: 11, borderLeftWidth: 1, borderRightWidth: 1, borderColor: CARD_BD },
  rowFirst: { borderTopWidth: 1, borderTopLeftRadius: 18, borderTopRightRadius: 18 },
  rowLast:  { borderBottomWidth: 1, borderBottomLeftRadius: 18, borderBottomRightRadius: 18 },
  sep: { height: 1, backgroundColor: SEP, marginHorizontal: 0 },
  name: { flex: 1, fontFamily: fonts.semiBold, fontSize: 15, color: T_C },
  unblockBtn: { borderWidth: 1.4, borderColor: B, borderRadius: 18, paddingHorizontal: 14, paddingVertical: 7, minWidth: 96, alignItems: 'center' },
  unblockTxt: { fontFamily: fonts.bold, fontSize: 13, color: B },

  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 6, paddingHorizontal: 40 },
  emptyIcon: { width: 72, height: 72, borderRadius: 36, backgroundColor: '#F0F0F3', alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  emptyTitle: { fontFamily: fonts.bold, fontSize: 17, color: T_C },
  emptySub: { fontFamily: fonts.regular, fontSize: 13.5, color: S, textAlign: 'center', lineHeight: 20 },
})
