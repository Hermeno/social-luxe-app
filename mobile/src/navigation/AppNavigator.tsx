import React from 'react'
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs'
import { createStackNavigator } from '@react-navigation/stack'
import FeedScreen from '../screens/FeedScreen'
import MessagesScreen from '../screens/MessagesScreen'
import CreateScreen from '../screens/CreateScreen'
import ProfileScreen from '../screens/ProfileScreen'
import ChatScreen from '../screens/MessagesScreen/ChatScreen'
// COMMUNITY BLOCKED FOR LAUNCH
// import GroupChatScreen from '../screens/GroupChatScreen'
// import CreateGroupScreen from '../screens/CreateGroupScreen'
import TabBar from '../components/TabBar'
import BookmarksScreen from '../screens/BookmarksScreen'
import ChallengesScreen from '../screens/ChallengesScreen'
import CoinsScreen from '../screens/CoinsScreen'
import MomentoScreen from '../screens/MomentoScreen'
import NotificationsScreen from '../screens/NotificationsScreen'
import PostViewerScreen from '../screens/PostViewerScreen'
import EditProfileScreen from '../screens/EditProfileScreen'
import StoryViewerScreen from '../screens/StoryViewerScreen'
import CreateStoryScreen from '../screens/CreateStoryScreen'
import HighlightsScreen from '../screens/HighlightsScreen'
import AboutScreen from '../screens/AboutScreen'
import VerifiedScreen from '../screens/VerifiedScreen'
import { Post } from '../types'
import { StoryGroup } from '../services/story.service'

export type AppStackParams = {
  Tabs: undefined
  Profile: { userId?: string }
  Chat: { userId: string; userName: string; userAvatar: string | null }
  About: undefined
  Verified: undefined
  // COMMUNITY BLOCKED FOR LAUNCH
  // GroupChat: { groupId: string; groupName: string; groupAvatar?: string | null }
  // CreateGroup: undefined
  GroupChat: { groupId: string; groupName: string; groupAvatar?: string | null }
  CreateGroup: undefined
  Bookmarks: undefined
  Challenges: undefined
  Coins: undefined
  Momento: undefined
  Notifications: undefined
  PostViewer: { posts: Post[]; startIndex: number }
  EditProfile: undefined
  StoryViewer: { groups: StoryGroup[]; startGroupIndex: number }
  CreateStory: undefined
  Highlights: { userId: string }
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
      {/* COMMUNITY BLOCKED FOR LAUNCH
      <Stack.Screen name="GroupChat" component={GroupChatScreen} />
      <Stack.Screen name="CreateGroup" component={CreateGroupScreen} />
      */}
      <Stack.Screen name="Bookmarks" component={BookmarksScreen} />
      <Stack.Screen name="Challenges" component={ChallengesScreen} />
      <Stack.Screen name="Coins" component={CoinsScreen} />
      <Stack.Screen name="Momento" component={MomentoScreen} />
      <Stack.Screen name="Notifications" component={NotificationsScreen} />
      <Stack.Screen name="PostViewer" component={PostViewerScreen} />
      <Stack.Screen name="EditProfile" component={EditProfileScreen} />
      <Stack.Screen name="StoryViewer" component={StoryViewerScreen} />
      <Stack.Screen name="CreateStory" component={CreateStoryScreen} />
      <Stack.Screen name="Highlights" component={HighlightsScreen} />
      <Stack.Screen name="About" component={AboutScreen} />
      <Stack.Screen name="Verified" component={VerifiedScreen} />
    </Stack.Navigator>
  )
}
