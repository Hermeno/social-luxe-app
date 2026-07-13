import React from 'react'
import { NavigatorScreenParams } from '@react-navigation/native'
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs'
import { createStackNavigator, CardStyleInterpolators } from '@react-navigation/stack'
import FeedScreen from '../screens/FeedScreen'
import MessagesScreen from '../screens/MessagesScreen'
import CreateScreen from '../screens/CreateScreen'
import ProfileScreen from '../screens/ProfileScreen'
import ChatScreen from '../screens/MessagesScreen/ChatScreen'
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
import ChangePasswordScreen from '../screens/ChangePasswordScreen'
import BlockedUsersScreen from '../screens/BlockedUsersScreen'
import NotifSettingsScreen from '../screens/NotifSettingsScreen'
import AppearanceScreen from '../screens/AppearanceScreen'
import LanguageScreen from '../screens/LanguageScreen'
import HelpScreen from '../screens/HelpScreen'
import CircleScreen from '../screens/CircleScreen'
import DonationsScreen from '../screens/DonationsScreen'
import CreateDonationScreen from '../screens/DonationsScreen/CreateDonationScreen'
import DonationDetailScreen from '../screens/DonationsScreen/DonationDetailScreen'
import UnionProfileScreen from '../screens/UnionProfileScreen'
import UnionChatScreen from '../screens/UnionChatScreen'
import { Post } from '../types'
import { StoryGroup } from '../services/story.service'

export type AppTabParams = {
  Feed: undefined
  Messages: undefined
  Create: undefined          // accessed via FeedHeader / ChallengesScreen, not shown in tab bar
  Circle: undefined
  Profile: { userId?: string }
}

export type AppStackParams = {
  Tabs: NavigatorScreenParams<AppTabParams>
  Profile: { userId?: string }
  Chat: { userId: string; userName: string; userAvatar: string | null; partnerHasPosts?: boolean }
  About: undefined
  Verified: undefined
  Bookmarks: undefined
  Challenges: undefined
  Coins: undefined
  Momento: undefined
  Notifications: undefined
  PostViewer: { posts: Post[]; startIndex: number }
  EditProfile: undefined
  Settings: undefined
  Privacy: undefined
  ChangePassword: undefined
  BlockedUsers: undefined
  NotifSettings: undefined
  Appearance: undefined
  Language: undefined
  Help: undefined
  StoryViewer: { groups: StoryGroup[]; startGroupIndex: number }
  CreateStory: undefined
  Highlights: { userId: string }
  Donations: undefined
  CreateDonation: undefined
  DonationDetail: { donationId: string }
  UnionProfile: { unionId: string }
  UnionChat: { unionId: string; otherUnionId?: string; unionName?: string }
}

const Stack = createStackNavigator<AppStackParams>()
const Tab = createBottomTabNavigator<AppTabParams>()

function Tabs({ defaultTab }: { defaultTab: 'Feed' | 'Messages' }) {
  return (
    <Tab.Navigator
      initialRouteName={defaultTab}
      tabBar={(props) => <TabBar {...props} />}
      screenOptions={{ headerShown: false, tabBarStyle: { position: 'absolute' } }}
    >
      <Tab.Screen name="Feed"      component={FeedScreen} />
      <Tab.Screen name="Messages"  component={MessagesScreen} />
      <Tab.Screen name="Create"    component={CreateScreen} />
      <Tab.Screen name="Circle"    component={CircleScreen} />
      <Tab.Screen name="Profile"   component={ProfileScreen} />
    </Tab.Navigator>
  )
}

export default function AppNavigator({ defaultTab }: { defaultTab: 'Feed' | 'Messages' }) {
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
      <Stack.Screen name="Tabs">{() => <Tabs defaultTab={defaultTab} />}</Stack.Screen>
      <Stack.Screen name="Profile" component={ProfileScreen} />
      <Stack.Screen name="Chat" component={ChatScreen} />
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
      <Stack.Screen name="ChangePassword" component={ChangePasswordScreen} />
      <Stack.Screen name="BlockedUsers" component={BlockedUsersScreen} />
      <Stack.Screen name="NotifSettings" component={NotifSettingsScreen} />
      <Stack.Screen name="Appearance" component={AppearanceScreen} />
      <Stack.Screen name="Language" component={LanguageScreen} />
      <Stack.Screen name="Help" component={HelpScreen} />
      <Stack.Screen name="Donations" component={DonationsScreen} />
      <Stack.Screen name="CreateDonation" component={CreateDonationScreen} />
      <Stack.Screen name="DonationDetail" component={DonationDetailScreen} />
      <Stack.Screen name="UnionProfile" component={UnionProfileScreen} />
      <Stack.Screen name="UnionChat" component={UnionChatScreen} />
    </Stack.Navigator>
  )
}
