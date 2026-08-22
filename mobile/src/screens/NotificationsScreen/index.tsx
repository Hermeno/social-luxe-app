import React, { useState, useCallback } from 'react'
import {
  View, Text, FlatList, TouchableOpacity,
  StyleSheet, ActivityIndicator, Alert,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useNavigation, useFocusEffect } from '@react-navigation/native'
import { StackNavigationProp } from '@react-navigation/stack'
import { AppStackParams } from '../../navigation/AppNavigator'
import { Ionicons } from '@expo/vector-icons'
import { useNotificationStore, AppNotification } from '../../store/notification.store'
import { getCache, setCache } from '../../db/database'
import { isConnected } from '../../services/netinfo.service'
import { getPartnerPostInvites, respondPartnerPost } from '../../services/post.service'
import { getPendingInvites, respondToInvite } from '../../services/union.service'
import { UNION_ENABLED } from '../../config/features'
import { Post, UnionInvite } from '../../types'
import AvatarImage from '../../components/AvatarImage'
import FollowSplitButton from '../../components/FollowSplitButton'
import { useFollowStore } from '../../store/follow.store'
import { api } from '../../services/api'
import { colors, fonts, spacing, radius } from '../../theme'
import { useT } from '../../i18n'
import { displayHandle } from '../../utils/handle'

function NotifRow({ item, timeLabel, onPress }: { item: AppNotification; timeLabel: string; onPress: () => void }) {
  const followed = useFollowStore((s) => item.fromUser ? s.followingIds.has(item.fromUser.id) : false)
  const [loading, setLoading] = useState(false)

  async function handleFollowBack() {
    if (!item.fromUser || loading) return
    setLoading(true)
    try {
      await useFollowStore.getState().toggle(item.fromUser.id, undefined, {
        name: item.fromUser.name, avatar: item.fromUser.avatar,
      })
    } catch {}
    setLoading(false)
  }

  const isFollow = item.type === 'follow' && !!item.fromUser

  return (
    <TouchableOpacity style={[s.notifRow, !item.read && s.notifUnread]} onPress={onPress} activeOpacity={0.7}>
      {/* Avatar + mini-badge do tipo (estilo do design) */}
      <View style={s.avatarWrap}>
        {item.fromUser
          ? <AvatarImage uri={item.fromUser.avatar} name={item.fromUser.name} size={46} />
          : <View style={s.avatarFallback}><Ionicons name="notifications" size={20} color={colors.gray400} /></View>
        }
        <View style={[s.typeBadge, { backgroundColor: notifColor(item.type) }]}>
          <Ionicons name={notifIcon(item.type) as any} size={10} color="#fff" />
        </View>
      </View>

      {/* Mensagem + data inline, cinza */}
      <View style={s.notifBody}>
        <Text style={s.notifMessage}>
          {item.message}<Text style={s.notifTimeInline}>   {timeLabel}</Text>
        </Text>
      </View>

      {/* Direita: Seguir laranja (follows) ou seta */}
      {isFollow && !followed
        ? <FollowSplitButton following={false} loading={loading} onFollow={handleFollowBack} theme="light" followBack />
        : <Ionicons name="chevron-forward" size={18} color="#D2D2D7" />
      }
    </TouchableOpacity>
  )
}


function notifIcon(type: AppNotification['type']): string {
  switch (type) {
    case 'like':            return 'heart'
    case 'comment':         return 'chatbubble'
    case 'reaction':        return 'happy'
    case 'message':         return 'paper-plane'
    case 'coin':            return 'diamond'
    case 'extend_vote':     return 'timer'
    case 'union_invite':    return 'heart-circle'
    case 'follow':          return 'person-add'
    case 'pairing_invite':  return 'people-circle'
    case 'pairing_accept':  return 'people-circle'
    default:                return 'notifications'
  }
}

function notifColor(type: AppNotification['type']): string {
  switch (type) {
    case 'like':            return '#FF7A1C'
    case 'comment':         return '#3B82F6'
    case 'reaction':        return '#F59E0B'
    case 'message':         return '#10B981'
    case 'coin':            return '#8B5CF6'
    case 'extend_vote':     return '#FF7A1C'
    case 'union_invite':    return '#FF4B6E'
    case 'follow':          return '#1A1A1A'
    case 'pairing_invite':  return '#0A0A0A'
    case 'pairing_accept':  return '#0A0A0A'
    default:                return '#6B7280'
  }
}

type SuggestUser = { id: string; name: string; username?: string | null; avatar: string | null; bio?: string | null }

function SuggestedRow({ user }: { user: SuggestUser }) {
  const t = useT()
  const followed = useFollowStore((s) => s.followingIds.has(user.id))
  const [loading, setLoading]     = useState(false)
  const [dismissed, setDismissed] = useState(false)
  if (dismissed || followed) return null

  async function handleFollow() {
    if (loading) return
    setLoading(true)
    try { await useFollowStore.getState().toggle(user.id, undefined, { name: user.name, avatar: user.avatar }) } catch {}
    setLoading(false)
  }

  return (
    <View style={s.suggestRow}>
      <AvatarImage uri={user.avatar} name={user.name} size={48} />
      <View style={s.suggestInfo}>
        <Text style={s.suggestName} numberOfLines={1}>{user.username ? displayHandle(user.username) : user.name}</Text>
        <Text style={s.suggestSub} numberOfLines={1}>{user.bio || t.msg_suggestion_one}</Text>
      </View>
      <FollowSplitButton following={false} loading={loading} onFollow={handleFollow} theme="light" followBack />
      <TouchableOpacity style={s.suggestX} onPress={() => setDismissed(true)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
        <Ionicons name="close" size={18} color={colors.gray400} />
      </TouchableOpacity>
    </View>
  )
}

export default function NotificationsScreen() {
  const nav = useNavigation<StackNavigationProp<AppStackParams>>()
  const { top } = useSafeAreaInsets()
  const { notifications, badge, markAllRead, setUnionInviteBadge } = useNotificationStore()
  const t = useT()

  const tAgo = (date: string) => {
    const diff = Date.now() - new Date(date).getTime()
    const m = Math.floor(diff / 60000)
    if (m < 60) return `${m}${t.time_m_ago}`
    if (m < 1440) return `${Math.floor(m / 60)}${t.time_h_ago}`
    return `${Math.floor(m / 1440)}${t.time_d_ago}`
  }

  const [unionInvites,     setUnionInvites]     = useState<UnionInvite[]>([])
  const [postInvites,      setPostInvites]      = useState<Post[]>([])
  const [loadingPartner,   setLoadingPartner]   = useState(true)
  const [respondingId,     setRespondingId]      = useState<string | null>(null)
  const [suggested,        setSuggested]         = useState<SuggestUser[]>([])

  useFocusEffect(useCallback(() => {
    let active = true
    async function load() {
      // Contas sugeridas — para a secção no fim (Seguir laranja)
      api.get('/users/suggested')
        .then((res) => { if (active) setSuggested(res.data.data ?? res.data ?? []) })
        .catch(() => {})
      // 1. Cache first — show immediately. Com a União desligada não há
      //    convites de união, mas os convites de post são outra coisa e
      //    continuam a carregar.
      const cached = UNION_ENABLED
        ? await getCache<UnionInvite[]>('union_invites').catch(() => null)
        : null
      if (cached && active) {
        setUnionInvites(cached)
        setUnionInviteBadge(cached.length)
      }
      // 2. Network sync in background
      if (!isConnected()) { setLoadingPartner(false); return }
      setLoadingPartner(true)
      try {
        const [fresh, invites] = await Promise.all([
          UNION_ENABLED ? getPendingInvites() : Promise.resolve([] as UnionInvite[]),
          getPartnerPostInvites().catch(() => []),
        ])
        if (active) {
          setUnionInvites(fresh)
          setUnionInviteBadge(fresh.length)
          setPostInvites(invites)
          if (UNION_ENABLED) setCache('union_invites', fresh).catch(() => {})
        }
      } catch {}
      if (active) setLoadingPartner(false)
    }
    load()
    return () => { active = false }
  }, []))

  async function handleUnionInviteResponse(id: string, accept: boolean) {
    setRespondingId(id)
    // Optimistic remove
    const remaining = unionInvites.filter((r) => r.id !== id)
    setUnionInvites(remaining)
    setUnionInviteBadge(remaining.length)
    setCache('union_invites', remaining).catch(() => {})
    try {
      await respondToInvite(id, accept)
      if (accept) Alert.alert(t.notifs_partner_accepted, t.notifs_partner_accepted_msg)
    } catch {
      // Rollback
      setUnionInvites(unionInvites)
      setUnionInviteBadge(unionInvites.length)
      setCache('union_invites', unionInvites).catch(() => {})
      Alert.alert(t.error, t.notifs_err_msg)
    }
    setRespondingId(null)
  }

  const totalBadge = badge + unionInvites.length

  return (
    <View style={[s.container, { paddingTop: top }]}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => nav.goBack()} style={s.hBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="chevron-back" size={26} color={colors.gray800} />
        </TouchableOpacity>
        <Text style={s.title}>{t.notifs_title}</Text>
        {badge > 0
          ? (
            <TouchableOpacity onPress={markAllRead} style={s.hBtn} activeOpacity={0.7} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="checkmark-done" size={22} color={colors.primary} />
            </TouchableOpacity>
          )
          : <View style={s.hBtn} />
        }
      </View>

      <FlatList
        data={notifications}
        keyExtractor={(n) => n.id}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={s.list}
        ListHeaderComponent={
          <>
            {/* Union invites section */}
            {(loadingPartner || unionInvites.length > 0) && (
              <View style={s.partnerSection}>
                <View style={s.sectionTitleRow}>
                  <Ionicons name="heart-circle" size={16} color="#FF4B6E" />
                  <Text style={s.sectionTitle}>{t.notifs_partner_reqs}</Text>
                </View>

                {loadingPartner && unionInvites.length === 0 && (
                  <ActivityIndicator color={colors.primary} style={{ marginVertical: 16 }} />
                )}

                {unionInvites.map((inv) => (
                  <View key={inv.id} style={s.partnerCard}>
                    <AvatarImage uri={inv.fromUnion.memberA.avatar} name={inv.fromUnion.memberA.name} size={50} />
                    <View style={s.partnerInfo}>
                      <Text style={s.partnerName}>{inv.fromUnion.memberA.name}</Text>
                      <Text style={s.partnerSub}>
                        {inv.fromUnion.label ?? t.notifs_partner_req_msg}
                      </Text>
                    </View>
                    <View style={s.partnerActions}>
                      <TouchableOpacity
                        style={s.acceptBtn}
                        onPress={() => handleUnionInviteResponse(inv.id, true)}
                        disabled={respondingId === inv.id}
                        activeOpacity={0.8}
                      >
                        {respondingId === inv.id
                          ? <ActivityIndicator size="small" color="#fff" />
                          : <Text style={s.acceptTxt}>{t.notifs_accept}</Text>
                        }
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={s.rejectBtn}
                        onPress={() => handleUnionInviteResponse(inv.id, false)}
                        disabled={respondingId === inv.id}
                        activeOpacity={0.8}
                      >
                        <Ionicons name="close" size={18} color={colors.gray600} />
                      </TouchableOpacity>
                    </View>
                  </View>
                ))}
              </View>
            )}

            {/* Post partner invites */}
            {postInvites.length > 0 && (
              <View style={[s.partnerSection, { backgroundColor: '#F0F4FF', marginTop: 8 }]}>
                <View style={s.sectionTitleRow}>
                  <Ionicons name="images-outline" size={15} color={colors.primary} />
                  <Text style={[s.sectionTitle, { color: colors.primary }]}>{t.notifs_collab}</Text>
                </View>
                {postInvites.map((post) => (
                  <View key={post.id} style={s.partnerCard}>
                    <AvatarImage uri={post.user.avatar} name={post.user.name} size={44} />
                    <View style={s.partnerInfo}>
                      <Text style={s.partnerName}>{`${post.user.name} ${t.notifs_collab_included}`}</Text>
                      {post.caption ? <Text style={s.partnerSub} numberOfLines={1}>{post.caption}</Text> : null}
                    </View>
                    <View style={s.partnerActions}>
                      <TouchableOpacity
                        style={s.acceptBtn}
                        onPress={async () => {
                          await respondPartnerPost(post.id, true)
                          setPostInvites((p) => p.filter((x) => x.id !== post.id))
                        }}
                        activeOpacity={0.8}
                      >
                        <Text style={s.acceptTxt}>{t.notifs_accept}</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={s.rejectBtn}
                        onPress={async () => {
                          await respondPartnerPost(post.id, false)
                          setPostInvites((p) => p.filter((x) => x.id !== post.id))
                        }}
                        activeOpacity={0.8}
                      >
                        <Ionicons name="close" size={18} color={colors.gray600} />
                      </TouchableOpacity>
                    </View>
                  </View>
                ))}
              </View>
            )}

            {/* Divider only if both sections have content */}
            {(unionInvites.length > 0 || postInvites.length > 0) && notifications.length > 0 && (
              <View style={s.sectionDivider} />
            )}
          </>
        }
        ListEmptyComponent={
          unionInvites.length === 0 ? (
            <View style={s.center}>
              <Ionicons name="notifications-outline" size={56} color={colors.gray200} />
              <Text style={s.emptyText}>{t.notifs_empty}</Text>
              <Text style={s.emptySubtext}>{t.notifs_empty_sub}</Text>
            </View>
          ) : null
        }
        ListFooterComponent={
          suggested.length > 0 ? (
            <View>
              <Text style={s.suggestHead}>{t.msg_suggestions_title}</Text>
              {suggested.map((u) => <SuggestedRow key={u.id} user={u} />)}
            </View>
          ) : null
        }
        renderItem={({ item }: { item: AppNotification }) => (
          <NotifRow
            item={item}
            timeLabel={tAgo(item.createdAt)}
            onPress={() => {
              if (item.type === 'follow' && item.fromUser) {
                nav.navigate('Profile', { userId: item.fromUser.id })
              }
              if ((item.type === 'pairing_invite' || item.type === 'pairing_accept') && item.fromUser) {
                nav.navigate('Chat', { userId: item.fromUser.id, userName: item.fromUser.name, userAvatar: item.fromUser.avatar })
              }
            }}
          />
        )}
      />
    </View>
  )
}

const s = StyleSheet.create({
  container:    { flex: 1, backgroundColor: colors.white },
  header:       {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm, gap: spacing.sm,
  },
  hBtn:         { width: 36, alignItems: 'center' },
  title:        { flex: 1, textAlign: 'center', color: colors.gray800, fontFamily: fonts.bold, fontSize: 18 },
  badge:        {
    backgroundColor: '#FF4B6E', borderRadius: radius.full,
    paddingHorizontal: 7, paddingVertical: 2,
    minWidth: 22, alignItems: 'center',
  },
  badgeText:    { color: '#fff', fontFamily: fonts.bold, fontSize: 11 },
  markAllText:  { color: colors.primary, fontFamily: fonts.semiBold, fontSize: 13 },

  list:         { paddingHorizontal: spacing.md, paddingTop: spacing.sm, paddingBottom: 40 },

  // Partner requests
  partnerSection: {
    backgroundColor: '#FFF5F6',
    borderRadius: 16,
    padding: 16,
    marginBottom: 8,
    gap: 12,
  },
  sectionTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  sectionTitle:    { fontSize: 11, fontFamily: fonts.bold, color: '#FF4B6E', letterSpacing: 1 },

  partnerCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
  },
  partnerInfo: { flex: 1 },
  partnerName: { fontSize: 15, fontFamily: fonts.semiBold, color: colors.gray800 },
  partnerSub:  { fontSize: 12, fontFamily: fonts.regular, color: colors.gray400, marginTop: 2 },
  partnerActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },

  acceptBtn: {
    backgroundColor: colors.primary, borderRadius: 8,
    paddingHorizontal: 14, paddingVertical: 8,
    minWidth: 72, alignItems: 'center',
  },
  acceptTxt: { fontSize: 13, fontFamily: fonts.semiBold, color: '#fff' },
  rejectBtn: {
    width: 36, height: 36, borderRadius: 8,
    backgroundColor: colors.gray100,
    alignItems: 'center', justifyContent: 'center',
  },

  sectionDivider: { height: 1, backgroundColor: colors.gray200, marginVertical: 8 },

  // Regular notifications
  center:       { alignItems: 'center', justifyContent: 'center', paddingTop: 80, gap: spacing.md },
  emptyText:    { color: colors.gray800, fontFamily: fonts.semiBold, fontSize: 18 },
  emptySubtext: { color: colors.gray400, fontFamily: fonts.regular, fontSize: 14 },
  notifRow:     {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    paddingVertical: 12,
  },
  notifUnread:  { backgroundColor: 'rgba(202,40,81,0.04)', marginHorizontal: -spacing.md, paddingHorizontal: spacing.md, borderRadius: 12 },
  avatarWrap:   { width: 46, height: 46 },
  avatarFallback: { width: 46, height: 46, borderRadius: 23, backgroundColor: colors.gray100, alignItems: 'center', justifyContent: 'center' },
  typeBadge:    {
    position: 'absolute', right: -2, bottom: -2, width: 20, height: 20, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: colors.white,
  },
  notifBody:    { flex: 1 },
  notifMessage: { color: colors.gray800, fontFamily: fonts.regular, fontSize: 14, lineHeight: 20 },
  notifTimeInline: { color: colors.gray400, fontFamily: fonts.regular, fontSize: 13 },

  // Contas sugeridas
  suggestHead:  { fontSize: 15, fontFamily: fonts.bold, color: colors.gray800, marginTop: 22, marginBottom: 10 },
  suggestRow:   { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: 10 },
  suggestInfo:  { flex: 1 },
  suggestName:  { fontSize: 14.5, fontFamily: fonts.semiBold, color: colors.gray800 },
  suggestSub:   { fontSize: 12, fontFamily: fonts.regular, color: colors.gray400, marginTop: 2 },
  suggestX:     { padding: 4 },
})
