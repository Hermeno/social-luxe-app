import { prisma } from '../config/database'

// Texto do @: minúsculas, sem acentos, só a-z0-9. Vazio → "user".
export function slugifyUsername(raw: string): string {
  const s = raw
    .normalize('NFD').replace(/[̀-ͯ]/g, '') // tira acentos
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .slice(0, 20)
  return s || 'user'
}

function num4(): string {
  return String(Math.floor(Math.random() * 10000)).padStart(4, '0')
}

/**
 * Handle completo e único a partir de uma base de texto.
 *  - Pro  → só a base (sem número); tem de estar livre, senão USERNAME_TAKEN.
 *  - Grátis → base + número de 4 dígitos, tentando até achar um livre.
 * `ignoreUserId` deixa o próprio manter/rever o seu handle ao editar.
 */
export async function generateUsername(
  base: string,
  isPaid: boolean,
  ignoreUserId?: string,
): Promise<string> {
  const clean = slugifyUsername(base)

  const isTaken = async (username: string) => {
    const found = await prisma.user.findUnique({ where: { username }, select: { id: true } })
    return !!found && found.id !== ignoreUserId
  }

  if (isPaid) {
    if (await isTaken(clean)) throw new Error('USERNAME_TAKEN')
    return clean
  }

  for (let i = 0; i < 25; i++) {
    const candidate = clean + num4()
    if (!(await isTaken(candidate))) return candidate
  }
  throw new Error('USERNAME_GEN_FAILED')
}

/**
 * Várias opções de @handle únicas (base do nome + número) para o utilizador
 * escolher no registo. Ex.: herminio4821, herminio7130, herminio0042…
 */
export async function usernameOptions(rawName: string, count = 6): Promise<{ base: string; options: string[] }> {
  const base = slugifyUsername(rawName)
  const out: string[] = []
  const seen = new Set<string>()

  for (let guard = 0; out.length < count && guard < count * 10; guard++) {
    const candidate = base + num4()
    if (seen.has(candidate)) continue
    seen.add(candidate)
    const found = await prisma.user.findUnique({ where: { username: candidate }, select: { id: true } })
    if (!found) out.push(candidate)
  }
  return { base, options: out }
}
