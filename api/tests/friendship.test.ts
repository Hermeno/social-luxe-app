import { request, cleanDb, createTestUser, loginTestUser, prisma } from './helpers'

let tokenA: string
let tokenB: string
let userBId: string

beforeAll(async () => {
  await cleanDb()
  await createTestUser('+2449000001')
  const userB = await createTestUser('+2449000002')
  userBId = userB.id
  tokenA = await loginTestUser('+2449000001')
  tokenB = await loginTestUser('+2449000002')
})

afterAll(async () => { await cleanDb(); await prisma.$disconnect() })

describe('POST /api/v1/friendships', () => {
  let friendshipId: string

  it('creates a friendship request', async () => {
    const res = await request
      .post('/api/v1/friendships')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ targetUserId: userBId, duration: 'SEVEN_DAYS' })
    expect(res.status).toBe(201)
    friendshipId = res.body.data.id
    expect(friendshipId).toBeDefined()
  })

  it('rejects duplicate friendship', async () => {
    const res = await request
      .post('/api/v1/friendships')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ targetUserId: userBId, duration: 'SEVEN_DAYS' })
    expect(res.status).toBe(400)
  })

  it('renews a friendship', async () => {
    const res = await request
      .put(`/api/v1/friendships/${friendshipId}/renew`)
      .set('Authorization', `Bearer ${tokenA}`)
    expect(res.status).toBe(200)
    expect(res.body.data.renewedAt).toBeDefined()
  })

  it('removes a friendship', async () => {
    const res = await request
      .delete(`/api/v1/friendships/${friendshipId}`)
      .set('Authorization', `Bearer ${tokenA}`)
    expect(res.status).toBe(200)
  })
})
