import React, { useState, useEffect } from 'react'
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useNavigation } from '@react-navigation/native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { useT } from '../../i18n'
import { fonts } from '../../theme'

const T_C = '#1A1A1A'
const M   = '#ABABAB'
const B   = '#CA2851'
const BD  = '#E5E5EA'
const BG  = '#FFFFFF'
const SX  = '#F9F9FB'
const SEP = '#F0F0F3'
const CARD_BD = '#EDEDF1'

const KEYS = { privateAcc: '@pv_private', onlineStatus: '@pv_online', twoFA: '@pv_2fa' }

function Toggle({ value, onToggle }: { value: boolean; onToggle: () => void }) {
  return (
    <TouchableOpacity style={[tog.track, value && tog.on]} onPress={onToggle} activeOpacity={0.8}>
      <View style={[tog.thumb, value && tog.thumbOn]} />
    </TouchableOpacity>
  )
}
const tog = StyleSheet.create({
  track:   { width: 46, height: 28, borderRadius: 999, backgroundColor: '#E5E5EA', padding: 2, justifyContent: 'center', flexShrink: 0 },
  on:      { backgroundColor: B },
  thumb:   { width: 24, height: 24, borderRadius: 999, backgroundColor: BG, alignSelf: 'flex-start', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.2, shadowRadius: 2, elevation: 2 },
  thumbOn: { alignSelf: 'flex-end' },
})

function Row({ iconName, title, subtitle, toggle, onToggle, onPress, isLast }: {
  iconName: string; title: string; subtitle?: string
  toggle?: boolean; onToggle?: () => void; onPress?: () => void; isLast?: boolean
}) {
  return (
    <TouchableOpacity style={[r.row, !isLast && r.sep]} onPress={toggle !== undefined ? onToggle : onPress} activeOpacity={0.75}>
      <View style={r.icon}><Ionicons name={iconName as any} size={17} color="#555" /></View>
      <View style={{ flex: 1 }}>
        <Text style={r.title}>{title}</Text>
        {!!subtitle && <Text style={r.sub}>{subtitle}</Text>}
      </View>
      {toggle !== undefined
        ? <Toggle value={toggle} onToggle={onToggle!} />
        : <Ionicons name="chevron-forward" size={17} color="#C4C4CC" />
      }
    </TouchableOpacity>
  )
}
const r = StyleSheet.create({
  row:  { flexDirection: 'row', alignItems: 'center', gap: 13, padding: 13, paddingHorizontal: 14 },
  sep:  { borderBottomWidth: 1, borderBottomColor: SEP },
  icon: { width: 32, height: 32, borderRadius: 9, backgroundColor: '#F2F2F5', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  title:{ fontFamily: fonts.semiBold, fontSize: 15, color: T_C },
  sub:  { fontFamily: fonts.medium, fontSize: 12, color: M, marginTop: 1 },
})

export default function PrivacyScreen() {
  const nav = useNavigation()
  const { top, bottom } = useSafeAreaInsets()
  const t = useT()

  const [privateAcc,   setPrivateAcc]   = useState(false)
  const [onlineStatus, setOnlineStatus] = useState(true)
  const [twoFA,        setTwoFA]        = useState(false)

  useEffect(() => {
    AsyncStorage.multiGet(Object.values(KEYS)).then(([[, pa], [, os], [, fa]]) => {
      if (pa !== null) setPrivateAcc(pa === '1')
      if (os !== null) setOnlineStatus(os === '1')
      if (fa !== null) setTwoFA(fa === '1')
    })
  }, [])

  function toggle(key: string, val: boolean, setter: (v: boolean) => void) {
    setter(val)
    AsyncStorage.setItem(key, val ? '1' : '0')
  }

  return (
    <View style={s.screen}>
      <View style={[s.header, { paddingTop: top + 8 }]}>
        <TouchableOpacity onPress={() => nav.goBack()} style={s.backBtn} hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}>
          <Ionicons name="chevron-back" size={20} color={T_C} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>{t.pv_title}</Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={[s.content, { paddingBottom: bottom + 32 }]}>
        <Text style={s.sectionLabel}>{t.pv_privacy}</Text>
        <View style={s.card}>
          <Row iconName="lock-closed-outline" title={t.pv_private} subtitle={t.pv_privateSub}
            toggle={privateAcc} onToggle={() => toggle(KEYS.privateAcc, !privateAcc, setPrivateAcc)} />
          <Row iconName="radio-outline" title={t.pv_online} subtitle={t.pv_onlineSub}
            toggle={onlineStatus} onToggle={() => toggle(KEYS.onlineStatus, !onlineStatus, setOnlineStatus)} isLast />
        </View>

        <Text style={s.sectionLabel}>{t.pv_security}</Text>
        <View style={s.card}>
          <Row iconName="shield-outline" title={t.pv_2fa}
            toggle={twoFA} onToggle={() => toggle(KEYS.twoFA, !twoFA, setTwoFA)} />
          <Row iconName="key-outline" title={t.pv_password}
            onPress={() => nav.navigate('ChangePassword' as never)} isLast />
        </View>

        <Text style={s.sectionLabel}>{t.pv_data}</Text>
        <View style={s.card}>
          <Row iconName="ban-outline" title={t.pv_blocked}
            onPress={() => nav.navigate('BlockedUsers' as never)} isLast />
        </View>
      </ScrollView>
    </View>
  )
}

const s = StyleSheet.create({
  screen:  { flex: 1, backgroundColor: SX },
  header:  { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingBottom: 12 },
  backBtn: { width: 40, height: 40, borderRadius: 999, backgroundColor: BG, borderWidth: 1, borderColor: BD, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontFamily: fonts.extraBold, fontSize: 20, letterSpacing: -0.4, color: T_C, flex: 1 },
  content:     { paddingHorizontal: 16, gap: 8, paddingTop: 4 },
  sectionLabel:{ fontFamily: fonts.bold, fontSize: 11, color: M, letterSpacing: 1, textTransform: 'uppercase', paddingLeft: 6, paddingBottom: 8, paddingTop: 2 },
  card:        { backgroundColor: BG, borderWidth: 1, borderColor: CARD_BD, borderRadius: 18, overflow: 'hidden' },
})
