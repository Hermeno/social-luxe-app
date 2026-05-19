import { Request } from 'express'
import { FriendshipDuration } from '@prisma/client'

export interface AuthPayload {
  userId: string
  phone: string
}

export interface AuthRequest extends Request {
  user?: AuthPayload
}

export interface RegisterBody {
  name: string
  phone: string
  countryCode: string
  password: string
  confirmPassword: string
}

export interface LoginBody {
  phone: string
  password: string
}

export interface CreatePostBody {
  caption?: string
}

export interface FriendshipBody {
  targetUserId: string
  duration: FriendshipDuration
}

export interface SendMessageBody {
  receiverId: string
  content?: string
}

export const FRIENDSHIP_DURATION_DAYS: Record<FriendshipDuration, number | null> = {
  ONE_DAY: 1,
  THREE_DAYS: 3,
  SEVEN_DAYS: 7,
  THIRTY_DAYS: 30,
  PERMANENT: null,
}

export const POST_EXTENSION_THRESHOLD = 0.5
export const POST_INITIAL_HOURS = 24
export const POST_EXTENDED_HOURS = 48
