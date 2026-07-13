import React from 'react'
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useNavigation } from '@react-navigation/native'
import { useI18n, useT } from '../../i18n'
import { fonts } from '../../theme'

const T_C = '#1A1A1A'
const S   = '#6E6E73'
const M   = '#ABABAB'
const B   = '#CA2851'
const BD  = '#E5E5EA'
const BG  = '#FFFFFF'
const SX  = '#F9F9FB'
const SEP = '#F0F0F3'
const CARD_BD = '#EDEDF1'

interface LangItem { code: string; label: string; native: string; emoji: string }

// Só os idiomas que a app realmente fala — nada de opções que não funcionam
const LANGS: LangItem[] = [
  { code: 'pt', label: 'Português', native: 'Português', emoji: '🇲🇿' },
  { code: 'en', label: 'Inglês',    native: 'English',   emoji: '🇬🇧' },
]

export default function LanguageScreen() {
  const nav = useNavigation()
  const { top, bottom } = useSafeAreaInsets()
  const t = useT()
  const { lang, setLang } = useI18n()

  return (
    <View style={s.screen}>
      <View style={[s.header, { paddingTop: top + 8 }]}>
        <TouchableOpacity onPress={() => nav.goBack()} style={s.backBtn} hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}>
          <Ionicons name="chevron-back" size={20} color={T_C} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>{t.ln_title}</Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={[s.content, { paddingBottom: bottom + 32, paddingTop: 8 }]}>
        <View style={s.card}>
          {LANGS.map((item, i) => (
            <LangRow
              key={item.code}
              item={item}
              selected={lang === item.code}
              onPress={() => setLang(item.code as 'pt' | 'en')}
              isLast={i === LANGS.length - 1}
            />
          ))}
        </View>
        <Text style={s.note}>{t.ln_note}</Text>
      </ScrollView>
    </View>
  )
}

function LangRow({ item, selected, onPress, isLast }: {
  item: LangItem; selected: boolean; onPress: () => void; isLast?: boolean
}) {
  return (
    <TouchableOpacity style={[lr.row, !isLast && lr.sep]} onPress={onPress} activeOpacity={0.75}>
      <Text style={lr.emoji}>{item.emoji}</Text>
      <View style={{ flex: 1 }}>
        <Text style={lr.label}>{item.label}</Text>
        <Text style={lr.native}>{item.native}</Text>
      </View>
      {selected && (
        <View style={lr.check}>
          <Ionicons name="checkmark" size={14} color={BG} />
        </View>
      )}
    </TouchableOpacity>
  )
}
const lr = StyleSheet.create({
  row:    { flexDirection: 'row', alignItems: 'center', gap: 13, padding: 13, paddingHorizontal: 14 },
  sep:    { borderBottomWidth: 1, borderBottomColor: SEP },
  emoji:  { fontSize: 24 },
  label:  { fontFamily: fonts.semiBold, fontSize: 15, color: T_C },
  native: { fontFamily: fonts.medium, fontSize: 12, color: M, marginTop: 1 },
  check:  { width: 26, height: 26, borderRadius: 13, backgroundColor: B, alignItems: 'center', justifyContent: 'center' },
})

const s = StyleSheet.create({
  screen:  { flex: 1, backgroundColor: SX },
  header:  { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingBottom: 12 },
  backBtn: { width: 40, height: 40, borderRadius: 999, backgroundColor: BG, borderWidth: 1, borderColor: BD, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontFamily: fonts.extraBold, fontSize: 22, letterSpacing: -0.5, color: T_C },

  searchWrap:  { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: BG, borderWidth: 1, borderColor: BD, borderRadius: 14, padding: 12, marginBottom: 16 },
  searchInput: { flex: 1, fontFamily: fonts.medium, fontSize: 15, color: T_C, padding: 0 },

  content:      { paddingHorizontal: 16, paddingTop: 0 },
  sectionLabel: { fontFamily: fonts.bold, fontSize: 11, color: M, letterSpacing: 1, textTransform: 'uppercase', paddingLeft: 6, paddingBottom: 10 },
  card:         { backgroundColor: BG, borderWidth: 1, borderColor: CARD_BD, borderRadius: 18, overflow: 'hidden' },
  empty:        { alignItems: 'center', paddingTop: 40 },
  emptyTxt:     { fontFamily: fonts.medium, fontSize: 15, color: M },
  note:         { textAlign: 'center', fontFamily: fonts.medium, fontSize: 12, color: M, marginTop: 20, paddingHorizontal: 16 },
})
