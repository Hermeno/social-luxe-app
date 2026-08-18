export type MediaType = 'IMAGE' | 'VIDEO'

export interface User {
  id: string
  name: string
  username?: string | null      // @handle: grátis = base+número, pago = base
  usernameBase?: string | null  // texto escolhido (para editar/upgrade)
  isPaid?: boolean              // pago → @ sem número
  phone: string
  countryCode: string
  avatar: string | null
  bio: string | null
  availability: string | null
  viewsPublic: boolean
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
  socialLinks?: unknown            // normalizeSocials() dá-lhe forma
}

export interface Post {
  id: string
  userId: string
  mediaUrl: string | null
  mediaUrls?: string[]        // álbum: 2+ fotos mostradas em grelha
  albumOverlays?: { emoji: string; x: number; y: number }[][]   // emojis por foto do álbum
  /** Dimensões originais, vindas do servidor. Permitem enquadrar a foto
   *  antes de ela carregar — sem isto a altura salta no `onLoad`. */
  mediaWidth?: number | null
  mediaHeight?: number | null
  mediaSizes?: { w: number | null; h: number | null }[]   // álbum, paralelo a mediaUrls
  thumbnailUrl: string
  mediaType: 'IMAGE' | 'VIDEO' | 'TEXT'
  caption: string | null
  bgColor: string | null
  /** Publicação de texto: chave da fonte ('script'|'hand'). null = padrão. */
  fontKey?: string | null
  expiresAt: string
  extended: boolean
  deviceModel?: string | null
  createdAt: string
  partnerUserId?: string | null
  partnerAccepted?: boolean
  partnerUser?: { id: string; name: string; avatar: string | null } | null
  isAnnouncement?: boolean
  /** Nos clones de repost, aponta para o post original canónico. */
  repostOfId?: string | null
  /** Autor do conteúdo original de um repost. Usado pela moderação para
   *  não reintroduzir conteúdo ocultado através da cópia de outra pessoa. */
  repostOriginalAuthorId?: string | null
  user: Pick<User, 'id' | 'name' | 'username' | 'avatar' | 'viewsPublic' | 'showDevice' | 'statusLabel' | 'lastSeen'>
  _count: { likes: number; comments: number; shares: number; reposts: number; views: number }
  recentCommenters?: Array<{ id: string; name: string; avatar: string | null }>
  hasVotedExtend?: boolean
  userLiked?: boolean
  userReposted?: boolean
  /** Foi ESTA publicação que recebeu o meu repost (o meu +1 no contador dela).
   *  Distinto de `userReposted`, que é verdadeiro em todas as células do mesmo
   *  conteúdo. */
  userRepostedVia?: boolean
  /** ID da cópia criada pelo próprio utilizador, útil para desfazer offline. */
  userRepostId?: string | null
}

export interface RepostResult {
  /** Original canónico. Define `userReposted` em todas as células do conteúdo
   *  e é o que impede repostar duas vezes a mesma publicação. */
  postId: string
  /** Publicação onde a pessoa tocou — a que recebe o +1/-1 no contador. */
  viaPostId: string
  /**
   * Novo contador de `viaPostId`. `null` offline, quando não há resposta do
   * servidor: nesse caso quem recebe mantém o contador que já tinha em vez de
   * se inventar um número.
   */
  viaCount: number | null
  reposted: boolean
  repostedPost: Post | null
  removedPostId?: string | null
}

/**
 * Post servido a quem ainda não tem conta (`GET /public/feed`).
 * Deliberadamente mais pobre que `Post`: sem expiração, sem estado de presença
 * do autor, sem o que o utilizador fez. Não é um `Post` incompleto — é outra
 * coisa, e o tipo separado impede que se cole um destes onde se espera sessão.
 */
export interface PublicPost {
  id: string
  mediaUrl: string | null
  mediaUrls?: string[]
  thumbnailUrl: string
  mediaType: 'IMAGE' | 'VIDEO' | 'TEXT'
  caption: string | null
  bgColor: string | null
  createdAt: string
  user: { id: string; name: string; username: string | null; avatar: string | null }
  _count: { likes: number; comments: number; views: number }
}

export interface Comment {
  id: string
  userId: string
  postId: string
  content: string
  parentId: string | null
  createdAt: string
  user: Pick<User, 'id' | 'name' | 'username' | 'avatar'>
  replies?: Comment[]
  likeCount?: number
  likedByMe?: boolean
  editedAt?: string | null
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
  user: Pick<User, 'id' | 'name' | 'username' | 'avatar'>
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
  friend: Pick<User, 'id' | 'name' | 'username' | 'avatar'>
  userA?: Pick<User, 'id' | 'name' | 'avatar'>
  userB?: Pick<User, 'id' | 'name' | 'avatar'>
}
