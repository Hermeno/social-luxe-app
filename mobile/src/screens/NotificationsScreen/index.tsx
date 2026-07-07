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
import { Post, UnionInvite } from '../../types'
import AvatarImage from '../../components/AvatarImage'
import FollowSplitButton from '../../components/FollowSplitButton'
import { useFollowStore } from '../../store/follow.store'
import { colors, fonts, spacing, radius } from '../../theme'
import { useT } from '../../i18n'

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

  return (
    <TouchableOpacity style={[s.notifRow, !item.read && s.notifUnread]} onPress={onPress} activeOpacity={0.7}>
      {item.type === 'follow' && item.fromUser
        ? <AvatarImage uri={item.fromUser.avatar} name={item.fromUser.name} size={40} />
        : (
          <View style={[s.iconWrap, { backgroundColor: notifColor(item.type) + '22' }]}>
            <Ionicons name={notifIcon(item.type) as any} size={20} color={notifColor(item.type)} />
          </View>
        )
      }
      <View style={s.notifBody}>
        <Text style={s.notifMessage}>{item.message}</Text>
        <Text style={s.notifTime}>{timeLabel}</Text>
      </View>
      {item.type === 'follow' && item.fromUser && !followed && (
        <FollowSplitButton following={false} loading={loading} onFollow={handleFollowBack} theme="light" />
      )}
      {!item.read && <View style={s.unreadDot} />}
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
    case 'like':            return '#CA2851'
    case 'comment':         return '#3B82F6'
    case 'reaction':        return '#F59E0B'
    case 'message':         return '#10B981'
    case 'coin':            return '#8B5CF6'
    case 'extend_vote':     return '#CA2851'
    case 'union_invite':    return '#FF4B6E'
    case 'follow':          return '#1A1A1A'
    case 'pairing_invite':  return '#0A0A0A'
    case 'pairing_accept':  return '#0A0A0A'
    default:                return '#6B7280'
  }
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

  useFocusEffect(useCallback(() => {
    let active = true
    async function load() {
      // 1. Cache first — show immediately
      const cached = await getCache<UnionInvite[]>('union_invites').catch(() => null)
      if (cached && active) {
        setUnionInvites(cached)
        setUnionInviteBadge(cached.length)
      }
      // 2. Network sync in background
      if (!isConnected()) { setLoadingPartner(false); return }
      setLoadingPartner(true)
      try {
        const [fresh, invites] = await Promise.all([
          getPendingInvites(),
          getPartnerPostInvites().catch(() => []),
        ])
        if (active) {
          setUnionInvites(fresh)
          setUnionInviteBadge(fresh.length)
          setPostInvites(invites)
          setCache('union_invites', fresh).catch(() => {})
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
        <TouchableOpacity onPress={() => nav.goBack()} style={s.backBtn}>
          <Ionicons name="chevron-back" size={26} color={colors.gray800} />
        </TouchableOpacity>
        <View style={s.titleWrap}>
          <Text style={s.title}>{t.notifs_title}</Text>
          {totalBadge > 0 && (
            <View style={s.badge}>
              <Text style={s.badgeText}>{totalBadge > 99 ? '99+' : totalBadge}</Text>
            </View>
          )}
        </View>
        {badge > 0 && (
          <TouchableOpacity onPress={markAllRead} activeOpacity={0.75}>
            <Text style={s.markAllText}>{t.notifs_mark_read}</Text>
          </TouchableOpacity>
        )}
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
  backBtn:      { width: 36 },
  titleWrap:    { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 },
  title:        { color: colors.gray800, fontFamily: fonts.bold, fontSize: 20 },
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
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.gray200,
  },
  notifUnread:  { backgroundColor: 'rgba(76,140,228,0.04)', marginHorizontal: -spacing.md, paddingHorizontal: spacing.md },
  iconWrap:     { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  notifBody:    { flex: 1, gap: 3 },
  notifMessage: { color: colors.gray800, fontFamily: fonts.regular, fontSize: 14, lineHeight: 20 },
  notifTime:    { color: colors.gray400, fontFamily: fonts.regular, fontSize: 11 },
  unreadDot:    { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.primary },
})
