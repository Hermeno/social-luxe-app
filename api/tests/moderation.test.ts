// Bloquear e silenciar são as duas ferramentas com que alguém se protege de
// outra pessoa. Ambas têm de ser reversíveis: um bloqueio que não se desfaz é
// pior do que não existir, porque a pessoa fica presa à decisão.
//
// Estes testes cobrem sobretudo o caminho de volta — listar e desfazer — que
// era exatamente o que não tinha cobertura nenhuma.

import { request, cleanDb, createTestUser, loginTestUser, prisma } from './helpers'

const API = '/api/v1'

let tokenA: string
let userBId: string
let userCId: string

beforeAll(async () => {
  await cleanDb()
  await createTestUser('+2449100001')
  const userB = await createTestUser('+2449100002')
  const userC = await createTestUser('+2449100003')
  userBId = userB.id
  userCId = userC.id
  tokenA = await loginTestUser('+2449100001')
})

afterAll(async () => { await cleanDb(); await prisma.$disconnect() })

describe('bloquear e desbloquear', () => {
  it('bloqueia alguém', async () => {
    const res = await request
      .post(`${API}/blocks`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ targetUserId: userBId })
    expect(res.status).toBe(200)
  })

  it('bloquear duas vezes não dá erro', async () => {
    const res = await request
      .post(`${API}/blocks`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ targetUserId: userBId })
    expect(res.status).toBe(200)
  })

  // O cliente endereça o desbloqueio por id de utilizador. Se a lista devolver
  // o utilizador aninhado, o mobile lê `item.id` como undefined e chama
  // DELETE /blocks/undefined — o bloqueio fica preso para sempre.
  it('a lista traz o id do utilizador no topo, não aninhado', async () => {
    const res = await request.get(`${API}/blocks`).set('Authorization', `Bearer ${tokenA}`)
    expect(res.status).toBe(200)
    expect(res.body.data).toHaveLength(1)
    expect(res.body.data[0].id).toBe(userBId)
    expect(res.body.data[0].name).toBeDefined()
  })

  it('desbloqueia e a lista fica vazia', async () => {
    const res = await request
      .delete(`${API}/blocks/${userBId}`)
      .set('Authorization', `Bearer ${tokenA}`)
    expect(res.status).toBe(200)

    const list = await request.get(`${API}/blocks`).set('Authorization', `Bearer ${tokenA}`)
    expect(list.body.data).toHaveLength(0)
  })

  it('desbloquear quem não está bloqueado não falha', async () => {
    const res = await request
      .delete(`${API}/blocks/${userBId}`)
      .set('Authorization', `Bearer ${tokenA}`)
    expect(res.status).toBe(200)
  })

  it('não deixa bloquear-se a si próprio', async () => {
    const me = await prisma.user.findFirst({ where: { phone: '+2449100001' } })
    const res = await request
      .post(`${API}/blocks`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ targetUserId: me!.id })
    expect(res.status).toBeGreaterThanOrEqual(400)
  })
})

describe('silenciar publicações', () => {
  it('silencia por um mês e devolve a data de fim', async () => {
    const res = await request
      .put(`${API}/mutes/${userBId}`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ duration: 'ONE_MONTH' })
    expect(res.status).toBe(200)
    expect(res.body.data.id).toBe(userBId)
    expect(res.body.data.expiresAt).not.toBeNull()

    // Aproximadamente um mês à frente — a conta exata é de calendário.
    const days = (new Date(res.body.data.expiresAt).getTime() - Date.now()) / 86_400_000
    expect(days).toBeGreaterThan(27)
    expect(days).toBeLessThan(32)
  })

  it('silencia para sempre sem data de fim', async () => {
    const res = await request
      .put(`${API}/mutes/${userCId}`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ duration: 'FOREVER' })
    expect(res.status).toBe(200)
    expect(res.body.data.expiresAt).toBeNull()
  })

  it('a lista traz ambos, com o id no topo', async () => {
    const res = await request.get(`${API}/mutes`).set('Authorization', `Bearer ${tokenA}`)
    expect(res.status).toBe(200)
    expect(res.body.data).toHaveLength(2)
    expect(res.body.data.map((u: { id: string }) => u.id).sort())
      .toEqual([userBId, userCId].sort())
  })

  it('deixa de silenciar', async () => {
    const res = await request
      .delete(`${API}/mutes/${userBId}`)
      .set('Authorization', `Bearer ${tokenA}`)
    expect(res.status).toBe(200)

    const list = await request.get(`${API}/mutes`).set('Authorization', `Bearer ${tokenA}`)
    expect(list.body.data.map((u: { id: string }) => u.id)).toEqual([userCId])
  })

  // Um silêncio expirado não é um silêncio. Se a listagem o continuasse a
  // mostrar, a pessoa via na app um estado que a feed já não aplicava.
  it('um silêncio expirado desaparece da lista', async () => {
    await prisma.userMute.update({
      where: { muterId_mutedId: { muterId: (await prisma.user.findFirst({ where: { phone: '+2449100001' } }))!.id, mutedId: userCId } },
      data: { expiresAt: new Date(Date.now() - 1000) },
    })
    const res = await request.get(`${API}/mutes`).set('Authorization', `Bearer ${tokenA}`)
    expect(res.body.data).toHaveLength(0)
  })
})
