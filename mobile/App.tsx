import 'react-native-gesture-handler'
import * as SplashScreen from 'expo-splash-screen'
import React, { useEffect, useRef, useState } from 'react'
import { StatusBar } from 'expo-status-bar'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { useFonts } from 'expo-font'
import {
  GoogleSansFlex_400Regular,
  GoogleSansFlex_500Medium,
  GoogleSansFlex_600SemiBold,
  GoogleSansFlex_700Bold,
  GoogleSansFlex_800ExtraBold,
} from '@expo-google-fonts/google-sans-flex'
import * as Notifications from 'expo-notifications'
import * as Location from 'expo-location'
import { Image, Platform, StyleSheet, View } from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import RootNavigator from './src/navigation/RootNavigator'
import { connectSocket, disconnectSocket } from './src/socket'
import { useAuthStore } from './src/store/auth.store'
import { useI18n } from './src/i18n'
import { useNotificationStore } from './src/store/notification.store'
import { useFriendsStore } from './src/store/friends.store'
import { useMessageBadgeStore } from './src/store/messageBadge.store'
import { getMyFollowers } from './src/services/follow.service'
import { api, onTokenExpired } from './src/services/api'

// Hold the native splash screen open until we explicitly release it.
// Must be called before any rendering occurs.
SplashScreen.preventAutoHideAsync().catch(() => {})

const CHANNEL_ID  = 'messages'
const PROJECT_ID  = '19550566-94a8-4992-8d1e-25df68e87569'
const DARK        = '#0A0A0A'

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
})

async function ensureChannel() {
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

async function registerForPushNotificationsAsync(): Promise<string | null> {
  try {
    const { status: existingStatus } = await Notifications.getPermissionsAsync()
    let finalStatus = existingStatus
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync()
      finalStatus = status
    }
    if (finalStatus !== 'granted') return null
    const tokenData = await Notifications.getExpoPushTokenAsync({ projectId: PROJECT_ID })
    return tokenData.data
  } catch {
    return null
  }
}

function showMessageNotification(senderName: string, body: string, data: Record<string, unknown>) {
  Notifications.scheduleNotificationAsync({
    content: {
      title: senderName,
      body,
      data,
      sound: 'default',
      ...(Platform.OS === 'android' ? { channelId: CHANNEL_ID } : {}),
    },
    trigger: null,
  }).catch(() => {})
}

function SocketManager() {
  const { token, isAuthenticated } = useAuthStore()
  const { addNotification } = useNotificationStore()
  const { setTotalUnread, increment } = useMessageBadgeStore()
  const notifListener = useRef<ReturnType<typeof Notifications.addNotificationReceivedListener> | null>(null)

  useEffect(() => {
    if (!isAuthenticated || !token) {
      disconnectSocket()
      return
    }

    ensureChannel()

    const socket = connectSocket(token)

    api.get('/users/connections')
      .then((r) => {
        const connections: { unreadCount: number }[] = r.data.data ?? r.data ?? []
        const total = connections.reduce((s, c) => s + (c.unreadCount ?? 0), 0)
        setTotalUnread(total)
      })
      .catch(() => {})

    function onNewMessage(msg: any) {
      const myId = useAuthStore.getState().user?.id
      if (!msg.senderId || msg.senderId === myId) return
      increment()
      const senderName = msg.sender?.name ?? msg.senderName ?? 'Nova mensagem'
      const body = msg.content
        ? (msg.content.length > 80 ? msg.content.slice(0, 80) + '…' : msg.content)
        : '📎 Enviou um ficheiro'
      showMessageNotification(senderName, body, {
        type: 'message',
        senderId: msg.senderId,
        senderName,
        userAvatar: msg.sender?.avatar ?? null,
      })
    }
    socket.on('message:new', onNewMessage)

    socket.on('notification', (payload: any) => {
      addNotification({
        id: payload.id ?? String(Date.now()),
        type: payload.type,
        message: payload.message,
        read: false,
        createdAt: payload.createdAt ?? new Date().toISOString(),
      })
    })

    registerForPushNotificationsAsync().then(async (pushToken) => {
      if (pushToken) {
        await AsyncStorage.setItem('push_token', pushToken).catch(() => {})
        const platform = Platform.OS
        api.post('/notifications/token', { token: pushToken, platform }).catch(() => {})
      }
    })

    notifListener.current = Notifications.addNotificationReceivedListener((notification) => {
      const data = notification.request.content.data as any
      if (data?.type) {
        addNotification({
          id: String(Date.now()),
          type: data.type,
          message: notification.request.content.body ?? '',
          read: false,
          createdAt: new Date().toISOString(),
        })
      }
    })

    return () => {
      socket.off('message:new', onNewMessage)
      socket.off('notification')
      if (notifListener.current) {
        notifListener.current.remove()
      }
    }
  }, [isAuthenticated, token])

  return null
}

function TokenExpiryWatcher() {
  const { logout } = useAuthStore()
  useEffect(() => {
    return onTokenExpired(() => { logout() })
  }, [])
  return null
}

function LocationSync() {
  const { isAuthenticated } = useAuthStore()

  useEffect(() => {
    if (!isAuthenticated) return
    ;(async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync()
        if (status !== 'granted') return
        const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced })
        await api.put('/users/profile', {
          lat: loc.coords.latitude,
          lng: loc.coords.longitude,
        })
      } catch {}
    })()
  }, [isAuthenticated])

  return null
}

function LangInit() {
  const { init } = useI18n()
  useEffect(() => { init() }, [])
  return null
}

function FollowerPoller() {
  const { isAuthenticated } = useAuthStore()
  const { setFollowerCount } = useFriendsStore()

  useEffect(() => {
    if (!isAuthenticated) return
    const poll = async () => {
      try {
        const list = await getMyFollowers()
        setFollowerCount(list.length)
      } catch {}
    }
    poll()
    const id = setInterval(poll, 30000)
    return () => clearInterval(id)
  }, [isAuthenticated])

  return null
}

export default function App() {
  const [fontsLoaded] = useFonts({
    'Jakarta-Regular':    GoogleSansFlex_400Regular,
    'Jakarta-Medium':     GoogleSansFlex_500Medium,
    'Jakarta-SemiBold':   GoogleSansFlex_600SemiBold,
    'Jakarta-Bold':       GoogleSansFlex_700Bold,
    'Jakarta-ExtraBold':  GoogleSansFlex_800ExtraBold,
  })

  const { isLoading: authLoading, isAuthenticated, loadUser } = useAuthStore()
  const [onboardingDone, setOnboardingDone] = useState<boolean | null>(null)
  const [defaultTab, setDefaultTab] = useState<'Feed' | 'Messages' | null>(null)

  useEffect(() => { loadUser() }, [])

  useEffect(() => {
    AsyncStorage.getItem('default_tab')
      .then((v) => setDefaultTab(v === 'Messages' ? 'Messages' : 'Feed'))
      .catch(() => setDefaultTab('Feed'))
  }, [])

  useEffect(() => {
    if (!isAuthenticated) { setOnboardingDone(null); return }
    AsyncStorage.getItem('onboarding_done')
      .then((v) => setOnboardingDone(v === '1'))
      .catch(() => setOnboardingDone(true))
  }, [isAuthenticated])

  const ready =
    fontsLoaded &&
    !authLoading &&
    defaultTab !== null &&
    (!isAuthenticated || onboardingDone !== null)

  // Release the native splash only after the full app tree is painted.
  // useEffect fires post-commit, so the screen is already rendered when
  // the native splash fades — zero blank frames.
  useEffect(() => {
    if (ready) {
      SplashScreen.hideAsync().catch(() => {})
    }
  }, [ready])

  return (
    <GestureHandlerRootView style={s.root}>
      <SafeAreaProvider style={s.root}>
        <StatusBar style="light" />
        {!ready ? (
          // JS-level dark cover: visível no Expo Go (onde a splash nativa não é controlável)
          // e invisível em builds standalone (a splash nativa cobre antes do hideAsync).
          <View style={s.cover}>
            <Image
              source={require('./assets/files/luxee-splash-iphone.png')}
              style={s.splashImg}
              resizeMode="contain"
            />
          </View>
        ) : (
          <>
            <LangInit />
            <TokenExpiryWatcher />
            <SocketManager />
            <FollowerPoller />
            <LocationSync />
            <RootNavigator
              onboardingDone={onboardingDone}
              setOnboardingDone={setOnboardingDone}
              defaultTab={defaultTab ?? 'Feed'}
            />
          </>
        )}
      </SafeAreaProvider>
    </GestureHandlerRootView>
  )
}

const s = StyleSheet.create({
  root:      { flex: 1, backgroundColor: DARK },
  cover:     { flex: 1, backgroundColor: DARK, alignItems: 'center', justifyContent: 'center' },
  splashImg: { width: '100%', height: '100%' },
})
