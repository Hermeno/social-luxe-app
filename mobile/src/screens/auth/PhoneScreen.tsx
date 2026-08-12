import React, { useState, useMemo } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform,
  Alert, Modal, FlatList, SafeAreaView, Keyboard, ScrollView,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useNavigation } from '@react-navigation/native'
import { StackNavigationProp } from '@react-navigation/stack'
import { AuthStackParams } from '../../navigation/AuthNavigator'
import * as authService from '../../services/auth.service'
import { fonts } from '../../theme'
import { useI18n, useT } from '../../i18n'
import Icon from '../../components/Icon'
import {
  AuthFieldFrame,
  AuthHeader,
  AuthPrimaryButton,
  authStyles,
  authUi,
} from '../../components/AuthFlow'

const COUNTRIES = [
  { code: '+244', flag: '🇦🇴', name: 'Angola',              iso: 'AO' },
  { code: '+55',  flag: '🇧🇷', name: 'Brasil',              iso: 'BR' },
  { code: '+238', flag: '🇨🇻', name: 'Cabo Verde',          iso: 'CV' },
  { code: '+245', flag: '🇬🇼', name: 'Guiné-Bissau',        iso: 'GW' },
  { code: '+240', flag: '🇬🇶', name: 'Guiné Equatorial',    iso: 'GQ' },
  { code: '+258', flag: '🇲🇿', name: 'Moçambique',          iso: 'MZ' },
  { code: '+351', flag: '🇵🇹', name: 'Portugal',            iso: 'PT' },
  { code: '+239', flag: '🇸🇹', name: 'São Tomé e Príncipe', iso: 'ST' },
  { code: '+27',  flag: '🇿🇦', name: 'África do Sul',       iso: 'ZA' },
  { code: '+213', flag: '🇩🇿', name: 'Argélia',             iso: 'DZ' },
  { code: '+54',  flag: '🇦🇷', name: 'Argentina',           iso: 'AR' },
  { code: '+61',  flag: '🇦🇺', name: 'Austrália',           iso: 'AU' },
  { code: '+32',  flag: '🇧🇪', name: 'Bélgica',             iso: 'BE' },
  { code: '+591', flag: '🇧🇴', name: 'Bolívia',             iso: 'BO' },
  { code: '+1',   flag: '🇨🇦', name: 'Canadá',              iso: 'CA' },
  { code: '+56',  flag: '🇨🇱', name: 'Chile',               iso: 'CL' },
  { code: '+86',  flag: '🇨🇳', name: 'China',               iso: 'CN' },
  { code: '+57',  flag: '🇨🇴', name: 'Colômbia',            iso: 'CO' },
  { code: '+506', flag: '🇨🇷', name: 'Costa Rica',          iso: 'CR' },
  { code: '+53',  flag: '🇨🇺', name: 'Cuba',                iso: 'CU' },
  { code: '+45',  flag: '🇩🇰', name: 'Dinamarca',           iso: 'DK' },
  { code: '+593', flag: '🇪🇨', name: 'Equador',             iso: 'EC' },
  { code: '+34',  flag: '🇪🇸', name: 'Espanha',             iso: 'ES' },
  { code: '+1',   flag: '🇺🇸', name: 'Estados Unidos',      iso: 'US' },
  { code: '+251', flag: '🇪🇹', name: 'Etiópia',             iso: 'ET' },
  { code: '+33',  flag: '🇫🇷', name: 'França',              iso: 'FR' },
  { code: '+233', flag: '🇬🇭', name: 'Gana',                iso: 'GH' },
  { code: '+30',  flag: '🇬🇷', name: 'Grécia',              iso: 'GR' },
  { code: '+91',  flag: '🇮🇳', name: 'Índia',               iso: 'IN' },
  { code: '+62',  flag: '🇮🇩', name: 'Indonésia',           iso: 'ID' },
  { code: '+353', flag: '🇮🇪', name: 'Irlanda',             iso: 'IE' },
  { code: '+972', flag: '🇮🇱', name: 'Israel',              iso: 'IL' },
  { code: '+39',  flag: '🇮🇹', name: 'Itália',              iso: 'IT' },
  { code: '+81',  flag: '🇯🇵', name: 'Japão',               iso: 'JP' },
  { code: '+254', flag: '🇰🇪', name: 'Quénia',              iso: 'KE' },
  { code: '+52',  flag: '🇲🇽', name: 'México',              iso: 'MX' },
  { code: '+212', flag: '🇲🇦', name: 'Marrocos',            iso: 'MA' },
  { code: '+234', flag: '🇳🇬', name: 'Nigéria',             iso: 'NG' },
  { code: '+47',  flag: '🇳🇴', name: 'Noruega',             iso: 'NO' },
  { code: '+31',  flag: '🇳🇱', name: 'Países Baixos',       iso: 'NL' },
  { code: '+51',  flag: '🇵🇪', name: 'Peru',                iso: 'PE' },
  { code: '+48',  flag: '🇵🇱', name: 'Polónia',             iso: 'PL' },
  { code: '+44',  flag: '🇬🇧', name: 'Reino Unido',         iso: 'GB' },
  { code: '+7',   flag: '🇷🇺', name: 'Rússia',              iso: 'RU' },
  { code: '+221', flag: '🇸🇳', name: 'Senegal',             iso: 'SN' },
  { code: '+46',  flag: '🇸🇪', name: 'Suécia',              iso: 'SE' },
  { code: '+41',  flag: '🇨🇭', name: 'Suíça',               iso: 'CH' },
  { code: '+255', flag: '🇹🇿', name: 'Tanzânia',            iso: 'TZ' },
  { code: '+90',  flag: '🇹🇷', name: 'Turquia',             iso: 'TR' },
  { code: '+380', flag: '🇺🇦', name: 'Ucrânia',             iso: 'UA' },
  { code: '+598', flag: '🇺🇾', name: 'Uruguai',             iso: 'UY' },
  { code: '+58',  flag: '🇻🇪', name: 'Venezuela',           iso: 'VE' },
  { code: '+84',  flag: '🇻🇳', name: 'Vietname',            iso: 'VN' },
  { code: '+260', flag: '🇿🇲', name: 'Zâmbia',              iso: 'ZM' },
  { code: '+263', flag: '🇿🇼', name: 'Zimbabwe',            iso: 'ZW' },
]

type Country = typeof COUNTRIES[0]

function detectCountryEntry(): Country {
  try {
    const locale = Intl.DateTimeFormat().resolvedOptions().locale
    const parts  = locale.split('-')
    for (let i = parts.length - 1; i >= 0; i--) {
      const p = parts[i]
      if (p.length === 2 && p === p.toUpperCase()) {
        const found = COUNTRIES.find(c => c.iso === p)
        if (found) return found
      }
    }
  } catch {}
  return COUNTRIES[0] // Angola default
}

// ─── Country picker modal ─────────────────────────────────────────────────────
function CountryPickerModal({
  visible,
  selectedIso,
  onSelect,
  onClose,
}: {
  visible:  boolean
  selectedIso: string
  onSelect: (c: Country) => void
  onClose:  () => void
}) {
  const t = useT()
  const [query, setQuery] = useState('')
  const [searchFocused, setSearchFocused] = useState(false)

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return COUNTRIES
    return COUNTRIES.filter(
      c => c.name.toLowerCase().includes(q) || c.code.includes(q)
    )
  }, [query])

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView style={pm.container}>
        <View style={pm.header}>
          <Text style={pm.title}>{t.au_indicative}</Text>
          <TouchableOpacity
            style={pm.closeBtn}
            onPress={onClose}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel={t.cancel}
          >
            <Icon name="close" size={20} color={authUi.ink} strokeWidth={1.9} />
          </TouchableOpacity>
        </View>

        <View style={pm.searchBlock}>
          <AuthFieldFrame focused={searchFocused} style={pm.searchFrame}>
            <View style={pm.searchIconBox}>
              <Icon name="search" size={18} color={searchFocused ? authUi.ink : authUi.faint} strokeWidth={1.8} />
            </View>
            <TextInput
              style={pm.searchInput}
              placeholder={t.au_search_country}
              placeholderTextColor={authUi.faint}
              value={query}
              onChangeText={setQuery}
              onFocus={() => setSearchFocused(true)}
              onBlur={() => setSearchFocused(false)}
              autoCorrect={false}
              returnKeyType="search"
            />
            {query.length > 0 && (
              <TouchableOpacity
                style={pm.clearBtn}
                onPress={() => setQuery('')}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel={t.cancel}
              >
                <Icon name="close" size={16} color={authUi.muted} strokeWidth={1.9} />
              </TouchableOpacity>
            )}
          </AuthFieldFrame>
        </View>

        <FlatList
          data={filtered}
          keyExtractor={item => item.iso}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          contentContainerStyle={pm.listContent}
          renderItem={({ item }) => {
            const active = item.iso === selectedIso
            return (
              <TouchableOpacity
                style={[pm.row, active && pm.rowActive]}
                activeOpacity={0.72}
                accessibilityRole="button"
                accessibilityLabel={`${item.name}, ${item.code}`}
                accessibilityState={{ selected: active }}
                onPress={() => {
                  onSelect(item)
                  setQuery('')
                  onClose()
                }}
              >
                <Text style={pm.rowFlag}>{item.flag}</Text>
                <Text style={[pm.rowName, active && pm.rowNameActive]} numberOfLines={1}>{item.name}</Text>
                <Text style={[pm.rowCode, active && pm.rowCodeActive]}>{item.code}</Text>
                {active ? <Icon name="check" size={18} color={authUi.signal} strokeWidth={2.2} /> : null}
              </TouchableOpacity>
            )
          }}
          ItemSeparatorComponent={() => <View style={pm.sep} />}
          ListEmptyComponent={(
            <View style={pm.empty}>
              <Text style={pm.emptyTitle}>{t.au_no_country}</Text>
            </View>
          )}
        />
      </SafeAreaView>
    </Modal>
  )
}

// ─── Main screen ──────────────────────────────────────────────────────────────
type Nav = StackNavigationProp<AuthStackParams>

export default function PhoneScreen() {
  const nav     = useNavigation<Nav>()
  const { top, bottom } = useSafeAreaInsets()
  const { lang, setLang } = useI18n()
  const t = useT()

  const [selected, setSelected] = useState<Country>(detectCountryEntry)
  const [phone,    setPhone]    = useState('')
  const [loading,  setLoading]  = useState(false)
  const [focused,  setFocused]  = useState(false)
  const [pickerOpen, setPickerOpen] = useState(false)

  const canGo = phone.replace(/\D/g, '').length >= 7

  async function handleContinue() {
    if (!canGo || loading) return
    setLoading(true)
    const full = `${selected.code}${phone.replace(/\D/g, '')}`
    try {
      const { exists } = await authService.checkPhone(full)
      nav.navigate(exists ? 'LoginPassword' : 'CreatePassword', { phone: full, countryCode: selected.code })
    } catch {
      Alert.alert(t.error, t.dn_load_fail_sub)
    } finally { setLoading(false) }
  }

  return (
    <KeyboardAvoidingView style={authStyles.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        style={authStyles.screen}
        contentContainerStyle={[s.page, { paddingTop: top + 10, paddingBottom: bottom + 14 }]}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        showsVerticalScrollIndicator={false}
      >
        <AuthHeader
          step={1}
          total={5}
          stage={t.au_stage_contact}
          right={(
            <View style={s.langToggle} accessibilityRole="radiogroup">
              <TouchableOpacity
                onPress={() => setLang('en')}
                style={[s.langOpt, lang === 'en' && s.langOptOn]}
                activeOpacity={0.72}
                accessibilityRole="radio"
                accessibilityLabel="English"
                accessibilityState={{ checked: lang === 'en' }}
                hitSlop={6}
              >
                <Text style={[s.langTxt, lang === 'en' && s.langTxtOn]}>EN</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setLang('pt')}
                style={[s.langOpt, lang === 'pt' && s.langOptOn]}
                activeOpacity={0.72}
                accessibilityRole="radio"
                accessibilityLabel="Português"
                accessibilityState={{ checked: lang === 'pt' }}
                hitSlop={6}
              >
                <Text style={[s.langTxt, lang === 'pt' && s.langTxtOn]}>PT</Text>
              </TouchableOpacity>
            </View>
          )}
        />

        <View style={[authStyles.hero, s.hero]}>
          <Text style={authStyles.heading}>{t.au_phone_heading}</Text>
          <Text style={authStyles.sub}>{t.au_phone_sub}</Text>
        </View>

        <View style={s.fieldBlock}>
          <AuthFieldFrame focused={focused || pickerOpen} style={s.phoneFrame}>
            <TouchableOpacity
              style={s.countryBtn}
              activeOpacity={0.72}
              onPress={() => { Keyboard.dismiss(); setPickerOpen(true) }}
              accessibilityRole="button"
              accessibilityLabel={`${selected.name}, ${selected.code}`}
              accessibilityHint={t.au_indicative}
            >
              <Text style={s.countryFlag}>{selected.flag}</Text>
              <Text style={s.countryCode}>{selected.code}</Text>
              <Icon name="chevron-down" size={16} color={authUi.muted} strokeWidth={1.8} />
            </TouchableOpacity>
            <View style={s.fieldDivider} />
            <TextInput
              style={s.phoneInput}
              placeholder="923 456 789"
              placeholderTextColor={authUi.faint}
              value={phone}
              onChangeText={setPhone}
              accessibilityLabel={t.au_phone_label}
              keyboardType="phone-pad"
              returnKeyType="done"
              onSubmitEditing={handleContinue}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              autoFocus
            />
          </AuthFieldFrame>
        </View>

        <View style={s.spacer} />

        <AuthPrimaryButton
          label={t.au_continue}
          onPress={handleContinue}
          disabled={!canGo}
          loading={loading}
        />

        <Text style={s.legal}>
          {t.au_legal_prefix}{' '}
          <Text style={s.legalLink}>{t.au_terms}</Text>
          {' '}{t.au_legal_middle}{' '}
          <Text style={s.legalLink}>{t.au_privacy}</Text>
          {' '}{t.au_legal_suffix}
        </Text>

      </ScrollView>

      <CountryPickerModal
        visible={pickerOpen}
        selectedIso={selected.iso}
        onSelect={c => setSelected(c)}
        onClose={() => setPickerOpen(false)}
      />
    </KeyboardAvoidingView>
  )
}

const s = StyleSheet.create({
  page: { flexGrow: 1, paddingHorizontal: 24, backgroundColor: authUi.paper },
  langToggle: {
    height: 32,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  langOpt: {
    minWidth: 27,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  langOptOn: {},
  langTxt: {
    color: authUi.muted,
    fontFamily: fonts.medium,
    fontSize: 12,
    lineHeight: 16,
  },
  langTxtOn: { color: authUi.ink, fontFamily: fonts.bold },
  hero: { marginTop: 46, gap: 10 },
  fieldBlock: { marginTop: 32 },
  phoneFrame: { height: 56 },
  countryBtn: {
    height: 54,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingLeft: 10,
    paddingRight: 12,
    flexShrink: 0,
  },
  countryFlag: { width: 28, fontSize: 21, lineHeight: 26, textAlign: 'center' },
  countryCode: {
    color: authUi.ink,
    fontFamily: fonts.semiBold,
    fontSize: 16,
    lineHeight: 20,
    fontVariant: ['tabular-nums'],
  },
  fieldDivider: {
    width: StyleSheet.hairlineWidth,
    height: 30,
    backgroundColor: authUi.line,
  },
  phoneInput: {
    flex: 1,
    height: 54,
    paddingHorizontal: 14,
    paddingVertical: 0,
    color: authUi.ink,
    fontFamily: fonts.medium,
    fontSize: 16,
    lineHeight: 22,
    letterSpacing: 0.25,
    fontVariant: ['tabular-nums'],
  },
  spacer: { flex: 1, minHeight: 22 },
  legal: {
    marginTop: 14,
    paddingHorizontal: 8,
    color: authUi.muted,
    fontFamily: fonts.regular,
    fontSize: 11.5,
    lineHeight: 17,
    textAlign: 'center',
  },
  legalLink: { color: authUi.ink, fontFamily: fonts.semiBold },
})

// ─── Picker styles ────────────────────────────────────────────────────────────
const pm = StyleSheet.create({
  container: { flex: 1, backgroundColor: authUi.paper },
  header: {
    minHeight: 60,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: authUi.line,
  },
  title: {
    color: authUi.ink,
    fontFamily: fonts.bold,
    fontSize: 18,
    lineHeight: 23,
    letterSpacing: -0.3,
  },
  closeBtn: {
    width: 44,
    height: 44,
    marginRight: -11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchBlock: { paddingHorizontal: 16, paddingVertical: 12 },
  searchFrame: { height: 48 },
  searchIconBox: {
    width: 38,
    height: 46,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchInput: {
    flex: 1,
    height: 46,
    paddingVertical: 0,
    color: authUi.ink,
    fontFamily: fonts.regular,
    fontSize: 15,
    lineHeight: 20,
  },
  clearBtn: {
    width: 44,
    height: 46,
    alignItems: 'center',
    justifyContent: 'center',
  },
  listContent: { paddingBottom: 22 },
  row: {
    minHeight: 54,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 18,
  },
  rowActive: { backgroundColor: '#FAFAFA' },
  rowFlag: { width: 36, fontSize: 23, lineHeight: 28, textAlign: 'center' },
  rowName: {
    flex: 1,
    marginLeft: 12,
    color: authUi.ink,
    fontFamily: fonts.medium,
    fontSize: 15,
    lineHeight: 20,
  },
  rowNameActive: { fontFamily: fonts.bold },
  rowCode: {
    marginLeft: 12,
    color: authUi.muted,
    fontFamily: fonts.semiBold,
    fontSize: 14,
    lineHeight: 18,
    fontVariant: ['tabular-nums'],
  },
  rowCodeActive: { color: authUi.ink },
  sep: {
    height: StyleSheet.hairlineWidth,
    marginLeft: 82,
    marginRight: 22,
    backgroundColor: authUi.line,
  },
  empty: {
    paddingHorizontal: 22,
    paddingVertical: 44,
    alignItems: 'center',
  },
  emptyTitle: {
    color: authUi.muted,
    fontFamily: fonts.medium,
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
  },
})
