import { prisma } from '../config/database'
import { hashPassword, comparePassword } from '../utils/hash'
import { signToken } from '../utils/jwt'
import { RegisterBody, LoginBody } from '../types'

export async function register(body: RegisterBody) {
  const { name, phone, countryCode, password, confirmPassword } = body

  if (password !== confirmPassword) throw new Error('Passwords do not match')
  if (password.length < 6) throw new Error('Password must be at least 6 characters')

  // phone already arrives as full international number (e.g. +244923456789)
  const exists = await prisma.user.findUnique({ where: { phone } })
  if (exists) throw new Error('Phone number already registered')

  const hashed = await hashPassword(password)

  const user = await prisma.user.create({
    data: { name, phone, countryCode, password: hashed },
    select: { id: true, name: true, phone: true, countryCode: true, avatar: true, bio: true, availability: true,  createdAt: true },
  })

  const token = signToken({ userId: user.id, phone: user.phone })
  return { user, token }
}

export async function login(body: LoginBody) {
  const { phone, password } = body

  const user = await prisma.user.findUnique({ where: { phone } })
  if (!user) throw new Error('Invalid credentials')

  const valid = await comparePassword(password, user.password)
  if (!valid) throw new Error('Invalid credentials')

  const token = signToken({ userId: user.id, phone: user.phone })
  const { password: _, ...safeUser } = user
  return { user: safeUser, token }
}

export async function getProfile(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true, name: true, phone: true, countryCode: true,
      avatar: true, bio: true, availability: true,
      viewsPublic: true, contact: true,
      defaultFollowDuration: true, city: true, district: true,
      autoReply: true, showDevice: true, statusLabel: true, interests: true,
      isAdmin: true, createdAt: true,
      // Sem estes, o próprio dono não via a sua conta profissional: o perfil
      // dele vem do /auth/me, não do /users/:id.
      accountType: true, businessCategory: true, businessAddress: true,
      businessHours: true, whatsapp: true, profileActions: true,
    },
  })
  if (!user) throw new Error('User not found')
  return user
}
