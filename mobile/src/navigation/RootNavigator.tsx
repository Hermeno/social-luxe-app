import React, { useEffect, useState } from 'react'
import { View, ActivityIndicator } from 'react-native'
import { NavigationContainer } from '@react-navigation/native'
import Toast from 'react-native-toast-message'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { useAuthStore } from '../store/auth.store'
import AuthNavigator from './AuthNavigator'
import AppNavigator from './AppNavigator'
import OnboardingScreen from '../screens/OnboardingScreen'
import { colors } from '../theme'

export default function RootNavigator() {
  const { isAuthenticated, isLoading, loadUser } = useAuthStore()
  const [onboardingDone, setOnboardingDone] = useState<boolean | null>(null)

  useEffect(() => { loadUser() }, [])

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
