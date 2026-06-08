import React, { useState, useCallback } from 'react'
import {
  View, Text, FlatList, TouchableOpacity,
  StyleSheet, ActivityIndicator, Alert,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useNavigation, useFocusEffect } from '@react-navigation/native'
import { Ionicons } from '@expo/vector-icons'
import { useNotificationStore, AppNotification } from '../../store/notification.store'
import { api } from '../../services/api'
import { getCache, setCache } from '../../db/database'
import { isConnected } from '../../services/netinfo.service'
import { getPartnerPostInvites, respondPartnerPost } from '../../services/post.service'
import { Post } from '../../types'
import AvatarImage from '../../components/AvatarImage'
import { colors, fonts, spacing, radius } from '../../theme'

interface PartnerRequest {
  id: string
  senderId: string
  status: string
  sender: { id: string; name: string; avatar: string | null; bio: string | null }
}

function timeAgo(date: string) {
  const diff = Date.now() - new Date(date).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 60) return `${m}m atrás`
  if (m < 1440) return `${Math.floor(m / 60)}h atrás`
  return `${Math.floor(m / 1440)}d atrás`
}

function notifIcon(type: AppNotification['type']): string {
  switch (type) {
    case 'like':            return 'heart'
    case 'comment':         return 'chatbubble'
    case 'reaction':        return 'happy'
    case 'message':         return 'paper-plane'
    case 'coin':            return 'diamond'
    case 'extend_vote':     return 'timer'
    case 'partner_request': return 'heart-circle'
    default:                return 'notifications'
  }
}

function notifColor(type: AppNotification['type']): string {
  switch (type) {
    case 'like':            return '#4C8CE4'
    case 'comment':         return '#3B82F6'
    case 'reaction':        return '#F59E0B'
    case 'message':         return '#10B981'
    case 'coin':            return '#8B5CF6'
    case 'extend_vote':     return '#EC4899'
    case 'partner_request': return '#FF4B6E'
    default:                return '#6B7280'
  }
}

export default function NotificationsScreen() {
  const nav = useNavigation()
  const { top } = useSafeAreaInsets()
  const { notifications, badge, markAllRead, setPartnerRequestBadge } = useNotificationStore()

  const [partnerRequests,  setPartnerRequests]  = useState<PartnerRequest[]>([])
  const [postInvites,      setPostInvites]      = useState<Post[]>([])
  const [loadingPartner,   setLoadingPartner]   = useState(true)
  const [respondingId,     setRespondingId]      = useState<string | null>(null)

  useFocusEffect(useCallback(() => {
    let active = true
    async function load() {
      // 1. Cache first — show immediately
      const cached = await getCache<PartnerRequest[]>('partner_requests').catch(() => null)
      if (cached && active) {
        setPartnerRequests(cached)
        setPartnerRequestBadge(cached.length)
      }
      // 2. Network sync in background
      if (!isConnected()) { setLoadingPartner(false); return }
      setLoadingPartner(true)
      try {
        const [reqRes, invites] = await Promise.all([
          api.get('/users/partner-requests'),
          getPartnerPostInvites().catch(() => []),
        ])
        const fresh: PartnerRequest[] = reqRes.data.data ?? []
        if (active) {
          setPartnerRequests(fresh)
          setPartnerRequestBadge(fresh.length)
          setPostInvites(invites)
          setCache('partner_requests', fresh).catch(() => {})
        }
      } catch {}
      if (active) setLoadingPartner(false)
    }
    load()
    return () => { active = false }
  }, []))

  async function handlePartnerResponse(id: string, accept: boolean) {
    setRespondingId(id)
    // Optimistic remove
    const remaining = partnerRequests.filter((r) => r.id !== id)
    setPartnerRequests(remaining)
    setPartnerRequestBadge(remaining.length)
    setCache('partner_requests', remaining).catch(() => {})
    try {
      await api.put(`/users/partner-requests/${id}/${accept ? 'accept' : 'reject'}`)
      if (accept) Alert.alert('💑 Associação aceite!', 'Os vossos perfis estão agora ligados.')
    } catch {
      // Rollback
      setPartnerRequests(partnerRequests)
      setPartnerRequestBadge(partnerRequests.length)
      setCache('partner_requests', partnerRequests).catch(() => {})
      Alert.alert('Erro', 'Não foi possível processar o pedido.')
    }
    setRespondingId(null)
  }

  const totalBadge = badge + partnerRequests.length

  return (
    <View style={[s.container, { paddingTop: top }]}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => (nav as any).goBack()} style={s.backBtn}>
          <Ionicons name="chevron-back" size={26} color={colors.gray800} />
        </TouchableOpacity>
        <View style={s.titleWrap}>
          <Text style={s.title}>Notificações</Text>
          {totalBadge > 0 && (
            <View style={s.badge}>
              <Text style={s.badgeText}>{totalBadge > 99 ? '99+' : totalBadge}</Text>
            </View>
          )}
        </View>
        {badge > 0 && (
          <TouchableOpacity onPress={markAllRead} activeOpacity={0.75}>
            <Text style={s.markAllText}>Marcar lido</Text>
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
            {/* Partner requests section */}
            {(loadingPartner || partnerRequests.length > 0) && (
              <View style={s.partnerSection}>
                <View style={s.sectionTitleRow}>
                  <Ionicons name="heart-circle" size={16} color="#FF4B6E" />
                  <Text style={s.sectionTitle}>PEDIDOS DE ASSOCIAÇÃO</Text>
                </View>

                {loadingPartner && partnerRequests.length === 0 && (
                  <ActivityIndicator color={colors.primary} style={{ marginVertical: 16 }} />
                )}

                {partnerRequests.map((req) => (
                  <View key={req.id} style={s.partnerCard}>
                    <AvatarImage uri={req.sender.avatar} size={50} />
                    <View style={s.partnerInfo}>
                      <Text style={s.partnerName}>{req.sender.name}</Text>
                      <Text style={s.partnerSub}>
                        {req.sender.bio ?? 'Quer associar a conta contigo 💑'}
                      </Text>
                    </View>
                    <View style={s.partnerActions}>
                      <TouchableOpacity
                        style={s.acceptBtn}
                        onPress={() => handlePartnerResponse(req.id, true)}
                        disabled={respondingId === req.id}
                        activeOpacity={0.8}
                      >
                        {respondingId === req.id
                          ? <ActivityIndicator size="small" color="#fff" />
                          : <Text style={s.acceptTxt}>Aceitar</Text>
                        }
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={s.rejectBtn}
                        onPress={() => handlePartnerResponse(req.id, false)}
                        disabled={respondingId === req.id}
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
                  <Text style={[s.sectionTitle, { color: colors.primary }]}>POSTS COM A TUA PARTICIPAÇÃO</Text>
                </View>
                {postInvites.map((post) => (
                  <View key={post.id} style={s.partnerCard}>
                    <AvatarImage uri={post.user.avatar} size={44} />
                    <View style={s.partnerInfo}>
                      <Text style={s.partnerName}>{post.user.name} incluiu-te num post</Text>
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
                        <Text style={s.acceptTxt}>Aceitar</Text>
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
            {(partnerRequests.length > 0 || postInvites.length > 0) && notifications.length > 0 && (
              <View style={s.sectionDivider} />
            )}
          </>
        }
        ListEmptyComponent={
          partnerRequests.length === 0 ? (
            <View style={s.center}>
              <Ionicons name="notifications-outline" size={56} color={colors.gray200} />
              <Text style={s.emptyText}>Sem notificações</Text>
              <Text style={s.emptySubtext}>Você está em dia com tudo!</Text>
            </View>
          ) : null
        }
        renderItem={({ item }: { item: AppNotification }) => (
          <View style={[s.notifRow, !item.read && s.notifUnread]}>
            <View style={[s.iconWrap, { backgroundColor: notifColor(item.type) + '22' }]}>
              <Ionicons name={notifIcon(item.type) as any} size={20} color={notifColor(item.type)} />
            </View>
            <View style={s.notifBody}>
              <Text style={s.notifMessage}>{item.message}</Text>
              <Text style={s.notifTime}>{timeAgo(item.createdAt)}</Text>
            </View>
            {!item.read && <View style={s.unreadDot} />}
          </View>
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
