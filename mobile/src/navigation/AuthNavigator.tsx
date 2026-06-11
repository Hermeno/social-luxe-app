import React from 'react'
import { createStackNavigator } from '@react-navigation/stack'
import PhoneScreen          from '../screens/auth/PhoneScreen'
import LoginPasswordScreen  from '../screens/auth/LoginPasswordScreen'
import CreatePasswordScreen from '../screens/auth/CreatePasswordScreen'
import SetNameScreen        from '../screens/auth/SetNameScreen'
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
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        cardStyle: { backgroundColor: '#fff' },
        cardStyleInterpolator: ({ current, layouts }) => ({
          cardStyle: {
            transform: [{
              translateX: current.progress.interpolate({
                inputRange: [0, 1],
                outputRange: [layouts.screen.width * 0.1, 0],
              }),
            }],
            opacity: current.progress.interpolate({
              inputRange: [0, 0.4, 1],
              outputRange: [0, 0.8, 1],
            }),
          },
        }),
      }}
    >
      <Stack.Screen name="Phone"          component={PhoneScreen} />
      <Stack.Screen name="LoginPassword"  component={LoginPasswordScreen} />
      <Stack.Screen name="CreatePassword" component={CreatePasswordScreen} />
      <Stack.Screen name="SetName"        component={SetNameScreen} />
      {/* OTP — registered but not reachable in v1 */}
      <Stack.Screen name="OTP"            component={OTPScreen} />
    </Stack.Navigator>
  )
}
