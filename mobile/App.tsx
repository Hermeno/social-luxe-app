import 'react-native-gesture-handler'
import React, { useEffect, useRef } from 'react'
import { StatusBar } from 'expo-status-bar'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { useFonts } from 'expo-font'
import {
  PlusJakartaSans_400Regular,
  PlusJakartaSans_500Medium,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
  PlusJakartaSans_800ExtraBold,
} from '@expo-google-fonts/plus-jakarta-sans'
import * as Notifications from 'expo-notifications'
import * as Location from 'expo-location'
import AsyncStorage from '@react-native-async-storage/async-storage'
import RootNavigator from './src/navigation/RootNavigator'
import { connectSocket, disconnectSocket } from './src/socket'
import { useAuthStore } from './src/store/auth.store'
import { useNotificationStore } from './src/store/notification.store'
import { useFriendsStore } from './src/store/friends.store'
import { getMyFollowers } from './src/services/follow.service'
import { api, onTokenExpired } from './src/services/api'

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
})

async function registerForPushNotificationsAsync(): Promise<string | null> {
  try {
    const { status: existingStatus } = await Notifications.getPermissionsAsync()
    let finalStatus = existingStatus
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync()
      finalStatus = status
    }
    if (finalStatus !== 'granted') return null
    const tokenData = await Notifications.getExpoPushTokenAsync()
    return tokenData.data
  } catch {
    return null
  }
}

function SocketManager() {
  const { token, isAuthenticated } = useAuthStore()
  const { addNotification } = useNotificationStore()
  const notifListener = useRef<ReturnType<typeof Notifications.addNotificationReceivedListener> | null>(null)

  useEffect(() => {
    if (!isAuthenticated || !token) {
      disconnectSocket()
      return
    }

    const socket = connectSocket(token)

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
        // Register token in backend so server can send pushes
        const platform = require('react-native').Platform.OS
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
    'Jakarta-Regular': PlusJakartaSans_400Regular,
    'Jakarta-Medium': PlusJakartaSans_500Medium,
    'Jakarta-SemiBold': PlusJakartaSans_600SemiBold,
    'Jakarta-Bold': PlusJakartaSans_700Bold,
    'Jakarta-ExtraBold': PlusJakartaSans_800ExtraBold,
  })

  if (!fontsLoaded) return null

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
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
