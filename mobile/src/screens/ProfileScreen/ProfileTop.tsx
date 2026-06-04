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
    <View style={s.wrap}>
      {/* Avatar */}
      <AvatarSection uri={avatarUri} availability={availability} onPress={onPickAvatar} />

      {/* Stats */}
      <View style={s.statsRow}>
        <View style={s.stat}>
          <Text style={s.statNum}>{postsCount}</Text>
          <Text style={s.statLabel}>Posts</Text>
        </View>
        <View style={s.divider} />
        <TouchableOpacity style={s.stat} onPress={onShowFollowers} activeOpacity={0.7}>
          <Text style={s.statNum}>{followerCount}</Text>
          <Text style={s.statLabel}>Seguidores</Text>
        </TouchableOpacity>
        <View style={s.divider} />
        <TouchableOpacity style={s.stat} onPress={onShowFollowing} activeOpacity={0.7}>
          <Text style={s.statNum}>{followingCount}</Text>
          <Text style={s.statLabel}>Seguindo</Text>
        </TouchableOpacity>
      </View>

      {/* Bio & availability */}
      {bio ? <Text style={s.bio}>{bio}</Text> : null}
      {availability ? (
        <Text style={s.avail}>● {availability}</Text>
      ) : null}

      {/* Edit button */}
      <TouchableOpacity style={s.editBtn} onPress={onEdit} activeOpacity={0.8}>
        <Text style={s.editText}>Editar perfil</Text>
      </TouchableOpacity>
    </View>
  )
}

const s = StyleSheet.create({
  wrap:      { paddingHorizontal: spacing.md, paddingTop: spacing.md, paddingBottom: spacing.sm, gap: spacing.md },
  statsRow:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around' },
  stat:      { alignItems: 'center', gap: 2, flex: 1 },
  statNum:   { fontSize: 22, fontFamily: fonts.bold, color: colors.gray800, letterSpacing: -0.5 },
  statLabel: { fontSize: 12, fontFamily: fonts.regular, color: colors.gray400 },
  divider:   { width: 1, height: 32, backgroundColor: colors.gray200 },
  bio:       { fontSize: 14, fontFamily: fonts.regular, color: colors.gray600, lineHeight: 20 },
  avail:     { fontSize: 12, fontFamily: fonts.regular, color: colors.secondary },
  editBtn:   {
    borderWidth: 1.5, borderColor: colors.gray200,
    borderRadius: radius.md, paddingVertical: 10,
    alignItems: 'center',
  },
  editText:  { fontSize: 14, fontFamily: fonts.semiBold, color: colors.gray800 },
})
