import React, { useEffect, useRef, useState } from 'react'
import {
  View, Text, StyleSheet, Animated, Pressable, TouchableOpacity,
  FlatList, useWindowDimensions, ActivityIndicator,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { useNavigation } from '@react-navigation/native'
import type { StackNavigationProp } from '@react-navigation/stack'
import { colors, fonts } from '../theme'
import AvatarImage from './AvatarImage'
import AvatarStack from './AvatarStack'
import FollowSplitButton from './FollowSplitButton'
import { useFollowStore } from '../store/follow.store'
import { useOverlayStore } from '../store/overlay.store'
import { api } from '../services/api'
import type { AppStackParams } from '../navigation/AppNavigator'
import { useT } from '../i18n'
import useReducedMotionPreference from '../hooks/useReducedMotionPreference'
import { displayHandle } from '../utils/handle'

const HIT = { top: 10, bottom: 10, left: 10, right: 10 }

type SuggestUser = {
  id: string
  name: string
  username?: string | null
  avatar: string | null
  bio?: string | null
  followsYou?: boolean
}

type Nav = StackNavigationProp<AppStackParams>

/** A folha vive dentro das tabs; navegar exige subir ao stack que as contém. */
function stackOf(navigation: Nav): Nav | undefined {
  const stack = navigation.getState().type === 'stack'
    ? navigation
    : navigation.getParent<Nav>()
  return stack?.getState().type === 'stack' ? stack : undefined
}

function openProfileOnStack(navigation: Nav, userId: string) {
  stackOf(navigation)?.push('Profile', { userId })
}

function openFollowersOnStack(navigation: Nav) {
  stackOf(navigation)?.push('Followers', { mode: 'followers' })
}

// ── Uma conta na folha ────────────────────────────────────────────────────────
function Row({ user, onOpen }: { user: SuggestUser; onOpen: () => void }) {
  const t        = useT()
  const followed = useFollowStore((s) => s.followingIds.has(user.id))
  const [loading, setLoading]     = useState(false)
  const [dismissed, setDismissed] = useState(false)
  if (dismissed) return null

  async function handleFollow() {
    if (loading) return
    setLoading(true)
    try { await useFollowStore.getState().toggle(user.id, undefined, { name: user.name, avatar: user.avatar }) } catch {}
    setLoading(false)
  }

  const context = user.followsYou ? t.profile_follow_back : (user.bio || t.msg_suggestion_one)

  return (
    <View style={s.row}>
      <TouchableOpacity
        style={s.profile}
        onPress={onOpen}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityLabel={user.name}
      >
        <AvatarImage uri={user.avatar} name={user.name} size={48} />
        <View style={s.info}>
          <Text style={s.name} numberOfLines={1}>{user.username ? displayHandle(user.username) : user.name}</Text>
          <Text style={s.context} numberOfLines={1}>{context}</Text>
        </View>
      </TouchableOpacity>
      <FollowSplitButton
        following={followed}
        loading={loading}
        onFollow={handleFollow}
        theme="light"
        followBack={!!user.followsYou}
      />
      <TouchableOpacity
        style={s.x}
        onPress={() => setDismissed(true)}
        hitSlop={HIT}
        accessibilityRole="button"
        accessibilityLabel={t.circle_remove}
      >
        <Ionicons name="close" size={18} color={colors.gray400} />
      </TouchableOpacity>
    </View>
  )
}

// ── Folha ─────────────────────────────────────────────────────────────────────
export default function SuggestionsSheet({ onClose }: { onClose: () => void }) {
  const t = useT()
  const nav = useNavigation<Nav>()
  const reduceMotion = useReducedMotionPreference()
  const { bottom: safeBottom, top: safeTop } = useSafeAreaInsets()
  const { height: winH } = useWindowDimensions()

  const slide = useRef(new Animated.Value(1)).current   // 1 = fora, 0 = no sítio
  const fade  = useRef(new Animated.Value(0)).current
  const [users, setUsers]     = useState<SuggestUser[]>([])
  const [followers, setFollowers] = useState<SuggestUser[]>([])
  const [loading, setLoading] = useState(true)

  // Esconde a TabBar enquanto a folha vive.
  useEffect(() => { const { push, pop } = useOverlayStore.getState(); push(); return pop }, [])

  useEffect(() => {
    slide.stopAnimation()
    fade.stopAnimation()
    if (reduceMotion) {
      slide.setValue(0)
      fade.setValue(1)
      return
    }
    Animated.parallel([
      Animated.spring(slide, { toValue: 0, useNativeDriver: true, damping: 22, stiffness: 220 }),
      Animated.timing(fade,  { toValue: 1, duration: 180, useNativeDriver: true }),
    ]).start()
  }, [fade, reduceMotion, slide])

  useEffect(() => {
    // Quem te segue e ainda não segues → "Seguir de volta"; depois, sugeridos.
    Promise.allSettled([api.get('/users/suggested'), api.get('/users/followers')])
      .then(([sug, fol]) => {
        const pick = (r: PromiseSettledResult<any>): any[] =>
          r.status === 'fulfilled' ? (r.value.data?.data ?? r.value.data ?? []) : []
        const suggested = pick(sug) as SuggestUser[]
        const followers = pick(fol) as SuggestUser[]
        const followingIds = useFollowStore.getState().followingIds

        setFollowers(followers)

        const back = followers
          .filter((u) => !followingIds.has(u.id))
          .map((u) => ({ ...u, followsYou: true }))
        const backIds = new Set(back.map((u) => u.id))
        const rest = suggested.filter((u) => !backIds.has(u.id))

        setUsers([...back, ...rest])
        setLoading(false)
      })
  }, [])

  function close(afterClose?: () => void) {
    const finish = () => {
      onClose()
      afterClose?.()
    }
    if (reduceMotion) {
      finish()
      return
    }
    Animated.parallel([
      Animated.timing(slide, { toValue: 1, duration: 200, useNativeDriver: true }),
      Animated.timing(fade,  { toValue: 0, duration: 160, useNativeDriver: true }),
    ]).start(finish)
  }

  const sheetH = Math.min(winH * 0.82, winH - safeTop - 40)

  return (
    <View style={s.overlay}>
      <Animated.View style={[s.backdrop, { opacity: fade }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={() => close()} />
      </Animated.View>

      <Animated.View
        style={[
          s.sheet,
          {
            height: sheetH,
            paddingBottom: Math.max(safeBottom, 12),
            transform: [{ translateY: slide.interpolate({ inputRange: [0, 1], outputRange: [0, winH] }) }],
          },
        ]}
      >
        <View style={s.grabberWrap}><View style={s.grabber} /></View>

        <View style={s.header}>
          <View style={{ flex: 1 }}>
            <Text style={s.hTitle}>{t.msg_suggestions_title}</Text>
          </View>
          <TouchableOpacity
            onPress={() => close()}
            hitSlop={HIT}
            style={s.close}
            accessibilityRole="button"
            accessibilityLabel={t.circle_close}
          >
            <Ionicons name="close" size={20} color={colors.gray600} />
          </TouchableOpacity>
        </View>

        {/* Topo da folha: quem já te segue à esquerda, «ver mais» à direita. */}
        {followers.length > 0 && (
          <View style={s.networkBar}>
            <AvatarStack users={followers} max={5} size={32} />
            <View style={s.networkSpacer} />
            <TouchableOpacity
              style={s.seeMore}
              onPress={() => close(() => openFollowersOnStack(nav))}
              activeOpacity={0.72}
              hitSlop={HIT}
              accessibilityRole="button"
              accessibilityLabel={`${t.see_more}. ${t.profile_followers}`}
            >
              <Text style={s.seeMoreText}>{t.see_more}</Text>
              <Ionicons name="chevron-forward" size={14} color={colors.gray800} />
            </TouchableOpacity>
          </View>
        )}

        {loading ? (
          <ActivityIndicator color={colors.primary} style={{ marginTop: 48 }} />
        ) : (
          <FlatList
            data={users}
            keyExtractor={(u) => u.id}
            renderItem={({ item }) => (
              <Row
                user={item}
                onOpen={() => close(() => openProfileOnStack(nav, item.id))}
              />
            )}
            contentContainerStyle={s.list}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={<Text style={s.empty}>{t.search_no_suggestions}</Text>}
          />
        )}
      </Animated.View>
    </View>
  )
}

const s = StyleSheet.create({
  overlay:  { ...StyleSheet.absoluteFillObject, zIndex: 100, justifyContent: 'flex-end' },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.32)' },

  sheet: {
    backgroundColor: colors.white,
    borderTopLeftRadius: 22, borderTopRightRadius: 22,
    overflow: 'hidden',
  },
  grabberWrap: { alignItems: 'center', paddingTop: 8, paddingBottom: 4 },
  grabber:     { width: 40, height: 5, borderRadius: 3, backgroundColor: '#E2E2E7' },

  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 20, paddingTop: 6, paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.gray200,
  },
  hTitle: { fontSize: 18, fontFamily: fonts.bold, color: colors.gray800, letterSpacing: -0.3 },
  close:  { width: 32, height: 32, borderRadius: 16, backgroundColor: '#F2F2F5', alignItems: 'center', justifyContent: 'center' },

  // Pilha de seguidores + atalho para a página, no topo da folha.
  networkBar: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 20, paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.gray200,
  },
  networkSpacer: { flex: 1 },
  seeMore: {
    flexDirection: 'row', alignItems: 'center', gap: 2,
    paddingVertical: 7, paddingLeft: 12, paddingRight: 8,
    borderRadius: 999, backgroundColor: '#F2F2F5',
  },
  seeMoreText: {
    fontSize: 13, fontFamily: fonts.semiBold, color: colors.gray800, letterSpacing: -0.2,
  },

  list: { paddingHorizontal: 20, paddingTop: 4 },
  row:  { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 11 },
  profile: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 12 },
  info: { flex: 1 },
  name:    { fontSize: 15, fontFamily: fonts.semiBold, color: colors.gray800, letterSpacing: -0.2 },
  context: { fontSize: 12.5, fontFamily: fonts.regular, color: colors.gray400, marginTop: 1 },
  x:       { padding: 4 },

  empty: { textAlign: 'center', color: colors.gray400, fontFamily: fonts.regular, fontSize: 14, marginTop: 40 },
})
