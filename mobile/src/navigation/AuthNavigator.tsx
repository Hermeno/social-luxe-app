import React from 'react'
import { createStackNavigator } from '@react-navigation/stack'
import { StatusBar } from 'expo-status-bar'
import PhoneScreen          from '../screens/auth/PhoneScreen'
import LoginPasswordScreen  from '../screens/auth/LoginPasswordScreen'
import CreatePasswordScreen from '../screens/auth/CreatePasswordScreen'
import SetNameScreen        from '../screens/auth/SetNameScreen'
import { authUi }           from '../components/AuthFlow'
import useReducedMotionPreference from '../hooks/useReducedMotionPreference'
// OTP screen — built but not reachable in v1, enabled post-investment
import OTPScreen            from '../screens/auth/OTPScreen'

export type AuthStackParams = {
  Phone:          undefined
  LoginPassword:  { phone: string; countryCode: string }
  CreatePassword: { phone: string; countryCode: string }
  SetName:        { phone: string; countryCode: string; password: string }
  OTP:            { phone: string; countryCode: string }
}

const Stack = createStackNavigator<AuthStackParams>()

export default function AuthNavigator() {
  const reduceMotion = useReducedMotionPreference()
  return (
    <>
      <StatusBar style="dark" />
      <Stack.Navigator
        screenOptions={{
          headerShown: false,
          animationEnabled: !reduceMotion,
          cardStyle: { backgroundColor: authUi.paper },
        }}
      >
        <Stack.Screen name="Phone"          component={PhoneScreen} />
        <Stack.Screen name="LoginPassword"  component={LoginPasswordScreen} />
        <Stack.Screen name="CreatePassword" component={CreatePasswordScreen} />
        <Stack.Screen name="SetName"        component={SetNameScreen} />
        {/* OTP — registered but not reachable in v1 */}
        <Stack.Screen name="OTP"            component={OTPScreen} />
      </Stack.Navigator>
    </>
  )
}
