import React, { useEffect, useState } from 'react'
import {
  View,
  Text,
  FlatList,
  Image,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  ActivityIndicator,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useNavigation } from '@react-navigation/native'
import { StackNavigationProp } from '@react-navigation/stack'
import { LinearGradient } from 'expo-linear-gradient'
import { Ionicons } from '@expo/vector-icons'
import { getActiveChallenges, Challenge } from '../../services/challenge.service'
import { AppStackParams } from '../../navigation/AppNavigator'
import { colors, fonts, spacing, radius } from '../../theme'

type Nav = StackNavigationProp<AppStackParams>

const { width } = Dimensions.get('window')
const API_BASE = 'http://192.168.43.184:3000'

function timeLeft(endsAt: string) {
  const diff = new Date(endsAt).getTime() - Date.now()
  if (diff <= 0) return 'Encerrado'
  const h = Math.floor(diff / 3600000)
  if (h < 24) return `Encerra em ${h}h`
  return `Encerra em ${Math.floor(h / 24)}d`
}

export default function ChallengesScreen() {
  const nav = useNavigation<Nav>()
  const { top } = useSafeAreaInsets()
  const [challenges, setChallenges] = useState<Challenge[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getActiveChallenges()
      .then(setChallenges)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  function handleParticipate(challenge: Challenge) {
    nav.navigate('Create' as any, { challengeHashtag: `#${challenge.hashtag}` })
  }

  return (
    <View style={[s.container, { paddingTop: top }]}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => nav.goBack()} style={s.backBtn}>
          <Ionicons name="chevron-back" size={26} color={colors.gray800} />
        </TouchableOpacity>
        <Text style={s.title}>Desafios</Text>
        <View style={{ width: 36 }} />
      </View>

      {loading ? (
        <View style={s.center}>
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      ) : (
        <FlatList
          data={challenges}
          keyExtractor={(c) => c.id}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={s.list}
          ListEmptyComponent={
            <View style={s.center}>
              <Ionicons name="trophy-outline" size={56} color="rgba(255,255,255,0.15)" />
              <Text style={s.emptyText}>Nenhum desafio ativo</Text>
            </View>
          }
          renderItem={({ item }: { item: Challenge }) => {
            const coverUri = item.coverUrl
              ? item.coverUrl.startsWith('http') ? item.coverUrl : `${API_BASE}${item.coverUrl}`
              : null
            return (
              <View style={s.card}>
                {coverUri ? (
                  <Image source={{ uri: coverUri }} style={s.cardBg} resizeMode="cover" />
                ) : (
                  <LinearGradient
                    colors={['#1a0010', '#FF4B6E']}
                    style={s.cardBg}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                  />
                )}
                <LinearGradient
                  colors={['transparent', 'rgba(0,0,0,0.88)']}
                  style={s.cardOverlay}
                />
                <View style={s.cardContent}>
                  <View style={s.hashtagPill}>
                    <Text style={s.hashtagText}>#{item.hashtag}</Text>
                  </View>
                  <Text style={s.cardTitle}>{item.title}</Text>
                  <Text style={s.cardDesc} numberOfLines={2}>{item.description}</Text>
                  <View style={s.cardFooter}>
                    <View style={s.timerRow}>
                      <Ionicons name="timer-outline" size={13} color="rgba(255,255,255,0.6)" />
                      <Text style={s.timerText}>{timeLeft(item.endsAt)}</Text>
                    </View>
                    <TouchableOpacity
                      style={s.participateBtn}
                      onPress={() => handleParticipate(item)}
                      activeOpacity={0.85}
                    >
                      <Text style={s.participateText}>Participar</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            )
          }}
        />
      )}
    </View>
  )
}

const s = StyleSheet.create({
  container:      { flex: 1, backgroundColor: colors.white },
  header:         {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
  },
  backBtn:        { width: 36 },
  title:          { color: colors.gray800, fontFamily: fonts.bold, fontSize: 20 },
  center:         { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md, paddingTop: 80 },
  emptyText:      { color: colors.gray400, fontFamily: fonts.medium, fontSize: 16 },
  list:           { padding: spacing.md, gap: spacing.md },
  card:           {
    borderRadius: radius.lg, overflow: 'hidden', height: 220,
    backgroundColor: '#1A1A1A',
  },
  cardBg:         { ...StyleSheet.absoluteFillObject },
  cardOverlay:    { ...StyleSheet.absoluteFillObject },
  cardContent:    {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    padding: spacing.md, gap: 6,
  },
  hashtagPill:    {
    alignSelf: 'flex-start',
    backgroundColor: colors.primary,
    borderRadius: radius.full,
    paddingHorizontal: 10, paddingVertical: 3,
  },
  hashtagText:    { color: colors.white, fontFamily: fonts.semiBold, fontSize: 11 },
  cardTitle:      { color: colors.white, fontFamily: fonts.bold, fontSize: 18 },
  cardDesc:       { color: 'rgba(255,255,255,0.65)', fontFamily: fonts.regular, fontSize: 13 },
  cardFooter:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 },
  timerRow:       { flexDirection: 'row', alignItems: 'center', gap: 4 },
  timerText:      { color: 'rgba(255,255,255,0.6)', fontFamily: fonts.regular, fontSize: 12 },
  participateBtn: {
    backgroundColor: colors.primary, borderRadius: radius.full,
    paddingHorizontal: 18, paddingVertical: 8,
  },
  participateText:{ color: colors.white, fontFamily: fonts.semiBold, fontSize: 13 },
})
