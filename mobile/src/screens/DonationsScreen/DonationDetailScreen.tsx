import React, { useState, useCallback } from 'react'
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView,
  ActivityIndicator, Image, TextInput, Alert,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useNavigation, useRoute, RouteProp, useFocusEffect } from '@react-navigation/native'
import { StackNavigationProp } from '@react-navigation/stack'
import { Ionicons } from '@expo/vector-icons'
import { LinearGradient } from 'expo-linear-gradient'
import Toast from 'react-native-toast-message'
import { colors, fonts } from '../../theme'
import AvatarImage from '../../components/AvatarImage'
import { useAuthStore } from '../../store/auth.store'
import {
  getDonation, requestDonation, confirmDelivery, leaveFeedback, Donation,
} from '../../services/donation.service'
import { AppStackParams } from '../../navigation/AppNavigator'

type Nav   = StackNavigationProp<AppStackParams>
type Route = RouteProp<AppStackParams, 'DonationDetail'>

const TYPE_LABEL   = { ITEM: 'Item', FINANCIAL: 'Ajuda financeira' } as const
const STATUS_LABEL = { AVAILABLE: 'Disponível', RESERVED: 'Reservada', DELIVERED: 'Entregue', EXPIRED: 'Expirada' } as const
const STATUS_COLOR = { AVAILABLE: colors.primary, RESERVED: '#B8860B', DELIVERED: '#2E9E5B', EXPIRED: colors.gray400 } as const

function Stars({ value, onChange }: { value: number; onChange?: (n: number) => void }) {
  return (
    <View style={{ flexDirection: 'row', gap: 4 }}>
      {[1, 2, 3, 4, 5].map((n) => (
        <TouchableOpacity key={n} disabled={!onChange} onPress={() => onChange?.(n)} hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}>
          <Ionicons name={n <= value ? 'star' : 'star-outline'} size={onChange ? 28 : 14} color={n <= value ? '#F5A623' : colors.gray300} />
        </TouchableOpacity>
      ))}
    </View>
  )
}

export default function DonationDetailScreen() {
  const { top, bottom } = useSafeAreaInsets()
  const nav   = useNavigation<Nav>()
  const route = useRoute<Route>()
  const { user } = useAuthStore()
  const { donationId } = route.params

  const [donation, setDonation] = useState<Donation | null>(null)
  const [loading,  setLoading]  = useState(true)
  const [busy,     setBusy]     = useState(false)
  const [rating,   setRating]   = useState(0)
  const [comment,  setComment]  = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      setDonation(await getDonation(donationId))
    } catch {
      Toast.show({ type: 'error', text1: 'Erro', text2: 'Não foi possível carregar a doação.', visibilityTime: 2500 })
    } finally {
      setLoading(false)
    }
  }, [donationId])

  useFocusEffect(useCallback(() => { load() }, [load]))

  async function handleRequest() {
    setBusy(true)
    try {
      const updated = await requestDonation(donationId)
      setDonation(updated)
      Toast.show({ type: 'success', text1: 'Pedido enviado!', text2: 'O doador foi notificado.', visibilityTime: 2500 })
    } catch (e: any) {
      Toast.show({ type: 'error', text1: 'Não foi possível pedir', text2: e?.response?.data?.message ?? 'Tenta novamente.', visibilityTime: 2500 })
    } finally {
      setBusy(false)
    }
  }

  async function handleConfirmDelivery() {
    setBusy(true)
    try {
      const updated = await confirmDelivery(donationId)
      setDonation((prev) => prev ? { ...prev, status: updated.status } : updated)
      Toast.show({ type: 'success', text1: 'Entrega confirmada!', visibilityTime: 2500 })
    } catch {
      Toast.show({ type: 'error', text1: 'Erro', text2: 'Não foi possível confirmar.', visibilityTime: 2500 })
    } finally {
      setBusy(false)
    }
  }

  async function handleSendFeedback() {
    if (rating === 0) {
      Alert.alert('Avaliação', 'Escolhe uma pontuação de 1 a 5 estrelas.')
      return
    }
    setBusy(true)
    try {
      await leaveFeedback(donationId, rating, comment.trim() || undefined)
      Toast.show({ type: 'success', text1: 'Obrigado pela avaliação!', visibilityTime: 2500 })
      load()
    } catch {
      Toast.show({ type: 'error', text1: 'Erro', text2: 'Não foi possível enviar a avaliação.', visibilityTime: 2500 })
    } finally {
      setBusy(false)
    }
  }

  if (loading || !donation) {
    return (
      <View style={s.screen}>
        <View style={[s.header, { paddingTop: top + 12 }]}>
          <TouchableOpacity onPress={() => nav.goBack()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Ionicons name="chevron-back" size={26} color={colors.dark} />
          </TouchableOpacity>
          <Text style={s.headerTitle}>Doação</Text>
          <View style={{ width: 26 }} />
        </View>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      </View>
    )
  }

  const isDonor       = donation.donorId === user?.id
  const isRequester    = donation.requesterId === user?.id
  const alreadyReviewed = !!donation.feedbacks?.some((f) => f.from.id === user?.id)
  const photo = donation.photos?.[0] ?? null

  return (
    <View style={s.screen}>
      <View style={[s.header, { paddingTop: top + 12 }]}>
        <TouchableOpacity onPress={() => nav.goBack()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Ionicons name="chevron-back" size={26} color={colors.dark} />
        </TouchableOpacity>
        <Text style={s.headerTitle} numberOfLines={1}>Doação</Text>
        <View style={{ width: 26 }} />
      </View>

      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: Math.max(bottom, 16) + 24, gap: 16 }}>
        {photo ? (
          <Image source={{ uri: photo }} style={s.hero} />
        ) : (
          <LinearGradient colors={['#CA2851', '#FF6766', '#FFB173']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.hero}>
            <Ionicons name={donation.type === 'ITEM' ? 'gift' : 'cash'} size={40} color="#fff" />
          </LinearGradient>
        )}

        <View style={s.badgeRow}>
          <View style={s.typeBadge}>
            <Ionicons name={donation.type === 'ITEM' ? 'gift-outline' : 'cash-outline'} size={13} color={colors.gray600} />
            <Text style={s.typeBadgeTxt}>{TYPE_LABEL[donation.type]}</Text>
          </View>
          <View style={[s.statusPill, { backgroundColor: `${STATUS_COLOR[donation.status]}18` }]}>
            <View style={[s.statusDot, { backgroundColor: STATUS_COLOR[donation.status] }]} />
            <Text style={[s.statusTxt, { color: STATUS_COLOR[donation.status] }]}>{STATUS_LABEL[donation.status]}</Text>
          </View>
        </View>

        <Text style={s.title}>{donation.title}</Text>
        {!!donation.description && <Text style={s.desc}>{donation.description}</Text>}

        {/* Donor */}
        <TouchableOpacity
          style={s.personCard}
          activeOpacity={0.8}
          onPress={() => nav.navigate('Profile', { userId: donation.donor.id })}
        >
          <AvatarImage uri={donation.donor.avatar} name={donation.donor.name} size={40} />
          <View style={{ flex: 1 }}>
            <Text style={s.personName}>{donation.donor.name}</Text>
            <Text style={s.personRole}>Doador{!!donation.donor.bio && ` · ${donation.donor.bio}`}</Text>
          </View>
        </TouchableOpacity>

        {/* Requester (visible to donor once reserved) */}
        {isDonor && donation.requester && (
          <TouchableOpacity
            style={s.personCard}
            activeOpacity={0.8}
            onPress={() => nav.navigate('Profile', { userId: donation.requester!.id })}
          >
            <AvatarImage uri={donation.requester.avatar} name={donation.requester.name} size={40} />
            <View style={{ flex: 1 }}>
              <Text style={s.personName}>{donation.requester.name}</Text>
              <Text style={s.personRole}>Vai receber</Text>
            </View>
            <TouchableOpacity
              onPress={() => nav.navigate('Chat', { userId: donation.requester!.id, userName: donation.requester!.name, userAvatar: donation.requester!.avatar })}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="chatbubble-outline" size={20} color={colors.primary} />
            </TouchableOpacity>
          </TouchableOpacity>
        )}

        {/* ── Actions ── */}
        {!isDonor && donation.status === 'AVAILABLE' && (
          <TouchableOpacity style={s.primaryBtn} onPress={handleRequest} disabled={busy} activeOpacity={0.85}>
            {busy ? <ActivityIndicator color="#fff" /> : <Text style={s.primaryBtnTxt}>Pedir esta doação</Text>}
          </TouchableOpacity>
        )}

        {!isDonor && donation.status === 'RESERVED' && isRequester && (
          <View style={s.infoBanner}>
            <Ionicons name="time-outline" size={16} color={colors.primary} />
            <Text style={s.infoBannerTxt}>Pedido enviado — combina a entrega com {donation.donor.name} e aguarda a confirmação.</Text>
          </View>
        )}

        {!isDonor && donation.status === 'RESERVED' && !isRequester && (
          <View style={s.infoBanner}>
            <Ionicons name="information-circle-outline" size={16} color={colors.gray500} />
            <Text style={s.infoBannerTxt}>Esta doação já foi reservada por outra pessoa.</Text>
          </View>
        )}

        {isDonor && donation.status === 'AVAILABLE' && (
          <View style={s.infoBanner}>
            <Ionicons name="hourglass-outline" size={16} color={colors.gray500} />
            <Text style={s.infoBannerTxt}>À espera que alguém peça esta doação.</Text>
          </View>
        )}

        {isDonor && donation.status === 'RESERVED' && (
          <TouchableOpacity style={s.primaryBtn} onPress={handleConfirmDelivery} disabled={busy} activeOpacity={0.85}>
            {busy ? <ActivityIndicator color="#fff" /> : <Text style={s.primaryBtnTxt}>Confirmar entrega</Text>}
          </TouchableOpacity>
        )}

        {donation.status === 'DELIVERED' && isRequester && !alreadyReviewed && (
          <View style={s.feedbackCard}>
            <Text style={s.feedbackTitle}>Como foi a experiência?</Text>
            <Stars value={rating} onChange={setRating} />
            <TextInput
              style={s.feedbackInput}
              placeholder="Deixa um comentário (opcional)"
              placeholderTextColor={colors.gray400}
              value={comment}
              onChangeText={setComment}
              multiline
            />
            <TouchableOpacity style={s.primaryBtn} onPress={handleSendFeedback} disabled={busy} activeOpacity={0.85}>
              {busy ? <ActivityIndicator color="#fff" /> : <Text style={s.primaryBtnTxt}>Enviar avaliação</Text>}
            </TouchableOpacity>
          </View>
        )}

        {donation.status === 'EXPIRED' && (
          <View style={s.infoBanner}>
            <Ionicons name="close-circle-outline" size={16} color={colors.gray500} />
            <Text style={s.infoBannerTxt}>Esta doação expirou.</Text>
          </View>
        )}

        {/* Feedbacks */}
        {!!donation.feedbacks?.length && (
          <View style={{ gap: 10 }}>
            <Text style={s.sectionLabel}>Avaliações</Text>
            {donation.feedbacks.map((f, i) => (
              <View key={i} style={s.feedbackRow}>
                <AvatarImage uri={f.from.avatar} name={f.from.name} size={30} />
                <View style={{ flex: 1, gap: 2 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Text style={s.personName}>{f.from.name}</Text>
                    <Stars value={f.rating} />
                  </View>
                  {!!f.comment && <Text style={s.feedbackComment}>{f.comment}</Text>}
                </View>
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  )
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.white },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingBottom: 14,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#EBEBEB',
  },
  headerTitle: { fontSize: 17, fontFamily: fonts.bold, color: colors.dark, letterSpacing: -0.2 },

  hero: { width: '100%', height: 200, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.gray100 },

  badgeRow: { flexDirection: 'row', gap: 8 },
  typeBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10, backgroundColor: colors.gray100 },
  typeBadgeTxt: { fontSize: 12, fontFamily: fonts.medium, color: colors.gray600 },
  statusPill: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10 },
  statusDot:  { width: 6, height: 6, borderRadius: 3 },
  statusTxt:  { fontSize: 12, fontFamily: fonts.semiBold },

  title: { fontSize: 21, fontFamily: fonts.bold, color: colors.dark, letterSpacing: -0.4 },
  desc:  { fontSize: 14.5, fontFamily: fonts.regular, color: colors.gray600, lineHeight: 21 },

  personCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    padding: 12, borderRadius: 14, borderWidth: 1, borderColor: colors.gray200,
  },
  personName: { fontSize: 14, fontFamily: fonts.semiBold, color: colors.dark },
  personRole: { fontSize: 12, fontFamily: fonts.regular, color: colors.gray500, marginTop: 1 },

  primaryBtn: { backgroundColor: colors.primary, borderRadius: 14, paddingVertical: 15, alignItems: 'center' },
  primaryBtnTxt: { fontSize: 15.5, fontFamily: fonts.bold, color: '#fff' },

  infoBanner: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 8,
    padding: 12, borderRadius: 12, backgroundColor: colors.gray100,
  },
  infoBannerTxt: { flex: 1, fontSize: 13, fontFamily: fonts.regular, color: colors.gray600, lineHeight: 18 },

  feedbackCard: { gap: 10, padding: 14, borderRadius: 14, borderWidth: 1, borderColor: colors.gray200 },
  feedbackTitle: { fontSize: 14.5, fontFamily: fonts.semiBold, color: colors.dark },
  feedbackInput: {
    borderWidth: 1.5, borderColor: colors.gray200, borderRadius: 12,
    paddingHorizontal: 12, paddingVertical: 10, minHeight: 60,
    fontSize: 14, fontFamily: fonts.regular, color: colors.dark,
    textAlignVertical: 'top', backgroundColor: '#FAFAFA',
  },

  sectionLabel: { fontSize: 13, fontFamily: fonts.semiBold, color: colors.gray500, letterSpacing: 0.2, textTransform: 'uppercase' },
  feedbackRow: { flexDirection: 'row', gap: 10 },
  feedbackComment: { fontSize: 13, fontFamily: fonts.regular, color: colors.gray600, lineHeight: 18 },
})
