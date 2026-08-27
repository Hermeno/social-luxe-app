/**
 * Marca metade dos utilizadores como verificados, para se ver o selo na app.
 *
 * Isto é uma amostra de teste, não uma decisão sobre ninguém: qualquer conta
 * apanhada aqui passa a mostrar o selo a toda a gente que a veja. Correr com
 * `--undo` desfaz tudo.
 *
 * A metade é escolhida por posição alfabética do `id`, não à sorte: correr o
 * script duas vezes dá exactamente o mesmo conjunto, e uma conta criada depois
 * não rouba o lugar a outra que já estava a mostrar o selo. Com sorteio, cada
 * execução trocaria metade dos selos e não se saberia o que se estava a ver.
 *
 *   npx ts-node --transpile-only src/scripts/verifyHalfUsers.ts
 *   npx ts-node --transpile-only src/scripts/verifyHalfUsers.ts --undo
 */
import { prisma } from '../config/database'

async function main() {
  const undo = process.argv.includes('--undo')

  if (undo) {
    const { count } = await prisma.user.updateMany({
      where: { isVerified: true },
      data: { isVerified: false },
    })
    console.log(`selo retirado a ${count} conta(s)`)
    return
  }

  const users = await prisma.user.findMany({
    select: { id: true, name: true },
    orderBy: { id: 'asc' },
  })
  if (users.length === 0) {
    console.log('não há utilizadores')
    return
  }

  // Uma sim, uma não. Em número ímpar sobra para os não verificados, que é o
  // lado seguro: o selo é uma afirmação, a ausência dele não afirma nada.
  const chosen = users.filter((_, index) => index % 2 === 0)
  const chosenIds = chosen.map((user) => user.id)

  const [verified, cleared] = await prisma.$transaction([
    prisma.user.updateMany({ where: { id: { in: chosenIds } }, data: { isVerified: true } }),
    prisma.user.updateMany({ where: { id: { notIn: chosenIds } }, data: { isVerified: false } }),
  ])

  console.log(`${users.length} contas · ${verified.count} com selo · ${cleared.count} sem selo`)
  console.log(chosen.slice(0, 10).map((user) => `  ✓ ${user.name}`).join('\n'))
  if (chosen.length > 10) console.log(`  … e mais ${chosen.length - 10}`)
}

main()
  .catch((error) => { console.error(error); process.exit(1) })
  .finally(() => prisma.$disconnect())
