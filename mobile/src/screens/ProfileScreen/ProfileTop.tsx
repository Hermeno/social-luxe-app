import React from 'react'
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import { colors, spacing, radius, fonts } from '../../theme'
import AvatarSection from './AvatarSection'

interface Props {
  avatarUri: string | null
  bio?: string
  postsCount: number
  followerCount: number
  followingCount: number
  availability?: string | null
  onPickAvatar: () => void
  onEdit: () => void
  onShowFollowers: () => void
  onShowFollowing: () => void
}

export default function ProfileTop({
  avatarUri, bio, postsCount, followerCount, followingCount,
  availability, onPickAvatar, onEdit, onShowFollowers, onShowFollowing,
}: Props) {
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
          <TouchableOpacity style={s.stat} onPress={onShowFollowers}>
            <Text style={s.statNum}>{followerCount}</Text>
            <Text style={s.statLabel}>Seguidores</Text>
          </TouchableOpacity>
          <View style={s.statDivider} />
          <TouchableOpacity style={s.stat} onPress={onShowFollowing}>
            <Text style={s.statNum}>{followingCount}</Text>
            <Text style={s.statLabel}>Seguindo</Text>
          </TouchableOpacity>
        </View>
      </View>
      {bio ? <Text style={s.bio}>{bio}</Text> : null}
      {availability ? <Text style={s.avail}>● {availability}</Text> : null}
      <View style={s.actions}>
        <TouchableOpacity style={s.editBtn} onPress={onEdit}>
          <Text style={s.editText}>Editar perfil</Text>
        </TouchableOpacity>
      </View>
    </>
  )
}

const s = StyleSheet.create({
  profileRow:  { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.md, marginBottom: spacing.md, gap: spacing.xl },
  stats:       { flex: 1, flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center' },
  stat:        { alignItems: 'center', gap: 2 },
  statNum:     { fontSize: 20, fontWeight: '700' as const, color: colors.gray800 },
  statLabel:   { fontSize: 11, color: colors.gray600 },
  statDivider: { width: 1, height: 32, backgroundColor: colors.gray200 },
  bio:         { fontSize: 14, color: colors.gray600, paddingHorizontal: spacing.md, marginBottom: spacing.xs },
  avail:       { fontSize: 12, color: colors.gray400, paddingHorizontal: spacing.md, marginBottom: spacing.md },
  actions:     { paddingHorizontal: spacing.md, marginBottom: spacing.md },
  editBtn:     { borderWidth: 1, borderColor: colors.gray200, borderRadius: radius.md, padding: spacing.sm, alignItems: 'center' },
  editText:    { fontSize: 13, fontWeight: '600' as const, color: colors.gray800 },
})
