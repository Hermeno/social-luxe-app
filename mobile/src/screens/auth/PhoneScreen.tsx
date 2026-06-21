import React, { useState, useRef, useMemo } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, Animated, ActivityIndicator,
  Modal, FlatList, SafeAreaView,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { useNavigation } from '@react-navigation/native'
import { StackNavigationProp } from '@react-navigation/stack'
import { AuthStackParams } from '../../navigation/AuthNavigator'
import * as authService from '../../services/auth.service'
import { fonts } from '../../theme'

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
  onSelect,
  onClose,
}: {
  visible:  boolean
  onSelect: (c: Country) => void
  onClose:  () => void
}) {
  const [query, setQuery] = useState('')

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
        {/* Header */}
        <View style={pm.header}>
          <Text style={pm.title}>Indicativo</Text>
          <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Ionicons name="close" size={24} color="#333" />
          </TouchableOpacity>
        </View>

        {/* Search */}
        <View style={pm.searchWrap}>
          <Ionicons name="search" size={17} color="#ABABAB" style={pm.searchIcon} />
          <TextInput
            style={pm.searchInput}
            placeholder="Pesquisar país ou indicativo..."
            placeholderTextColor="#ABABAB"
            value={query}
            onChangeText={setQuery}
            autoCorrect={false}
            clearButtonMode="while-editing"
          />
        </View>

        {/* List */}
        <FlatList
          data={filtered}
          keyExtractor={item => item.iso}
          keyboardShouldPersistTaps="handled"
          renderItem={({ item }) => (
            <TouchableOpacity
              style={pm.row}
              activeOpacity={0.7}
              onPress={() => {
                onSelect(item)
                setQuery('')
                onClose()
              }}
            >
              <Text style={pm.rowFlag}>{item.flag}</Text>
              <Text style={pm.rowName} numberOfLines={1}>{item.name}</Text>
              <Text style={pm.rowCode}>{item.code}</Text>
            </TouchableOpacity>
          )}
          ItemSeparatorComponent={() => <View style={pm.sep} />}
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

  const [selected, setSelected] = useState<Country>(detectCountryEntry)
  const [phone,    setPhone]    = useState('')
  const [loading,  setLoading]  = useState(false)
  const [focused,  setFocused]  = useState(false)
  const [pickerOpen, setPickerOpen] = useState(false)
  const btnScale = useRef(new Animated.Value(1)).current

  const canGo = phone.replace(/\D/g, '').length >= 7

  function bounce(cb: () => void) {
    Animated.sequence([
      Animated.spring(btnScale, { toValue: 0.97, useNativeDriver: true, speed: 60, bounciness: 0 }),
      Animated.spring(btnScale, { toValue: 1,    useNativeDriver: true, speed: 40, bounciness: 5 }),
    ]).start(cb)
  }

  async function handleContinue() {
    if (!canGo) return
    bounce(async () => {
      setLoading(true)
      try {
        const full = `${selected.code}${phone.replace(/\D/g, '')}`
        const { exists } = await authService.checkPhone(full)
        nav.navigate(exists ? 'LoginPassword' : 'CreatePassword', { phone: full, countryCode: selected.code })
      } catch {
        const full = `${selected.code}${phone.replace(/\D/g, '')}`
        nav.navigate('LoginPassword', { phone: full, countryCode: selected.code })
      } finally { setLoading(false) }
    })
  }

  return (
    <KeyboardAvoidingView style={s.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={[s.inner, { paddingTop: top + 18, paddingBottom: bottom + 14 }]}>

        {/* Brand + tagline */}
        <View style={s.brandRow}>
          <Text style={s.brand}>luxee</Text>
          <View style={s.brandDot} />
          <Text style={s.tagline}>histórias que desaparecem</Text>
        </View>

        {/* Heading */}
        <View style={s.hero}>
          <Text style={s.heading}>Qual é o teu{'\n'}número?</Text>
          <Text style={s.sub}>Vamos enviar-te um código por SMS para confirmar que és mesmo tu.</Text>
        </View>

        {/* Phone inputs */}
        <View style={s.inputRow}>
          {/* Country code selector */}
          <TouchableOpacity
            style={s.countryBtn}
            activeOpacity={0.75}
            onPress={() => setPickerOpen(true)}
          >
            <Text style={s.countryFlag}>{selected.flag}</Text>
            <Text style={s.countryCode}>{selected.code}</Text>
            <Ionicons name="chevron-down" size={18} color="#ABABAB" />
          </TouchableOpacity>

          {/* Number field */}
          <View style={[s.phoneWrap, focused && s.phoneWrapFocused]}>
            <TextInput
              style={s.phoneInput}
              placeholder="923 456 789"
              placeholderTextColor="#ABABAB"
              value={phone}
              onChangeText={setPhone}
              keyboardType="phone-pad"
              returnKeyType="done"
              onSubmitEditing={handleContinue}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              autoFocus
            />
          </View>
        </View>

        <View style={s.spacer} />

        {/* CTA */}
        <Animated.View style={{ transform: [{ scale: btnScale }] }}>
          <TouchableOpacity
            style={[s.cta, (!canGo || loading) && s.ctaOff]}
            onPress={handleContinue}
            disabled={!canGo || loading}
            activeOpacity={0.88}
          >
            {loading
              ? <ActivityIndicator color="#fff" size="small" />
              : <>
                  <Text style={s.ctaTxt}>Continuar</Text>
                  <Ionicons name="arrow-forward" size={19} color="#fff" />
                </>
            }
          </TouchableOpacity>
        </Animated.View>

        {/* Legal */}
        <Text style={s.legal}>
          Ao continuar, aceitas os{' '}
          <Text style={s.legalLink}>Termos</Text>
          {' '}e a{' '}
          <Text style={s.legalLink}>Política de Privacidade</Text>
          {' '}da luxee.
        </Text>

      </View>

      <CountryPickerModal
        visible={pickerOpen}
        onSelect={c => setSelected(c)}
        onClose={() => setPickerOpen(false)}
      />
    </KeyboardAvoidingView>
  )
}

const B  = '#CA2851'
const T  = '#1A1A1A'
const S  = '#6E6E73'
const M  = '#ABABAB'
const BD = '#E5E5EA'
const BG = '#FFFFFF'
const SX = '#F9F9FB'

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: BG },
  inner:  { flex: 1, paddingHorizontal: 24 },

  brandRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 7, marginBottom: 0 },
  brand:    { fontFamily: fonts.bold, fontSize: 22, color: T, letterSpacing: -0.6 },
  brandDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: B, marginTop: 9 },
  tagline:  { marginLeft: 6, fontFamily: fonts.medium, fontSize: 13, color: M, letterSpacing: -0.1, marginTop: 6 },

  hero:    { marginTop: 48, gap: 14 },
  heading: { fontFamily: fonts.extraBold, fontSize: 34, lineHeight: 40, letterSpacing: -1, color: T },
  sub:     { fontFamily: fonts.regular, fontSize: 15, lineHeight: 22, color: S },

  inputRow: { marginTop: 34, flexDirection: 'row', gap: 10 },

  countryBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    height: 56, borderRadius: 16,
    borderWidth: 1.5, borderColor: BD,
    backgroundColor: SX, paddingHorizontal: 14,
    flexShrink: 0,
  },
  countryFlag: { fontSize: 22, lineHeight: 26 },
  countryCode: { fontFamily: fonts.semiBold, fontSize: 17, color: T },

  phoneWrap: {
    flex: 1, height: 56, borderRadius: 16,
    borderWidth: 1.5, borderColor: BD,
    backgroundColor: SX,
    paddingHorizontal: 16, justifyContent: 'center',
  },
  phoneWrapFocused: {
    borderColor: B, backgroundColor: BG,
    ...Platform.select({
      ios: { shadowColor: B, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.15, shadowRadius: 12 },
    }),
  },
  phoneInput: {
    fontFamily: fonts.medium, fontSize: 17,
    color: T, letterSpacing: 0.3,
    paddingVertical: 0,
  },

  spacer: { flex: 1 },

  cta: {
    height: 52, borderRadius: 16,
    backgroundColor: B,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    ...Platform.select({
      ios: { shadowColor: B, shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.65, shadowRadius: 18 },
      android: { elevation: 8 },
    }),
  },
  ctaOff: { opacity: 0.45 },
  ctaTxt: { fontFamily: fonts.bold, fontSize: 17, color: '#fff', letterSpacing: -0.2 },

  legal:     { marginTop: 16, fontSize: 12, fontFamily: fonts.regular, color: M, textAlign: 'center', lineHeight: 18, paddingHorizontal: 6 },
  legalLink: { color: S, fontFamily: fonts.semiBold },
})

// ─── Picker styles ────────────────────────────────────────────────────────────
const pm = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: BD,
  },
  title: { fontFamily: fonts.bold, fontSize: 18, color: T },

  searchWrap: {
    flexDirection: 'row', alignItems: 'center',
    margin: 16, paddingHorizontal: 14,
    height: 44, borderRadius: 12,
    backgroundColor: SX, borderWidth: 1, borderColor: BD,
  },
  searchIcon:  { marginRight: 8 },
  searchInput: {
    flex: 1, fontFamily: fonts.regular, fontSize: 15,
    color: T, paddingVertical: 0,
  },

  row: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 20, paddingVertical: 14, gap: 14,
  },
  rowFlag: { fontSize: 24, width: 32, textAlign: 'center' },
  rowName: { flex: 1, fontFamily: fonts.medium, fontSize: 15, color: T },
  rowCode: { fontFamily: fonts.semiBold, fontSize: 15, color: S },
  sep:     { height: StyleSheet.hairlineWidth, backgroundColor: BD, marginLeft: 66 },
})
