import React, { useState } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useNavigation } from '@react-navigation/native'
import { changePassword } from '../../services/auth.service'
import { toast } from '../../utils/toast'
import { fonts } from '../../theme'
import { useT } from '../../i18n'

const T_C = '#1A1A1A'
const M   = '#ABABAB'
const B   = '#CA2851'
const BD  = '#E5E5EA'
const BG  = '#FFFFFF'
const SX  = '#F9F9FB'
const CARD_BD = '#EDEDF1'

function Field({ label, value, onChange, show, onToggleShow, placeholder }: {
  label: string; value: string; onChange: (v: string) => void
  show: boolean; onToggleShow: () => void; placeholder: string
}) {
  return (
    <View style={s.field}>
      <Text style={s.label}>{label}</Text>
      <View style={s.inputWrap}>
        <TextInput
          style={s.input}
          value={value}
          onChangeText={onChange}
          placeholder={placeholder}
          placeholderTextColor="#C4C4C4"
          secureTextEntry={!show}
          autoCapitalize="none"
          autoCorrect={false}
        />
        <TouchableOpacity onPress={onToggleShow} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Ionicons name={show ? 'eye-off-outline' : 'eye-outline'} size={19} color={M} />
        </TouchableOpacity>
      </View>
    </View>
  )
}

export default function ChangePasswordScreen() {
  const nav = useNavigation()
  const { top } = useSafeAreaInsets()
  const t = useT()

  const [current, setCurrent] = useState('')
  const [next,    setNext]    = useState('')
  const [confirm, setConfirm] = useState('')
  const [showCur, setShowCur] = useState(false)
  const [showNew, setShowNew] = useState(false)
  const [loading, setLoading] = useState(false)

  const canSubmit = current.length >= 1 && next.length >= 6 && confirm.length >= 6

  async function handleSubmit() {
    if (!canSubmit || loading) return
    if (next !== confirm) { toast.error(t.error, t.cp_mismatch); return }
    if (next.length < 6)  { toast.error(t.error, t.cp_tooShort); return }
    setLoading(true)
    try {
      await changePassword(current, next)
      toast.success(t.cp_okTitle, t.cp_okMsg)
      nav.goBack()
    } catch (e) {
      toast.error(t.error, e instanceof Error ? e.message : t.cp_fail)
    }
    setLoading(false)
  }

  return (
    <KeyboardAvoidingView style={s.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={[s.header, { paddingTop: top + 8 }]}>
        <TouchableOpacity onPress={() => nav.goBack()} style={s.backBtn} hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}>
          <Ionicons name="chevron-back" size={20} color={T_C} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>{t.cp_title}</Text>
      </View>

      <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <View style={s.card}>
          <Field label={t.cp_current} value={current} onChange={setCurrent} show={showCur} onToggleShow={() => setShowCur(v => !v)} placeholder={t.cp_currentPh} />
          <View style={s.sep} />
          <Field label={t.cp_new} value={next} onChange={setNext} show={showNew} onToggleShow={() => setShowNew(v => !v)} placeholder={t.cp_newPh} />
          <View style={s.sep} />
          <Field label={t.cp_confirm} value={confirm} onChange={setConfirm} show={showNew} onToggleShow={() => setShowNew(v => !v)} placeholder={t.cp_confirmPh} />
        </View>

        <Text style={s.hint}>{t.cp_hint}</Text>

        <TouchableOpacity
          style={[s.submit, !canSubmit && s.submitOff]}
          onPress={handleSubmit}
          disabled={!canSubmit || loading}
          activeOpacity={0.88}
        >
          {loading ? <ActivityIndicator color="#fff" size="small" /> : <Text style={s.submitTxt}>{t.cp_save}</Text>}
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

const s = StyleSheet.create({
  screen:  { flex: 1, backgroundColor: SX },
  header:  { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingBottom: 12 },
  backBtn: { width: 40, height: 40, borderRadius: 999, backgroundColor: BG, borderWidth: 1, borderColor: BD, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontFamily: fonts.extraBold, fontSize: 22, letterSpacing: -0.5, color: T_C },
  content: { paddingHorizontal: 16, paddingTop: 8, gap: 12 },

  card: { backgroundColor: BG, borderWidth: 1, borderColor: CARD_BD, borderRadius: 18, paddingHorizontal: 14 },
  sep:  { height: 1, backgroundColor: '#F0F0F3' },
  field: { paddingVertical: 12, gap: 6 },
  label: { fontFamily: fonts.semiBold, fontSize: 12.5, color: M },
  inputWrap: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  input: { flex: 1, fontFamily: fonts.medium, fontSize: 16, color: T_C, padding: 0 },

  hint: { fontFamily: fonts.regular, fontSize: 12.5, color: M, paddingHorizontal: 6, lineHeight: 18 },

  submit: { height: 52, borderRadius: 26, backgroundColor: B, alignItems: 'center', justifyContent: 'center', marginTop: 6 },
  submitOff: { opacity: 0.3 },
  submitTxt: { fontFamily: fonts.bold, fontSize: 16, color: '#fff', letterSpacing: -0.3 },
})
