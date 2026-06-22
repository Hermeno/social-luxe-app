export type MediaType = 'IMAGE' | 'VIDEO'

export interface User {
  id: string
  name: string
  phone: string
  countryCode: string
  avatar: string | null
  bio: string | null
  availability: string | null
  ghostMode: boolean
  viewsPublic: boolean
  coinBalance: number
  createdAt: string
  contact?: string | null
  defaultFollowDuration?: string | null
  relationshipStatus?: string | null
  partnerName?: string | null
  partnerId?: string | null
  city?: string | null
  district?: string | null
  autoReply?: string | null
  showDevice?: boolean
  statusLabel?: string | null
  isAdmin?: boolean
  lastSeen?: string | null
}

export interface PostSticker {
  id: string
  type: 'emoji' | 'message' | 'gift'
  emoji: string
  content?: string
  x: number
  y: number
  user: Pick<User, 'id' | 'name' | 'avatar'>
  likeCount?: number
  myLike?: boolean
  viewCount?: number
}

// ── Travel Posts ──────────────────────────────────────────────────────────────
export interface TravelNode {
  id:                 string
  countryCode:        string
  countryName:        string
  views:              number
  likes:              number
  comments:           number
  objectsAdded:       number
  firstInteractionAt: string
  lastInteractionAt:  string
}

export interface TravelObject {
  id:          string
  type:        'emoji' | 'sticker'
  value:       string
  countryCode: string
  createdAt:   string
  user:        Pick<User, 'id' | 'name' | 'avatar'>
}

export interface TravelStats {
  totalCountries:    number
  totalViews:        number
  totalLikes:        number
  totalComments:     number
  totalObjects:      number
  lastCountry:       { code: string; name: string } | null
  mostActiveCountry: { code: string; name: string } | null
}

export interface TravelData {
  nodes:   TravelNode[]
  objects: TravelObject[]
  stats:   TravelStats
}

export interface Post {
  id: string
  userId: string
  mediaUrl: string | null
  thumbnailUrl: string
  mediaType: 'IMAGE' | 'VIDEO' | 'TEXT'
  caption: string | null
  bgColor: string | null
  expiresAt: string
  extended: boolean
  deviceModel?: string | null
  createdAt: string
  partnerUserId?: string | null
  partnerAccepted?: boolean
  partnerUser?: { id: string; name: string; avatar: string | null } | null
  isAnnouncement?: boolean
  stickersEnabled?: boolean
  isTravelEnabled?: boolean
  user: Pick<User, 'id' | 'name' | 'avatar' | 'viewsPublic' | 'showDevice' | 'statusLabel' | 'lastSeen'>
  _count: { likes: number; comments: number; shares: number; views: number }
  recentCommenters?: Array<{ id: string; name: string; avatar: string | null }>
  stickers?: PostSticker[]
  hasVotedExtend?: boolean
  userLiked?: boolean
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

export interface Connection {
  user: Pick<User, 'id' | 'name' | 'avatar'>
  lastMessage: {
    id: string
    content: string | null
    senderId: string
    readAt: string | null
    createdAt: string
  } | null
  unreadCount: number
  postIds: string[]
}

export interface ApiResponse<T> {
  success: boolean
  message: string
  data: T
}

export type FriendshipDuration = 'ONE_DAY' | 'THREE_DAYS' | 'SEVEN_DAYS' | 'THIRTY_DAYS' | 'PERMANENT'

export interface Friendship {
  id: string
  friendshipId: string
  userAId: string
  userBId: string
  duration: FriendshipDuration
  expiresAt: string | null
  renewedAt: string | null
  createdAt: string
  friend: Pick<User, 'id' | 'name' | 'avatar'>
  userA?: Pick<User, 'id' | 'name' | 'avatar'>
  userB?: Pick<User, 'id' | 'name' | 'avatar'>
}
