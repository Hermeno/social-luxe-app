import React, { useEffect, useMemo, useState } from 'react'
import {
  View, Text, StyleSheet, TouchableOpacity, FlatList, Modal,
  ActivityIndicator, TextInput,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import AvatarImage from '../../components/AvatarImage'
import { getConnections } from '../../services/follow.service'
import { fonts } from '../../theme'
import { useT } from '../../i18n'

type Person = { id: string; name: string; avatar: string | null }

interface Props {
  visible: boolean
  onClose: () => void
  // targetId null = metade aberta, qualquer ligação pode completar
  onPick: (targetId: string | null) => void
}

// O último passo antes de publicar deixou de ser "Publicar" e passou a ser
// "quem completa isto". É aqui que a regra da app se torna gesto.
export default function TargetPicker({ visible, onClose, onPick }: Props) {
  const { top, bottom } = useSafeAreaInsets()
  const t = useT()
  const [people,  setPeople]  = useState<Person[]>([])
  const [loading, setLoading] = useState(true)
  const [query,   setQuery]   = useState('')

  useEffect(() => {
    if (!visible) return
    setLoading(true)
    // A ligação traz a pessoa em `.user` — ler os campos no topo dava tudo
    // vazio, e um cast para `any` tinha escondido isso do compilador.
    getConnections()
      .then((cs) => setPeople(cs.map((c) => ({
        id:     c.user.id,
        name:   c.user.name,
        avatar: c.user.avatar ?? null,
      }))))
      .catch(() => setPeople([]))
      .finally(() => setLoading(false))
  }, [visible])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return q ? people.filter((p) => p.name.toLowerCase().includes(q)) : people
  }, [people, query])

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose} presentationStyle="fullScreen">
      <View style={s.screen}>
        <View style={[s.header, { paddingTop: top }]}>
          <TouchableOpacity
            style={s.headerSide}
            onPress={onClose}
            activeOpacity={0.65}
            accessibilityRole="button"
            accessibilityLabel={t.cancel}
          >
            <Text style={s.cancelTxt}>{t.cancel}</Text>
          </TouchableOpacity>
          <View style={s.headerIdentity} pointerEvents="none">
            <View style={s.brandSignal}>
              <View style={s.brandSignalLine} />
              <View style={s.brandSignalDot} />
            </View>
            <Text style={s.title}>{t.create_target_title}</Text>
          </View>
          <View style={s.headerSide} />
        </View>

        <Text style={s.sub}>{t.create_target_sub}</Text>

        <TouchableOpacity
          style={s.openRow}
          onPress={() => onPick(null)}
          activeOpacity={0.68}
          accessibilityRole="button"
          accessibilityLabel={t.create_target_open}
        >
          <View style={s.openSignal} />
          <Ionicons name="globe-outline" size={20} color="#FF7A1C" />
          <View style={s.openCopy}>
            <Text style={s.openTitle}>{t.create_target_open}</Text>
            <Text style={s.openSub}>{t.create_target_open_sub}</Text>
          </View>
          <Ionicons name="chevron-forward" size={17} color="#A8A8AF" />
        </TouchableOpacity>

        <View style={s.searchWrap}>
          <Ionicons name="search" size={18} color="#77777D" />
          <TextInput
            style={s.search}
            placeholder={t.search_ph}
            placeholderTextColor="#A0A0A5"
            value={query}
            onChangeText={setQuery}
            returnKeyType="search"
          />
        </View>

        <Text style={s.sectionLabel}>{t.ep_connections}</Text>

        {loading ? (
          <View style={s.center}><ActivityIndicator color="#FF7A1C" /></View>
        ) : (
          <FlatList
            data={filtered}
            keyExtractor={(p) => p.id}
            keyboardShouldPersistTaps="handled"
            style={s.list}
            contentContainerStyle={{ paddingBottom: bottom + 16 }}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={s.row}
                onPress={() => onPick(item.id)}
                activeOpacity={0.68}
                accessibilityRole="button"
                accessibilityLabel={item.name}
              >
                <AvatarImage uri={item.avatar} size={38} name={item.name} />
                <Text style={s.rowName} numberOfLines={1}>{item.name}</Text>
                <Ionicons name="chevron-forward" size={17} color="#A8A8AF" />
              </TouchableOpacity>
            )}
            ListEmptyComponent={
              <Text style={s.empty}>{t.create_target_empty}</Text>
            }
          />
        )}
      </View>
    </Modal>
  )
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#FAFAF8' },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    backgroundColor: '#FAFAF8',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#D8D8D5',
  },
  headerSide: {
    width: 96,
    height: 52,
    paddingHorizontal: 16,
    justifyContent: 'center',
  },
  headerIdentity: {
    flex: 1,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
  },
  brandSignal: { height: 4, flexDirection: 'row', alignItems: 'center', gap: 3 },
  brandSignalLine: { width: 18, height: 2, backgroundColor: '#FF7A1C' },
  brandSignalDot: { width: 3, height: 3, borderRadius: 1.5, backgroundColor: '#FF7A1C' },
  cancelTxt: { fontSize: 14, fontFamily: fonts.medium, color: '#5C5C63' },
  title: { fontSize: 15, fontFamily: fonts.semiBold, color: '#1A1A1A', letterSpacing: -0.2 },
  sub: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 13,
    fontFamily: fonts.regular,
    color: '#6E6E73',
    lineHeight: 19,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#DEDEDA',
  },
  openRow: {
    minHeight: 72,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#D8D8D5',
  },
  openSignal: { width: 2, height: 24, backgroundColor: '#FF7A1C' },
  openCopy: { flex: 1, minWidth: 0 },
  openTitle: { fontSize: 14, fontFamily: fonts.semiBold, color: '#1A1A1A' },
  openSub: { fontSize: 12, fontFamily: fonts.regular, color: '#86868C', marginTop: 2 },
  searchWrap: {
    height: 52,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#D8D8D5',
  },
  search: { flex: 1, fontSize: 14, fontFamily: fonts.regular, color: '#1A1A1A', padding: 0 },
  sectionLabel: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
    fontSize: 11,
    fontFamily: fonts.semiBold,
    letterSpacing: 0.7,
    color: '#77777D',
  },
  center: { paddingVertical: 40, alignItems: 'center' },
  list: { flex: 1 },
  row: {
    minHeight: 58,
    marginLeft: 16,
    paddingRight: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#DEDEDA',
  },
  rowName: { flex: 1, fontSize: 14.5, fontFamily: fonts.medium, color: '#1A1A1A' },
  empty: {
    fontSize: 13,
    fontFamily: fonts.regular,
    color: '#929298',
    textAlign: 'center',
    paddingVertical: 36,
    paddingHorizontal: 24,
    lineHeight: 19,
  },
})
