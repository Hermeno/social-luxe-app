import { getCache, setCache } from '../../db/database'

// ─── Quando perguntar ───────────────────────────────────────────────────────
//
// O cartão de gosto é caro: cada vez que aparece, interrompe. Por isso não é
// sorteado à cega — é decidido no momento em que a resposta vale mais do que
// o incómodo. A política vive toda aqui, num sítio só, e assenta em quatro
// ideias:
//
//   1. Perguntar onde ainda não sabemos. Quem gostou, repostou ou ficou pelo
//      post já respondeu com os dedos; repetir a pergunta é pedir o que já
//      temos. O momento ambíguo — ficou a ver e não fez nada — é o único que
//      ensina alguma coisa.
//   2. Perguntar pouco. Teto por utilização da app, distância mínima entre
//      cartões em publicações E em tempo. Perguntado a toda a hora, o cartão
//      vira mobília e a resposta deixa de ser pensada.
//   3. Perguntar onde falta informação. Um tipo de conteúdo sobre o qual não
//      sabemos nada vale mais do que o décimo vídeo do mesmo género; um autor
//      que a pessoa não segue vale mais do que um que já segue.
//   4. Aceitar um não. Cartões ignorados seguidos são resposta: a app cala-se
//      por horas, e por mais tempo a cada vez que insistir não resultou.
//
// Nada disto é aleatório à superfície: a decisão de cada publicação fica
// memoizada, para o cartão nunca nascer e morrer entre renders.

const CACHE_KEY = 'taste_policy_v1'

// ⚠️ TESTE DE DESENHO — `true` mostra o cartão em todas as publicações e quase
// de imediato, ignorando a política inteira. Só para ver o desenho.
export const TASTE_DEBUG_ALWAYS = false

export type TasteKind = 'VIDEO' | 'TEXT' | 'IMAGE'

export interface TasteAskContext {
  postId: string
  kind: TasteKind
  isSelf: boolean
  isAnnouncement: boolean
  /** Já gostou, repostou ou republicou — o gosto já é conhecido. */
  engaged: boolean
  followingAuthor: boolean
}

interface Memory {
  /** Publicações já respondidas. A pergunta nunca se repete. */
  answered: string[]
  /** Respostas por tipo de conteúdo — mede o que já sabemos de cada um. */
  byKind: Record<string, number>
  /** Cartões seguidos que apareceram e ficaram sem resposta. */
  ignoredStreak: number
  /** Quando apareceu o último cartão (ms). */
  lastAskedAt: number
}

const EMPTY: Memory = { answered: [], byKind: {}, ignoredStreak: 0, lastAskedAt: 0 }

// ── Números da política ─────────────────────────────────────────────────────
const ASKS_PER_SESSION   = 2        // teto por utilização da app
const ASKS_WHEN_KNOWN     = 1       // ... e metade disso quando já sabemos muito
const MIN_POSTS_BETWEEN  = 7        // publicações entre dois cartões
const MIN_MS_BETWEEN     = 90_000   // e tempo, para não caberem todos num minuto
const SETTLE_POSTS       = 3        // ninguém é interrompido mal abre a app
const KNOWN_ENOUGH       = 30       // sinais a partir dos quais se pergunta menos
const ANSWERED_KEEP      = 500      // histórico local só serve para não repetir
// Silêncio depois de o cartão ser ignorado N vezes seguidas. Insistir com quem
// não responde não traz sinal nenhum — traz desinstalações.
const IGNORE_PAUSE_MS = [0, 0, 6 * 3_600_000, 24 * 3_600_000, 72 * 3_600_000]

let memory: Memory = { ...EMPTY }
let hydrated = false

// Sessão — morre com o processo, de propósito: o teto é por utilização.
let postsSeenThisSession = 0
let postsSinceLastAsk = Number.MAX_SAFE_INTEGER
let asksThisSession = 0

// Decisão final por publicação. Sem isto, o sorteio corria outra vez a cada
// render e o cartão piscava.
const decisions = new Map<string, boolean>()

export async function hydrateTastePolicy(): Promise<void> {
  if (hydrated) return
  try {
    const saved = await getCache<Memory>(CACHE_KEY)
    if (saved) memory = { ...EMPTY, ...saved, answered: saved.answered ?? [] }
  } catch {}
  hydrated = true
}

function persist(): void {
  setCache(CACHE_KEY, memory).catch(() => {})
}

function ignorePause(): number {
  const i = Math.min(memory.ignoredStreak, IGNORE_PAUSE_MS.length - 1)
  return IGNORE_PAUSE_MS[i]
}

function sessionBudget(): number {
  return memory.answered.length >= KNOWN_ENOUGH ? ASKS_WHEN_KNOWN : ASKS_PER_SESSION
}

// Probabilidade de gastar a pergunta NESTA publicação, já passadas todas as
// barreiras. É aqui que mora o "onde é que isto ensina mais".
function askProbability(ctx: TasteAskContext): number {
  let p = 0.4

  const counts = Object.values(memory.byKind)
  const total = counts.reduce((sum, n) => sum + n, 0)
  const forKind = memory.byKind[ctx.kind] ?? 0
  // Informação nova vale mais do que confirmação.
  if (total === 0 || forKind / total < 0.25) p += 0.25

  // Onde o feed ainda está a adivinhar: alguém que a pessoa não segue.
  if (!ctx.followingAuthor) p += 0.2

  // Já sabemos muito desta pessoa — a partir daqui pergunta-se por manutenção,
  // não por descoberta.
  if (memory.answered.length >= KNOWN_ENOUGH) p -= 0.2

  return Math.max(0.12, Math.min(0.85, p))
}

export function shouldAskTaste(ctx: TasteAskContext): boolean {
  if (TASTE_DEBUG_ALWAYS) return true
  // Sem memória carregada não se pergunta: podíamos repetir uma pergunta que
  // já foi respondida, que é a pior forma de parecer distraído.
  if (!hydrated) return false

  const memo = decisions.get(ctx.postId)
  if (memo !== undefined) return memo

  // Barreiras permanentes — a resposta não muda com o tempo, fica memoizada.
  const permanentlyNo = ctx.isSelf
    || ctx.isAnnouncement
    || ctx.engaged
    || memory.answered.includes(ctx.postId)
  if (permanentlyNo) {
    decisions.set(ctx.postId, false)
    return false
  }

  // Barreiras de momento — NÃO se memoizam: esta publicação pode voltar a ser
  // boa candidata daqui a cinco posts.
  const now = Date.now()
  if (postsSeenThisSession < SETTLE_POSTS) return false
  if (asksThisSession >= sessionBudget()) return false
  if (postsSinceLastAsk < MIN_POSTS_BETWEEN) return false
  if (now - memory.lastAskedAt < Math.max(MIN_MS_BETWEEN, ignorePause())) return false

  const ask = Math.random() < askProbability(ctx)
  decisions.set(ctx.postId, ask)
  return ask
}

/** Quanto tempo a pessoa tem de estar no post antes de a pergunta fazer sentido. */
export function tasteDwellMs(kind: TasteKind): number {
  if (TASTE_DEBUG_ALWAYS) return 700
  // Um vídeo pede-se visto; um texto lê-se depressa. Perguntar antes disso é
  // perguntar antes de haver opinião — e essa resposta não vale nada.
  return kind === 'VIDEO' ? 6500 : kind === 'TEXT' ? 3500 : 4500
}

/** Uma publicação passou pelos olhos da pessoa. */
export function noteTastePostSeen(): void {
  postsSeenThisSession += 1
  postsSinceLastAsk += 1
}

/** O cartão apareceu mesmo — a partir daqui contam o teto e a distância. */
export function noteTasteShown(postId: string): void {
  if (TASTE_DEBUG_ALWAYS) return
  asksThisSession += 1
  postsSinceLastAsk = 0
  memory.lastAskedAt = Date.now()
  decisions.set(postId, true)
  persist()
}

export function noteTasteAnswered(postId: string, kind: TasteKind): void {
  memory.byKind[kind] = (memory.byKind[kind] ?? 0) + 1
  if (!memory.answered.includes(postId)) {
    memory.answered = [...memory.answered, postId].slice(-ANSWERED_KEEP)
  }
  // Respondeu: a paciência recomeça do zero.
  memory.ignoredStreak = 0
  decisions.set(postId, false)
  persist()
}

/** Apareceu e a pessoa seguiu em frente. Também é uma resposta. */
export function noteTasteIgnored(postId: string): void {
  memory.ignoredStreak += 1
  decisions.set(postId, false)
  persist()
}
