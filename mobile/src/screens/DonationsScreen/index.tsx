import React, { useState, useCallback } from 'react'
import {
  View, Text, TouchableOpacity, StyleSheet, FlatList,
  ActivityIndicator, RefreshControl, Image,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useNavigation, useFocusEffect } from '@react-navigation/native'
import { StackNavigationProp } from '@react-navigation/stack'
import { Ionicons, Feather } from '@expo/vector-icons'
import { LinearGradient } from 'expo-linear-gradient'
import * as Location from 'expo-location'
import { colors, fonts } from '../../theme'
import AvatarImage from '../../components/AvatarImage'
import { getNearbyDonations, getMyDonations, Donation, DonationStatus } from '../../services/donation.service'
import { AppStackParams } from '../../navigation/AppNavigator'
import { useT, Strings } from '../../i18n'

type Nav = StackNavigationProp<AppStackParams>
type Tab = 'nearby' | 'mine'

const STATUS_KEY: Record<DonationStatus, keyof Strings> = {
  AVAILABLE: 'dn_status_available',
  RESERVED:  'dn_status_reserved',
  DELIVERED: 'dn_status_delivered',
  EXPIRED:   'dn_status_expired',
}
const STATUS_COLOR: Record<DonationStatus, string> = {
  AVAILABLE: colors.primary,
  RESERVED:  '#B8860B',
  DELIVERED: '#22C55E',
  EXPIRED:   colors.gray400,
}

function DonationCard({ item, mine, onPress }: { item: Donation; mine: boolean; onPress: () => void }) {
  const t = useT()
  const photo = item.photos?.[0] ?? null
  return (
    <TouchableOpacity style={s.card} onPress={onPress} activeOpacity={0.85}>
      {photo ? (
        <Image source={{ uri: photo }} style={s.cardImg} />
      ) : (
        <LinearGradient colors={['#CA2851', '#FF6766']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.cardImg}>
          <Ionicons name={item.type === 'ITEM' ? 'gift' : 'cash'} size={24} color="#fff" />
        </LinearGradient>
      )}

      <View style={s.cardBody}>
        <View style={s.cardTopRow}>
          <Text style={s.cardTitle} numberOfLines={1}>{item.title}</Text>
          <View style={[s.statusPill, { backgroundColor: `${STATUS_COLOR[item.status]}18` }]}>
            <View style={[s.statusDot, { backgroundColor: STATUS_COLOR[item.status] }]} />
            <Text style={[s.statusTxt, { color: STATUS_COLOR[item.status] }]}>{t[STATUS_KEY[item.status]]}</Text>
          </View>
        </View>

        {!!item.description && (
          <Text style={s.cardDesc} numberOfLines={2}>{item.description}</Text>
        )}

        <View style={s.cardFooter}>
          {mine ? (
            item.requester ? (
              <View style={s.footerRow}>
                <AvatarImage uri={item.requester.avatar} name={item.requester.name} size={16} />
                <Text style={s.footerTxt} numberOfLines={1}>{item.requester.name} {t.dn_requested}</Text>
              </View>
            ) : (
              <Text style={s.footerTxt}>{t.dn_no_requests}</Text>
            )
          ) : (
            <View style={s.footerRow}>
              <AvatarImage uri={item.donor.avatar} name={item.donor.name} size={16} />
              <Text style={s.footerTxt} numberOfLines={1}>{item.donor.name}</Text>
              {item.distanceKm != null && (
                <Text style={s.footerDist}>· {item.distanceKm} km</Text>
              )}
            </View>
          )}
        </View>
      </View>
    </TouchableOpacity>
  )
}

export default function DonationsScreen() {
  const { top, bottom } = useSafeAreaInsets()
  const nav = useNavigation<Nav>()
  const t = useT()
  const canGoBack = nav.canGoBack()

  const [tab,         setTab]         = useState<Tab>('nearby')
  const [donations,   setDonations]   = useState<Donation[]>([])
  const [loading,     setLoading]     = useState(true)
  const [refreshing,  setRefreshing]  = useState(false)
  const [locDenied,   setLocDenied]   = useState(false)
  const [loadError,   setLoadError]   = useState(false)

  const load = useCallback(async (activeTab: Tab, isRefresh = false) => {
    isRefresh ? setRefreshing(true) : setLoading(true)
    setLoadError(false)
    try {
      if (activeTab === 'mine') {
        setDonations(await getMyDonations())
        setLocDenied(false)
      } else {
        const { status } = await Location.requestForegroundPermissionsAsync()
        if (status !== 'granted') {
          setLocDenied(true)
          setDonations([])
          return
        }
        setLocDenied(false)
        const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced })
        setDonations(await getNearbyDonations(pos.coords.latitude, pos.coords.longitude))
      }
    } catch {
      setLoadError(true)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useFocusEffect(useCallback(() => { load(tab) }, [tab, load]))

  function renderEmpty() {
    if (loading) return null
    if (locDenied) {
      return (
        <View style={s.empty}>
          <Ionicons name="location-outline" size={36} color={colors.gray300} />
          <Text style={s.emptyTitle}>{t.dn_need_location}</Text>
          <Text style={s.emptySub}>{t.dn_need_location_sub}</Text>
          <TouchableOpacity style={s.emptyBtn} onPress={() => load('nearby')} activeOpacity={0.85}>
            <Text style={s.emptyBtnTxt}>{t.dn_try_again}</Text>
          </TouchableOpacity>
        </View>
      )
    }
    if (loadError) {
      return (
        <View style={s.empty}>
          <Ionicons name="wifi-outline" size={36} color={colors.gray300} />
          <Text style={s.emptyTitle}>{t.dn_load_fail}</Text>
          <Text style={s.emptySub}>{t.dn_load_fail_sub}</Text>
          <TouchableOpacity style={s.emptyBtn} onPress={() => load(tab)} activeOpacity={0.85}>
            <Text style={s.emptyBtnTxt}>{t.dn_try_again}</Text>
          </TouchableOpacity>
        </View>
      )
    }
    return (
      <View style={s.empty}>
        <LinearGradient colors={['#CA2851', '#FF6766', '#FFB173']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.emptyIcon}>
          <Feather name="heart" size={30} color="#fff" />
        </LinearGradient>
        <Text style={s.emptyTitle}>
          {tab === 'mine' ? t.dn_empty_mine : t.dn_empty_nearby}
        </Text>
        <Text style={s.emptySub}>
          {tab === 'mine' ? t.dn_empty_mine_sub : t.dn_empty_nearby_sub}
        </Text>
        <TouchableOpacity style={s.emptyBtn} onPress={() => nav.navigate('CreateDonation')} activeOpacity={0.85}>
          <Text style={s.emptyBtnTxt}>{t.dn_post}</Text>
        </TouchableOpacity>
      </View>
    )
  }

  return (
    <View style={s.screen}>
      {/* Header */}
      <View style={[s.header, { paddingTop: top + 12 }]}>
        {canGoBack
          ? <TouchableOpacity onPress={() => nav.goBack()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Ionicons name="chevron-back" size={26} color={colors.dark} />
            </TouchableOpacity>
          : <View style={{ width: 26 }} />
        }
        <Text style={s.headerTitle}>{t.dn_title}</Text>
        <TouchableOpacity onPress={() => nav.navigate('CreateDonation')} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Ionicons name="add-circle" size={27} color={colors.primary} />
        </TouchableOpacity>
      </View>

      {/* Tabs */}
      <View style={s.tabRow}>
        <TouchableOpacity style={[s.tabBtn, tab === 'nearby' && s.tabBtnActive]} onPress={() => setTab('nearby')} activeOpacity={0.8}>
          <Text style={[s.tabTxt, tab === 'nearby' && s.tabTxtActive]}>{t.dn_tab_nearby}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[s.tabBtn, tab === 'mine' && s.tabBtnActive]} onPress={() => setTab('mine')} activeOpacity={0.8}>
          <Text style={[s.tabTxt, tab === 'mine' && s.tabTxtActive]}>{t.dn_tab_mine}</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={s.loadingWrap}>
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      ) : (
        <FlatList
          data={donations}
          keyExtractor={(d) => d.id}
          contentContainerStyle={[s.list, { paddingBottom: Math.max(bottom, 16) + 24 }, donations.length === 0 && { flex: 1 }]}
          ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
          ListEmptyComponent={renderEmpty}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => load(tab, true)} tintColor={colors.primary} />
          }
          renderItem={({ item }) => (
            <DonationCard
              item={item}
              mine={tab === 'mine'}
              onPress={() => nav.navigate('DonationDetail', { donationId: item.id })}
            />
          )}
        />
      )}
    </View>
  )
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.white },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingBottom: 14,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#EBEBEB',
  },
  headerTitle: { fontSize: 17, fontFamily: fonts.bold, color: colors.dark, letterSpacing: -0.2 },

  tabRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingVertical: 12 },
  tabBtn: {
    flex: 1, alignItems: 'center', paddingVertical: 10,
    borderRadius: 12, backgroundColor: colors.gray100,
  },
  tabBtnActive: { backgroundColor: colors.primary },
  tabTxt:       { fontSize: 13.5, fontFamily: fonts.semiBold, color: colors.gray500 },
  tabTxtActive: { color: '#fff' },

  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  list: { paddingHorizontal: 16 },

  card: {
    flexDirection: 'row', gap: 12,
    borderRadius: 16, padding: 10,
    borderWidth: 1, borderColor: colors.gray200,
  },
  cardImg: {
    width: 64, height: 64, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.gray100,
  },
  cardBody: { flex: 1, gap: 4, justifyContent: 'center' },
  cardTopRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  cardTitle: { flex: 1, fontSize: 15, fontFamily: fonts.semiBold, color: colors.dark, letterSpacing: -0.2 },

  statusPill: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  statusDot:  { width: 5, height: 5, borderRadius: 2.5 },
  statusTxt:  { fontSize: 10.5, fontFamily: fonts.semiBold },

  cardDesc: { fontSize: 12.5, fontFamily: fonts.regular, color: colors.gray500, lineHeight: 17 },

  cardFooter: { marginTop: 2 },
  footerRow:  { flexDirection: 'row', alignItems: 'center', gap: 6 },
  footerTxt:  { fontSize: 12, fontFamily: fonts.medium, color: colors.gray600, flexShrink: 1 },
  footerDist: { fontSize: 12, fontFamily: fonts.regular, color: colors.gray400 },

  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40, gap: 10 },
  emptyIcon: { width: 76, height: 76, borderRadius: 22, alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
  emptyTitle: { fontSize: 17, fontFamily: fonts.bold, color: colors.dark, textAlign: 'center', letterSpacing: -0.3 },
  emptySub:   { fontSize: 13, fontFamily: fonts.regular, color: colors.gray500, textAlign: 'center', lineHeight: 19 },
  emptyBtn:   { marginTop: 8, backgroundColor: colors.primary, paddingHorizontal: 22, paddingVertical: 11, borderRadius: 14 },
  emptyBtnTxt: { fontSize: 14, fontFamily: fonts.semiBold, color: '#fff' },
})
