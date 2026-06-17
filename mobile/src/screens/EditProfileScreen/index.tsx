import React, { useState, useEffect } from 'react'
import {
  View, Text, TextInput, ScrollView, TouchableOpacity, StyleSheet,
  ActivityIndicator, Alert, Modal, FlatList,
} from 'react-native'
import { Image } from 'expo-image'
import { Ionicons } from '@expo/vector-icons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useNavigation } from '@react-navigation/native'
import { StackNavigationProp } from '@react-navigation/stack'
import * as ImagePicker from 'expo-image-picker'
import { useAuthStore } from '../../store/auth.store'
import { AppStackParams } from '../../navigation/AppNavigator'
import { fonts } from '../../theme'
import { API_BASE } from '../../config'
import { api } from '../../services/api'
import { useT } from '../../i18n'

type Nav = StackNavigationProp<AppStackParams>

const T  = '#1A1A1A'
const S  = '#6E6E73'
const M  = '#ABABAB'
const B  = '#CA2851'
const BD = '#E5E5EA'
const BG = '#FFFFFF'
const SX = '#F9F9FB'
const CARD_BD = '#EDEDF1'
const G  = '#22C55E'

const STATUS_PRESETS = [
  { label: '👑 Rico',               value: 'Rico' },
  { label: '💼 Empresário',         value: 'Empresário' },
  { label: '🔥 Influencer',         value: 'Influencer' },
  { label: '🩺 Médico',             value: 'Médico' },
  { label: '💊 Enfermeiro',         value: 'Enfermeiro' },
  { label: '⚙️ Engenheiro',         value: 'Engenheiro' },
  { label: '📊 Engenheiro de Dados', value: 'Engenheiro de Dados' },
  { label: '🎨 Designer',           value: 'Designer' },
  { label: '📸 Fotógrafo',          value: 'Fotógrafo' },
  { label: '⚖️ Advogado',           value: 'Advogado' },
  { label: '🏋️ Atleta',             value: 'Atleta' },
  { label: '🎵 Artista',            value: 'Artista' },
  { label: '🤪 Maluco',             value: 'Maluco' },
  { label: '🎯 Importante',         value: 'Importante' },
  { label: '📚 Professor',          value: 'Professor' },
  { label: '🏗️ Arquitecto',         value: 'Arquitecto' },
  { label: '🌍 Viajante',           value: 'Viajante' },
]

function Toggle({ value }: { value: boolean }) {
  return (
    <View style={[tog.track, value && tog.on]}>
      <View style={[tog.thumb, value && tog.thumbOn]} />
    </View>
  )
}
const tog = StyleSheet.create({
  track:   { width: 46, height: 28, borderRadius: 999, backgroundColor: BD, padding: 2, justifyContent: 'center', flexShrink: 0 },
  on:      { backgroundColor: B },
  thumb:   { width: 24, height: 24, borderRadius: 999, backgroundColor: BG, alignSelf: 'flex-start', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.2, shadowRadius: 2, elevation: 2 },
  thumbOn: { alignSelf: 'flex-end' },
})

export default function EditProfileScreen() {
  const nav = useNavigation<Nav>()
  const { top, bottom } = useSafeAreaInsets()
  const { user, refreshUser } = useAuthStore()
  const t = useT()

  const [name,        setName]        = useState(user?.name ?? '')
  const [bio,         setBio]         = useState(user?.bio ?? '')
  const [avatar,      setAvatar]      = useState<string | null>(null)
  const [showDevice,  setShowDevice]  = useState(user?.showDevice ?? false)
  const [statusLabel, setStatusLabel] = useState(user?.statusLabel ?? '')
  const [statusModal, setStatusModal] = useState(false)
  const [customInput, setCustomInput] = useState('')
  const [saving,      setSaving]      = useState(false)

  // Sync from store whenever user object updates (e.g. after refreshUser)
  useEffect(() => {
    setShowDevice(user?.showDevice ?? false)
    setStatusLabel(user?.statusLabel ?? '')
  }, [user?.showDevice, user?.statusLabel])

  const avatarUri = avatar
    ?? (user?.avatar ? (user.avatar.startsWith('http') ? user.avatar : `${API_BASE}${user.avatar}`) : null)

  const isDirty =
    name !== (user?.name ?? '') ||
    bio  !== (user?.bio  ?? '') ||
    !!avatar ||
    showDevice  !== (user?.showDevice  ?? false) ||
    statusLabel !== (user?.statusLabel ?? '')

  async function pickAvatar() {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (status !== 'granted') {
      Alert.alert(t.profile_perm_title, t.profile_perm_msg)
      return
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'] as any,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.85,
    })
    if (!result.canceled && result.assets?.[0]) {
      setAvatar(result.assets[0].uri)
    }
  }

  async function handleSave() {
    if (!name.trim()) { Alert.alert(t.error, t.ep_nameEmpty); return }
    setSaving(true)
    try {
      const formData = new FormData()
      formData.append('name', name.trim())
      formData.append('bio', bio.trim())
      formData.append('showDevice', String(showDevice))
      formData.append('statusLabel', statusLabel.trim())
      if (avatar) {
        const fileName = avatar.split('/').pop() ?? 'avatar.jpg'
        const mimeType = fileName.endsWith('.png') ? 'image/png' : 'image/jpeg'
        formData.append('avatar', { uri: avatar, name: fileName, type: mimeType } as any)
      }
      await api.put('/users/profile', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      await refreshUser()
      nav.goBack()
    } catch (e: any) {
      Alert.alert(t.error, e.message ?? t.ep_saveError)
    } finally {
      setSaving(false)
    }
  }

  return (
    <View style={s.screen}>
      {/* Header */}
      <View style={[s.header, { paddingTop: top + 8 }]}>
        <TouchableOpacity onPress={() => nav.goBack()} style={s.backBtn} hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}>
          <Ionicons name="chevron-back" size={20} color={T} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>{t.ep_title}</Text>
        <TouchableOpacity
          style={[s.saveBtn, (!isDirty || saving) && s.saveBtnDisabled]}
          onPress={handleSave}
          disabled={!isDirty || saving}
          hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}
        >
          {saving
            ? <ActivityIndicator size="small" color={BG} />
            : <Text style={s.saveBtnTxt}>{t.save}</Text>
          }
        </TouchableOpacity>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[s.content, { paddingBottom: bottom + 32 }]}
        keyboardShouldPersistTaps="handled"
      >
        {/* Avatar */}
        <View style={s.avatarSection}>
          <TouchableOpacity style={s.avatarWrap} onPress={pickAvatar} activeOpacity={0.8}>
            {avatarUri
              ? <Image source={{ uri: avatarUri }} style={s.avatar} contentFit="cover" />
              : <View style={[s.avatar, s.avatarFallback]}>
                  <Text style={s.avatarInitial}>{name?.[0]?.toUpperCase() ?? '?'}</Text>
                </View>
            }
            <View style={s.cameraBadge}>
              <Ionicons name="camera" size={14} color={BG} />
            </View>
          </TouchableOpacity>
          <TouchableOpacity onPress={pickAvatar}>
            <Text style={s.changePhotoTxt}>{t.ep_changePhoto}</Text>
          </TouchableOpacity>
        </View>

        {/* Name */}
        <View style={s.section}>
          <Text style={s.sectionLabel}>{t.ep_info}</Text>
          <View style={s.card}>
            <FieldRow label={t.ep_name} value={name} onChange={setName} placeholder={t.ep_name} maxLength={40} isLast />
          </View>
        </View>

        {/* Bio */}
        <View style={s.section}>
          <Text style={s.sectionLabel}>{t.ep_bio}</Text>
          <View style={s.card}>
            <View style={s.bioWrap}>
              <TextInput
                style={s.bioInput}
                value={bio}
                onChangeText={setBio}
                placeholder={t.ep_bioPlaceholder}
                placeholderTextColor={M}
                multiline
                maxLength={160}
                textAlignVertical="top"
              />
              <Text style={s.charCount}>{bio.length}/160</Text>
            </View>
          </View>
        </View>

        {/* Identidade no Post */}
        <View style={s.section}>
          <Text style={s.sectionLabel}>Identidade no Post</Text>
          <View style={s.card}>
            {/* Device toggle */}
            <TouchableOpacity style={s.identRow} onPress={() => setShowDevice((v) => !v)} activeOpacity={0.8}>
              <View style={[s.identIcon, { backgroundColor: 'rgba(76,140,228,0.12)' }]}>
                <Ionicons name="phone-portrait-outline" size={16} color={B} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.identTitle}>Mostrar dispositivo</Text>
                <Text style={s.identSub}>{showDevice ? 'Visível nas publicações' : 'Oculto'}</Text>
              </View>
              <Toggle value={showDevice} />
            </TouchableOpacity>

            {/* Status badge */}
            <TouchableOpacity style={[s.identRow, s.identRowLast]} onPress={() => setStatusModal(true)} activeOpacity={0.8}>
              <View style={[s.identIcon, { backgroundColor: 'rgba(255,200,60,0.15)' }]}>
                <Ionicons name="ribbon-outline" size={16} color="#B8860B" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.identTitle}>Badge de status</Text>
                <Text style={s.identSub} numberOfLines={1}>{statusLabel || 'Nenhum'}</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={M} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Phone (read-only) */}
        <View style={s.section}>
          <Text style={s.sectionLabel}>{t.ep_connections}</Text>
          <View style={s.card}>
            <View style={s.fieldRow}>
              <View style={s.fieldLabelWrap}>
                <Ionicons name="call-outline" size={16} color={B} style={{ marginRight: 7 }} />
                <Text style={s.fieldLabel}>{t.ep_phone}</Text>
              </View>
              <View style={s.fieldValueRight}>
                <Text style={s.fieldValueMuted}>{user?.phone ?? ''}</Text>
                <View style={s.verifiedBadge}>
                  <Ionicons name="checkmark" size={11} color={BG} />
                </View>
              </View>
            </View>
          </View>
        </View>
      </ScrollView>

      {/* Status picker modal */}
      <Modal visible={statusModal} animationType="slide" transparent onRequestClose={() => setStatusModal(false)}>
        <TouchableOpacity style={sm.overlay} activeOpacity={1} onPress={() => setStatusModal(false)} />
        <View style={[sm.sheet, { paddingBottom: bottom + 20 }]}>
          <View style={sm.handle} />
          <Text style={sm.title}>Escolhe um badge de status</Text>

          <View style={sm.customRow}>
            <TextInput
              style={sm.customInput}
              placeholder="Escreve o teu próprio..."
              placeholderTextColor={M}
              value={customInput}
              onChangeText={setCustomInput}
              maxLength={28}
            />
            <TouchableOpacity
              style={[sm.customBtn, !customInput.trim() && sm.customBtnOff]}
              onPress={() => {
                if (!customInput.trim()) return
                setStatusLabel(customInput.trim())
                setCustomInput('')
                setStatusModal(false)
              }}
              activeOpacity={0.75}
            >
              <Text style={sm.customBtnTxt}>OK</Text>
            </TouchableOpacity>
          </View>

          <FlatList
            data={[{ label: '❌ Remover badge', value: '' }, ...STATUS_PRESETS]}
            keyExtractor={(item) => item.value}
            numColumns={2}
            columnWrapperStyle={{ gap: 8 }}
            contentContainerStyle={{ gap: 8, paddingTop: 4 }}
            showsVerticalScrollIndicator={false}
            renderItem={({ item }) => {
              const selected = statusLabel === item.value && item.value !== ''
              return (
                <TouchableOpacity
                  style={[sm.chip, selected && sm.chipSelected, item.value === '' && sm.chipRemove]}
                  onPress={() => {
                    setStatusLabel(item.value)
                    setStatusModal(false)
                  }}
                  activeOpacity={0.75}
                >
                  <Text style={[sm.chipTxt, selected && sm.chipTxtSelected, item.value === '' && sm.chipTxtRemove]}>
                    {item.label}
                  </Text>
                </TouchableOpacity>
              )
            }}
          />
        </View>
      </Modal>
    </View>
  )
}

function FieldRow({ label, value, onChange, placeholder, prefix, maxLength, autoCapitalize, isLast }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string
  prefix?: string; maxLength?: number; autoCapitalize?: 'none' | 'sentences'
  isLast?: boolean
}) {
  return (
    <View style={[fr.row, !isLast && fr.sep]}>
      <Text style={fr.label}>{label}</Text>
      <View style={fr.inputWrap}>
        {prefix && <Text style={fr.prefix}>{prefix}</Text>}
        <TextInput
          style={fr.input}
          value={value}
          onChangeText={onChange}
          placeholder={placeholder}
          placeholderTextColor={M}
          maxLength={maxLength}
          autoCapitalize={autoCapitalize ?? 'words'}
        />
      </View>
    </View>
  )
}
const fr = StyleSheet.create({
  row:      { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 13, paddingHorizontal: 14 },
  sep:      { borderBottomWidth: 1, borderBottomColor: '#F0F0F3' },
  label:    { fontFamily: fonts.semiBold, fontSize: 14, color: S, width: 88, flexShrink: 0 },
  inputWrap:{ flex: 1, flexDirection: 'row', alignItems: 'center' },
  prefix:   { fontFamily: fonts.semiBold, fontSize: 15, color: M },
  input:    { flex: 1, fontFamily: fonts.semiBold, fontSize: 15, color: T, padding: 0 },
})

const s = StyleSheet.create({
  screen:  { flex: 1, backgroundColor: BG },
  header:  { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingBottom: 10 },
  backBtn: { width: 40, height: 40, borderRadius: 999, backgroundColor: BG, borderWidth: 1, borderColor: BD, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { flex: 1, fontFamily: fonts.extraBold, fontSize: 22, letterSpacing: -0.5, color: T },
  saveBtn: {
    paddingHorizontal: 16, paddingVertical: 8, borderRadius: 12, backgroundColor: B,
    minWidth: 80, alignItems: 'center',
  },
  saveBtnDisabled: { backgroundColor: BD },
  saveBtnTxt: { fontFamily: fonts.bold, fontSize: 14, color: BG },
  content: { paddingHorizontal: 16, paddingTop: 8, gap: 0 },

  avatarSection: { alignItems: 'center', marginBottom: 24, gap: 10 },
  avatarWrap:    { width: 88, height: 88, borderRadius: 44, position: 'relative' },
  avatar:        { width: 88, height: 88, borderRadius: 44 },
  avatarFallback:{ backgroundColor: `${B}15`, alignItems: 'center', justifyContent: 'center' },
  avatarInitial: { fontFamily: fonts.bold, fontSize: 32, color: B },
  cameraBadge:   {
    position: 'absolute', bottom: 0, right: 0,
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: B, borderWidth: 2, borderColor: BG,
    alignItems: 'center', justifyContent: 'center',
  },
  changePhotoTxt: { fontFamily: fonts.bold, fontSize: 14, color: B },

  section:      { marginBottom: 16 },
  sectionLabel: { fontFamily: fonts.bold, fontSize: 11, color: M, letterSpacing: 1, textTransform: 'uppercase', paddingLeft: 6, paddingBottom: 8 },
  card:         { backgroundColor: SX, borderWidth: 1, borderColor: CARD_BD, borderRadius: 18, overflow: 'hidden' },

  bioWrap:  { padding: 14 },
  bioInput: { fontFamily: fonts.medium, fontSize: 15, color: T, minHeight: 80, padding: 0 },
  charCount:{ fontFamily: fonts.medium, fontSize: 11, color: M, textAlign: 'right', marginTop: 6 },

  fieldRow:       { flexDirection: 'row', alignItems: 'center', padding: 13, paddingHorizontal: 14 },
  fieldLabelWrap: { flexDirection: 'row', alignItems: 'center', width: 110, flexShrink: 0 },
  fieldLabel:     { fontFamily: fonts.semiBold, fontSize: 14, color: S },
  fieldValueRight:{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 },
  fieldValueMuted:{ fontFamily: fonts.medium, fontSize: 15, color: M, flex: 1 },
  verifiedBadge:  { width: 18, height: 18, borderRadius: 9, backgroundColor: G, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },

  // Identidade no Post rows
  identRow: {
    flexDirection: 'row', alignItems: 'center', gap: 13,
    padding: 13, paddingHorizontal: 14,
    borderBottomWidth: 1, borderBottomColor: '#F0F0F3',
  },
  identRowLast: { borderBottomWidth: 0 },
  identIcon: { width: 32, height: 32, borderRadius: 9, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  identTitle: { fontFamily: fonts.semiBold, fontSize: 15, color: T },
  identSub:   { fontFamily: fonts.medium, fontSize: 12, color: M, marginTop: 1 },
})

const sm = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.38)' },
  sheet: {
    backgroundColor: BG,
    borderTopLeftRadius: 28, borderTopRightRadius: 28,
    padding: 20, maxHeight: '72%',
  },
  handle: { width: 36, height: 4, borderRadius: 2, backgroundColor: BD, alignSelf: 'center', marginBottom: 16 },
  title:  { fontFamily: fonts.extraBold, fontSize: 18, color: T, marginBottom: 14, letterSpacing: -0.3 },

  customRow:    { flexDirection: 'row', gap: 10, marginBottom: 16 },
  customInput:  {
    flex: 1, backgroundColor: SX, borderWidth: 1, borderColor: CARD_BD,
    borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10,
    fontFamily: fonts.medium, fontSize: 14, color: T,
  },
  customBtn:    { backgroundColor: B, borderRadius: 12, paddingHorizontal: 18, alignItems: 'center', justifyContent: 'center' },
  customBtnOff: { backgroundColor: BD },
  customBtnTxt: { fontFamily: fonts.bold, fontSize: 14, color: BG },

  chip:           { flex: 1, backgroundColor: SX, borderWidth: 1, borderColor: CARD_BD, borderRadius: 12, paddingVertical: 10, paddingHorizontal: 12, alignItems: 'center' },
  chipSelected:   { backgroundColor: `${B}15`, borderColor: B },
  chipRemove:     { backgroundColor: 'rgba(255,59,48,0.07)', borderColor: 'rgba(255,59,48,0.2)' },
  chipTxt:        { fontFamily: fonts.medium, fontSize: 13, color: T, textAlign: 'center' },
  chipTxtSelected:{ color: B, fontFamily: fonts.bold },
  chipTxtRemove:  { color: '#FF3B30' },
})
