import React from 'react'
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Alert } from 'react-native'
import { Image } from 'expo-image'
import { Ionicons } from '@expo/vector-icons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useNavigation } from '@react-navigation/native'
import { StackNavigationProp } from '@react-navigation/stack'
import { useAuthStore } from '../../store/auth.store'
import { AppStackParams } from '../../navigation/AppNavigator'
import { fonts } from '../../theme'
import { API_BASE } from '../../config'
import { useT, useI18n } from '../../i18n'

type Nav = StackNavigationProp<AppStackParams>

const T_C = '#1A1A1A'
const S   = '#6E6E73'
const M   = '#ABABAB'
const B   = '#CA2851'
const BD  = '#E5E5EA'
const BG  = '#FFFFFF'
const SX  = '#F9F9FB'
const SEP = '#F0F0F3'
const CARD_BD = '#EDEDF1'

function Toggle({ value }: { value: boolean }) {
  return (
    <View style={[tog.track, value && tog.on]}>
      <View style={[tog.thumb, value && tog.thumbOn]} />
    </View>
  )
}
const tog = StyleSheet.create({
  track:   { width: 46, height: 28, borderRadius: 999, backgroundColor: '#E5E5EA', padding: 2, justifyContent: 'center', flexShrink: 0 },
  on:      { backgroundColor: B },
  thumb:   { width: 24, height: 24, borderRadius: 999, backgroundColor: BG, alignSelf: 'flex-start', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.2, shadowRadius: 2, elevation: 2 },
  thumbOn: { alignSelf: 'flex-end' },
})

interface RowProps {
  iconBg: string; iconColor: string; iconName: string
  title: string; subtitle?: string
  badge?: { text: string; color: string; bg: string }
  value?: string; toggle?: boolean
  onPress?: () => void; isLast?: boolean
}
function Row({ iconBg, iconColor, iconName, title, subtitle, badge, value, toggle, onPress, isLast }: RowProps) {
  return (
    <TouchableOpacity style={[r.row, !isLast && r.sep]} onPress={onPress} activeOpacity={onPress ? 0.7 : 1}>
      <View style={[r.icon, { backgroundColor: iconBg }]}>
        <Ionicons name={iconName as any} size={17} color={iconColor} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={r.title}>{title}</Text>
        {!!subtitle && <Text style={r.sub}>{subtitle}</Text>}
      </View>
      {!!badge && <View style={[r.badge, { backgroundColor: badge.bg }]}><Text style={[r.badgeTxt, { color: badge.color }]}>{badge.text}</Text></View>}
      {!!value && <Text style={r.value}>{value}</Text>}
      {toggle !== undefined && <Toggle value={toggle} />}
      {toggle === undefined && <Ionicons name="chevron-forward" size={18} color="#C4C4CC" />}
    </TouchableOpacity>
  )
}
const r = StyleSheet.create({
  row:      { flexDirection: 'row', alignItems: 'center', gap: 13, padding: 13, paddingHorizontal: 14 },
  sep:      { borderBottomWidth: 1, borderBottomColor: SEP },
  icon:     { width: 32, height: 32, borderRadius: 9, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  title:    { fontFamily: fonts.semiBold, fontSize: 15, color: T_C },
  sub:      { fontFamily: fonts.medium, fontSize: 12, color: M, marginTop: 1 },
  value:    { fontFamily: fonts.medium, fontSize: 14, color: M },
  badge:    { borderRadius: 999, paddingHorizontal: 9, paddingVertical: 3 },
  badgeTxt: { fontFamily: fonts.bold, fontSize: 11 },
})


export default function SettingsScreen() {
  const nav = useNavigation<Nav>()
  const { top, bottom } = useSafeAreaInsets()
  const { user, logout } = useAuthStore()
  const t = useT()
  const { lang } = useI18n()
  const currentLangLabel = lang === 'en' ? t.english : t.portuguese

  const avatarUri = user?.avatar
    ? (user.avatar.startsWith('http') ? user.avatar : `${API_BASE}${user.avatar}`)
    : null

  function handleLogout() {
    Alert.alert(t.logout_title, t.logout_msg, [
      { text: t.cancel, style: 'cancel' },
      { text: t.logout_ok, style: 'destructive', onPress: () => logout() },
    ])
  }

  return (
    <View style={s.screen}>
      <View style={[s.header, { paddingTop: top + 8 }]}>
        <TouchableOpacity onPress={() => nav.goBack()} style={s.backBtn} hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}>
          <Ionicons name="chevron-back" size={20} color={T_C} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>{t.settings}</Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={[s.content, { paddingBottom: bottom + 32 }]}>
        {/* Profile card */}
        <TouchableOpacity style={s.profileCard} onPress={() => nav.navigate('Profile', {})} activeOpacity={0.75}>
          <View style={s.avatarWrap}>
            {avatarUri
              ? <Image source={{ uri: avatarUri }} style={s.avatar} contentFit="cover" />
              : <View style={[s.avatar, s.avatarFallback]}><Text style={s.avatarInitial}>{user?.name?.[0]?.toUpperCase() ?? '?'}</Text></View>
            }
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={s.profileName} numberOfLines={1}>{user?.name ?? 'Utilizador'}</Text>
            <Text style={s.profileSub} numberOfLines={1}>{user?.phone ?? ''} · {t.settings_viewProfile}</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color="#C4C4CC" />
        </TouchableOpacity>

        <Text style={s.sectionLabel}>{t.account}</Text>
        <View style={s.card}>
          <Row iconBg="#F2F2F5" iconColor="#555" iconName="person-outline" title={t.editProfile} onPress={() => nav.navigate('EditProfile')} />
          <Row iconBg="#F2F2F5" iconColor="#555" iconName="shield-checkmark-outline" title={t.verified}
            badge={{ text: t.pending, color: '#8E8E93', bg: '#F0F0F3' }}
            onPress={() => nav.navigate('Verified')} />
          <Row iconBg="#F2F2F5" iconColor="#555" iconName="lock-closed-outline" title={t.privacy} isLast
            onPress={() => nav.navigate('Privacy')} />
        </View>

        <Text style={s.sectionLabel}>{t.preferences}</Text>
        <View style={s.card}>
          <Row iconBg="#F2F2F5" iconColor="#555" iconName="notifications-outline" title={t.notifications}
            onPress={() => nav.navigate('NotifSettings')} />
          <Row iconBg="#F2F2F5" iconColor="#555" iconName="globe-outline" title={t.language} value={currentLangLabel} isLast
            onPress={() => nav.navigate('Language')} />
        </View>

        <Text style={s.sectionLabel}>{t.support}</Text>
        <View style={s.card}>
          <Row iconBg="#F2F2F5" iconColor="#555" iconName="help-circle-outline" title={t.help}
            onPress={() => nav.navigate('Help')} />
          <Row iconBg="#F2F2F5" iconColor="#555" iconName="information-circle-outline" title={t.about} isLast
            onPress={() => nav.navigate('About')} />
        </View>

        <TouchableOpacity style={s.logoutBtn} onPress={handleLogout} activeOpacity={0.75}>
          <Ionicons name="log-out-outline" size={19} color="#FF3B30" />
          <Text style={s.logoutTxt}>{t.logout}</Text>
        </TouchableOpacity>

        <Text style={s.version}>luxee · {t.version} 1.0.0</Text>
      </ScrollView>

    </View>
  )
}

const s = StyleSheet.create({
  screen:  { flex: 1, backgroundColor: SX },
  header:  { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingBottom: 12 },
  backBtn: { width: 40, height: 40, borderRadius: 999, backgroundColor: BG, borderWidth: 1, borderColor: BD, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontFamily: fonts.extraBold, fontSize: 26, letterSpacing: -0.6, color: T_C },
  content: { paddingHorizontal: 16, gap: 8, paddingTop: 4 },

  profileCard: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 14, borderRadius: 20, backgroundColor: BG, borderWidth: 1, borderColor: CARD_BD, marginBottom: 10 },
  avatarWrap:    { width: 56, height: 56, borderRadius: 28, overflow: 'hidden', flexShrink: 0 },
  avatar:        { width: 56, height: 56, borderRadius: 28 },
  avatarFallback:{ backgroundColor: `${B}15`, alignItems: 'center', justifyContent: 'center' },
  avatarInitial: { fontFamily: fonts.bold, fontSize: 22, color: B },
  profileName:   { fontFamily: fonts.bold, fontSize: 17, color: T_C, letterSpacing: -0.3 },
  profileSub:    { fontFamily: fonts.medium, fontSize: 13, color: S, marginTop: 2 },

  sectionLabel: { fontFamily: fonts.bold, fontSize: 11, color: M, letterSpacing: 1, textTransform: 'uppercase', paddingLeft: 6, paddingBottom: 8, paddingTop: 2 },
  card:  { backgroundColor: BG, borderWidth: 1, borderColor: CARD_BD, borderRadius: 18, overflow: 'hidden' },

  logoutBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9, padding: 14, borderRadius: 18, backgroundColor: BG, borderWidth: 1, borderColor: CARD_BD, marginTop: 10 },
  logoutTxt: { fontFamily: fonts.bold, fontSize: 15, color: '#FF3B30' },
  version:   { textAlign: 'center', fontFamily: fonts.medium, fontSize: 12, color: M, marginTop: 8 },
})
