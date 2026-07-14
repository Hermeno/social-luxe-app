import React from 'react'
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, Linking, Alert,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useNavigation } from '@react-navigation/native'
import { StackNavigationProp } from '@react-navigation/stack'
import { AppStackParams } from '../../navigation/AppNavigator'
import { fonts } from '../../theme'
import { useT, useI18n } from '../../i18n'
import { PT } from '../../i18n/pt'
import { EN } from '../../i18n/en'

type Nav = StackNavigationProp<AppStackParams>

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
  const tr = useI18n.getState().lang === 'en' ? EN : PT
  Linking.openURL(url).catch(() => Alert.alert(tr.error, tr.about_link_fail))
}

function LinkRow({ iconBg, iconColor, iconName, title, action, onPress, isLast }: {
  iconBg: string; iconColor: string; iconName: string
  title: string; action?: string; onPress?: () => void; isLast?: boolean
}) {
  return (
    <TouchableOpacity
      style={[lr.row, !isLast && lr.sep]}
      onPress={onPress}
      activeOpacity={onPress ? 0.7 : 1}
    >
      <View style={[lr.icon, { backgroundColor: iconBg }]}>
        <Ionicons name={iconName as any} size={17} color={iconColor} />
      </View>
      <Text style={lr.title}>{title}</Text>
      {action ? (
        <Text style={lr.action}>{action}</Text>
      ) : (
        <Ionicons name="chevron-forward" size={17} color="#C4C4CC" />
      )}
    </TouchableOpacity>
  )
}
const lr = StyleSheet.create({
  row:    { flexDirection: 'row', alignItems: 'center', gap: 13, padding: 13, paddingHorizontal: 14 },
  sep:    { borderBottomWidth: 1, borderBottomColor: SEP },
  icon:   { width: 32, height: 32, borderRadius: 9, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  title:  { flex: 1, fontFamily: fonts.semiBold, fontSize: 15, color: T },
  action: { fontFamily: fonts.semiBold, fontSize: 12, color: B },
})

export default function AboutScreen() {
  const nav = useNavigation<Nav>()
  const { top, bottom } = useSafeAreaInsets()
  const t = useT()

  return (
    <View style={s.screen}>
      <View style={[s.header, { paddingTop: top + 8 }]}>
        <TouchableOpacity onPress={() => nav.goBack()} style={s.backBtn} hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}>
          <Ionicons name="chevron-back" size={20} color={T} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>{t.about_title}</Text>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[s.content, { paddingBottom: bottom + 32 }]}
      >
        <View style={s.hero}>
          <View style={s.appIcon}>
            <Text style={s.appIconLetter}>l</Text>
          </View>
          <View style={s.appNameRow}>
            <Text style={s.appName}>luxee</Text>
            <View style={s.appDot} />
          </View>
          <Text style={s.appVersion}>{t.version} 1.0.0 · build 1</Text>
        </View>

        <Text style={s.description}>{t.about_desc}</Text>

        <View style={s.devCard}>
          <View style={s.devInitials}>
            <Text style={s.devInitialsTxt}>HM</Text>
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={s.devLabel}>{t.about_madeBy}</Text>
            <Text style={s.devName}>Hermínio A. Macamo</Text>
            <Text style={s.devLocation}>Chibuto · Gaza · Moçambique 🇲🇿</Text>
          </View>
        </View>

        <View style={[s.card, { marginTop: 12 }]}>
          <LinkRow
            iconBg="rgba(76,140,228,0.12)" iconColor={B} iconName="call-outline"
            title="+258 84 205 9826" action="Ligar"
            onPress={() => openLink('tel:+258842059826')}
          />
          <LinkRow
            iconBg="rgba(76,140,228,0.12)" iconColor={B} iconName="mail-outline"
            title="herminiomacamo6@gmail.com" action="Email"
            onPress={() => openLink('mailto:herminiomacamo6@gmail.com')}
            isLast
          />
        </View>

        <View style={[s.card, { marginTop: 12 }]}>
          <LinkRow
            iconBg="rgba(76,140,228,0.12)" iconColor={B} iconName="document-text-outline"
            title={t.about_terms}
            onPress={() => {}}
          />
          <LinkRow
            iconBg="rgba(76,140,228,0.12)" iconColor={B} iconName="lock-closed-outline"
            title={t.about_privacyLink}
            onPress={() => {}}
          />
          <LinkRow
            iconBg="rgba(76,140,228,0.12)" iconColor={B} iconName="star-outline"
            title={t.about_rate} isLast
            onPress={() => {}}
          />
        </View>

        <View style={s.footer}>
          <Text style={s.footerTxt}>{t.feito_com} </Text>
          <Ionicons name="heart" size={14} color="#FF3B30" />
          <Text style={s.footerTxt}> {t.about_footer} 🇲🇿</Text>
        </View>
        <Text style={s.copyright}>{t.about_copyright}</Text>
      </ScrollView>
    </View>
  )
}

const s = StyleSheet.create({
  screen:  { flex: 1, backgroundColor: BG },
  header:  { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingBottom: 10 },
  backBtn: { width: 40, height: 40, borderRadius: 999, backgroundColor: BG, borderWidth: 1, borderColor: BD, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontFamily: fonts.extraBold, fontSize: 26, letterSpacing: -0.6, color: T },
  content: { paddingHorizontal: 16, gap: 0 },

  hero: { alignItems: 'center', marginTop: 24, marginBottom: 20, gap: 14 },
  appIcon: {
    width: 96, height: 96, borderRadius: 28, backgroundColor: B,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: B, shadowOffset: { width: 0, height: 18 }, shadowOpacity: 0.5, shadowRadius: 30,
    elevation: 12,
  },
  appIconLetter: { fontFamily: fonts.extraBold, fontSize: 42, color: BG, letterSpacing: -2 },
  appNameRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 7 },
  appName:    { fontFamily: fonts.extraBold, fontSize: 30, color: T, letterSpacing: -1 },
  appDot:     { width: 9, height: 9, borderRadius: 999, backgroundColor: B, marginTop: 11 },
  appVersion: { fontFamily: fonts.medium, fontSize: 13, color: M },

  description: { fontFamily: fonts.medium, fontSize: 15, lineHeight: 23, color: S, textAlign: 'center', paddingHorizontal: 6, marginBottom: 20 },

  devCard: {
    flexDirection: 'row', alignItems: 'center', gap: 13,
    padding: 14, borderRadius: 18,
    backgroundColor: 'rgba(76,140,228,0.06)',
    borderWidth: 1, borderColor: 'rgba(76,140,228,0.18)',
    marginBottom: 0,
  },
  devInitials: { width: 46, height: 46, borderRadius: 14, backgroundColor: B, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  devInitialsTxt: { fontFamily: fonts.extraBold, fontSize: 18, color: BG, letterSpacing: -0.5 },
  devLabel:   { fontFamily: fonts.medium, fontSize: 11, color: B, letterSpacing: 0.6, textTransform: 'uppercase' },
  devName:    { fontFamily: fonts.bold, fontSize: 15, color: T, letterSpacing: -0.3, marginTop: 2 },
  devLocation:{ fontFamily: fonts.medium, fontSize: 12, color: S, marginTop: 1 },

  card: { backgroundColor: SX, borderWidth: 1, borderColor: CARD_BD, borderRadius: 18, overflow: 'hidden' },

  footer:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 24 },
  footerTxt: { fontFamily: fonts.semiBold, fontSize: 13, color: S },
  copyright: { textAlign: 'center', fontFamily: fonts.medium, fontSize: 12, color: M, marginTop: 6, marginBottom: 8 },
})
