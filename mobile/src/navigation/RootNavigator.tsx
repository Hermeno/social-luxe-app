import React, { useEffect } from 'react'
import { AppState, AppStateStatus, Text, StyleSheet, View } from 'react-native'
import { NavigationContainer, DefaultTheme } from '@react-navigation/native'
import Toast, { BaseToastProps } from 'react-native-toast-message'
import { Ionicons } from '@expo/vector-icons'
import { colors, fonts } from '../theme'
import { useAuthStore } from '../store/auth.store'
import { useOnlineStore } from '../store/online.store'
import { connectSocket, disconnectSocket, getSocket } from '../socket'
import { useSync } from '../hooks/useSync'
import { getCachedConnections } from '../db/database'
import { useMessageBadgeStore } from '../store/messageBadge.store'
import AuthNavigator from './AuthNavigator'
import AppNavigator from './AppNavigator'
import OnboardingScreen from '../screens/OnboardingScreen'

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
  const { online } = useSync()
  const { setTotalUnread } = useMessageBadgeStore()

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

  return (
    <NavigationContainer theme={{ ...DefaultTheme, colors: { ...DefaultTheme.colors, background: '#0A0A0A' } }}>
      {!isAuthenticated
        ? <AuthNavigator />
        : !onboardingDone
          ? <OnboardingScreen onDone={() => setOnboardingDone(true)} />
          : <AppNavigator defaultTab={defaultTab} />
      }
      <Toast config={toastConfig} position="bottom" bottomOffset={110} />
    </NavigationContainer>
  )
}
