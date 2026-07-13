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

const KEY = '@notif_settings'

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

function Row({ iconName, title, subtitle, value, onToggle, isLast }: {
  iconName: string; title: string; subtitle?: string; value: boolean; onToggle: () => void; isLast?: boolean
}) {
  return (
    <View style={[r.row, !isLast && r.sep]}>
      <View style={r.iconWrap}><Ionicons name={iconName as any} size={17} color="#555" /></View>
      <View style={{ flex: 1 }}>
        <Text style={r.title}>{title}</Text>
        {!!subtitle && <Text style={r.sub}>{subtitle}</Text>}
      </View>
      <Toggle value={value} onToggle={onToggle} />
    </View>
  )
}
const r = StyleSheet.create({
  row:     { flexDirection: 'row', alignItems: 'center', gap: 13, padding: 13, paddingHorizontal: 14 },
  sep:     { borderBottomWidth: 1, borderBottomColor: SEP },
  iconWrap:{ width: 32, height: 32, borderRadius: 9, backgroundColor: '#F2F2F5', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  title:   { fontFamily: fonts.semiBold, fontSize: 15, color: T_C },
  sub:     { fontFamily: fonts.medium, fontSize: 12, color: M, marginTop: 1 },
})

interface Settings { pauseAll: boolean; followers: boolean; likes: boolean; comments: boolean; mentions: boolean; dms: boolean; digest: boolean; news: boolean }
const DEFAULTS: Settings = { pauseAll: false, followers: true, likes: true, comments: true, mentions: true, dms: true, digest: false, news: false }

export default function NotifSettingsScreen() {
  const nav = useNavigation()
  const { top, bottom } = useSafeAreaInsets()
  const t = useT()
  const [cfg, setCfg] = useState<Settings>(DEFAULTS)

  useEffect(() => {
    AsyncStorage.getItem(KEY).then(v => {
      if (v) { try { setCfg({ ...DEFAULTS, ...JSON.parse(v) }) } catch {} }
    })
  }, [])

  function set(key: keyof Settings, val: boolean) {
    const next = { ...cfg, [key]: val }
    setCfg(next)
    AsyncStorage.setItem(KEY, JSON.stringify(next))
  }

  const pushEnabled = !cfg.pauseAll

  return (
    <View style={s.screen}>
      <View style={[s.header, { paddingTop: top + 8 }]}>
        <TouchableOpacity onPress={() => nav.goBack()} style={s.backBtn} hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}>
          <Ionicons name="chevron-back" size={20} color={T_C} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>{t.nf_title}</Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={[s.content, { paddingBottom: bottom + 32 }]}>
        <View style={[s.pauseCard, cfg.pauseAll && s.pauseCardOn]}>
          <View style={{ flex: 1 }}>
            <Text style={[s.pauseTitle, cfg.pauseAll && s.pauseTitleOn]}>{t.nf_pauseAll}</Text>
            <Text style={[s.pauseSub, cfg.pauseAll && s.pauseSubOn]}>{t.nf_pauseSub}</Text>
          </View>
          <Toggle value={cfg.pauseAll} onToggle={() => set('pauseAll', !cfg.pauseAll)} />
        </View>

        <Text style={s.sectionLabel}>{t.nf_push}</Text>
        <View style={[s.card, !pushEnabled && { opacity: 0.45 }]}>
          <Row iconName="people-outline"    title={t.nf_followers}                  value={pushEnabled && cfg.followers} onToggle={() => set('followers', !cfg.followers)} />
          <Row iconName="heart-outline"     title={t.nf_likes}    subtitle={t.nf_likesSub} value={pushEnabled && cfg.likes}     onToggle={() => set('likes', !cfg.likes)} />
          <Row iconName="chatbubble-outline" title={t.nf_comments}                  value={pushEnabled && cfg.comments} onToggle={() => set('comments', !cfg.comments)} />
          <Row iconName="at-outline"        title={t.nf_mentions}                  value={pushEnabled && cfg.mentions} onToggle={() => set('mentions', !cfg.mentions)} />
          <Row iconName="paper-plane-outline" title={t.nf_dms}                     value={pushEnabled && cfg.dms}      onToggle={() => set('dms', !cfg.dms)} isLast />
        </View>

        <Text style={s.sectionLabel}>{t.nf_email}</Text>
        <View style={s.card}>
          <Row iconName="mail-outline"     title={t.nf_digest}   subtitle={t.nf_digestSub} value={cfg.digest} onToggle={() => set('digest', !cfg.digest)} />
          <Row iconName="megaphone-outline" title={t.nf_news}                               value={cfg.news}   onToggle={() => set('news', !cfg.news)} isLast />
        </View>
      </ScrollView>
    </View>
  )
}

const s = StyleSheet.create({
  screen:  { flex: 1, backgroundColor: SX },
  header:  { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingBottom: 12 },
  backBtn: { width: 40, height: 40, borderRadius: 999, backgroundColor: BG, borderWidth: 1, borderColor: BD, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontFamily: fonts.extraBold, fontSize: 22, letterSpacing: -0.5, color: T_C },
  content: { paddingHorizontal: 16, gap: 8, paddingTop: 4 },

  pauseCard:    { flexDirection: 'row', alignItems: 'center', gap: 13, padding: 16, borderRadius: 18, backgroundColor: BG, borderWidth: 1, borderColor: CARD_BD },
  pauseCardOn:  { backgroundColor: 'rgba(202,40,81,0.06)', borderColor: 'rgba(202,40,81,0.22)' },
  pauseTitle:   { fontFamily: fonts.bold, fontSize: 15, color: T_C },
  pauseTitleOn: { color: B },
  pauseSub:     { fontFamily: fonts.medium, fontSize: 12, color: M, marginTop: 2 },
  pauseSubOn:   { color: '#CA2851AA' },

  sectionLabel: { fontFamily: fonts.bold, fontSize: 11, color: M, letterSpacing: 1, textTransform: 'uppercase', paddingLeft: 6, paddingBottom: 8, paddingTop: 2 },
  card:         { backgroundColor: BG, borderWidth: 1, borderColor: CARD_BD, borderRadius: 18, overflow: 'hidden' },
})
