import React, { useEffect, useState } from 'react'
import {
  View,
  Text,
  FlatList,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useNavigation } from '@react-navigation/native'
import { Ionicons } from '@expo/vector-icons'
import * as Location from 'expo-location'
import {
  getFriendsMomentos,
  createMomento,
  deleteMomento,
  Momento,
} from '../../services/momento.service'
import { useAuthStore } from '../../store/auth.store'
import { colors, fonts, spacing, radius } from '../../theme'
import AvatarImage from '../../components/AvatarImage'

function timeLeft(expiresAt: string) {
  const diff = new Date(expiresAt).getTime() - Date.now()
  if (diff <= 0) return 'Expirado'
  const m = Math.floor(diff / 60000)
  if (m < 60) return `Expira em ${m}m`
  return `Expira em ${Math.floor(m / 60)}h`
}

function timeAgo(date: string) {
  const diff = Date.now() - new Date(date).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 60) return `há ${m}m`
  if (m < 1440) return `há ${Math.floor(m / 60)}h`
  return `há ${Math.floor(m / 1440)}d`
}

function calcDistance(
  lat1: number, lon1: number,
  lat2: number, lon2: number,
): string {
  const R = 6371
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLon = ((lon2 - lon1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2
  const d = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  if (d < 1) return `${Math.round(d * 1000)}m`
  return `${d.toFixed(1)}km`
}

export default function MomentoScreen() {
  const nav = useNavigation()
  const { top, bottom } = useSafeAreaInsets()
  const { user } = useAuthStore()
  const [momentos, setMomentos] = useState<Momento[]>([])
  const [loading, setLoading] = useState(true)
  const [label, setLabel] = useState('')
  const [sharing, setSharing] = useState(false)
  const [myLocation, setMyLocation] = useState<{ lat: number; lon: number } | null>(null)
  const [showForm, setShowForm] = useState(false)

  useEffect(() => {
    getFriendsMomentos()
      .then(setMomentos)
      .catch(() => {})
      .finally(() => setLoading(false))
    Location.requestForegroundPermissionsAsync().then(({ status }) => {
      if (status === 'granted') {
        Location.getCurrentPositionAsync({}).then((loc) => {
          setMyLocation({ lat: loc.coords.latitude, lon: loc.coords.longitude })
        }).catch(() => {})
      }
    })
  }, [])

  async function handleShare() {
    setSharing(true)
    try {
      const { status } = await Location.requestForegroundPermissionsAsync()
      if (status !== 'granted') {
        Alert.alert('Permissão necessária', 'Precisamos de acesso à localização.')
        setSharing(false)
        return
      }
      const loc = await Location.getCurrentPositionAsync({})
      const m = await createMomento(loc.coords.latitude, loc.coords.longitude, label || undefined)
      setMomentos((prev) => [m, ...prev])
      setMyLocation({ lat: loc.coords.latitude, lon: loc.coords.longitude })
      setLabel('')
      setShowForm(false)
    } catch {
      Alert.alert('Erro', 'Não foi possível compartilhar o momento.')
    } finally {
      setSharing(false)
    }
  }

  async function handleDelete(momentoId: string) {
    try {
      await deleteMomento(momentoId)
      setMomentos((prev) => prev.filter((m) => m.id !== momentoId))
    } catch {}
  }

  return (
    <View style={[s.container, { paddingTop: top }]}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => nav.goBack()} style={s.backBtn}>
          <Ionicons name="chevron-back" size={26} color={colors.gray800} />
        </TouchableOpacity>
        <Text style={s.title}>Momentos</Text>
        <TouchableOpacity onPress={() => setShowForm((v) => !v)}>
          <Ionicons name={showForm ? 'close' : 'add-circle-outline'} size={26} color={colors.primary} />
        </TouchableOpacity>
      </View>

      {showForm && (
        <View style={s.form}>
          <TextInput
            style={s.labelInput}
            placeholder="Label (ex: Balada, Trabalho...)"
            placeholderTextColor={colors.gray400}
            value={label}
            onChangeText={setLabel}
          />
          <TouchableOpacity
            style={[s.shareBtn, sharing && s.shareBtnDisabled]}
            onPress={handleShare}
            disabled={sharing}
            activeOpacity={0.85}
          >
            {sharing ? (
              <ActivityIndicator color={colors.white} size="small" />
            ) : (
              <>
                <Ionicons name="location" size={16} color={colors.white} />
                <Text style={s.shareBtnText}>Compartilhar Momento</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      )}

      {loading ? (
        <View style={s.center}>
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      ) : (
        <FlatList
          data={momentos}
          keyExtractor={(m) => m.id}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={s.list}
          ListEmptyComponent={
            <View style={s.center}>
              <Ionicons name="location-outline" size={56} color="rgba(255,255,255,0.15)" />
              <Text style={s.emptyText}>Nenhum momento ativo</Text>
              <Text style={s.emptySubtext}>
                Compartilhe sua localização com amigos por tempo limitado
              </Text>
            </View>
          }
          renderItem={({ item }: { item: Momento }) => {
            const isOwn = item.userId === user?.id
            const dist = myLocation
              ? calcDistance(myLocation.lat, myLocation.lon, item.latitude, item.longitude)
              : null
            return (
              <View style={s.card}>
                <AvatarImage uri={item.user.avatar} size={48} />
                <View style={s.cardBody}>
                  <Text style={s.cardName}>{item.user.name}</Text>
                  {item.label && <Text style={s.cardLabel}>{item.label}</Text>}
                  <View style={s.cardMeta}>
                    <Text style={s.cardTime}>{timeAgo(item.createdAt)}</Text>
                    {dist && (
                      <>
                        <Text style={s.metaDot}>·</Text>
                        <Ionicons name="navigate-outline" size={11} color={colors.gray400} />
                        <Text style={s.cardDist}>{dist}</Text>
                      </>
                    )}
                  </View>
                  <Text style={s.expiry}>{timeLeft(item.expiresAt)}</Text>
                </View>
                {isOwn && (
                  <TouchableOpacity
                    onPress={() => handleDelete(item.id)}
                    style={s.deleteBtn}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="trash-outline" size={18} color={colors.primary} />
                  </TouchableOpacity>
                )}
              </View>
            )
          }}
        />
      )}
    </View>
  )
}

const s = StyleSheet.create({
  container:    { flex: 1, backgroundColor: colors.white },
  header:       {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
  },
  backBtn:      { width: 36 },
  title:        { color: colors.gray800, fontFamily: fonts.bold, fontSize: 20 },
  form:         {
    marginHorizontal: spacing.md, marginBottom: spacing.md,
    backgroundColor: colors.gray100, borderRadius: radius.lg,
    padding: spacing.md, gap: spacing.sm,
  },
  labelInput:   {
    backgroundColor: colors.white, borderRadius: radius.md,
    paddingHorizontal: spacing.md, paddingVertical: 10,
    color: colors.gray800, fontFamily: fonts.regular, fontSize: 15,
    borderWidth: 1, borderColor: colors.gray200,
  },
  shareBtn:     {
    flexDirection: 'row', alignItems: 'center', gap: 8, justifyContent: 'center',
    backgroundColor: colors.primary, borderRadius: radius.full,
    paddingVertical: 12,
  },
  shareBtnDisabled: { opacity: 0.5 },
  shareBtnText: { color: colors.white, fontFamily: fonts.semiBold, fontSize: 14 },
  center:       { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md, paddingTop: 60 },
  emptyText:    { color: colors.gray800, fontFamily: fonts.semiBold, fontSize: 18 },
  emptySubtext: { color: colors.gray400, fontFamily: fonts.regular, fontSize: 13, textAlign: 'center', paddingHorizontal: 40 },
  list:         { paddingHorizontal: spacing.md, paddingTop: spacing.sm, gap: spacing.sm, paddingBottom: 40 },
  card:         {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.white, borderRadius: radius.lg,
    borderWidth: 1, borderColor: colors.gray200,
    padding: spacing.md, gap: spacing.md,
  },
  cardBody:     { flex: 1, gap: 3 },
  cardName:     { color: colors.gray800, fontFamily: fonts.semiBold, fontSize: 15 },
  cardLabel:    { color: colors.primary, fontFamily: fonts.medium, fontSize: 13 },
  cardMeta:     { flexDirection: 'row', alignItems: 'center', gap: 4 },
  cardTime:     { color: colors.gray400, fontFamily: fonts.regular, fontSize: 11 },
  metaDot:      { color: colors.gray400, fontSize: 11 },
  cardDist:     { color: colors.gray400, fontFamily: fonts.regular, fontSize: 11 },
  expiry:       { color: '#D4821A', fontFamily: fonts.regular, fontSize: 11 },
  deleteBtn:    { padding: 8 },
})
