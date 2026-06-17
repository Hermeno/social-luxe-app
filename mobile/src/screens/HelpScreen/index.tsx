import React, { useState } from 'react'
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, TextInput, Linking, Alert, LayoutAnimation,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useNavigation } from '@react-navigation/native'
import { fonts } from '../../theme'
import { useT } from '../../i18n'

const T  = '#1A1A1A'
const S  = '#6E6E73'
const M  = '#ABABAB'
const B  = '#CA2851'
const BD = '#E5E5EA'
const BG = '#FFFFFF'
const SX = '#F9F9FB'
const SEP = '#F0F0F3'
const CARD_BD = '#EDEDF1'

function openLink(url: string) {
  Linking.openURL(url).catch(() => Alert.alert('Erro', 'Não foi possível abrir.'))
}

const FAQ_ITEMS_KEYS = [
  { q: 'hp_faq1q', a: 'hp_faq1a' },
  { q: 'hp_faq2q', a: 'hp_faq2a' },
  { q: 'hp_faq3q', a: 'hp_faq3a' },
] as const

function FaqItem({ q, a, isLast }: { q: string; a: string; isLast?: boolean }) {
  const [open, setOpen] = useState(false)
  function toggle() {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut)
    setOpen(v => !v)
  }
  return (
    <View style={[fi.wrap, !isLast && fi.sep]}>
      <TouchableOpacity style={fi.header} onPress={toggle} activeOpacity={0.75}>
        <Text style={fi.q}>{q}</Text>
        <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={17} color={M} />
      </TouchableOpacity>
      {open && <Text style={fi.a}>{a}</Text>}
    </View>
  )
}
const fi = StyleSheet.create({
  wrap:   { padding: 14, paddingHorizontal: 14 },
  sep:    { borderBottomWidth: 1, borderBottomColor: SEP },
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  q:      { flex: 1, fontFamily: fonts.semiBold, fontSize: 14, color: T, lineHeight: 20 },
  a:      { fontFamily: fonts.medium, fontSize: 13, color: S, lineHeight: 19, marginTop: 8 },
})

export default function HelpScreen() {
  const nav = useNavigation()
  const { top, bottom } = useSafeAreaInsets()
  const t = useT()
  const [query, setQuery] = useState('')

  return (
    <View style={s.screen}>
      <View style={[s.header, { paddingTop: top + 8 }]}>
        <TouchableOpacity onPress={() => nav.goBack()} style={s.backBtn} hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}>
          <Ionicons name="chevron-back" size={20} color={T} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>{t.hp_title}</Text>
      </View>

      <View style={[s.searchWrap, { marginHorizontal: 16 }]}>
        <Ionicons name="search-outline" size={17} color={M} />
        <TextInput
          style={s.searchInput}
          value={query}
          onChangeText={setQuery}
          placeholder={t.hp_search}
          placeholderTextColor={M}
          returnKeyType="search"
        />
        {query.length > 0 && (
          <TouchableOpacity onPress={() => setQuery('')} hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}>
            <Ionicons name="close-circle" size={17} color={M} />
          </TouchableOpacity>
        )}
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={[s.content, { paddingBottom: bottom + 32 }]}>
        <Text style={s.sectionLabel}>{t.hp_faq}</Text>
        <View style={s.card}>
          {FAQ_ITEMS_KEYS.map((item, i) => (
            <FaqItem key={i} q={t[item.q]} a={t[item.a]} isLast={i === FAQ_ITEMS_KEYS.length - 1} />
          ))}
        </View>

        <Text style={[s.sectionLabel, { marginTop: 20 }]}>{t.hp_contact}</Text>
        <View style={s.card}>
          <TouchableOpacity style={[s.contactRow, s.contactSep]} onPress={() => {}} activeOpacity={0.75}>
            <View style={s.contactIcon}>
              <Ionicons name="chatbubble-ellipses-outline" size={18} color={B} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.contactTitle}>{t.hp_chat}</Text>
              <Text style={s.contactSub}>{t.hp_chatSub}</Text>
            </View>
            <Ionicons name="chevron-forward" size={17} color="#C4C4CC" />
          </TouchableOpacity>
          <TouchableOpacity style={s.contactRow} onPress={() => openLink('mailto:herminiomacamo6@gmail.com?subject=luxee%20Reportar%20Problema')} activeOpacity={0.75}>
            <View style={s.contactIcon}>
              <Ionicons name="flag-outline" size={18} color="#FF4B6E" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.contactTitle}>{t.hp_report}</Text>
              <Text style={s.contactSub}>{t.hp_reportSub}</Text>
            </View>
            <Ionicons name="chevron-forward" size={17} color="#C4C4CC" />
          </TouchableOpacity>
        </View>

        <View style={s.devCard}>
          <View style={s.devBadge}>
            <Text style={s.devBadgeTxt}>HM</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.devLabel}>{t.hp_createdBy}</Text>
            <Text style={s.devName}>Hermínio A. Macamo</Text>
          </View>
          <TouchableOpacity onPress={() => openLink('mailto:herminiomacamo6@gmail.com')}>
            <Text style={s.devContact}>Email</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  )
}

const s = StyleSheet.create({
  screen:  { flex: 1, backgroundColor: SX },
  header:  { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingBottom: 12 },
  backBtn: { width: 40, height: 40, borderRadius: 999, backgroundColor: BG, borderWidth: 1, borderColor: BD, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontFamily: fonts.extraBold, fontSize: 22, letterSpacing: -0.5, color: T },

  searchWrap:  { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: BG, borderWidth: 1, borderColor: BD, borderRadius: 14, padding: 12, marginBottom: 16 },
  searchInput: { flex: 1, fontFamily: fonts.medium, fontSize: 15, color: T, padding: 0 },

  content: { paddingHorizontal: 16, paddingTop: 0 },
  sectionLabel: { fontFamily: fonts.bold, fontSize: 11, color: M, letterSpacing: 1, textTransform: 'uppercase', paddingLeft: 6, paddingBottom: 10 },
  card:    { backgroundColor: BG, borderWidth: 1, borderColor: CARD_BD, borderRadius: 18, overflow: 'hidden' },

  contactRow:  { flexDirection: 'row', alignItems: 'center', gap: 13, padding: 14, paddingHorizontal: 14 },
  contactSep:  { borderBottomWidth: 1, borderBottomColor: SEP },
  contactIcon: { width: 36, height: 36, borderRadius: 10, backgroundColor: 'rgba(76,140,228,0.12)', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  contactTitle:{ fontFamily: fonts.bold, fontSize: 15, color: T },
  contactSub:  { fontFamily: fonts.medium, fontSize: 12, color: M, marginTop: 2 },

  devCard: {
    flexDirection: 'row', alignItems: 'center', gap: 13,
    marginTop: 20, padding: 14, borderRadius: 18,
    backgroundColor: 'rgba(76,140,228,0.06)', borderWidth: 1, borderColor: 'rgba(76,140,228,0.18)',
  },
  devBadge:    { width: 42, height: 42, borderRadius: 12, backgroundColor: B, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  devBadgeTxt: { fontFamily: fonts.extraBold, fontSize: 16, color: BG },
  devLabel:    { fontFamily: fonts.medium, fontSize: 11, color: B, letterSpacing: 0.6, textTransform: 'uppercase' },
  devName:     { fontFamily: fonts.bold, fontSize: 14, color: T, marginTop: 2 },
  devContact:  { fontFamily: fonts.bold, fontSize: 13, color: B },
})
