import React, { useEffect, useRef } from 'react'
import { AppState, AppStateStatus, Platform, Text, StyleSheet, View } from 'react-native'
import { NavigationContainer, DefaultTheme } from '@react-navigation/native'
import Toast, { BaseToastProps } from 'react-native-toast-message'
import { ConfirmHost } from '../components/confirm'
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
import AuthNavigator from './AuthNavigator'
import AppNavigator from './AppNavigator'
import OnboardingScreen from '../screens/OnboardingScreen'
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
    lightColor: '#CA2851',
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
  pillError: { backgroundColor: '#1A0800' },
  pillInfo:  { backgroundColor: '#0A1628' },
  iconWrap: {
    width: 30, height: 30, borderRadius: 15,
    backgroundColor: '#22C55E',
    alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  },
  iconError: { backgroundColor: '#EF4444' },
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

    const onNotification = (payload: Partial<AppNotification> & Record<string, unknown>) => {
      const item = normalizeNotification(payload)
      if (item) addNotification(item)
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
    socket.on('notification:new', onNotification)
    socket.on('notification', onNotification)
    socket.on('union:together:live', onUnionTogetherLive)

    return () => {
      socket.off('users:online:snapshot', onOnlineSnapshot)
      socket.off('user:online', onUserOnline)
      socket.off('user:offline', onUserOffline)
      socket.off('message:new', onNewMessage)
      socket.off('circle:called', onCircleCalled)
      socket.off('notification:new', onNotification)
      socket.off('notification', onNotification)
      socket.off('union:together:live', onUnionTogetherLive)
    }
  }, [isAuthenticated, token, setTotalUnread, increment, setCircleInvite, addNotification])

  return (
    <NavigationContainer theme={{ ...DefaultTheme, colors: { ...DefaultTheme.colors, background: '#0A0A0A' } }}>
      {!isAuthenticated
        ? guestMode === 'guest'
          // Vitrina pública: vê-se sem conta, participa-se com ela.
          ? <GuestFeedScreen />
          // 'checking' passa direto para a entrada normal — sem ecrã de espera:
          // se houver acervo, a troca é quase imediata; se não houver, não se
          // perdeu tempo nenhum a olhar para um spinner.
          : <AuthNavigator />
        : !onboardingDone
          ? <OnboardingScreen onDone={() => setOnboardingDone(true)} />
          : <AppNavigator defaultTab={defaultTab} />
      }
      <Toast config={toastConfig} position="bottom" bottomOffset={110} />
      <ConfirmHost />
    </NavigationContainer>
  )
}
