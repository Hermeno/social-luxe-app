import React, { useEffect, useState, useCallback } from 'react'
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  Alert, ActivityIndicator, TextInput, Modal,
} from 'react-native'
import { Image } from 'expo-image'
import { Ionicons } from '@expo/vector-icons'
import { LinearGradient } from 'expo-linear-gradient'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native'
import { StackNavigationProp } from '@react-navigation/stack'
import { colors, fonts } from '../../theme'
import * as unionService from '../../services/union.service'
import { useUnionStore } from '../../store/union.store'
import { useAuthStore } from '../../store/auth.store'
import { AppStackParams } from '../../navigation/AppNavigator'
import { Union } from '../../types'

type Nav   = StackNavigationProp<AppStackParams>
type Route = RouteProp<AppStackParams, 'UnionProfile'>


function MemberChip({ name, avatar }: { name: string; avatar: string | null }) {
  return (
    <View style={s.chip}>
      {avatar
        ? <Image source={{ uri: avatar }} style={s.chipAvatar} contentFit="cover" />
        : <View style={[s.chipAvatar, s.chipAvatarFallback]}><Ionicons name="person" size={14} color={colors.gray400} /></View>
      }
      <Text style={s.chipName} numberOfLines={1}>{name}</Text>
    </View>
  )
}

export default function UnionProfileScreen() {
  const nav    = useNavigation<Nav>()
  const route  = useRoute<Route>()
  const insets = useSafeAreaInsets()
  const me     = useAuthStore((s) => s.user)
  const { updateUnion, removeUnion } = useUnionStore()

  const [union,      setUnion]      = useState<Union | null>(null)
  const [loading,    setLoading]    = useState(true)
  const [editModal,  setEditModal]  = useState(false)
  const [editName,   setEditName]   = useState('')
  const [editBio,    setEditBio]    = useState('')
  const [saving,     setSaving]     = useState(false)

  const isMember = union
    ? union.memberA.id === me?.id || union.memberB.id === me?.id
    : false

  useEffect(() => {
    unionService.getUnion(route.params.unionId)
      .then((u) => { setUnion(u); setEditName(u.name); setEditBio(u.bio ?? '') })
      .catch(() => Alert.alert('Erro', 'Não foi possível carregar a união'))
      .finally(() => setLoading(false))
  }, [route.params.unionId])

  async function handleSave() {
    if (!union) return
    setSaving(true)
    try {
      const updated = await unionService.updateUnion(union.id, { name: editName.trim(), bio: editBio.trim() })
      setUnion(updated)
      updateUnion(updated)
      setEditModal(false)
    } catch (e: any) {
      Alert.alert('Erro', e?.response?.data?.message ?? 'Não foi possível guardar')
    } finally { setSaving(false) }
  }

  async function handleDissolve() {
    if (!union) return
    Alert.alert(
      'Dissolver União',
      'Tens a certeza? Todas as conversas desta união serão apagadas permanentemente.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Dissolver', style: 'destructive',
          onPress: async () => {
            try {
              await unionService.dissolveUnion(union.id)
              removeUnion(union.id)
              nav.goBack()
            } catch (e: any) {
              Alert.alert('Erro', e?.response?.data?.message ?? 'Não foi possível dissolver')
            }
          },
        },
      ],
    )
  }

  if (loading) {
    return (
      <View style={[s.root, { alignItems: 'center', justifyContent: 'center' }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    )
  }

  if (!union) {
    return (
      <View style={[s.root, { alignItems: 'center', justifyContent: 'center' }]}>
        <Text style={{ fontFamily: fonts.medium, color: colors.gray500 }}>União não encontrada</Text>
      </View>
    )
  }

  return (
    <View style={s.root}>
      {/* Header */}
      <View style={[s.header, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity style={s.backBtn} onPress={() => nav.goBack()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Ionicons name="chevron-back" size={22} color={colors.black} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>União</Text>
        {isMember
          ? <TouchableOpacity style={s.editBtn} onPress={() => setEditModal(true)}>
              <Ionicons name="pencil-outline" size={18} color={colors.black} />
            </TouchableOpacity>
          : <View style={{ width: 36 }} />
        }
      </View>

      <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>

        {/* Cover / Avatar */}
        <View style={s.coverWrap}>
          <LinearGradient colors={['#CA2851', '#FF6766', '#FFB173']} style={s.cover} />
          <View style={s.unionAvatarWrap}>
            {union.avatar
              ? <Image source={{ uri: union.avatar }} style={s.unionAvatar} contentFit="cover" />
              : <LinearGradient colors={['#CA2851', '#FF6766']} style={s.unionAvatar}>
                  <Text style={s.unionAvatarEmoji}>💑</Text>
                </LinearGradient>
            }
          </View>
        </View>

        {/* Info */}
        <View style={s.infoSection}>
          <Text style={s.unionName}>{union.name}</Text>
          {union.label ? (
            <View style={s.typePill}>
              <Text style={s.typePillTxt}>💑 {union.label}</Text>
            </View>
          ) : null}
          {union.bio ? <Text style={s.unionBio}>{union.bio}</Text> : null}
        </View>

        {/* Members */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>Membros</Text>
          <View style={s.membersRow}>
            <MemberChip name={union.memberA.name} avatar={union.memberA.avatar} />
            <View style={s.membersDivider}><Text style={s.membersDividerTxt}>&</Text></View>
            <MemberChip name={union.memberB.name} avatar={union.memberB.avatar} />
          </View>
        </View>

        {/* Actions */}
        <View style={s.section}>
          <TouchableOpacity
            style={s.actionBtn}
            onPress={() => nav.navigate('UnionChat', { unionId: union.id, unionName: union.name })}
            activeOpacity={0.85}
          >
            <Ionicons name="chatbubble-ellipses-outline" size={20} color={colors.black} />
            <Text style={s.actionBtnTxt}>Ver conversas</Text>
            <Ionicons name="chevron-forward" size={16} color={colors.gray400} style={{ marginLeft: 'auto' }} />
          </TouchableOpacity>

          {isMember && (
            <TouchableOpacity style={[s.actionBtn, s.actionBtnDanger]} onPress={handleDissolve} activeOpacity={0.85}>
              <Ionicons name="trash-outline" size={20} color="#E53935" />
              <Text style={[s.actionBtnTxt, { color: '#E53935' }]}>Dissolver União</Text>
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>

      {/* Edit Modal */}
      <Modal visible={editModal} animationType="slide" presentationStyle="pageSheet">
        <View style={[s.modalRoot, { paddingTop: 20 }]}>
          <View style={s.modalHeader}>
            <TouchableOpacity onPress={() => setEditModal(false)}>
              <Text style={s.modalCancel}>Cancelar</Text>
            </TouchableOpacity>
            <Text style={s.modalTitle}>Editar União</Text>
            <TouchableOpacity onPress={handleSave} disabled={saving}>
              {saving ? <ActivityIndicator size="small" color={colors.primary} /> : <Text style={s.modalSave}>Guardar</Text>}
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={{ padding: 20, gap: 16 }}>
            <View>
              <Text style={s.fieldLabel}>Nome</Text>
              <TextInput style={s.fieldInput} value={editName} onChangeText={setEditName} maxLength={40} />
            </View>
            <View>
              <Text style={s.fieldLabel}>Bio</Text>
              <TextInput style={[s.fieldInput, { minHeight: 80 }]} value={editBio} onChangeText={setEditBio} maxLength={160} multiline />
            </View>
          </ScrollView>
        </View>
      </Modal>
    </View>
  )
}

const s = StyleSheet.create({
  root:    { flex: 1, backgroundColor: colors.white },

  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingBottom: 12,
    backgroundColor: colors.white,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.gray200,
  },
  backBtn:     { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  editBtn:     { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { flex: 1, textAlign: 'center', fontFamily: fonts.semiBold, fontSize: 16, color: colors.black },

  content: { paddingBottom: 40 },

  // Cover
  coverWrap:       { height: 140, position: 'relative', marginBottom: 50 },
  cover:           { ...StyleSheet.absoluteFillObject },
  unionAvatarWrap: { position: 'absolute', bottom: -44, alignSelf: 'center' },
  unionAvatar:     { width: 88, height: 88, borderRadius: 44, borderWidth: 4, borderColor: colors.white, alignItems: 'center', justifyContent: 'center' },
  unionAvatarEmoji:{ fontSize: 40 },

  // Info
  infoSection: { alignItems: 'center', paddingHorizontal: 24, paddingTop: 8, paddingBottom: 16 },
  unionName:   { fontFamily: fonts.bold, fontSize: 24, color: colors.black, letterSpacing: -0.5, textAlign: 'center' },
  typePill:    { backgroundColor: colors.gray100, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 5, marginTop: 8 },
  typePillTxt: { fontFamily: fonts.medium, fontSize: 13, color: colors.gray800 },
  unionBio:    { fontFamily: fonts.regular, fontSize: 14, color: colors.gray600, textAlign: 'center', marginTop: 10, lineHeight: 20 },

  // Members
  section:      { paddingHorizontal: 20, marginTop: 24 },
  sectionTitle: { fontFamily: fonts.semiBold, fontSize: 13, color: colors.gray500, letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 12 },
  membersRow:   { flexDirection: 'row', alignItems: 'center', gap: 12 },
  membersDivider:   { flex: 0, paddingHorizontal: 4 },
  membersDividerTxt:{ fontFamily: fonts.bold, fontSize: 18, color: colors.gray300 },

  chip: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.gray100, borderRadius: 12, padding: 10 },
  chipAvatar:        { width: 32, height: 32, borderRadius: 16 },
  chipAvatarFallback:{ backgroundColor: colors.gray200, alignItems: 'center', justifyContent: 'center' },
  chipName:          { flex: 1, fontFamily: fonts.semiBold, fontSize: 13, color: colors.black },

  // Actions
  actionBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    paddingVertical: 16, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.gray100,
  },
  actionBtnTxt:    { fontFamily: fonts.medium, fontSize: 15, color: colors.black },
  actionBtnDanger: { marginTop: 8 },

  // Modal
  modalRoot:   { flex: 1, backgroundColor: colors.white },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingBottom: 16, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.gray100 },
  modalTitle:  { fontFamily: fonts.semiBold, fontSize: 16, color: colors.black },
  modalCancel: { fontFamily: fonts.medium, fontSize: 15, color: colors.gray500 },
  modalSave:   { fontFamily: fonts.semiBold, fontSize: 15, color: colors.primary },
  fieldLabel:  { fontFamily: fonts.medium, fontSize: 13, color: colors.gray500, marginBottom: 6 },
  fieldInput:  { fontFamily: fonts.regular, fontSize: 15, color: colors.black, borderWidth: 1, borderColor: colors.gray200, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10 },
})
