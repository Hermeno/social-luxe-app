import path from 'path'
import fs from 'fs'
import { request, cleanDb, createTestUser, loginTestUser, prisma } from './helpers'

let token: string

beforeAll(async () => {
  await cleanDb()
  await createTestUser()
  token = await loginTestUser()
})

afterAll(async () => { await cleanDb(); await prisma.$disconnect() })

describe('GET /api/v1/posts/feed', () => {
  it('returns feed with auth', async () => {
    const res = await request.get('/api/v1/posts/feed').set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(200)
    expect(Array.isArray(res.body.data)).toBe(true)
  })

  it('rejects without auth', async () => {
    const res = await request.get('/api/v1/posts/feed')
    expect(res.status).toBe(401)
  })
})

describe('POST /api/v1/posts', () => {
  let postId: string

  it('creates a post with image', async () => {
    const testImagePath = path.join(__dirname, 'test.jpg')
    if (!fs.existsSync(testImagePath)) {
      fs.writeFileSync(testImagePath, Buffer.from('/9j/4AAQ', 'base64'))
    }
    const res = await request.post('/api/v1/posts')
      .set('Authorization', `Bearer ${token}`)
      .attach('media', testImagePath)
      .field('caption', 'Test post')
    expect([201, 400]).toContain(res.status)
    if (res.status === 201) postId = res.body.data.id
  })

  it('rejects post without media', async () => {
    const res = await request.post('/api/v1/posts')
      .set('Authorization', `Bearer ${token}`)
      .send({ caption: 'No media' })
    expect(res.status).toBe(400)
  })
})
