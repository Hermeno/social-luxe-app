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
import { StoryGroup } from '../services/story.service'
import StoryViewerScreen from '../screens/StoryViewerScreen'
import CreateStoryScreen from '../screens/CreateStoryScreen'
import GroupsScreen from '../screens/GroupsScreen'
import GroupChatScreen from '../screens/GroupChatScreen'
import CreateGroupScreen from '../screens/CreateGroupScreen'
import BookmarksScreen from '../screens/BookmarksScreen'
import SearchScreen from '../screens/SearchScreen'
import HighlightsScreen from '../screens/HighlightsScreen'
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
  StoryViewer: { groups: StoryGroup[]; startGroupIndex: number }
  CreateStory: undefined
  GroupList: undefined
  GroupChat: { groupId: string; groupName: string }
  CreateGroup: undefined
  Bookmarks: undefined
  Search: undefined
  Highlights: { userId: string }
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
  Friends: undefined
}

const Stack = createStackNavigator<AppStackParams>()
const Tab = createBottomTabNavigator<AppTabParams>()

function Tabs() {
  return (
    <Tab.Navigator tabBar={(props) => <TabBar {...props} />} screenOptions={{ headerShown: false }}>
      <Tab.Screen name="Feed" component={FeedScreen} />
      <Tab.Screen name="Messages" component={MessagesScreen} />
      <Tab.Screen name="Create" component={CreateScreen} />
      <Tab.Screen name="Friends" component={FriendsScreen} />
    </Tab.Navigator>
  )
}

export default function AppNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Tabs" component={Tabs} />
      <Stack.Screen name="Profile" component={ProfileScreen} />
      <Stack.Screen name="Chat" component={ChatScreen} />
      <Stack.Screen name="StoryViewer" component={StoryViewerScreen} />
      <Stack.Screen name="CreateStory" component={CreateStoryScreen} />
      <Stack.Screen name="GroupList" component={GroupsScreen} />
      <Stack.Screen name="GroupChat" component={GroupChatScreen} />
      <Stack.Screen name="CreateGroup" component={CreateGroupScreen} />
      <Stack.Screen name="Bookmarks" component={BookmarksScreen} />
      <Stack.Screen name="Search" component={SearchScreen} />
      <Stack.Screen name="Highlights" component={HighlightsScreen} />
      <Stack.Screen name="Challenges" component={ChallengesScreen} />
      <Stack.Screen name="Coins" component={CoinsScreen} />
      <Stack.Screen name="Momento" component={MomentoScreen} />
      <Stack.Screen name="FriendshipMap" component={FriendshipMapScreen} />
      <Stack.Screen name="Notifications" component={NotificationsScreen} />
      <Stack.Screen name="PostViewer" component={PostViewerScreen} />
    </Stack.Navigator>
  )
}
