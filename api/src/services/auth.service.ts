import { prisma } from '../config/database'
import { hashPassword, comparePassword } from '../utils/hash'
import { signToken } from '../utils/jwt'
import { RegisterBody, LoginBody } from '../types'

export async function register(body: RegisterBody) {
  const { name, phone, countryCode, password, confirmPassword } = body

  if (password !== confirmPassword) throw new Error('Passwords do not match')
  if (password.length < 6) throw new Error('Password must be at least 6 characters')

  const fullPhone = `${countryCode}${phone}`
  const exists = await prisma.user.findUnique({ where: { phone: fullPhone } })
  if (exists) throw new Error('Phone number already registered')

  const hashed = await hashPassword(password)

  const user = await prisma.user.create({
    data: { name, phone: fullPhone, countryCode, password: hashed },
    select: { id: true, name: true, phone: true, countryCode: true, avatar: true, createdAt: true },
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
    select: { id: true, name: true, phone: true, countryCode: true, avatar: true, bio: true, availability: true, createdAt: true },
  })
  if (!user) throw new Error('User not found')
  return user
}
