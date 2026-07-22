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
  const { bottom } = useSafeAreaInsets()
  const [people,  setPeople]  = useState<Person[]>([])
  const [loading, setLoading] = useState(true)
  const [query,   setQuery]   = useState('')

  useEffect(() => {
    if (!visible) return
    setLoading(true)
    getConnections()
      .then((cs) => setPeople(cs.map((c: any) => ({ id: c.id, name: c.name, avatar: c.avatar ?? null }))))
      .catch(() => setPeople([]))
      .finally(() => setLoading(false))
  }, [visible])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return q ? people.filter((p) => p.name.toLowerCase().includes(q)) : people
  }, [people, query])

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={s.backdrop}>
        <View style={[s.sheet, { paddingBottom: bottom + 12 }]}>
          <View style={s.grabber} />
          <Text style={s.title}>Quem completa?</Text>
          <Text style={s.sub}>Sem a metade de alguém, isto não vai para o feed.</Text>

          <TouchableOpacity style={s.open} onPress={() => onPick(null)} activeOpacity={0.85}>
            <View style={s.openIcon}><Ionicons name="globe-outline" size={16} color="#CA2851" /></View>
            <View style={{ flex: 1 }}>
              <Text style={s.openTitle}>Deixar aberta</Text>
              <Text style={s.openSub}>A primeira ligação que responder fica no post</Text>
            </View>
          </TouchableOpacity>

          <View style={s.searchWrap}>
            <Ionicons name="search" size={15} color="#ABABAB" />
            <TextInput
              style={s.search}
              placeholder="Procurar"
              placeholderTextColor="#ABABAB"
              value={query}
              onChangeText={setQuery}
            />
          </View>

          {loading ? (
            <View style={s.center}><ActivityIndicator color="#CA2851" /></View>
          ) : (
            <FlatList
              data={filtered}
              keyExtractor={(p) => p.id}
              keyboardShouldPersistTaps="handled"
              style={s.list}
              renderItem={({ item }) => (
                <TouchableOpacity style={s.row} onPress={() => onPick(item.id)} activeOpacity={0.7}>
                  <AvatarImage uri={item.avatar} size={38} name={item.name} />
                  <Text style={s.rowName} numberOfLines={1}>{item.name}</Text>
                  <Ionicons name="chevron-forward" size={16} color="#D5D5DA" />
                </TouchableOpacity>
              )}
              ListEmptyComponent={
                <Text style={s.empty}>
                  Ainda não tens ligações. Segue alguém — no Luxee ninguém publica sozinho.
                </Text>
              }
            />
          )}

          <TouchableOpacity style={s.cancel} onPress={onClose} activeOpacity={0.8}>
            <Text style={s.cancelTxt}>Cancelar</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  )
}

const s = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 22, borderTopRightRadius: 22,
    paddingHorizontal: 18, paddingTop: 8, maxHeight: '82%',
  },
  grabber: {
    width: 38, height: 4, borderRadius: 2, backgroundColor: '#E5E5EA',
    alignSelf: 'center', marginBottom: 14,
  },
  title: { fontSize: 19, fontFamily: fonts.semiBold, color: '#1A1A1A', letterSpacing: -0.4 },
  sub: { fontSize: 13, fontFamily: fonts.regular, color: '#6E6E73', marginTop: 3, lineHeight: 18 },

  open: {
    flexDirection: 'row', alignItems: 'center', gap: 11,
    marginTop: 16, padding: 12, borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth, borderColor: '#EDEDF1',
  },
  openIcon: {
    width: 32, height: 32, borderRadius: 16,
    alignItems: 'center', justifyContent: 'center', backgroundColor: '#FDEEF2',
  },
  openTitle: { fontSize: 14, fontFamily: fonts.semiBold, color: '#1A1A1A' },
  openSub: { fontSize: 12, fontFamily: fonts.regular, color: '#ABABAB', marginTop: 1 },

  searchWrap: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginTop: 14, paddingHorizontal: 12, height: 40,
    borderRadius: 12, backgroundColor: '#F5F5F7',
  },
  search: { flex: 1, fontSize: 14, fontFamily: fonts.regular, color: '#1A1A1A', padding: 0 },

  center: { paddingVertical: 40, alignItems: 'center' },
  list: { marginTop: 6 },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 11, paddingVertical: 9,
  },
  rowName: { flex: 1, fontSize: 14.5, fontFamily: fonts.medium, color: '#1A1A1A' },
  empty: {
    fontSize: 13, fontFamily: fonts.regular, color: '#ABABAB',
    textAlign: 'center', paddingVertical: 36, paddingHorizontal: 20, lineHeight: 19,
  },

  cancel: { height: 44, alignItems: 'center', justifyContent: 'center', marginTop: 4 },
  cancelTxt: { fontSize: 14, fontFamily: fonts.semiBold, color: '#6E6E73' },
})
