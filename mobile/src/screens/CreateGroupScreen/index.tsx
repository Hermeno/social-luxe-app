import React, { useEffect, useState } from 'react'
import {
  View, Text, TextInput, FlatList, TouchableOpacity,
  StyleSheet, ActivityIndicator, Alert,
  KeyboardAvoidingView, Platform,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useNavigation } from '@react-navigation/native'
import { Ionicons } from '@expo/vector-icons'
import { createGroup } from '../../services/group.service'
import { getMyFollowing, FollowUser } from '../../services/follow.service'
import { colors, fonts, spacing, radius } from '../../theme'
import AvatarImage from '../../components/AvatarImage'

export default function CreateGroupScreen() {
  const nav = useNavigation()
  const { top, bottom } = useSafeAreaInsets()
  const [groupName, setGroupName]   = useState('')
  const [people,    setPeople]      = useState<FollowUser[]>([])
  const [selected,  setSelected]    = useState<Set<string>>(new Set())
  const [loading,   setLoading]     = useState(true)
  const [creating,  setCreating]    = useState(false)

  useEffect(() => {
    getMyFollowing()
      .then(setPeople)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  async function handleCreate() {
    if (!groupName.trim())
      return Alert.alert('Nome obrigatório', 'Dá um nome ao grupo.')
    if (selected.size === 0)
      return Alert.alert('Sem membros', 'Adiciona pelo menos um membro.')
    setCreating(true)
    try {
      await createGroup(groupName.trim(), Array.from(selected))
      nav.goBack()
    } catch {
      Alert.alert('Erro', 'Não foi possível criar o grupo.')
    } finally {
      setCreating(false)
    }
  }

  return (
    <KeyboardAvoidingView
      style={[s.container, { paddingTop: top }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 24}
    >
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => nav.goBack()} style={s.backBtn}>
          <Ionicons name="chevron-back" size={26} color={colors.gray800} />
        </TouchableOpacity>
        <Text style={s.title}>Nova Comunidade</Text>
        <View style={{ width: 36 }} />
      </View>

      {/* Group name input */}
      <View style={s.nameWrap}>
        <Ionicons name="people-outline" size={20} color={colors.gray400} />
        <TextInput
          style={s.nameInput}
          placeholder="Nome da comunidade..."
          placeholderTextColor={colors.gray400}
          value={groupName}
          onChangeText={setGroupName}
          autoCapitalize="words"
          returnKeyType="done"
        />
      </View>

      <Text style={s.sectionLabel}>
        Adicionar membros{selected.size > 0 ? ` · ${selected.size} selecionado${selected.size > 1 ? 's' : ''}` : ''}
      </Text>

      {loading ? (
        <View style={s.center}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={people}
          keyExtractor={(p) => p.id}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={s.list}
          keyboardShouldPersistTaps="handled"
          renderItem={({ item }) => {
            const isSelected = selected.has(item.id)
            return (
              <TouchableOpacity
                style={s.personRow}
                onPress={() => toggleSelect(item.id)}
                activeOpacity={0.8}
              >
                <AvatarImage uri={item.avatar} size={44} />
                <View style={s.personInfo}>
                  <Text style={s.personName}>{item.name}</Text>
                  {item.bio ? (
                    <Text style={s.personBio} numberOfLines={1}>{item.bio}</Text>
                  ) : null}
                </View>
                <View style={[s.checkbox, isSelected && s.checkboxSelected]}>
                  {isSelected && <Ionicons name="checkmark" size={14} color={colors.white} />}
                </View>
              </TouchableOpacity>
            )
          }}
          ListEmptyComponent={
            <View style={s.center}>
              <Ionicons name="people-outline" size={40} color={colors.gray200} style={{ marginBottom: 10 }} />
              <Text style={s.emptyTitle}>Ninguém a seguir ainda</Text>
              <Text style={s.emptyText}>Segue pessoas para as adicionares a uma comunidade.</Text>
            </View>
          }
        />
      )}

      <View style={[s.footer, { paddingBottom: bottom + spacing.md }]}>
        <TouchableOpacity
          style={[s.createBtn, (creating || !groupName.trim()) && s.createDisabled]}
          onPress={handleCreate}
          disabled={creating || !groupName.trim()}
          activeOpacity={0.85}
        >
          {creating
            ? <ActivityIndicator color={colors.white} />
            : <Text style={s.createText}>Criar Comunidade</Text>
          }
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  )
}

const s = StyleSheet.create({
  container:       { flex: 1, backgroundColor: colors.white },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
  },
  backBtn: { width: 36 },
  title:   { color: colors.gray800, fontFamily: fonts.bold, fontSize: 20 },

  nameWrap: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    marginHorizontal: spacing.md, marginTop: spacing.sm,
    backgroundColor: colors.gray100, borderRadius: radius.md,
    paddingHorizontal: spacing.md, paddingVertical: 14,
  },
  nameInput: { flex: 1, color: colors.gray800, fontFamily: fonts.regular, fontSize: 16, padding: 0 },

  sectionLabel: {
    color: colors.gray400, fontFamily: fonts.semiBold, fontSize: 12,
    textTransform: 'uppercase', letterSpacing: 0.8,
    paddingHorizontal: spacing.md, marginTop: spacing.lg, marginBottom: spacing.sm,
  },

  center:     { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 48, gap: 4 },
  emptyTitle: { color: colors.gray600, fontFamily: fonts.semiBold, fontSize: 15 },
  emptyText:  { color: colors.gray400, fontFamily: fonts.regular, fontSize: 13, textAlign: 'center', paddingHorizontal: 32 },

  list:      { paddingHorizontal: spacing.md, paddingBottom: 20 },
  personRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 12, gap: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.gray200,
  },
  personInfo: { flex: 1, gap: 2 },
  personName: { color: colors.gray800, fontFamily: fonts.semiBold, fontSize: 15 },
  personBio:  { color: colors.gray400, fontFamily: fonts.regular, fontSize: 12 },

  checkbox:         { width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: colors.gray200, alignItems: 'center', justifyContent: 'center' },
  checkboxSelected: { backgroundColor: colors.primary, borderColor: colors.primary },

  footer:     { paddingHorizontal: spacing.md, paddingTop: spacing.md },
  createBtn:  { backgroundColor: colors.primary, borderRadius: radius.full, paddingVertical: 16, alignItems: 'center' },
  createDisabled: { opacity: 0.4 },
  createText: { color: colors.white, fontFamily: fonts.bold, fontSize: 16 },
})
