import 'react-native-gesture-handler'
import React, { useEffect, useRef } from 'react'
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
import { Platform, View, Image } from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import RootNavigator from './src/navigation/RootNavigator'
import { connectSocket, disconnectSocket } from './src/socket'
import { useAuthStore } from './src/store/auth.store'
import { useNotificationStore } from './src/store/notification.store'
import { useFriendsStore } from './src/store/friends.store'
import { useMessageBadgeStore } from './src/store/messageBadge.store'
import { getMyFollowers } from './src/services/follow.service'
import { api, onTokenExpired } from './src/services/api'

const CHANNEL_ID  = 'messages'
const PROJECT_ID  = '19550566-94a8-4992-8d1e-25df68e87569'

// Show alerts even when the app is in the foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
})

// Android 8+ requires a notification channel or notifications are silently dropped
async function ensureChannel() {
  if (Platform.OS !== 'android') return
  await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
    name: 'Mensagens',
    importance: Notifications.AndroidImportance.MAX,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: '#4C8CE4',
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
    // projectId is required for standalone APK builds
    const tokenData = await Notifications.getExpoPushTokenAsync({ projectId: PROJECT_ID })
    return tokenData.data
  } catch {
    return null
  }
}

function showMessageNotification(senderName: string, body: string, data: object) {
  Notifications.scheduleNotificationAsync({
    content: {
      title: senderName,
      body,
      data,
      sound: 'default',
      ...(Platform.OS === 'android' ? { channelId: CHANNEL_ID } : {}),
    },
    trigger: null, // show immediately
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

    // ── Load initial unread count immediately on login ──────────────
    api.get('/users/connections')
      .then((r) => {
        const connections: { unreadCount: number }[] = r.data.data ?? r.data ?? []
        const total = connections.reduce((s, c) => s + (c.unreadCount ?? 0), 0)
        setTotalUnread(total)
      })
      .catch(() => {})

    // ── Real-time: increment badge + local notification for incoming messages ──
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

// Auto-logout when server returns 401 (expired token)
function TokenExpiryWatcher() {
  const { logout } = useAuthStore()
  useEffect(() => {
    return onTokenExpired(() => { logout() })
  }, [])
  return null
}

// Sends device location to backend once after login (for proximity feed)
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

// Polls followers every 30s to detect new followers and update badge
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
    'Jakarta-Regular': GoogleSansFlex_400Regular,
    'Jakarta-Medium': GoogleSansFlex_500Medium,
    'Jakarta-SemiBold': GoogleSansFlex_600SemiBold,
    'Jakarta-Bold': GoogleSansFlex_700Bold,
    'Jakarta-ExtraBold': GoogleSansFlex_800ExtraBold,
  })

  if (!fontsLoaded) {
    return (
      <View style={{ flex: 1, backgroundColor: '#4C8CE4', justifyContent: 'center', alignItems: 'center' }}>
        <Image
          source={require('./assets/splash-logo.png')}
          style={{ width: 160, height: 160, resizeMode: 'contain' }}
        />
      </View>
    )
  }

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: '#4C8CE4' }}>
      <SafeAreaProvider>
        <StatusBar style="light" />
        <TokenExpiryWatcher />
        <SocketManager />
        <FollowerPoller />
        <LocationSync />
        <RootNavigator />
      </SafeAreaProvider>
    </GestureHandlerRootView>
  )
}
