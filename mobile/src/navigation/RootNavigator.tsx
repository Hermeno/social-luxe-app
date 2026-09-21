import React, { useEffect, useRef } from 'react'
import { AppState, AppStateStatus, Platform, Text, StyleSheet, View } from 'react-native'
import { NavigationContainer, DefaultTheme } from '@react-navigation/native'
import Toast, { BaseToastProps } from 'react-native-toast-message'
import { ConfirmHost } from '../components/confirm'
import CircleJoinHost from '../components/CircleJoin'
import { useCircleJoinStore } from '../store/circleJoin.store'
import { toast } from '../utils/toast'
import { Ionicons } from '@expo/vector-icons'
import * as Notifications from 'expo-notifications'
import Constants from 'expo-constants'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { colors, fonts } from '../theme'
import { useAuthStore } from '../store/auth.store'
import { useOnlineStore } from '../store/online.store'
import { useFollowStore } from '../store/follow.store'
import { connectSocket, disconnectSocket, getSocket } from '../socket'
import { useSync } from '../hooks/useSync'
import { getCachedConnections, updateCachedConnection } from '../db/database'
import { useMessageBadgeStore } from '../store/messageBadge.store'
import { useNotificationStore, AppNotification } from '../store/notification.store'
import { getIncoming as getCircleIncoming } from '../services/circle.service'
import type { CircleMember, CircleRound } from '../services/circle.service'
import { isCircleScreenActive } from '../screens/CircleScreen/presence'
import { strings } from '../i18n'
import AppNavigator from './AppNavigator'
import AuthNextExperience from '../experiences/auth-next'
import GuestFeedScreen from '../screens/GuestFeedScreen'
import { useGuestStore } from '../store/guest.store'
import { api } from '../services/api'
import { Message, TogetherLivePayload } from '../types'

const CHANNEL_ID = 'messages'

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge:  true,
    shouldShowBanner: true,
    shouldShowList:   true,
  }),
})

async function ensureNotificationChannel() {
  if (Platform.OS !== 'android') return
  await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
    name: 'Mensagens',
    importance: Notifications.AndroidImportance.MAX,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: colors.heart,
    sound: 'default',
    enableVibrate: true,
    showBadge: true,
  }).catch(() => {})
}

async function registerPushToken() {
  await ensureNotificationChannel()

  const { status: existing } = await Notifications.getPermissionsAsync()
  const { status } = existing !== 'granted'
    ? await Notifications.requestPermissionsAsync()
    : { status: existing }
  if (status !== 'granted') return

  const projectId =
    (Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined)?.eas?.projectId ??
    (Constants as unknown as { easConfig?: { projectId?: string } }).easConfig?.projectId
  if (!projectId) return

  const { data: pushToken } = await Notifications.getExpoPushTokenAsync({ projectId })
  await AsyncStorage.setItem('push_token', pushToken).catch(() => {})
  await api.post('/notifications/token', { token: pushToken, platform: Platform.OS })
}

function normalizeNotification(payload: Partial<AppNotification> & Record<string, unknown>): AppNotification | null {
  if (!payload.type || typeof payload.type !== 'string') return null
  return {
    id: typeof payload.id === 'string' ? payload.id : String(Date.now()),
    type: payload.type as AppNotification['type'],
    message: typeof payload.message === 'string' ? payload.message : '',
    read: false,
    createdAt: typeof payload.createdAt === 'string' ? payload.createdAt : new Date().toISOString(),
    fromUser: payload.fromUser as AppNotification['fromUser'],
  }
}

function rememberId(seen: Set<string>, id: string, max = 200) {
  if (seen.has(id)) return false
  seen.add(id)
  if (seen.size > max) {
    const oldest = seen.values().next().value
    if (oldest) seen.delete(oldest)
  }
  return true
}

const toastConfig = {
  success: ({ text1, text2 }: BaseToastProps) => (
    <View style={ts.pill}>
      <View style={ts.iconWrap}>
        <Ionicons name="checkmark" size={16} color="#fff" />
      </View>
      <View style={ts.textWrap}>
        <Text style={ts.title}>{text1}</Text>
        {!!text2 && <Text style={ts.sub}>{text2}</Text>}
      </View>
    </View>
  ),
  error: ({ text1, text2 }: BaseToastProps) => (
    <View style={[ts.pill, ts.pillError]}>
      <View style={[ts.iconWrap, ts.iconError]}>
        <Ionicons name="close" size={16} color="#fff" />
      </View>
      <View style={ts.textWrap}>
        <Text style={ts.title}>{text1}</Text>
        {!!text2 && <Text style={ts.sub}>{text2}</Text>}
      </View>
    </View>
  ),
  info: ({ text1, text2 }: BaseToastProps) => (
    <View style={[ts.pill, ts.pillInfo]}>
      <View style={[ts.iconWrap, ts.iconInfo]}>
        <Ionicons name="information" size={16} color="#fff" />
      </View>
      <View style={ts.textWrap}>
        <Text style={ts.title}>{text1}</Text>
        {!!text2 && <Text style={ts.sub}>{text2}</Text>}
      </View>
    </View>
  ),
}

const ts = StyleSheet.create({
  pill: {
    width: '82%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#1A1A1A',
    borderRadius: 18,
    paddingHorizontal: 18,
    paddingVertical: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.22,
    shadowRadius: 20,
    elevation: 10,
  },
  pillError: { backgroundColor: '#1A1A1A' },
  pillInfo:  { backgroundColor: '#1A1A1A' },
  iconWrap: {
    width: 30, height: 30, borderRadius: 15,
    backgroundColor: colors.black,
    alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  },
  iconError: { backgroundColor: colors.error },
  iconInfo:  { backgroundColor: colors.primary },
  textWrap: { flex: 1 },
  title: {
    color: '#FFFFFF',
    fontFamily: fonts.semiBold,
    fontSize: 15,
    letterSpacing: -0.3,
  },
  sub: {
    color: 'rgba(255,255,255,0.55)',
    fontFamily: fonts.regular,
    fontSize: 13,
    marginTop: 2,
    letterSpacing: -0.1,
  },
})

interface Props {
  onboardingDone: boolean | null
  setOnboardingDone: (v: boolean) => void
  defaultTab: 'Feed' | 'Messages'
}

export default function RootNavigator({ onboardingDone, setOnboardingDone, defaultTab }: Props) {
  const { isAuthenticated, token } = useAuthStore()
  useSync()
  const guestMode  = useGuestStore((g) => g.mode)
  const leaveGuest = useGuestStore((g) => g.leaveGuest)
  const returnToGuest = useGuestStore((g) => g.returnToGuest)
  const hasGuestShowcase = useGuestStore((g) => g.posts.length > 0)
  const { setTotalUnread, increment } = useMessageBadgeStore()
  const setCircleInvite = useNotificationStore((s) => s.setCircleInvite)
  const addNotification = useNotificationStore((s) => s.addNotification)
  const seenMessageIds = useRef<Set<string>>(new Set())

  // O arranque decide-se no App.tsx (a splash espera por ele). Aqui só se larga
  // o acervo depois de haver sessão — não fica média pública em memória.
  useEffect(() => {
    if (isAuthenticated) leaveGuest()
  }, [isAuthenticated, leaveGuest])

  // Reconnect socket and refresh badge when app comes back to foreground
  useEffect(() => {
    if (!isAuthenticated || !token) return

    const sub = AppState.addEventListener('change', (state: AppStateStatus) => {
      if (state !== 'active') return
      // Reconnect socket if dropped while app was in background
      const sock = getSocket()
      if (sock && !sock.connected) sock.connect()
      else if (!sock) connectSocket(token)

      // Recalculate badge from SQLite cache (source of truth)
      getCachedConnections()
        .then((conns) => setTotalUnread(conns.reduce((s, c) => s + c.unreadCount, 0)))
        .catch(() => {})
    })

    return () => sub.remove()
  }, [isAuthenticated, token])

  // Register Expo push token when authenticated (physical devices only)
  useEffect(() => {
    if (!isAuthenticated || !token) return
    registerPushToken().catch(() => {})
  }, [isAuthenticated, token])

  // Mirror foreground push notifications into the in-app notification list.
  useEffect(() => {
    if (!isAuthenticated) return
    const sub = Notifications.addNotificationReceivedListener((notification) => {
      const data = notification.request.content.data as Record<string, unknown>
      const item = normalizeNotification({
        ...data,
        message: notification.request.content.body ?? (typeof data.message === 'string' ? data.message : undefined),
      })
      if (item) addNotification(item)
    })
    return () => sub.remove()
  }, [isAuthenticated, addNotification])

  // Connect socket when authenticated and listen to online/offline events
  useEffect(() => {
    if (!isAuthenticated || !token) {
      disconnectSocket()
      return
    }

    const socket = connectSocket(token)
    const { setOnline, setOffline } = useOnlineStore.getState()
    const myId = useAuthStore.getState().user?.id

    // Load who we follow into the global store (SQLite cache first, then API)
    useFollowStore.getState().load().catch(() => {})

    api.get('/users/connections')
      .then((r) => {
        const connections: { unreadCount: number }[] = r.data.data ?? r.data ?? []
        setTotalUnread(connections.reduce((s, c) => s + (c.unreadCount ?? 0), 0))
      })
      .catch(() => {})

    getCircleIncoming()
      .then((r) => { if (r.call) setCircleInvite(true) })
      .catch(() => {})

    const onOnlineSnapshot = ({ userIds }: { userIds: string[] }) => {
      userIds.forEach(id => setOnline(id))
    }

    const onUserOnline  = ({ userId }: { userId: string }) => setOnline(userId)
    const onUserOffline = ({ userId }: { userId: string }) => setOffline(userId)

    const onNewMessage = (msg: Message) => {
      if (!msg.senderId || msg.senderId === myId) return
      if (msg.id && !rememberId(seenMessageIds.current, msg.id)) return
      increment()
      const lastMessage = {
        id: msg.id,
        content: msg.content,
        senderId: msg.senderId,
        readAt: msg.readAt,
        createdAt: msg.createdAt,
      }
      getCachedConnections()
        .then((conns) => {
          const conn = conns.find((c) => c.user.id === msg.senderId)
          if (!conn) return
          return updateCachedConnection(msg.senderId, {
            lastMessage,
            unreadCount: conn.unreadCount + 1,
          }, { user: conn.user, postIds: conn.postIds })
        })
        .catch(() => {})
    }

    const onCircleCalled = () => setCircleInvite(true)

    // ── Alguém do círculo disparou e eu ainda não ──────────────────────────
    // A ronda dura um minuto. Com o ecrã do Círculo à frente quem avisa é a
    // faixa lá dentro; fora dele não havia aviso nenhum e o minuto passava sem
    // se dar por nada. Uma notificação por ronda — nunca duas.
    const notifiedRounds = new Set<string>()
    const onCircleUpdate = ({ currentRound, members }: {
      sessionId: string
      members?: CircleMember[]
      currentRound?: CircleRound | null
    }) => {
      if (isCircleScreenActive()) return
      if (!currentRound?.id || !Array.isArray(members)) return
      if (new Date(currentRound.expiresAt).getTime() <= Date.now()) return
      if (notifiedRounds.has(currentRound.id)) return

      const inRound = (member: CircleMember) => (member.captures ?? [])
        .some((capture) => capture.roundId === currentRound.id)
      const mine = members.find((member) => member.user.id === myId)
      if (!mine || inRound(mine)) return
      const shooter = members.find((member) => member.user.id !== myId && inRound(member))
      if (!shooter) return

      notifiedRounds.add(currentRound.id)
      const t = strings()
      const leftMs = new Date(currentRound.expiresAt).getTime() - Date.now()
      Notifications.scheduleNotificationAsync({
        content: {
          title: `⭕ ${shooter.user.name.split(' ')[0]} ${t.circle_alreadyShot}`,
          body: `${t.circle_shootTogether} · ${Math.max(1, Math.round(leftMs / 1000))}s`,
          data: { type: 'circle_shot', sessionId: currentRound.sessionId },
        },
        trigger: null,
      }).catch(() => {})
    }

    const onNotification = (payload: Partial<AppNotification> & Record<string, unknown>) => {
      const item = normalizeNotification(payload)
      if (item) addNotification(item)
    }

    // ── Entrar num Círculo depois ──────────────────────────────────────────
    // Chegou um pedido (ou alguém desistiu do seu): a lista do anfitrião vem
    // do servidor, que é quem sabe o que ainda está à espera.
    const onCircleJoinRequest = () => {
      useCircleJoinStore.getState().loadIncoming().catch(() => {})
    }
    // O anfitrião decidiu o meu pedido. Aceite, a fotografia chega à feed pelo
    // `post:updated`; aqui só se diz o que aconteceu e se liberta o botão.
    const onCircleJoinDecided = ({ momentId, accepted }: { momentId: string; accepted: boolean }) => {
      useCircleJoinStore.getState().resolveMine(momentId)
      const t = strings()
      if (accepted) toast.success(t.circleJoin_decidedAccepted)
      else toast.info(t.circleJoin_decidedDeclined)
    }

    const onUnionTogetherLive = ({ unionName, label, memberAName, memberBName }: TogetherLivePayload) => {
      Toast.show({
        type:            'success',
        text1:           `💑 ${unionName} estão juntos agora`,
        text2:           label ? `${label} · ${memberAName} & ${memberBName}` : `${memberAName} & ${memberBName}`,
        visibilityTime:  5000,
        position:        'top',
      })
    }

    socket.on('users:online:snapshot', onOnlineSnapshot)
    socket.on('user:online', onUserOnline)
    socket.on('user:offline', onUserOffline)
    socket.on('message:new', onNewMessage)
    socket.on('circle:called', onCircleCalled)
    socket.on('circle:update', onCircleUpdate)
    socket.on('notification:new', onNotification)
    socket.on('notification', onNotification)
    socket.on('union:together:live', onUnionTogetherLive)
    socket.on('circle:join-request', onCircleJoinRequest)
    socket.on('circle:join-decided', onCircleJoinDecided)
    // O estado dos pedidos à entrada: os que me esperam e os meus por decidir.
    useCircleJoinStore.getState().load().catch(() => {})

    return () => {
      socket.off('users:online:snapshot', onOnlineSnapshot)
      socket.off('user:online', onUserOnline)
      socket.off('user:offline', onUserOffline)
      socket.off('message:new', onNewMessage)
      socket.off('circle:called', onCircleCalled)
      socket.off('circle:update', onCircleUpdate)
      socket.off('notification:new', onNotification)
      socket.off('notification', onNotification)
      socket.off('union:together:live', onUnionTogetherLive)
      socket.off('circle:join-request', onCircleJoinRequest)
      socket.off('circle:join-decided', onCircleJoinDecided)
    }
  }, [isAuthenticated, token, setTotalUnread, increment, setCircleInvite, addNotification])

  // ── A porta de entrada ────────────────────────────────────────────────────
  //
  // Uma só experiência cobre a autenticação e o onboarding: são o mesmo percurso
  // para quem chega, e tê-los em dois componentes obrigava a Home a existir no
  // meio deles. O `AuthNavigator` e o `OnboardingScreen` continuam no disco,
  // intactos; deixaram de ser montados.
  const showingGuest = !isAuthenticated && guestMode === 'guest'
  const showEntry = !showingGuest && (!isAuthenticated || !onboardingDone)

  // Lido uma só vez, quando a experiência monta — é a isso que o `initialStep`
  // serve. Depois disso quem manda é o estado interno dela: registar uma conta
  // faz `isAuthenticated` virar, e se este valor voltasse a entrar o percurso
  // saltava para trás no meio do caminho.
  //
  // O arranque do módulo é saltado de propósito: o `App.tsx` já restaurou a
  // sessão antes de nos montar, e repeti-lo seria uma segunda chamada à API por
  // trás de um ecrã branco.
  const entryStep = isAuthenticated ? 'photo' : 'phone'

  return (
    <NavigationContainer theme={{ ...DefaultTheme, colors: { ...DefaultTheme.colors, background: '#0A0A0A' } }}>
      {showingGuest
        // Vitrina pública: vê-se sem conta, participa-se com ela.
        // 'checking' passa direto para a entrada normal — sem ecrã de espera:
        // se houver acervo, a troca é quase imediata; se não houver, não se
        // perdeu tempo nenhum a olhar para um spinner.
        ? <GuestFeedScreen />
        : showEntry
          ? (
            <AuthNextExperience
              initialStep={entryStep}
              // Só há para onde voltar se a vitrina tiver mesmo conteúdo. Depois
              // de terminar sessão o acervo já não está em memória, e o botão
              // levaria a um ecrã vazio.
              onExitToGuest={hasGuestShowcase ? returnToGuest : undefined}
              // A experiência só chega aqui com o onboarding mesmo concluído:
              // é o passo dos interesses que grava a marca, e os passos
              // opcionais a seguir podem ser saltados sem a desfazer.
              onComplete={() => setOnboardingDone(true)}
            />
          )
          : <AppNavigator defaultTab={defaultTab} />
      }
      {isAuthenticated && !showEntry && <CircleJoinHost />}
      <Toast config={toastConfig} position="bottom" bottomOffset={110} />
      <ConfirmHost />
    </NavigationContainer>
  )
}
