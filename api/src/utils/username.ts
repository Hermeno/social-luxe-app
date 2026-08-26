import { prisma } from '../config/database'

/**
 * Texto do @: minúsculas, sem acentos, letras, dígitos, ponto, traço-baixo e
 * traço.
 *
 * Os três separadores entram porque são o que as pessoas usam para ligar
 * palavras — `ana.silva`, `ana_silva`, `ana-silva` — e sem eles um nome de duas
 * palavras colapsava num bloco só (`anasilva`), que se lê pior e obrigava a
 * distinguir contas por um número atrás.
 *
 * As regras a seguir existem para o handle continuar a ser legível e não
 * confundível com outro:
 *  · nunca começa nem acaba com separador
 *  · nunca leva dois separadores seguidos
 *  · no máximo 20 caracteres
 */
export function slugifyUsername(raw: string): string {
  const s = raw
    .normalize('NFD').replace(/[̀-ͯ]/g, '')  // tira acentos
    .toLowerCase()
    .replace(/[^a-z0-9._-]/g, '')
    .replace(/[._-]{2,}/g, (m) => m[0])                 // `..`, `__`, `--` colapsam
    .replace(/^[._-]+|[._-]+$/g, '')                    // não abre nem fecha
    .slice(0, 20)
    .replace(/[._-]+$/, '')                             // o corte pode deixar um
  return s || 'user'
}

/**
 * Variações de um nome, por ordem de preferência.
 *
 * Antes daqui saíam `herminio4821`, `herminio7130` — a base mais quatro dígitos
 * ao acaso. O número não diz nada sobre a pessoa, não se decora e não se dita
 * ao telefone; era só uma forma barata de garantir unicidade.
 *
 * As variações saem agora do próprio nome. `Hermínio Silva` dá `herminio`,
 * `herminio.silva`, `herminio_silva`, `hsilva`, `herminiosilva` — todas
 * legíveis, todas dizendo quem é a pessoa.
 */
function variantsOf(rawName: string): string[] {
  const words = rawName
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean)

  if (words.length === 0) return ['user']

  const SEP = ['.', '_', '-'] as const
  const [first, ...rest] = words
  const last = rest[rest.length - 1]
  const out: string[] = [first]

  const join = (a: string, b: string) => SEP.map((sp) => `${a}${sp}${b}`).concat(`${a}${b}`)

  if (last && last !== first) {
    out.push(
      ...join(first, last),          // ana.silva  ana_silva  ana-silva  anasilva
      ...join(first[0], last),       // a.silva    a_silva    a-silva    asilva
      ...join(first, last[0]),       // ana.s      ana_s      ana-s      anas
      ...join(last, first),          // silva.ana  …
      last,                          // silva
    )
  }
  // Nome do meio, quando existe, abre outra volta de combinações.
  if (rest.length > 1) out.push(...join(first, rest[0]), ...join(rest[0], last))

  return out.map(slugifyUsername).filter((v, i, a) => v && a.indexOf(v) === i)
}

/** Sufixo curto, só quando o nome já não dá mais variações livres. */
function shortSuffix(): string {
  return String(Math.floor(Math.random() * 100)).padStart(2, '0')
}

/**
 * Handle único a partir de uma base de texto.
 *
 * Já não há dois regimes. Toda a gente fica com um handle sem número quando o
 * nome o permite; o `isPaid` deixou de ser o que decide se se leva dígitos e
 * passa a decidir apenas se a colisão é um erro (a conta paga reservou aquele
 * handle e quer aquele) ou se se procura a variação seguinte.
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

  // 1.ª escolha: o nome, tal como é.
  if (!(await isTaken(clean))) return clean

  // 2.ª: as variações que o próprio nome oferece.
  for (const candidate of variantsOf(base)) {
    if (candidate !== clean && !(await isTaken(candidate))) return candidate
  }

  // 3.ª: só aqui entram dígitos, e são dois, não quatro — e sempre atrás de um
  // separador, para se ler como `ana.silva.07` e não como um código.
  for (let i = 0; i < 40; i++) {
    const candidate = slugifyUsername(`${clean}.${shortSuffix()}`)
    if (!(await isTaken(candidate))) return candidate
  }
  throw new Error('USERNAME_GEN_FAILED')
}

/**
 * Opções de @handle livres para o utilizador escolher no registo.
 *
 * Devolve primeiro as variações do nome. Só completa com dígitos se o nome não
 * chegar para `count` opções livres — quem se chama Ana Silva pode precisar
 * disso, quem tem um nome pouco comum nunca vê um número.
 */
export async function usernameOptions(
  rawName: string,
  count = 6,
): Promise<{ base: string; options: string[] }> {
  const base = slugifyUsername(rawName)
  const out: string[] = []
  const seen = new Set<string>()

  const tryAdd = async (candidate: string) => {
    if (!candidate || seen.has(candidate)) return
    seen.add(candidate)
    const found = await prisma.user.findUnique({ where: { username: candidate }, select: { id: true } })
    if (!found) out.push(candidate)
  }

  for (const v of variantsOf(rawName)) {
    if (out.length >= count) break
    await tryAdd(v)
  }

  for (let guard = 0; out.length < count && guard < count * 10; guard++) {
    await tryAdd(slugifyUsername(`${base}.${shortSuffix()}`))
  }

  return { base, options: out }
}
