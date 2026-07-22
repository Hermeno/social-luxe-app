import React, { useState, useEffect, useCallback } from 'react'
import {
  View, Text, StyleSheet, TouchableOpacity, FlatList, ActivityIndicator,
  RefreshControl, Image, Alert,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useNavigation, useFocusEffect } from '@react-navigation/native'
import * as ImagePicker from 'expo-image-picker'
import {
  getMyHalves, getIncomingHalves, completeHalf, deleteHalf, Half,
} from '../../services/half.service'
import AvatarImage from '../../components/AvatarImage'
import { toast } from '../../utils/toast'
import { fonts } from '../../theme'
import { API_BASE } from '../../config'

function resolveMedia(url: string) {
  return url.startsWith('http') ? url : `${API_BASE}${url}`
}

const T_C = '#1A1A1A'
const S   = '#6E6E73'
const M   = '#ABABAB'
const B   = '#CA2851'
const BG  = '#FFFFFF'
const SEP = '#F0F0F3'
const CARD_BD = '#EDEDF1'

type Tab = 'incoming' | 'mine'

// Quanto falta até a metade morrer. Uma metade que expira nunca foi publicada —
// é isso que dá urgência ao ecrã, por isso o contador é o dado mais visível.
function timeLeft(expiresAt: string): string {
  const ms = new Date(expiresAt).getTime() - Date.now()
  if (ms <= 0) return 'a expirar'
  const h = Math.floor(ms / 3_600_000)
  if (h >= 1) return `${h}h`
  return `${Math.max(1, Math.floor(ms / 60_000))}min`
}

export default function HalvesScreen() {
  const nav = useNavigation<any>()
  const { top, bottom } = useSafeAreaInsets()

  const [tab,      setTab]      = useState<Tab>('incoming')
  const [incoming, setIncoming] = useState<Half[]>([])
  const [mine,     setMine]     = useState<Half[]>([])
  const [loading,  setLoading]  = useState(true)
  const [refresh,  setRefresh]  = useState(false)
  const [busy,     setBusy]     = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const [inc, own] = await Promise.all([getIncomingHalves(), getMyHalves()])
      setIncoming(inc)
      setMine(own)
    } catch {}
    setLoading(false)
    setRefresh(false)
  }, [])

  useEffect(() => { load() }, [])
  useFocusEffect(useCallback(() => { load() }, [load]))

  // Completar exige a câmara: a tua metade é tirada agora, não escolhida da
  // galeria. Duas metades preparadas em separado seriam duas fotos soltas.
  async function handleComplete(half: Half) {
    if (busy) return
    const perm = await ImagePicker.requestCameraPermissionsAsync()
    if (!perm.granted) {
      Alert.alert('Câmara', 'Precisas de dar acesso à câmara para completar uma metade.')
      return
    }
    const shot = await ImagePicker.launchCameraAsync({ quality: 0.8 })
    if (shot.canceled || !shot.assets?.[0]) return

    setBusy(half.id)
    try {
      const post = await completeHalf(half.id, shot.assets[0].uri)
      setIncoming((prev) => prev.filter((h) => h.id !== half.id))
      toast.success('Ficou inteira', `Tu e ${half.creator.name.split(' ')[0]} publicaram.`)
      nav.navigate('PostViewer', { posts: [post], startIndex: 0 })
    } catch (e: unknown) {
      const msg = (e as any)?.response?.data?.message ?? 'Não foi possível completar.'
      toast.error('Erro', msg)
      load()
    }
    setBusy(null)
  }

  async function handleDelete(half: Half) {
    if (busy) return
    setBusy(half.id)
    try {
      await deleteHalf(half.id)
      setMine((prev) => prev.filter((h) => h.id !== half.id))
    } catch {
      toast.error('Erro', 'Não foi possível apagar.')
    }
    setBusy(null)
  }

  function renderIncoming({ item }: { item: Half }) {
    const first = item.creator.name.split(' ')[0]
    return (
      <View style={s.card}>
        <Image source={{ uri: resolveMedia(item.mediaUrl) }} style={s.thumb} />
        <View style={s.cardBody}>
          <View style={s.who}>
            <AvatarImage uri={item.creator.avatar} size={22} name={item.creator.name} />
            <Text style={s.whoTxt} numberOfLines={1}>{first}</Text>
            <View style={s.clock}>
              <Ionicons name="time-outline" size={11} color={M} />
              <Text style={s.clockTxt}>{timeLeft(item.expiresAt)}</Text>
            </View>
          </View>
          {item.caption ? <Text style={s.caption} numberOfLines={2}>{item.caption}</Text> : null}
          <Text style={s.hint}>
            {item.targetUserId ? 'Escolheu-te para completar.' : 'Aberta — qualquer ligação pode completar.'}
          </Text>
          <TouchableOpacity style={s.cta} onPress={() => handleComplete(item)} activeOpacity={0.85} disabled={busy === item.id}>
            {busy === item.id
              ? <ActivityIndicator size="small" color="#fff" />
              : <><Ionicons name="camera" size={14} color="#fff" /><Text style={s.ctaTxt}>Completar</Text></>}
          </TouchableOpacity>
        </View>
      </View>
    )
  }

  function renderMine({ item }: { item: Half }) {
    return (
      <View style={s.card}>
        <Image source={{ uri: resolveMedia(item.mediaUrl) }} style={s.thumb} />
        <View style={s.cardBody}>
          <View style={s.who}>
            <Text style={s.whoTxt} numberOfLines={1}>
              {item.targetUser ? `À espera de ${item.targetUser.name.split(' ')[0]}` : 'Aberta a quem quiser'}
            </Text>
            <View style={s.clock}>
              <Ionicons name="time-outline" size={11} color={M} />
              <Text style={s.clockTxt}>{timeLeft(item.expiresAt)}</Text>
            </View>
          </View>
          {item.caption ? <Text style={s.caption} numberOfLines={2}>{item.caption}</Text> : null}
          <Text style={s.hint}>Se ninguém completar, isto nunca foi publicado.</Text>
          <TouchableOpacity style={s.ghost} onPress={() => handleDelete(item)} activeOpacity={0.8} disabled={busy === item.id}>
            <Text style={s.ghostTxt}>Desistir</Text>
          </TouchableOpacity>
        </View>
      </View>
    )
  }

  const data      = tab === 'incoming' ? incoming : mine
  const emptyTxt  = tab === 'incoming'
    ? 'Ninguém está à tua espera agora.'
    : 'Não tens nenhuma metade à espera.'
  const emptySub  = tab === 'incoming'
    ? 'Quando alguém começar uma publicação contigo, aparece aqui.'
    : 'Começa uma no Criar — depois escolhe quem a completa.'

  return (
    <View style={s.screen}>
      <View style={[s.header, { paddingTop: top + 8 }]}>
        <TouchableOpacity onPress={() => nav.goBack()} style={s.backBtn} hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}>
          <Ionicons name="chevron-back" size={20} color={T_C} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Metades</Text>
      </View>

      <View style={s.tabs}>
        {(['incoming', 'mine'] as Tab[]).map((k) => (
          <TouchableOpacity key={k} style={[s.tab, tab === k && s.tabOn]} onPress={() => setTab(k)} activeOpacity={0.8}>
            <Text style={[s.tabTxt, tab === k && s.tabTxtOn]}>
              {k === 'incoming' ? `Para ti${incoming.length ? ` (${incoming.length})` : ''}` : 'Tuas'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <View style={s.center}><ActivityIndicator color={B} /></View>
      ) : (
        <FlatList
          data={data}
          keyExtractor={(h) => h.id}
          renderItem={tab === 'incoming' ? renderIncoming : renderMine}
          contentContainerStyle={[s.list, { paddingBottom: bottom + 24 }]}
          refreshControl={<RefreshControl refreshing={refresh} onRefresh={() => { setRefresh(true); load() }} tintColor={B} />}
          ListEmptyComponent={
            <View style={s.empty}>
              <Text style={s.emptyTitle}>{emptyTxt}</Text>
              <Text style={s.emptySub}>{emptySub}</Text>
            </View>
          }
        />
      )}
    </View>
  )
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: BG },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 12, paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: SEP,
  },
  backBtn: { padding: 4 },
  headerTitle: { fontSize: 17, fontFamily: fonts.semiBold, color: T_C, letterSpacing: -0.3 },

  tabs: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingVertical: 12 },
  tab: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 16, backgroundColor: '#F5F5F7' },
  tabOn: { backgroundColor: T_C },
  tabTxt: { fontSize: 13, fontFamily: fonts.semiBold, color: S },
  tabTxtOn: { color: '#fff' },

  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  list: { paddingHorizontal: 16, gap: 12 },

  card: {
    flexDirection: 'row', gap: 12, padding: 10,
    borderRadius: 16, borderWidth: StyleSheet.hairlineWidth, borderColor: CARD_BD,
  },
  thumb: { width: 84, height: 112, borderRadius: 12, backgroundColor: '#F2F2F5' },
  cardBody: { flex: 1, gap: 6, justifyContent: 'center' },

  who: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  whoTxt: { flex: 1, fontSize: 14, fontFamily: fonts.semiBold, color: T_C, letterSpacing: -0.2 },
  clock: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  clockTxt: { fontSize: 11, fontFamily: fonts.regular, color: M },

  caption: { fontSize: 13, fontFamily: fonts.regular, color: S, lineHeight: 18 },
  hint: { fontSize: 11, fontFamily: fonts.regular, color: M, lineHeight: 15 },

  cta: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    marginTop: 2, height: 34, borderRadius: 17, backgroundColor: B,
  },
  ctaTxt: { fontSize: 13, fontFamily: fonts.semiBold, color: '#fff' },

  ghost: {
    marginTop: 2, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth, borderColor: CARD_BD,
  },
  ghostTxt: { fontSize: 12, fontFamily: fonts.semiBold, color: S },

  empty: { alignItems: 'center', paddingTop: 80, paddingHorizontal: 32, gap: 8 },
  emptyTitle: { fontSize: 16, fontFamily: fonts.semiBold, color: T_C, textAlign: 'center', letterSpacing: -0.3 },
  emptySub: { fontSize: 13, fontFamily: fonts.regular, color: M, textAlign: 'center', lineHeight: 19 },
})
