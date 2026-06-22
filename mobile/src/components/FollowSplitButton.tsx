import React, { useState, useRef } from 'react'
import {
  View, Text, TouchableOpacity, StyleSheet, Modal,
  TouchableWithoutFeedback, ActivityIndicator,
} from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { Ionicons } from '@expo/vector-icons'
import { colors, fonts } from '../theme'
import { FollowDuration } from '../services/follow.service'

const GRAD: [string, string, string] = ['#CA2851', '#FF6766', '#FFB173']

export type { FollowDuration }

interface Props {
  following: boolean
  loading: boolean
  onFollow: (duration: FollowDuration) => void
  theme?: 'dark' | 'light'
  followBack?: boolean  // true when they follow you but you don't follow them yet
}

const DURATION_OPTS: { key: FollowDuration; label: string }[] = [
  { key: '1d',      label: 'Seguir por 1 dia' },
  { key: '1m',      label: 'Seguir por 1 mês' },
  { key: '1y',      label: 'Seguir por 1 ano' },
  { key: 'forever', label: 'Seguir para sempre' },
]

const MENU_ITEM_H = 46

export default function FollowSplitButton({ following, loading, onFollow, theme = 'light', followBack = false }: Props) {
  const [showMenu, setShowMenu] = useState(false)
  const [pos, setPos]           = useState({ x: 0, y: 0, w: 0 })
  const ref                     = useRef<View>(null)
  const isDark                  = theme === 'dark'

  function openMenu() {
    ref.current?.measure((_x, _y, width, _h, pageX, pageY) => {
      setPos({ x: pageX, y: pageY, w: width })
      setShowMenu(true)
    })
  }

  const menuTop = pos.y > 250
    ? pos.y - DURATION_OPTS.length * MENU_ITEM_H - 8
    : pos.y + 36

  if (following) {
    return (
      <TouchableOpacity
        style={[s.pill, isDark ? s.pillDarkFollowing : s.pillLightFollowing]}
        onPress={() => onFollow('forever')}
        activeOpacity={0.7}
        disabled={loading}
      >
        {loading
          ? <ActivityIndicator size="small" color={isDark ? 'rgba(255,255,255,0.6)' : colors.gray400} />
          : <Text style={[s.label, isDark ? s.labelDarkFollowing : s.labelLightFollowing]}>Seguindo</Text>
        }
      </TouchableOpacity>
    )
  }

  // Shared inner content for both dark and gradient-light variants
  const innerContent = (
    <>
      <TouchableOpacity
        style={[s.side, isDark ? s.sideSmall : s.sideLarge]}
        onPress={() => onFollow('forever')}
        activeOpacity={0.7}
        disabled={loading}
      >
        {loading
          ? <ActivityIndicator size="small" color={colors.white} />
          : <Text style={[s.label, s.labelFollow]}>{followBack ? 'Seguir de volta' : 'Seguir'}</Text>
        }
      </TouchableOpacity>

      <View style={[s.sep, s.sepLight]} />

      <TouchableOpacity
        style={[s.arrow, isDark ? s.arrowSmall : s.arrowLarge]}
        onPress={openMenu}
        activeOpacity={0.7}
        disabled={loading}
      >
        <Ionicons name="chevron-down" size={12} color="rgba(255,255,255,0.85)" />
      </TouchableOpacity>
    </>
  )

  return (
    <>
      <View ref={ref} style={isDark ? [s.pill, s.pillDark] : s.pillGradWrap}>
        {isDark ? innerContent : (
          <LinearGradient
            colors={GRAD}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={[s.pill, s.pillLight]}
          >
            {innerContent}
          </LinearGradient>
        )}
      </View>

      <Modal
        transparent
        visible={showMenu}
        animationType="fade"
        onRequestClose={() => setShowMenu(false)}
      >
        <TouchableWithoutFeedback onPress={() => setShowMenu(false)}>
          <View style={StyleSheet.absoluteFill}>
            <View style={[s.menu, { left: pos.x, top: menuTop, minWidth: Math.max(pos.w, 190) }]}>
              {DURATION_OPTS.map((opt, i) => (
                <TouchableOpacity
                  key={opt.key}
                  style={[s.menuItem, i < DURATION_OPTS.length - 1 && s.menuItemBorder]}
                  onPress={() => { setShowMenu(false); onFollow(opt.key) }}
                  activeOpacity={0.7}
                >
                  <Text style={s.menuLabel}>{opt.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    </>
  )
}

const s = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    overflow: 'hidden',
  },

  pillDark: {
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.85)',
    borderRadius: 6,
  },
  pillDarkFollowing: {
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.85)',
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },

  pillGradWrap: {
    borderRadius: 20,
    overflow: 'hidden',
    alignSelf: 'flex-start',
  },
  pillLight: {
    borderRadius: 20,
  },
  pillLightFollowing: {
    backgroundColor: colors.white,
    borderWidth: 1.5,
    borderColor: colors.gray200,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 7,
  },

  side: { alignItems: 'center', justifyContent: 'center' },
  sideSmall: { paddingHorizontal: 10, paddingVertical: 3 },
  sideLarge: { paddingHorizontal: 14, paddingVertical: 6 },

  arrow: { alignItems: 'center', justifyContent: 'center' },
  arrowSmall: { paddingHorizontal: 7, paddingVertical: 3 },
  arrowLarge: { paddingHorizontal: 6, paddingVertical: 6 },

  sep: { width: 1, alignSelf: 'stretch' },
  sepDark:  { backgroundColor: 'rgba(255,255,255,0.4)' },
  sepLight: { backgroundColor: 'rgba(255,255,255,0.45)' },

  label: { fontFamily: fonts.medium, fontSize: 11 },
  labelFollow:        { color: colors.white },
  labelDarkFollowing: { color: colors.white },
  labelLightFollowing:{ color: colors.gray600, fontSize: 13 },

  menu: {
    position: 'absolute',
    backgroundColor: colors.white,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
    overflow: 'hidden',
  },
  menuItem: {
    paddingHorizontal: 18,
    paddingVertical: 13,
  },
  menuItemBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.gray200,
  },
  menuLabel: {
    fontSize: 14,
    fontFamily: fonts.medium,
    color: colors.gray800,
  },
})
