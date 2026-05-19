import React, { useEffect } from 'react'
import { View, ActivityIndicator } from 'react-native'
import { NavigationContainer } from '@react-navigation/native'
import { useAuthStore } from '../store/auth.store'
import AuthNavigator from './AuthNavigator'
import AppNavigator from './AppNavigator'
import { colors } from '../theme'

export default function RootNavigator() {
  const { isAuthenticated, isLoading, loadUser } = useAuthStore()

  useEffect(() => { loadUser() }, [])

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.black }}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    )
  }

  return (
    <NavigationContainer>
      {isAuthenticated ? <AppNavigator /> : <AuthNavigator />}
    </NavigationContainer>
  )
}
