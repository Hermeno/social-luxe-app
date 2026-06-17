import React, { useState } from 'react'
import { Modal, View, Text, TextInput, TouchableOpacity, Pressable, Switch, StyleSheet, KeyboardAvoidingView, Platform, ScrollView } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useAuthStore } from '../../store/auth.store'
import { api } from '../../services/api'
import { colors, spacing, radius, fonts } from '../../theme'

const AVAILABILITY = ['Disponível', 'Ocupado', 'Ausente']
interface Props { visible: boolean; onClose: () => void }

export default function EditProfileSheet({ visible, onClose }: Props) {
  const { user, refreshUser } = useAuthStore()
  const [name,        setName]        = useState(user?.name ?? '')
  const [bio,         setBio]         = useState(user?.bio ?? '')
  const [avail,       setAvail]       = useState(user?.availability ?? 'Disponível')
  const [viewsPublic, setViewsPublic] = useState(user?.viewsPublic ?? false)
  const [saving, setSaving] = useState(false)

  async function save() {
    setSaving(true)
    try {
      await api.put('/users/profile', { name, bio, availability: avail, viewsPublic })
      await refreshUser()
      onClose()
    } catch {} finally { setSaving(false) }
  }

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <TouchableOpacity style={s.backdrop} onPress={onClose} activeOpacity={1} />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 8}
      >
        <ScrollView
          bounces={false}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={s.sheet}
        >
          <View style={s.handle} />
          <Text style={s.title}>Editar Perfil</Text>

          <TextInput style={s.input} value={name} onChangeText={setName} placeholder="Nome" placeholderTextColor={colors.gray400} returnKeyType="next" />
          <TextInput style={[s.input, s.bioInput]} value={bio} onChangeText={setBio} placeholder="Bio" placeholderTextColor={colors.gray400} multiline returnKeyType="done" />

          <Text style={s.label}>Disponibilidade</Text>
          <View style={s.availRow}>
            {AVAILABILITY.map((a) => (
              <Pressable key={a} style={[s.availBtn, avail === a && s.availActive]} onPress={() => setAvail(a)}>
                <Text style={[s.availTxt, avail === a && s.availTxtActive]}>{a}</Text>
              </Pressable>
            ))}
          </View>

          {/* Views visibility toggle */}
          <View style={s.toggleRow}>
            <View style={s.toggleLeft}>
              <Ionicons name="eye-outline" size={18} color={colors.gray600} />
              <View style={s.toggleText}>
                <Text style={s.toggleLabel}>Visualizações públicas</Text>
                <Text style={s.toggleSub}>
                  {viewsPublic
                    ? 'Todos podem ver o total de views'
                    : 'Apenas tu vês o total de views'}
                </Text>
              </View>
            </View>
            <Switch
              value={viewsPublic}
              onValueChange={setViewsPublic}
              trackColor={{ false: colors.gray200, true: `${colors.primary}60` }}
              thumbColor={viewsPublic ? colors.primary : colors.white}
            />
          </View>

          <TouchableOpacity style={[s.saveBtn, saving && s.saveOff]} onPress={save} disabled={saving}>
            <Text style={s.saveTxt}>{saving ? 'Salvando...' : 'Salvar'}</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  )
}

const s = StyleSheet.create({
  backdrop:      { flex: 1, backgroundColor: 'transparent' },
  sheet:         { backgroundColor: colors.white, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: spacing.lg, gap: spacing.md },
  handle:        { width: 40, height: 4, borderRadius: 2, backgroundColor: colors.gray200, alignSelf: 'center', marginBottom: spacing.sm },
  title:         { fontSize: 18, fontFamily: fonts.bold, color: colors.gray800, textAlign: 'center' },
  input:         { backgroundColor: colors.gray100, borderRadius: radius.md, padding: spacing.md, fontSize: 15, fontFamily: fonts.regular, color: colors.gray800 },
  bioInput:      { minHeight: 80, textAlignVertical: 'top' },
  label:         { fontSize: 13, fontFamily: fonts.semiBold, color: colors.gray600 },
  availRow:      { flexDirection: 'row', gap: spacing.sm },
  availBtn:      { flex: 1, paddingVertical: spacing.sm, borderRadius: radius.md, borderWidth: 1, borderColor: colors.gray200, alignItems: 'center' },
  availActive:   { backgroundColor: colors.primary, borderColor: colors.primary },
  availTxt:      { fontSize: 12, fontFamily: fonts.regular, color: colors.gray600 },
  availTxtActive:{ color: colors.white, fontFamily: fonts.semiBold },

  toggleRow:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: colors.gray100, borderRadius: radius.md, padding: spacing.md },
  toggleLeft: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  toggleText: { flex: 1, gap: 2 },
  toggleLabel:{ fontSize: 14, fontFamily: fonts.semiBold, color: colors.gray800 },
  toggleSub:  { fontSize: 11, fontFamily: fonts.regular, color: colors.gray400 },

  saveBtn:       { backgroundColor: colors.primary, borderRadius: radius.md, padding: spacing.md, alignItems: 'center' },
  saveOff:       { opacity: 0.5 },
  saveTxt:       { color: colors.white, fontFamily: fonts.bold, fontSize: 15 },
})
