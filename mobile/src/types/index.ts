export type MediaType = 'IMAGE' | 'VIDEO'

export type FriendshipDuration = 'ONE_DAY' | 'THREE_DAYS' | 'SEVEN_DAYS' | 'THIRTY_DAYS' | 'PERMANENT'

export interface User {
  id: string
  name: string
  phone: string
  countryCode: string
  avatar: string | null
  bio: string | null
  availability: string | null
  ghostMode: boolean
  coinBalance: number
  createdAt: string
}

export interface Post {
  id: string
  userId: string
  mediaUrl: string
  thumbnailUrl: string   // Cloudinary blurred thumbnail — tiny, loads instantly
  mediaType: MediaType
  caption: string | null
  expiresAt: string
  extended: boolean
  createdAt: string
  user: Pick<User, 'id' | 'name' | 'avatar'>
  _count: { likes: number; comments: number; shares: number; views: number }
}

export interface Comment {
  id: string
  userId: string
  postId: string
  content: string
  parentId: string | null
  createdAt: string
  user: Pick<User, 'id' | 'name' | 'avatar'>
  replies?: Comment[]
}

export interface Friendship {
  friendshipId: string
  duration: FriendshipDuration
  expiresAt: string | null
  renewedAt: string | null
  friend: Pick<User, 'id' | 'name' | 'avatar'>
}

export interface MessageReaction {
  emoji: string
  userId: string
}

export interface Message {
  id: string
  senderId: string
  receiverId: string
  content: string | null
  mediaUrl: string | null
  readAt: string | null
  replyToId: string | null
  createdAt: string
  sender: Pick<User, 'id' | 'name' | 'avatar'>
  receiver: Pick<User, 'id' | 'name' | 'avatar'>
  replyTo?: { id: string; content: string | null; sender: { name: string } } | null
  reactions?: MessageReaction[]
}

export interface ApiResponse<T> {
  success: boolean
  message: string
  data: T
}
