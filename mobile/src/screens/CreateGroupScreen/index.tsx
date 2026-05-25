import React, { useEffect, useState } from 'react'
import {
  View,
  Text,
  TextInput,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useNavigation } from '@react-navigation/native'
import { Ionicons } from '@expo/vector-icons'
import { createGroup } from '../../services/group.service'
import { getFriends } from '../../services/friendship.service'
import { Friendship } from '../../types'
import { colors, fonts, spacing, radius } from '../../theme'
import AvatarImage from '../../components/AvatarImage'

export default function CreateGroupScreen() {
  const nav = useNavigation()
  const { top, bottom } = useSafeAreaInsets()
  const [groupName, setGroupName] = useState('')
  const [friends, setFriends] = useState<Friendship[]>([])
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    getFriends()
      .then(setFriends)
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
    if (!groupName.trim()) return Alert.alert('Nome obrigatório', 'Digite um nome para o grupo.')
    if (selected.size === 0) return Alert.alert('Selecione membros', 'Adicione pelo menos um membro.')
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
    <View style={[s.container, { paddingTop: top }]}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => nav.goBack()} style={s.backBtn}>
          <Ionicons name="chevron-back" size={26} color={colors.white} />
        </TouchableOpacity>
        <Text style={s.title}>Novo Grupo</Text>
        <View style={{ width: 36 }} />
      </View>

      <View style={s.nameWrap}>
        <Ionicons name="people-outline" size={20} color="rgba(255,255,255,0.4)" />
        <TextInput
          style={s.nameInput}
          placeholder="Nome do grupo..."
          placeholderTextColor="rgba(255,255,255,0.3)"
          value={groupName}
          onChangeText={setGroupName}
        />
      </View>

      <Text style={s.sectionLabel}>
        Adicionar membros ({selected.size} selecionados)
      </Text>

      {loading ? (
        <View style={s.center}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={friends}
          keyExtractor={(f) => f.friendshipId}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={s.list}
          renderItem={({ item }) => {
            const isSelected = selected.has(item.friend.id)
            return (
              <TouchableOpacity
                style={s.friendRow}
                onPress={() => toggleSelect(item.friend.id)}
                activeOpacity={0.8}
              >
                <AvatarImage uri={item.friend.avatar} size={44} />
                <Text style={s.friendName}>{item.friend.name}</Text>
                <View style={[s.checkbox, isSelected && s.checkboxSelected]}>
                  {isSelected && <Ionicons name="checkmark" size={14} color={colors.white} />}
                </View>
              </TouchableOpacity>
            )
          }}
          ListEmptyComponent={
            <View style={s.center}>
              <Text style={s.emptyText}>Nenhum amigo para adicionar</Text>
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
          {creating ? (
            <ActivityIndicator color={colors.white} />
          ) : (
            <Text style={s.createText}>Criar Grupo</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  )
}

const s = StyleSheet.create({
  container:       { flex: 1, backgroundColor: colors.white },
  header:          {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
  },
  backBtn:         { width: 36 },
  title:           { color: colors.gray800, fontFamily: fonts.bold, fontSize: 20 },
  nameWrap:        {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    marginHorizontal: spacing.md, marginTop: spacing.sm,
    backgroundColor: colors.gray100, borderRadius: radius.md,
    paddingHorizontal: spacing.md, paddingVertical: 14,
  },
  nameInput:       { flex: 1, color: colors.gray800, fontFamily: fonts.regular, fontSize: 16, padding: 0 },
  sectionLabel:    {
    color: colors.gray400, fontFamily: fonts.medium, fontSize: 12,
    textTransform: 'uppercase', letterSpacing: 0.8,
    paddingHorizontal: spacing.md, marginTop: spacing.lg, marginBottom: spacing.sm,
  },
  center:          { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 40 },
  emptyText:       { color: colors.gray400, fontFamily: fonts.regular, fontSize: 14 },
  list:            { paddingHorizontal: spacing.md, paddingBottom: 20 },
  friendRow:       {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 12, gap: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.gray200,
  },
  friendName:      { flex: 1, color: colors.gray800, fontFamily: fonts.medium, fontSize: 15 },
  checkbox:        {
    width: 24, height: 24, borderRadius: 12,
    borderWidth: 2, borderColor: colors.gray200,
    alignItems: 'center', justifyContent: 'center',
  },
  checkboxSelected:{ backgroundColor: colors.primary, borderColor: colors.primary },
  footer:          { paddingHorizontal: spacing.md, paddingTop: spacing.md },
  createBtn:       {
    backgroundColor: colors.primary, borderRadius: radius.full,
    paddingVertical: 16, alignItems: 'center',
  },
  createDisabled:  { opacity: 0.4 },
  createText:      { color: colors.white, fontFamily: fonts.bold, fontSize: 16 },
})
