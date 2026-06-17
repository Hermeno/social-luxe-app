import React from 'react'
import { NavigatorScreenParams } from '@react-navigation/native'
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs'
import { createStackNavigator, CardStyleInterpolators } from '@react-navigation/stack'
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
import SettingsScreen from '../screens/SettingsScreen'
import PrivacyScreen from '../screens/PrivacyScreen'
import NotifSettingsScreen from '../screens/NotifSettingsScreen'
import AppearanceScreen from '../screens/AppearanceScreen'
import LanguageScreen from '../screens/LanguageScreen'
import HelpScreen from '../screens/HelpScreen'
import StoreScreen from '../screens/StoreScreen'
import ProductDetailScreen from '../screens/ProductDetailScreen'
import CreateListingScreen from '../screens/CreateListingScreen'
import CartScreen from '../screens/CartScreen'
import MyStoreScreen from '../screens/MyStoreScreen'
import DonationsScreen from '../screens/DonationsScreen'
import CreateDonationScreen from '../screens/DonationsScreen/CreateDonationScreen'
import { Post } from '../types'
import { StoryGroup } from '../services/story.service'

export type AppTabParams = {
  Feed: undefined
  Messages: undefined
  Create: undefined
}

export type AppStackParams = {
  Tabs: NavigatorScreenParams<AppTabParams>
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
  Settings: undefined
  Privacy: undefined
  NotifSettings: undefined
  Appearance: undefined
  Language: undefined
  Help: undefined
  StoryViewer: { groups: StoryGroup[]; startGroupIndex: number }
  CreateStory: undefined
  Highlights: { userId: string }
  Store: undefined
  ProductDetail: { productId: string }
  CreateListing: undefined
  Cart: undefined
  MyStore: undefined
  Donations: undefined
  CreateDonation: undefined
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
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        // Custom interpolator: only the INCOMING card translates in from the right.
        // The background card (Feed/etc.) stays completely static — no scale, no
        // opacity change. This eliminates the black-flash on Android caused by the
        // default interpolator animating the back card.
        cardStyleInterpolator: ({ current, layouts }) => ({
          cardStyle: {
            transform: [{
              translateX: current.progress.interpolate({
                inputRange:  [0, 1],
                outputRange: [layouts.screen.width, 0],
                extrapolate: 'clamp',
              }),
            }],
          },
          overlayStyle: {
            opacity: current.progress.interpolate({
              inputRange:  [0, 1],
              outputRange: [0, 0.08],
              extrapolate: 'clamp',
            }),
          },
        }),
      }}
    >
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
      <Stack.Screen name="Settings" component={SettingsScreen} />
      <Stack.Screen name="Privacy" component={PrivacyScreen} />
      <Stack.Screen name="NotifSettings" component={NotifSettingsScreen} />
      <Stack.Screen name="Appearance" component={AppearanceScreen} />
      <Stack.Screen name="Language" component={LanguageScreen} />
      <Stack.Screen name="Help" component={HelpScreen} />
      <Stack.Screen name="Store" component={StoreScreen} />
      <Stack.Screen name="ProductDetail" component={ProductDetailScreen} />
      <Stack.Screen name="CreateListing" component={CreateListingScreen} />
      <Stack.Screen name="Cart" component={CartScreen} />
      <Stack.Screen name="MyStore" component={MyStoreScreen} />
      <Stack.Screen name="Donations" component={DonationsScreen} />
      <Stack.Screen name="CreateDonation" component={CreateDonationScreen} />
    </Stack.Navigator>
  )
}
