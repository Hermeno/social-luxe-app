import React, { useEffect, useState } from 'react'
import { View, ActivityIndicator, AppState, AppStateStatus } from 'react-native'
import { NavigationContainer } from '@react-navigation/native'
import Toast from 'react-native-toast-message'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { useAuthStore } from '../store/auth.store'
import { useOnlineStore } from '../store/online.store'
import { onTokenExpired } from '../services/api'
import { connectSocket, disconnectSocket, getSocket } from '../socket'
import { useSync } from '../hooks/useSync'
import { getCachedConnections } from '../db/database'
import { useMessageBadgeStore } from '../store/messageBadge.store'
import AuthNavigator from './AuthNavigator'
import AppNavigator from './AppNavigator'
import OnboardingScreen from '../screens/OnboardingScreen'
import { colors } from '../theme'

export default function RootNavigator() {
  const { isAuthenticated, isLoading, loadUser, logout, token } = useAuthStore()
  const { online } = useSync()
  const [onboardingDone, setOnboardingDone] = useState<boolean | null>(null)
  const { setTotalUnread } = useMessageBadgeStore()

  useEffect(() => { loadUser() }, [])

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

  // Auto-logout when token expires
  useEffect(() => {
    return onTokenExpired(() => { logout() })
  }, [])

  // Connect socket when authenticated and listen to online/offline events
  useEffect(() => {
    if (!isAuthenticated || !token) {
      disconnectSocket()
      return
    }

    const socket = connectSocket(token)
    const { setOnline, setOffline } = useOnlineStore.getState()

    // Snapshot de quem já está online quando conectamos
    socket.on('users:online:snapshot', ({ userIds }: { userIds: string[] }) => {
      userIds.forEach(id => setOnline(id))
    })

    // Eventos em tempo real
    socket.on('user:online',  ({ userId }: { userId: string }) => setOnline(userId))
    socket.on('user:offline', ({ userId }: { userId: string }) => setOffline(userId))

    return () => {
      socket.off('users:online:snapshot')
      socket.off('user:online')
      socket.off('user:offline')
    }
  }, [isAuthenticated, token])

  useEffect(() => {
    if (!isAuthenticated) return
    AsyncStorage.getItem('onboarding_done')
      .then((v) => setOnboardingDone(v === '1'))
      .catch(() => setOnboardingDone(true))
  }, [isAuthenticated])

  if (isLoading || (isAuthenticated && onboardingDone === null)) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.black }}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    )
  }

  return (
    <NavigationContainer>
      {!isAuthenticated
        ? <AuthNavigator />
        : !onboardingDone
          ? <OnboardingScreen onDone={() => setOnboardingDone(true)} />
          : <AppNavigator />
      }
      <Toast />
    </NavigationContainer>
  )
}
