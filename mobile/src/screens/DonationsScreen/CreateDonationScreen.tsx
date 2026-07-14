import React, { useState } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, ActivityIndicator, Alert,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useNavigation } from '@react-navigation/native'
import { Ionicons } from '@expo/vector-icons'
import * as Location from 'expo-location'
import { colors, fonts } from '../../theme'
import { DonationType, createDonation } from '../../services/donation.service'
import Toast from 'react-native-toast-message'
import { useT, Strings } from '../../i18n'

const EXPIRE_OPTS: { key: keyof Strings; value: number }[] = [
  { key: 'dn_expire_3',    value: 3 },
  { key: 'dn_expire_7',    value: 7 },
  { key: 'dn_expire_15',   value: 15 },
  { key: 'dn_expire_30',   value: 30 },
  { key: 'dn_expire_none', value: 0 },
]

const RADIUS_OPTS = [5, 10, 20, 50]

export default function CreateDonationScreen() {
  const { top } = useSafeAreaInsets()
  const nav = useNavigation()
  const t = useT()

  const [title,       setTitle]       = useState('')
  const [description, setDescription] = useState('')
  const [type,        setType]        = useState<DonationType>('ITEM')
  const [radiusKm,    setRadiusKm]    = useState(10)
  const [expiresIdx,  setExpiresIdx]  = useState(1)   // default 7 days
  const [loading,     setLoading]     = useState(false)

  async function handleCreate() {
    if (!title.trim()) {
      Alert.alert(t.dn_required_field, t.dn_required_title)
      return
    }
    setLoading(true)
    try {
      const { status } = await Location.requestForegroundPermissionsAsync()
      if (status !== 'granted') {
        Alert.alert(t.dn_loc_required, t.dn_loc_required_sub)
        setLoading(false)
        return
      }
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced })

      const expOpt = EXPIRE_OPTS[expiresIdx]
      await createDonation({
        title: title.trim(),
        description: description.trim() || undefined,
        lat: pos.coords.latitude,
        lng: pos.coords.longitude,
        radiusKm,
        type,
        expiresInDays: expOpt.value > 0 ? expOpt.value : undefined,
      })

      Toast.show({ type: 'success', text1: t.dn_published, text2: t.dn_published_sub, visibilityTime: 3000 })
      nav.goBack()
    } catch {
      Toast.show({ type: 'error', text1: t.error, text2: t.dn_publish_fail, visibilityTime: 2500 })
    } finally {
      setLoading(false)
    }
  }

  return (
    <View style={s.screen}>
      {/* Header */}
      <View style={[s.header, { paddingTop: top + 12 }]}>
        <TouchableOpacity onPress={() => nav.goBack()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Ionicons name="chevron-back" size={26} color="#1A1A1A" />
        </TouchableOpacity>
        <Text style={s.headerTitle}>{t.dn_new}</Text>
        <View style={{ width: 26 }} />
      </View>

      <ScrollView style={s.scroll} contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">

        {/* Type selector */}
        <Text style={s.label}>{t.dn_type_label}</Text>
        <View style={s.typeRow}>
          {(['ITEM', 'FINANCIAL'] as DonationType[]).map((dt) => (
            <TouchableOpacity
              key={dt}
              style={[s.typePill, type === dt && s.typePillActive]}
              onPress={() => setType(dt)}
              activeOpacity={0.75}
            >
              <Ionicons
                name={dt === 'ITEM' ? 'gift-outline' : 'cash-outline'}
                size={16}
                color={type === dt ? '#fff' : colors.gray500}
              />
              <Text style={[s.typePillTxt, type === dt && s.typePillTxtActive]}>
                {dt === 'ITEM' ? t.dn_type_item : t.dn_type_financial}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Title */}
        <Text style={s.label}>{t.dn_title_label}</Text>
        <TextInput
          style={s.input}
          placeholder={t.dn_title_ph}
          placeholderTextColor={colors.gray400}
          value={title}
          onChangeText={setTitle}
          maxLength={80}
        />

        {/* Description */}
        <Text style={s.label}>{t.dn_desc_label}</Text>
        <TextInput
          style={[s.input, s.inputMulti]}
          placeholder={t.dn_desc_ph}
          placeholderTextColor={colors.gray400}
          value={description}
          onChangeText={setDescription}
          multiline
          numberOfLines={3}
          textAlignVertical="top"
          maxLength={400}
        />

        {/* Radius */}
        <Text style={s.label}>{t.dn_radius_label}</Text>
        <View style={s.pillRow}>
          {RADIUS_OPTS.map((r) => (
            <TouchableOpacity
              key={r}
              style={[s.smallPill, radiusKm === r && s.smallPillActive]}
              onPress={() => setRadiusKm(r)}
            >
              <Text style={[s.smallPillTxt, radiusKm === r && s.smallPillTxtActive]}>{r} km</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Expires */}
        <Text style={s.label}>{t.dn_expire_label}</Text>
        <View style={s.pillRow}>
          {EXPIRE_OPTS.map((opt, i) => (
            <TouchableOpacity
              key={i}
              style={[s.smallPill, expiresIdx === i && s.smallPillActive]}
              onPress={() => setExpiresIdx(i)}
            >
              <Text style={[s.smallPillTxt, expiresIdx === i && s.smallPillTxtActive]}>{t[opt.key]}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Location note */}
        <View style={s.locNote}>
          <Ionicons name="location-outline" size={14} color={colors.primary} />
          <Text style={s.locNoteTxt}>{t.dn_loc_note}</Text>
        </View>

        {/* Submit */}
        <TouchableOpacity
          style={[s.submitBtn, loading && s.submitBtnOff]}
          onPress={handleCreate}
          disabled={loading}
          activeOpacity={0.85}
        >
          {loading
            ? <ActivityIndicator color="#fff" />
            : <Text style={s.submitTxt}>{t.dn_post}</Text>
          }
        </TouchableOpacity>

      </ScrollView>
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
  headerTitle: { fontSize: 17, fontFamily: fonts.bold, color: '#1A1A1A', letterSpacing: -0.2 },

  scroll:   { flex: 1 },
  content:  { padding: 20, gap: 6, paddingBottom: 48 },

  label: { fontSize: 13, fontFamily: fonts.semiBold, color: '#333', marginTop: 14, marginBottom: 8 },

  typeRow: { flexDirection: 'row', gap: 10 },
  typePill: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7,
    borderWidth: 1.5, borderColor: colors.gray200, borderRadius: 12,
    paddingVertical: 12,
  },
  typePillActive:    { backgroundColor: colors.primary, borderColor: colors.primary },
  typePillTxt:       { fontSize: 14, fontFamily: fonts.medium, color: colors.gray500 },
  typePillTxtActive: { color: '#fff' },

  input: {
    borderWidth: 1.5, borderColor: colors.gray200, borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 12,
    fontSize: 15, fontFamily: fonts.regular, color: '#1A1A1A',
    backgroundColor: '#FAFAFA',
  },
  inputMulti: { minHeight: 90, paddingTop: 12 },

  pillRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  smallPill: {
    borderWidth: 1.5, borderColor: colors.gray200, borderRadius: 20,
    paddingHorizontal: 14, paddingVertical: 7,
  },
  smallPillActive:    { backgroundColor: colors.primary, borderColor: colors.primary },
  smallPillTxt:       { fontSize: 13, fontFamily: fonts.medium, color: colors.gray500 },
  smallPillTxtActive: { color: '#fff' },

  locNote: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 7, marginTop: 16,
    padding: 12, borderRadius: 10, backgroundColor: `${colors.primary}0A`,
  },
  locNoteTxt: { flex: 1, fontSize: 12, fontFamily: fonts.regular, color: '#555', lineHeight: 17 },

  submitBtn: {
    marginTop: 28, backgroundColor: colors.primary,
    borderRadius: 14, paddingVertical: 16, alignItems: 'center',
  },
  submitBtnOff: { opacity: 0.6 },
  submitTxt:    { color: '#fff', fontSize: 16, fontFamily: fonts.bold },
})
