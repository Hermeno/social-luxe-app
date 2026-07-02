import { PrismaClient } from '@prisma/client'
import supertest from 'supertest'
import app from '../src/app'
import { hashPassword } from '../src/utils/hash'

export const prisma = new PrismaClient()
export const request = supertest(app)

export async function createTestUser(phone = '+2449900000001') {
  return prisma.user.create({
    data: {
      name: 'Test User',
      phone,
      countryCode: '+244',
      password: await hashPassword('password123'),
    },
  })
}

export async function loginTestUser(phone = '+2449900000001') {
  const res = await request.post('/api/v1/auth/login').send({ phone, password: 'password123' })
  return res.body.data.token as string
}

export async function cleanDb() {
  await prisma.message.deleteMany()
  await prisma.share.deleteMany()
  await prisma.view.deleteMany()
  await prisma.like.deleteMany()
  await prisma.comment.deleteMany()
  await prisma.post.deleteMany()
  await prisma.friendshipHistory.deleteMany()
  await prisma.friendship.deleteMany()
  await prisma.deviceToken.deleteMany()
  await prisma.user.deleteMany()
}
