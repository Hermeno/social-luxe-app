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
  city?: string | null
  district?: string | null
  autoReply?: string | null
  showDevice?: boolean
  statusLabel?: string | null
  interests?: string[]
  isAdmin?: boolean
  lastSeen?: string | null
  // Conta profissional / comercial
  accountType?: 'PERSONAL' | 'PROFESSIONAL'
  businessCategory?: string | null
  businessAddress?: string | null
  businessHours?: unknown          // 7 entradas; normalizeHours() dá-lhe forma
  whatsapp?: string | null
  profileActions?: string[]
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

export interface Post {
  id: string
  userId: string
  mediaUrl: string | null
  mediaUrls?: string[]        // álbum: 2+ fotos mostradas em grelha
  albumOverlays?: { emoji: string; x: number; y: number }[][]   // emojis por foto do álbum
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

// ── União (Duo Profile) ───────────────────────────────────────────────────────

export type UnionInviteStatus = 'PENDING' | 'ACCEPTED' | 'REJECTED'

export interface TogetherStatus {
  unionId:        string
  bothPresent:    boolean
  memberConsents: Record<string, boolean>
  visibility:     'private' | 'public'
}

export interface TogetherLivePayload {
  unionId:     string
  unionName:   string
  label:       string | null
  memberAName: string
  memberBName: string
}

// ── Pairing — persistent relationship tag between two users ──────────────────

export type PairingType = 'AMIGOS' | 'AMORES' | 'IRMAOS' | 'BESTS' | 'BONITONAS' | 'GEMEAS' | 'OUTRO'
export type PairingStatus = 'PENDING' | 'ACTIVE' | 'ENDED'

export interface Pairing {
  id:          string
  type:        PairingType
  customLabel: string | null
  status:      PairingStatus
  requestedBy: string
  createdAt:   string
  respondedAt: string | null
  endedAt:     string | null
  userA: { id: string; name: string; avatar: string | null }
  userB: { id: string; name: string; avatar: string | null }
}

export interface UnionMember {
  id:     string
  name:   string
  avatar: string | null
}

export interface Union {
  id:        string
  name:      string
  avatar:    string | null
  label:     string | null
  bio:       string | null
  memberA:   UnionMember
  memberB:   UnionMember
  createdAt: string
}

export interface UnionInvite {
  id:          string
  fromUnion:   Union
  toUserId:    string
  status:      UnionInviteStatus
  createdAt:   string
}

export interface UnionMessage {
  id:          string
  fromUnionId: string
  toUnionId:   string
  fromUnion:   { id: string; name: string; avatar: string | null; memberA: UnionMember; memberB: UnionMember }
  content:     string | null
  mediaUrl:    string | null
  readAt:      string | null
  createdAt:   string
}

export interface UnionConversation {
  otherUnion:  Union
  myUnion:     Union
  lastMessage: UnionMessage | null
  unreadCount: number
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
