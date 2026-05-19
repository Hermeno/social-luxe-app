import React from 'react'
import { createStackNavigator } from '@react-navigation/stack'
import PhoneEntryScreen from '../screens/auth/PhoneEntryScreen'
import LoginPasswordScreen from '../screens/auth/LoginPasswordScreen'
import RegisterDetailsScreen from '../screens/auth/RegisterDetailsScreen'

export type AuthStackParams = {
  PhoneEntry:      { mode: 'login' | 'register' }
  LoginPassword:   { phone: string; countryCode: string }
  RegisterDetails: { phone: string; countryCode: string }
}

const Stack = createStackNavigator<AuthStackParams>()

export default function AuthNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="PhoneEntry"      component={PhoneEntryScreen} initialParams={{ mode: 'login' }} />
      <Stack.Screen name="LoginPassword"   component={LoginPasswordScreen} />
      <Stack.Screen name="RegisterDetails" component={RegisterDetailsScreen} />
    </Stack.Navigator>
  )
}
