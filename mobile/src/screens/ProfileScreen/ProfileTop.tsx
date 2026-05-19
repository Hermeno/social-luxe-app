import React from 'react'
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useNavigation } from '@react-navigation/native'
import { StackNavigationProp } from '@react-navigation/stack'
import { AppStackParams } from '../../navigation/AppNavigator'
import { colors, spacing, radius } from '../../theme'
import AvatarSection from './AvatarSection'

type Nav = StackNavigationProp<AppStackParams>
interface Props {
  avatarUri: string | null; bio?: string; postsCount: number
  availability?: string | null; onPickAvatar: () => void; onEdit: () => void
}

export default function ProfileTop({ avatarUri, bio, postsCount, availability, onPickAvatar, onEdit }: Props) {
  const nav = useNavigation<Nav>()
  return (
    <>
      <View style={s.profileRow}>
        <AvatarSection uri={avatarUri} availability={availability} onPress={onPickAvatar} />
        <View style={s.stats}>
          <View style={s.stat}>
            <Text style={s.statNum}>{postsCount}</Text>
            <Text style={s.statLabel}>Posts</Text>
          </View>
          <View style={s.statDivider} />
          <TouchableOpacity style={s.stat} onPress={() => (nav as any).navigate('Tabs', { screen: 'Friends' })}>
            <Text style={s.statNum}>—</Text>
            <Text style={s.statLabel}>Amigos</Text>
          </TouchableOpacity>
        </View>
      </View>
      {bio ? <Text style={s.bio}>{bio}</Text> : null}
      {availability ? <Text style={s.avail}>● {availability}</Text> : null}
      <View style={s.actions}>
        <TouchableOpacity style={s.editBtn} onPress={onEdit}>
          <Text style={s.editText}>Editar perfil</Text>
        </TouchableOpacity>
        <TouchableOpacity style={s.friendsBtn} onPress={() => (nav as any).navigate('Tabs', { screen: 'Friends' })}>
          <Ionicons name="people-outline" size={18} color={colors.primary} />
          <Text style={s.friendsBtnText}>Amigos</Text>
        </TouchableOpacity>
      </View>
    </>
  )
}

const s = StyleSheet.create({
  profileRow:    { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.md, marginBottom: spacing.md, gap: spacing.xl },
  stats:         { flex: 1, flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center' },
  stat:          { alignItems: 'center', gap: 2 },
  statNum:       { fontSize: 20, fontWeight: '700' as const, color: colors.gray800 },
  statLabel:     { fontSize: 11, color: colors.gray600 },
  statDivider:   { width: 1, height: 32, backgroundColor: colors.gray200 },
  bio:           { fontSize: 14, color: colors.gray600, paddingHorizontal: spacing.md, marginBottom: spacing.xs },
  avail:         { fontSize: 12, color: colors.gray400, paddingHorizontal: spacing.md, marginBottom: spacing.md },
  actions:       { flexDirection: 'row', gap: spacing.sm, paddingHorizontal: spacing.md, marginBottom: spacing.md },
  editBtn:       { flex: 1, borderWidth: 1, borderColor: colors.gray200, borderRadius: radius.md, padding: spacing.sm, alignItems: 'center' },
  editText:      { fontSize: 13, fontWeight: '600' as const, color: colors.gray800 },
  friendsBtn:    { flexDirection: 'row', gap: 6, borderWidth: 1, borderColor: colors.primary, borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, alignItems: 'center' },
  friendsBtnText:{ fontSize: 13, fontWeight: '600' as const, color: colors.primary },
})
