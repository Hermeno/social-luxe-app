import React from 'react'
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs'
import { createStackNavigator } from '@react-navigation/stack'
import FeedScreen from '../screens/FeedScreen'
import MessagesScreen from '../screens/MessagesScreen'
import CreateScreen from '../screens/CreateScreen'
import ProfileScreen from '../screens/ProfileScreen'
import ChatScreen from '../screens/MessagesScreen/ChatScreen'
import TabBar from '../components/TabBar'
import BookmarksScreen from '../screens/BookmarksScreen'
import SearchScreen from '../screens/SearchScreen'
import ChallengesScreen from '../screens/ChallengesScreen'
import CoinsScreen from '../screens/CoinsScreen'
import MomentoScreen from '../screens/MomentoScreen'
import FriendshipMapScreen from '../screens/FriendshipMapScreen'
import NotificationsScreen from '../screens/NotificationsScreen'
import PostViewerScreen from '../screens/PostViewerScreen'
import { Post } from '../types'

export type AppStackParams = {
  Tabs: undefined
  Profile: { userId?: string }
  Chat: { userId: string; userName: string; userAvatar: string | null }
  Bookmarks: undefined
  Search: undefined
  Challenges: undefined
  Coins: undefined
  Momento: undefined
  FriendshipMap: undefined
  Notifications: undefined
  PostViewer: { posts: Post[]; startIndex: number }
}

export type AppTabParams = {
  Feed: undefined
  Messages: undefined
  Create: undefined
}

const Stack = createStackNavigator<AppStackParams>()
const Tab = createBottomTabNavigator<AppTabParams>()

function Tabs() {
  return (
    <Tab.Navigator tabBar={(props) => <TabBar {...props} />} screenOptions={{ headerShown: false }}>
      <Tab.Screen name="Feed" component={FeedScreen} />
      <Tab.Screen name="Messages" component={MessagesScreen} />
      <Tab.Screen name="Create" component={CreateScreen} />
    </Tab.Navigator>
  )
}

export default function AppNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Tabs" component={Tabs} />
      <Stack.Screen name="Profile" component={ProfileScreen} />
      <Stack.Screen name="Chat" component={ChatScreen} />
      <Stack.Screen name="Bookmarks" component={BookmarksScreen} />
      <Stack.Screen name="Search" component={SearchScreen} />
      <Stack.Screen name="Challenges" component={ChallengesScreen} />
      <Stack.Screen name="Coins" component={CoinsScreen} />
      <Stack.Screen name="Momento" component={MomentoScreen} />
      <Stack.Screen name="FriendshipMap" component={FriendshipMapScreen} />
      <Stack.Screen name="Notifications" component={NotificationsScreen} />
      <Stack.Screen name="PostViewer" component={PostViewerScreen} />
    </Stack.Navigator>
  )
}
