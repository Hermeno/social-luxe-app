import React, { useState } from 'react'
import { Modal, View, Text, TextInput, TouchableOpacity, Pressable, StyleSheet } from 'react-native'
import { useAuthStore } from '../../store/auth.store'
import { api } from '../../services/api'
import { colors, spacing, radius } from '../../theme'

const AVAILABILITY = ['Disponível', 'Ocupado', 'Ausente']
interface Props { visible: boolean; onClose: () => void }

export default function EditProfileSheet({ visible, onClose }: Props) {
  const { user, loadUser } = useAuthStore()
  const [name, setName]   = useState(user?.name ?? '')
  const [bio, setBio]     = useState(user?.bio ?? '')
  const [avail, setAvail] = useState(user?.availability ?? 'Disponível')
  const [saving, setSaving] = useState(false)

  async function save() {
    setSaving(true)
    try { await api.put('/users/profile', { name, bio, availability: avail }); await loadUser(); onClose() }
    catch {} finally { setSaving(false) }
  }

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <TouchableOpacity style={s.backdrop} onPress={onClose} activeOpacity={1} />
      <View style={s.sheet}>
        <View style={s.handle} />
        <Text style={s.title}>Editar Perfil</Text>
        <TextInput style={s.input} value={name} onChangeText={setName} placeholder="Nome" placeholderTextColor={colors.gray400} />
        <TextInput style={[s.input, s.bioInput]} value={bio} onChangeText={setBio} placeholder="Bio" placeholderTextColor={colors.gray400} multiline />
        <Text style={s.label}>Disponibilidade</Text>
        <View style={s.availRow}>
          {AVAILABILITY.map((a) => (
            <Pressable key={a} style={[s.availBtn, avail === a && s.availActive]} onPress={() => setAvail(a)}>
              <Text style={[s.availTxt, avail === a && s.availTxtActive]}>{a}</Text>
            </Pressable>
          ))}
        </View>
        <TouchableOpacity style={[s.saveBtn, saving && s.saveOff]} onPress={save} disabled={saving}>
          <Text style={s.saveTxt}>{saving ? 'Salvando...' : 'Salvar'}</Text>
        </TouchableOpacity>
      </View>
    </Modal>
  )
}

const s = StyleSheet.create({
  backdrop:      { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet:         { backgroundColor: colors.white, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: spacing.lg, gap: spacing.md },
  handle:        { width: 40, height: 4, borderRadius: 2, backgroundColor: colors.gray200, alignSelf: 'center', marginBottom: spacing.sm },
  title:         { fontSize: 18, fontWeight: '700' as const, color: colors.gray800, textAlign: 'center' },
  input:         { backgroundColor: colors.gray100, borderRadius: radius.md, padding: spacing.md, fontSize: 15, color: colors.gray800 },
  bioInput:      { minHeight: 80, textAlignVertical: 'top' },
  label:         { fontSize: 13, fontWeight: '600' as const, color: colors.gray600 },
  availRow:      { flexDirection: 'row', gap: spacing.sm },
  availBtn:      { flex: 1, paddingVertical: spacing.sm, borderRadius: radius.md, borderWidth: 1, borderColor: colors.gray200, alignItems: 'center' },
  availActive:   { backgroundColor: colors.primary, borderColor: colors.primary },
  availTxt:      { fontSize: 12, color: colors.gray600 },
  availTxtActive:{ color: colors.white, fontWeight: '600' as const },
  saveBtn:       { backgroundColor: colors.primary, borderRadius: radius.md, padding: spacing.md, alignItems: 'center' },
  saveOff:       { opacity: 0.5 },
  saveTxt:       { color: colors.white, fontWeight: '700' as const, fontSize: 15 },
})
