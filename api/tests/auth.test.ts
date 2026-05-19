import { request, cleanDb, prisma } from './helpers'

beforeAll(async () => { await cleanDb() })
afterAll(async () => { await cleanDb(); await prisma.$disconnect() })

describe('POST /api/v1/auth/register', () => {
  it('registers a new user', async () => {
    const res = await request.post('/api/v1/auth/register').send({
      name: 'Maria Silva',
      phone: '912345678',
      countryCode: '+244',
      password: 'senha123',
      confirmPassword: 'senha123',
    })
    expect(res.status).toBe(201)
    expect(res.body.data.token).toBeDefined()
    expect(res.body.data.user.name).toBe('Maria Silva')
  })

  it('rejects duplicate phone', async () => {
    const res = await request.post('/api/v1/auth/register').send({
      name: 'Outro',
      phone: '912345678',
      countryCode: '+244',
      password: 'senha123',
      confirmPassword: 'senha123',
    })
    expect(res.status).toBe(400)
    expect(res.body.message).toMatch(/already registered/)
  })

  it('rejects mismatched passwords', async () => {
    const res = await request.post('/api/v1/auth/register').send({
      name: 'Teste',
      phone: '999000001',
      countryCode: '+244',
      password: 'senha123',
      confirmPassword: 'diferente',
    })
    expect(res.status).toBe(400)
  })
})

describe('POST /api/v1/auth/login', () => {
  it('logs in with correct credentials', async () => {
    const res = await request.post('/api/v1/auth/login').send({
      phone: '+244912345678',
      password: 'senha123',
    })
    expect(res.status).toBe(200)
    expect(res.body.data.token).toBeDefined()
  })

  it('rejects wrong password', async () => {
    const res = await request.post('/api/v1/auth/login').send({
      phone: '+244912345678',
      password: 'errada',
    })
    expect(res.status).toBe(400)
  })
})
