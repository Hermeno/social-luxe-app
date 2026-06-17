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
const CARD_BD = '#EDEDF1'

type Theme = 'light' | 'dark' | 'auto'

export default function AppearanceScreen() {
  const nav = useNavigation()
  const { top, bottom } = useSafeAreaInsets()
  const t = useT()

  const [theme,    setTheme]    = useState<Theme>('auto')
  const [accent,   setAccent]   = useState('#CA2851')
  const [textSize, setTextSize] = useState(3)

  useEffect(() => {
    AsyncStorage.multiGet(['@theme', '@accent_color', '@text_size']).then(([th, ac, sz]) => {
      if (th[1]) setTheme(th[1] as Theme)
      if (ac[1]) setAccent(ac[1])
      if (sz[1]) setTextSize(Number(sz[1]))
    })
  }, [])

  function saveTheme(v: Theme)  { setTheme(v);    AsyncStorage.setItem('@theme', v) }
  function saveAccent(v: string){ setAccent(v);   AsyncStorage.setItem('@accent_color', v) }
  function saveSize(v: number)  { setTextSize(v); AsyncStorage.setItem('@text_size', String(v)) }

  const ACCENTS = [
    { color: '#CA2851', label: t.ac_blue   },
    { color: '#7C5FE6', label: t.ac_purple },
    { color: '#22C55E', label: t.ac_green  },
    { color: '#FF4B6E', label: t.ac_red    },
  ]

  return (
    <View style={s.screen}>
      <View style={[s.header, { paddingTop: top + 8 }]}>
        <TouchableOpacity onPress={() => nav.goBack()} style={s.backBtn} hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}>
          <Ionicons name="chevron-back" size={20} color={T_C} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>{t.ap_title}</Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={[s.content, { paddingBottom: bottom + 32 }]}>
        <Text style={s.sectionLabel}>{t.ap_theme}</Text>
        <View style={s.themeRow}>
          <ThemeCard label={t.ap_light} iconName="sunny-outline" active={theme === 'light'} onPress={() => saveTheme('light')} />
          <ThemeCard label={t.ap_dark}  iconName="moon-outline"  active={theme === 'dark'}  onPress={() => saveTheme('dark')} dark />
          <ThemeCardAuto label={t.ap_auto} active={theme === 'auto'} onPress={() => saveTheme('auto')} />
        </View>

        <Text style={[s.sectionLabel, { marginTop: 20 }]}>{t.ap_textSize}</Text>
        <View style={s.card}>
          <View style={s.sliderWrap}>
            <Text style={[s.sampleTxt, { fontSize: 12 + textSize * 2 }]}>Aa</Text>
            <View style={s.slider}>
              {[1, 2, 3, 4, 5].map(v => (
                <TouchableOpacity key={v} style={[s.sliderDot, textSize === v && s.sliderDotActive]}
                  onPress={() => saveSize(v)} hitSlop={{ top: 12, right: 12, bottom: 12, left: 12 }} />
              ))}
            </View>
            <Text style={[s.sampleTxt, { fontSize: 22 }]}>Aa</Text>
          </View>
          <View style={s.sliderTrackBg}>
            <View style={[s.sliderFill, { width: `${((textSize - 1) / 4) * 100}%` }]} />
          </View>
        </View>

        <Text style={[s.sectionLabel, { marginTop: 20 }]}>{t.ap_accent}</Text>
        <View style={s.card}>
          <View style={s.accentRow}>
            {ACCENTS.map(a => (
              <TouchableOpacity key={a.color} style={s.accentItem} onPress={() => saveAccent(a.color)} activeOpacity={0.8}>
                <View style={[s.accentDot, { backgroundColor: a.color }, accent === a.color && s.accentDotActive]}>
                  {accent === a.color && <Ionicons name="checkmark" size={14} color={BG} />}
                </View>
                <Text style={[s.accentLabel, accent === a.color && { color: a.color, fontFamily: fonts.bold }]}>{a.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </ScrollView>
    </View>
  )
}

function ThemeCard({ label, iconName, active, onPress, dark }: { label: string; iconName: string; active: boolean; onPress: () => void; dark?: boolean }) {
  const bg = dark ? '#1A1A1A' : BG
  const iconColor = dark ? BG : '#1A1A1A'
  return (
    <TouchableOpacity style={[tc.card, { backgroundColor: bg }, active && tc.cardActive]} onPress={onPress} activeOpacity={0.8}>
      <Ionicons name={iconName as any} size={24} color={iconColor} />
      <Text style={[tc.label, { color: iconColor }]}>{label}</Text>
      {active && <View style={tc.check}><Ionicons name="checkmark" size={13} color={BG} /></View>}
    </TouchableOpacity>
  )
}
function ThemeCardAuto({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity style={[tc.card, tc.autoCard, active && tc.cardActive]} onPress={onPress} activeOpacity={0.8}>
      <View style={tc.autoHalf}><Ionicons name="sunny-outline" size={24} color="#1A1A1A" /></View>
      <View style={[tc.autoHalf, { backgroundColor: '#1A1A1A' }]}><Ionicons name="moon-outline" size={24} color={BG} /></View>
      <Text style={tc.autoLabel}>{label}</Text>
      {active && <View style={tc.check}><Ionicons name="checkmark" size={13} color={BG} /></View>}
    </TouchableOpacity>
  )
}
const tc = StyleSheet.create({
  card:       { flex: 1, height: 100, borderRadius: 18, borderWidth: 1.5, borderColor: CARD_BD, alignItems: 'center', justifyContent: 'center', gap: 8, overflow: 'hidden', position: 'relative' },
  cardActive: { borderColor: B, borderWidth: 2 },
  label:      { fontFamily: fonts.semiBold, fontSize: 13 },
  autoCard:   { flexDirection: 'row', padding: 0 },
  autoHalf:   { flex: 1, alignItems: 'center', justifyContent: 'center', height: '100%' },
  autoLabel:  { position: 'absolute', bottom: 8, fontFamily: fonts.semiBold, fontSize: 13, color: '#6E6E73' },
  check:      { position: 'absolute', top: 8, right: 8, width: 20, height: 20, borderRadius: 10, backgroundColor: B, alignItems: 'center', justifyContent: 'center' },
})

const s = StyleSheet.create({
  screen:  { flex: 1, backgroundColor: SX },
  header:  { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingBottom: 12 },
  backBtn: { width: 40, height: 40, borderRadius: 999, backgroundColor: BG, borderWidth: 1, borderColor: BD, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontFamily: fonts.extraBold, fontSize: 22, letterSpacing: -0.5, color: T_C },
  content: { paddingHorizontal: 16, paddingTop: 4 },

  sectionLabel: { fontFamily: fonts.bold, fontSize: 11, color: M, letterSpacing: 1, textTransform: 'uppercase', paddingLeft: 6, paddingBottom: 10 },
  themeRow: { flexDirection: 'row', gap: 12 },
  card:     { backgroundColor: BG, borderWidth: 1, borderColor: CARD_BD, borderRadius: 18, overflow: 'hidden', padding: 16 },

  sliderWrap: { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 14 },
  sampleTxt:  { fontFamily: fonts.medium, color: T_C, width: 34 },
  slider:     { flex: 1, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sliderDot:  { width: 10, height: 10, borderRadius: 5, backgroundColor: BD },
  sliderDotActive: { backgroundColor: B, width: 14, height: 14, borderRadius: 7 },
  sliderTrackBg: { height: 4, backgroundColor: BD, borderRadius: 999, marginHorizontal: 48 },
  sliderFill:    { height: 4, backgroundColor: B, borderRadius: 999 },

  accentRow:  { flexDirection: 'row', justifyContent: 'space-around' },
  accentItem: { alignItems: 'center', gap: 8 },
  accentDot:  { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  accentDotActive: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 6, elevation: 4 },
  accentLabel:{ fontFamily: fonts.medium, fontSize: 12, color: M },
})
