import React from 'react'
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { Ionicons } from '@expo/vector-icons'
import { colors, fonts } from '../theme'
import { FollowDuration } from '../services/follow.service'
import { useT } from '../i18n'

const GRAD: [string, string, string] = ['#CA2851', '#FF6766', '#FFB173']

export type { FollowDuration }

interface Props {
  following: boolean
  loading: boolean
  onFollow: (duration: FollowDuration) => void
  theme?: 'dark' | 'light'
  followBack?: boolean  // true when they follow you but you don't follow them yet
}

export default function FollowSplitButton({ following, loading, onFollow, theme = 'light', followBack = false }: Props) {
  const isDark = theme === 'dark'
  const t = useT()

  if (following) {
    return (
      <TouchableOpacity
        style={[s.pill, isDark ? s.pillDarkFollowing : s.pillLightFollowing]}
        onPress={() => onFollow('forever')}
        activeOpacity={0.7}
        disabled={loading}
      >
        {loading
          ? <ActivityIndicator size="small" color={isDark ? 'rgba(255,255,255,0.7)' : colors.gray500} />
          : (
            <View style={s.followingRow}>
              <Ionicons name="checkmark" size={13} color={isDark ? '#fff' : colors.gray800} />
              <Text style={[s.label, isDark ? s.labelDarkFollowing : s.labelLightFollowing]}>{t.following}</Text>
            </View>
          )
        }
      </TouchableOpacity>
    )
  }

  const content = loading
    ? <ActivityIndicator size="small" color={colors.white} />
    : <Text style={s.labelFollow}>{followBack ? t.profile_follow_back : t.follow}</Text>

  if (isDark) {
    return (
      <TouchableOpacity
        style={[s.pill, s.pillDark]}
        onPress={() => onFollow('forever')}
        activeOpacity={0.75}
        disabled={loading}
      >
        {content}
      </TouchableOpacity>
    )
  }

  return (
    <TouchableOpacity onPress={() => onFollow('forever')} activeOpacity={0.85} disabled={loading}>
      <LinearGradient
        colors={GRAD}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={[s.pill, s.pillLight]}
      >
        {content}
      </LinearGradient>
    </TouchableOpacity>
  )
}

const s = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 22,
  },

  pillDark: {
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.9)',
    paddingHorizontal: 16,
    paddingVertical: 7,
  },
  pillDarkFollowing: {
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.55)',
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: 22,
    paddingHorizontal: 14,
    paddingVertical: 7,
  },

  pillLight: {
    paddingHorizontal: 18,
    paddingVertical: 9,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 3,
  },
  pillLightFollowing: {
    backgroundColor: '#F0F0F5',
    borderRadius: 22,
    paddingHorizontal: 15,
    paddingVertical: 9,
  },

  followingRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },

  label: { fontFamily: fonts.semiBold, fontSize: 13 },
  labelFollow:         { fontFamily: fonts.semiBold, fontSize: 13, color: colors.white, letterSpacing: -0.1 },
  labelDarkFollowing:  { color: colors.white },
  labelLightFollowing: { color: colors.gray800 },
})
