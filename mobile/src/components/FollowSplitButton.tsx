import React from 'react'
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { colors, fonts } from '../theme'
import { FollowDuration } from '../services/follow.service'
import { useT } from '../i18n'

export type { FollowDuration }

interface Props {
  following: boolean
  loading: boolean
  onFollow: (duration: FollowDuration) => void
  theme?: 'dark' | 'light'
  followBack?: boolean  // true when they follow you but you don't follow them yet
  variant?: 'default' | 'list'
}

export default function FollowSplitButton({
  following,
  loading,
  onFollow,
  theme = 'light',
  followBack = false,
  variant = 'default',
}: Props) {
  const isDark = theme === 'dark'
  const isList = variant === 'list'
  const t = useT()
  const followLabel = followBack ? t.profile_follow_back : t.follow

  if (following) {
    return (
      <TouchableOpacity
        style={[s.pill, isDark ? s.pillDarkFollowing : s.pillLightFollowing, isList && s.pillListFollowing]}
        onPress={() => onFollow('forever')}
        activeOpacity={0.7}
        disabled={loading}
        hitSlop={isList ? 4 : undefined}
        accessibilityRole="button"
        accessibilityLabel={t.following}
        accessibilityState={{ busy: loading, disabled: loading, selected: true }}
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
    : <Text style={s.labelFollow}>{followLabel}</Text>

  if (isDark) {
    // No feed o Seguir é sempre transparente — só o contorno, sobre o vídeo.
    return (
      <TouchableOpacity
        style={[s.pill, s.pillDarkFollow]}
        onPress={() => onFollow('forever')}
        activeOpacity={0.75}
        disabled={loading}
        accessibilityRole="button"
        accessibilityLabel={followLabel}
        accessibilityState={{ busy: loading, disabled: loading, selected: false }}
      >
        {content}
      </TouchableOpacity>
    )
  }

  return (
    <TouchableOpacity
      onPress={() => onFollow('forever')}
      activeOpacity={0.85}
      disabled={loading}
      hitSlop={isList ? 4 : undefined}
      accessibilityRole="button"
      accessibilityLabel={followLabel}
      accessibilityState={{ busy: loading, disabled: loading, selected: false }}
    >
      <View style={[s.pill, s.pillLight, isList && s.pillListFollow]}>
        {content}
      </View>
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

  // Seguir (feed): sempre transparente, só o contorno branco
  pillDarkFollow: {
    borderWidth: 1.4,
    borderColor: 'rgba(255,255,255,0.9)',
    backgroundColor: 'transparent',
    paddingHorizontal: 16,
    paddingVertical: 7,
  },
  // A seguir: também transparente, contorno mais discreto
  pillDarkFollowing: {
    borderWidth: 1.4,
    borderColor: 'rgba(255,255,255,0.55)',
    backgroundColor: 'transparent',
    borderRadius: 22,
    paddingHorizontal: 14,
    paddingVertical: 7,
  },

  pillLight: {
    backgroundColor: '#FF7A1C',   // laranja dos designs
    paddingHorizontal: 18,
    paddingVertical: 9,
    shadowColor: '#FF7A1C',
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
  pillListFollow: {
    width: 120,
    height: 36,
    paddingHorizontal: 10,
    paddingVertical: 0,
    borderRadius: 12,
    shadowOpacity: 0,
    elevation: 0,
  },
  pillListFollowing: {
    width: 120,
    height: 36,
    paddingHorizontal: 10,
    paddingVertical: 0,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#D8D8D3',
    backgroundColor: '#FFFFFF',
  },

  followingRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },

  label: { fontFamily: fonts.semiBold, fontSize: 13 },
  labelFollow:         { fontFamily: fonts.semiBold, fontSize: 13, color: colors.white, letterSpacing: -0.1 },
  labelDarkFollowing:  { color: colors.white },
  labelLightFollowing: { color: colors.gray800 },
})
