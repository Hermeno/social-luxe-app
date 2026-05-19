import React from 'react'
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs'
import { createStackNavigator } from '@react-navigation/stack'
import FeedScreen from '../screens/FeedScreen'
import MessagesScreen from '../screens/MessagesScreen'
import CreateScreen from '../screens/CreateScreen'
import ProfileScreen from '../screens/ProfileScreen'
import FriendsScreen from '../screens/FriendsScreen'
import ChatScreen from '../screens/MessagesScreen/ChatScreen'
import TabBar from '../components/TabBar'

export type AppStackParams = {
  Tabs:    undefined
  Profile: { userId?: string }
  Chat:    { userId: string; userName: string; userAvatar: string | null }
}

export type AppTabParams = {
  Feed:     undefined
  Messages: undefined
  Create:   undefined
  Friends:  undefined
}

const Stack = createStackNavigator<AppStackParams>()
const Tab   = createBottomTabNavigator<AppTabParams>()

function Tabs() {
  return (
    <Tab.Navigator tabBar={(props) => <TabBar {...props} />} screenOptions={{ headerShown: false }}>
      <Tab.Screen name="Feed"     component={FeedScreen} />
      <Tab.Screen name="Messages" component={MessagesScreen} />
      <Tab.Screen name="Create"   component={CreateScreen} />
      <Tab.Screen name="Friends"  component={FriendsScreen} />
    </Tab.Navigator>
  )
}

export default function AppNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Tabs"    component={Tabs} />
      <Stack.Screen name="Profile" component={ProfileScreen} />
      <Stack.Screen name="Chat"    component={ChatScreen} />
    </Stack.Navigator>
  )
}
