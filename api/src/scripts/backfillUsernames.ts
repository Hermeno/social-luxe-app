// Preenche o @handle das contas que ainda não têm (existentes antes do feature).
// Correr uma vez após a migração:  npm run backfill:usernames
import { prisma } from '../config/database'
import { slugifyUsername, generateUsername } from '../utils/username'

async function main() {
  const users = await prisma.user.findMany({
    where: { username: null },
    select: { id: true, name: true },
  })
  console.log(`A preencher @ para ${users.length} conta(s)…`)

  for (const u of users) {
    const base = slugifyUsername(u.name)
    const username = await generateUsername(base, false)
    await prisma.user.update({ where: { id: u.id }, data: { username, usernameBase: base } })
    console.log(`  ${u.name} → @${username}`)
  }

  console.log('Feito.')
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
