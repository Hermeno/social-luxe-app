import React, { useEffect, useState } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  StyleSheet, Modal, ActivityIndicator, Alert, Image,
} from 'react-native'
import * as ImagePicker from 'expo-image-picker'
import { Ionicons } from '@expo/vector-icons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import {
  GroupInfo, GroupMember,
  getGroupInfo, updateGroup, deleteGroup,
  removeGroupMember, promoteToAdmin, leaveGroup,
} from '../../services/group.service'
import AvatarImage from '../../components/AvatarImage'
import { colors, fonts, spacing, radius } from '../../theme'

interface Props {
  visible:        boolean
  groupId:        string
  onClose:        () => void
  onGroupDeleted: () => void
  onGroupUpdated: (name: string, avatar: string | null) => void
  currentUserId:  string
}

export default function GroupSettingsSheet({
  visible, groupId, onClose, onGroupDeleted, onGroupUpdated, currentUserId,
}: Props) {
  const { top, bottom } = useSafeAreaInsets()
  const [info,        setInfo]        = useState<GroupInfo | null>(null)
  const [loading,     setLoading]     = useState(false)
  const [saving,      setSaving]      = useState(false)
  const [editName,    setEditName]    = useState(false)
  const [nameVal,     setNameVal]     = useState('')
  const [editDesc,    setEditDesc]    = useState(false)
  const [descVal,     setDescVal]     = useState('')
  const [newAvatar,   setNewAvatar]   = useState<string | null>(null)

  useEffect(() => {
    if (!visible) return
    setLoading(true)
    getGroupInfo(groupId)
      .then((data) => {
        setInfo(data)
        setNameVal(data.name)
        setDescVal(data.description ?? '')
      })
      .catch(() => Alert.alert('Erro', 'Não foi possível carregar as definições.'))
      .finally(() => setLoading(false))
  }, [visible, groupId])

  const isAdmin   = info?.myRole === 'admin'
  const isCreator = info?.isCreator ?? false

  async function pickAvatar() {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (status !== 'granted') { Alert.alert('Permissão necessária'); return }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: 'images', allowsEditing: true, aspect: [1, 1], quality: 0.85,
    })
    if (result.canceled || !result.assets[0]) return
    setNewAvatar(result.assets[0].uri)
  }

  async function saveChanges(overrides?: { name?: string; description?: string }) {
    setSaving(true)
    try {
      const payload: any = {}
      const n = overrides?.name        ?? (editName ? nameVal.trim() : undefined)
      const d = overrides?.description ?? (editDesc ? descVal.trim() : undefined)
      if (n)           payload.name        = n
      if (d !== undefined) payload.description = d
      if (newAvatar)   payload.avatarUri   = newAvatar

      if (!Object.keys(payload).length) { setSaving(false); return }

      const updated = await updateGroup(groupId, payload)
      setInfo((prev) => prev ? { ...prev, ...updated } : prev)
      setNewAvatar(null)
      setEditName(false)
      setEditDesc(false)
      onGroupUpdated(updated.name, updated.avatar)
      Alert.alert('Guardado', 'Comunidade actualizada.')
    } catch (e: any) {
      Alert.alert('Erro', e.message)
    } finally { setSaving(false) }
  }

  async function handleKick(member: GroupMember) {
    Alert.alert('Remover membro', `Remover ${member.user.name}?`, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Remover', style: 'destructive', onPress: async () => {
        try {
          await removeGroupMember(groupId, member.userId)
          setInfo((prev) => prev ? {
            ...prev,
            members:     prev.members.filter((m) => m.userId !== member.userId),
            memberCount: prev.memberCount - 1,
          } : prev)
        } catch (e: any) { Alert.alert('Erro', e.message) }
      }},
    ])
  }

  async function handlePromote(member: GroupMember) {
    Alert.alert('Promover a admin', `Tornar ${member.user.name} administrador?`, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Promover', onPress: async () => {
        try {
          await promoteToAdmin(groupId, member.userId)
          setInfo((prev) => prev ? {
            ...prev,
            members: prev.members.map((m) =>
              m.userId === member.userId ? { ...m, isAdmin: true } : m),
          } : prev)
        } catch (e: any) { Alert.alert('Erro', e.message) }
      }},
    ])
  }

  async function handleDelete() {
    Alert.alert('Eliminar comunidade', 'Esta ação é permanente.', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Eliminar', style: 'destructive', onPress: async () => {
        try { await deleteGroup(groupId); onGroupDeleted() }
        catch (e: any) { Alert.alert('Erro', e.message) }
      }},
    ])
  }

  async function handleLeave() {
    Alert.alert('Sair da comunidade', 'Tens a certeza?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Sair', style: 'destructive', onPress: async () => {
        try { await leaveGroup(groupId); onGroupDeleted() }
        catch (e: any) { Alert.alert('Erro', e.message) }
      }},
    ])
  }

  if (!visible) return null

  const avatarUri = newAvatar ?? info?.avatar ?? null

  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={[s.container, { paddingTop: top || 16 }]}>

        {/* ── Header ── */}
        <View style={s.header}>
          <TouchableOpacity onPress={onClose}>
            <Ionicons name="close" size={24} color={colors.gray800} />
          </TouchableOpacity>
          <Text style={s.headerTitle}>Definições</Text>
          {isAdmin && (
            <TouchableOpacity onPress={() => saveChanges()} disabled={saving}>
              {saving
                ? <ActivityIndicator size="small" color={colors.primary} />
                : <Text style={s.saveHeaderBtn}>Guardar</Text>
              }
            </TouchableOpacity>
          )}
          {!isAdmin && <View style={{ width: 56 }} />}
        </View>

        {loading ? (
          <View style={s.center}><ActivityIndicator color={colors.primary} /></View>
        ) : !info ? null : (
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll}>

            {/* ── Avatar ── */}
            <View style={s.avatarSection}>
              <TouchableOpacity onPress={isAdmin ? pickAvatar : undefined} activeOpacity={isAdmin ? 0.75 : 1}>
                {avatarUri
                  ? <Image source={{ uri: avatarUri }} style={s.avatarLarge} />
                  : (
                    <View style={[s.avatarLarge, s.avatarFallback]}>
                      <Ionicons name="people" size={36} color={colors.white} />
                    </View>
                  )
                }
                {isAdmin && (
                  <View style={s.avatarEditBadge}>
                    <Ionicons name="camera" size={14} color={colors.white} />
                  </View>
                )}
              </TouchableOpacity>
              <Text style={s.avatarHint}>{isAdmin ? 'Toca para alterar a foto' : info.name}</Text>
            </View>

            {/* ── Name ── */}
            <View style={s.fieldCard}>
              <View style={s.fieldHeader}>
                <Text style={s.fieldLabel}>Nome</Text>
                {isAdmin && !editName && (
                  <TouchableOpacity onPress={() => setEditName(true)}>
                    <Ionicons name="pencil-outline" size={16} color={colors.primary} />
                  </TouchableOpacity>
                )}
              </View>
              {editName && isAdmin ? (
                <TextInput
                  style={s.fieldInput}
                  value={nameVal}
                  onChangeText={setNameVal}
                  autoFocus
                  returnKeyType="done"
                  onSubmitEditing={() => setEditName(false)}
                />
              ) : (
                <Text style={s.fieldValue}>{info.name}</Text>
              )}
            </View>

            {/* ── Description ── */}
            <View style={s.fieldCard}>
              <View style={s.fieldHeader}>
                <Text style={s.fieldLabel}>Descrição</Text>
                {isAdmin && !editDesc && (
                  <TouchableOpacity onPress={() => setEditDesc(true)}>
                    <Ionicons name="pencil-outline" size={16} color={colors.primary} />
                  </TouchableOpacity>
                )}
              </View>
              {editDesc && isAdmin ? (
                <TextInput
                  style={[s.fieldInput, { minHeight: 72, textAlignVertical: 'top' }]}
                  value={descVal}
                  onChangeText={setDescVal}
                  multiline
                  autoFocus
                  placeholder="Adiciona uma descrição..."
                  placeholderTextColor={colors.gray400}
                />
              ) : (
                <Text style={[s.fieldValue, !info.description && { color: colors.gray400, fontStyle: 'italic' }]}>
                  {info.description || 'Sem descrição'}
                </Text>
              )}
            </View>

            {/* ── Type badge ── */}
            <View style={s.typeBadge}>
              <Ionicons
                name={info.type === 'COMMUNITY' ? 'globe-outline' : 'people-outline'}
                size={14} color={colors.primary}
              />
              <Text style={s.typeBadgeTxt}>
                {info.type === 'COMMUNITY' ? 'Comunidade pública' : 'Grupo privado'}
              </Text>
            </View>

            {/* ── Members ── */}
            <View style={s.section}>
              <Text style={s.sectionLabel}>{info.memberCount} {info.memberCount === 1 ? 'membro' : 'membros'}</Text>
              {info.members.map((member) => {
                const isSelf      = member.userId === currentUserId
                const canKick     = isAdmin && !isSelf && !(member.isAdmin && !isCreator)
                const canPromote  = isCreator && !isSelf && !member.isAdmin
                return (
                  <View key={member.userId} style={s.memberRow}>
                    <AvatarImage uri={member.user.avatar} size={44} />
                    <View style={s.memberMeta}>
                      <Text style={s.memberName}>
                        {member.user.name}{isSelf ? ' (tu)' : ''}
                      </Text>
                      {member.isAdmin && (
                        <View style={s.adminTag}>
                          <Ionicons name="shield-checkmark" size={10} color={colors.primary} />
                          <Text style={s.adminTagTxt}>
                            {info.createdBy === member.userId ? 'Criador' : 'Admin'}
                          </Text>
                        </View>
                      )}
                    </View>
                    <View style={s.memberBtns}>
                      {canPromote && (
                        <TouchableOpacity onPress={() => handlePromote(member)} style={s.memberBtn}>
                          <Ionicons name="shield-outline" size={18} color={colors.primary} />
                        </TouchableOpacity>
                      )}
                      {canKick && (
                        <TouchableOpacity onPress={() => handleKick(member)} style={s.memberBtn}>
                          <Ionicons name="person-remove-outline" size={18} color="#E53E3E" />
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>
                )
              })}
            </View>

            {/* ── Danger zone ── */}
            <View style={[s.section, { paddingBottom: bottom + spacing.lg }]}>
              {!isCreator && (
                <TouchableOpacity style={s.dangerBtn} onPress={handleLeave}>
                  <Ionicons name="exit-outline" size={18} color="#E53E3E" />
                  <Text style={s.dangerTxt}>Sair da comunidade</Text>
                </TouchableOpacity>
              )}
              {isCreator && (
                <TouchableOpacity style={s.dangerBtn} onPress={handleDelete}>
                  <Ionicons name="trash-outline" size={18} color="#E53E3E" />
                  <Text style={s.dangerTxt}>Eliminar comunidade</Text>
                </TouchableOpacity>
              )}
            </View>

          </ScrollView>
        )}
      </View>
    </Modal>
  )
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.white },
  center:    { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scroll:    { paddingBottom: 40 },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.md, paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.gray200,
  },
  headerTitle:  { fontSize: 17, fontFamily: fonts.semiBold, color: colors.gray800 },
  saveHeaderBtn:{ fontSize: 15, fontFamily: fonts.semiBold, color: colors.primary },

  avatarSection: { alignItems: 'center', paddingVertical: spacing.lg, gap: 8 },
  avatarLarge:   { width: 96, height: 96, borderRadius: 48, backgroundColor: colors.primary },
  avatarFallback:{ alignItems: 'center', justifyContent: 'center' },
  avatarEditBadge:{
    position: 'absolute', bottom: 0, right: 0,
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: colors.primary,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: colors.white,
  },
  avatarHint: { fontSize: 13, fontFamily: fonts.regular, color: colors.gray400 },

  fieldCard: {
    marginHorizontal: spacing.md, marginBottom: 12,
    backgroundColor: colors.gray100, borderRadius: radius.md,
    padding: 14, gap: 6,
  },
  fieldHeader:{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  fieldLabel: { fontSize: 11, fontFamily: fonts.semiBold, color: colors.gray400, textTransform: 'uppercase', letterSpacing: 0.5 },
  fieldValue: { fontSize: 15, fontFamily: fonts.regular, color: colors.gray800 },
  fieldInput: {
    fontSize: 15, fontFamily: fonts.regular, color: colors.gray800,
    borderBottomWidth: 1, borderBottomColor: colors.primary,
    paddingBottom: 4,
  },

  typeBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    marginHorizontal: spacing.md, marginBottom: spacing.lg,
    backgroundColor: `${colors.primary}12`,
    paddingHorizontal: 12, paddingVertical: 7,
    borderRadius: radius.full, alignSelf: 'flex-start',
  },
  typeBadgeTxt: { fontSize: 12, fontFamily: fonts.medium, color: colors.primary },

  section: {
    paddingHorizontal: spacing.md, paddingTop: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.gray200, gap: 4,
  },
  sectionLabel: {
    fontSize: 11, fontFamily: fonts.semiBold, color: colors.gray400,
    textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 8,
  },

  memberRow:  { flexDirection: 'row', alignItems: 'center', paddingVertical: 9, gap: 12 },
  memberMeta: { flex: 1, gap: 3 },
  memberName: { fontSize: 14, fontFamily: fonts.semiBold, color: colors.gray800 },
  adminTag:   { flexDirection: 'row', alignItems: 'center', gap: 3 },
  adminTagTxt:{ fontSize: 11, fontFamily: fonts.medium, color: colors.primary },
  memberBtns: { flexDirection: 'row', gap: 6 },
  memberBtn:  { padding: 6 },

  dangerBtn:  { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 14 },
  dangerTxt:  { fontSize: 15, fontFamily: fonts.semiBold, color: '#E53E3E' },
})
