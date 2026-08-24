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

const CACHE_PREFIX = 'taste_policy_v2'

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
  /** Publicações onde o cartão já apareceu, mesmo que tenha sido ignorado. */
  asked: string[]
  /** Respostas por tipo de conteúdo — mede o que já sabemos de cada um. */
  byKind: Record<string, number>
  /** Cartões seguidos que apareceram e ficaram sem resposta. */
  ignoredStreak: number
  /** Quando apareceu o último cartão (ms). */
  lastAskedAt: number
}

function emptyMemory(): Memory {
  return { answered: [], asked: [], byKind: {}, ignoredStreak: 0, lastAskedAt: 0 }
}

// ── Números da política ─────────────────────────────────────────────────────
const ASKS_PER_SESSION   = 3        // teto por utilização real da app
const ASKS_WHEN_KNOWN     = 2       // com gosto conhecido, manutenção mais leve
const MIN_POSTS_BETWEEN  = 5        // publicações entre dois cartões
const MIN_MS_BETWEEN     = 60_000   // e tempo, para não caberem todos num minuto
const SETTLE_POSTS       = 3        // ninguém é interrompido mal abre a app
const KNOWN_ENOUGH       = 30       // sinais a partir dos quais se pergunta menos
const ANSWERED_KEEP      = 500      // histórico local só serve para não repetir
// Silêncio depois de o cartão ser ignorado N vezes seguidas. Insistir com quem
// não responde não traz sinal nenhum — mas desaparecer durante dias também não:
// o feed fica sem forma de aprender e o utilizador sem forma de o afinar. Daí a
// escala parar nas horas e não nos dias.
const IGNORE_PAUSE_MS = [0, 15 * 60_000, 2 * 3_600_000, 12 * 3_600_000, 24 * 3_600_000]
// Cada janela inteira sem cartão nenhum perdoa uma ignorada. É isto que faltava:
// a série só descia com uma resposta, portanto três cartões passados à frente
// calavam a pergunta para sempre — ia crescendo e nunca voltava atrás.
const STREAK_FORGIVE_MS = 24 * 3_600_000

// Uma sessão termina depois de meia hora sem qualquer publicação observada.
// Antes, "sessão" era a vida do processo JavaScript: em iOS isso pode durar
// semanas em background e o teto de cartões nunca voltava a abrir.
const SESSION_IDLE_MS = 30 * 60_000

let memory: Memory = emptyMemory()
let hydrated = false
let activeUserId: string | null = null
let hydrationRun = 0

// Sessão real — reinicia por identidade e depois de inatividade suficiente.
let postsSeenThisSession = 0
let postsSinceLastAsk = Number.MAX_SAFE_INTEGER
let asksThisSession = 0
let lastSessionActivityAt = 0

// Decisão final por publicação. Sem isto, o sorteio corria outra vez a cada
// render e o cartão piscava.
const decisions = new Map<string, boolean>()

function resetSession(): void {
  postsSeenThisSession = 0
  postsSinceLastAsk = Number.MAX_SAFE_INTEGER
  asksThisSession = 0
  decisions.clear()
}

function touchSession(now = Date.now()): void {
  if (lastSessionActivityAt > 0 && now - lastSessionActivityAt >= SESSION_IDLE_MS) {
    resetSession()
  }
  lastSessionActivityAt = now
}

export async function hydrateTastePolicy(userId: string | null | undefined): Promise<void> {
  const nextUserId = userId ?? null
  if (hydrated && activeUserId === nextUserId) return

  const run = ++hydrationRun
  activeUserId = nextUserId
  hydrated = false
  memory = emptyMemory()
  lastSessionActivityAt = 0
  resetSession()
  if (!nextUserId) return

  try {
    const saved = await getCache<Memory>(`${CACHE_PREFIX}:${nextUserId}`)
    if (run !== hydrationRun || activeUserId !== nextUserId) return
    if (saved) {
      memory = {
        ...emptyMemory(),
        ...saved,
        answered: saved.answered ?? [],
        asked: saved.asked ?? saved.answered ?? [],
        byKind: saved.byKind ?? {},
      }
    }
  } catch {}
  if (run !== hydrationRun || activeUserId !== nextUserId) return
  hydrated = true
}

function persist(): void {
  if (!activeUserId) return
  setCache(`${CACHE_PREFIX}:${activeUserId}`, memory).catch(() => {})
}

function effectiveIgnoredStreak(now = Date.now()): number {
  const idleMs = now - memory.lastAskedAt
  const forgiven = memory.lastAskedAt > 0 ? Math.floor(idleMs / STREAK_FORGIVE_MS) : 0
  return Math.max(0, memory.ignoredStreak - forgiven)
}

function ignorePause(): number {
  const streak = effectiveIgnoredStreak()
  return IGNORE_PAUSE_MS[Math.min(streak, IGNORE_PAUSE_MS.length - 1)]
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
  touchSession()
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
    || memory.asked.includes(ctx.postId)
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
  touchSession()
  postsSeenThisSession += 1
  postsSinceLastAsk += 1
}

/** O cartão apareceu mesmo — a partir daqui contam o teto e a distância. */
export function noteTasteShown(postId: string): void {
  if (TASTE_DEBUG_ALWAYS) return
  const now = Date.now()
  touchSession(now)
  asksThisSession += 1
  postsSinceLastAsk = 0
  // Torna o perdão efetivo antes de mover o relógio. Sem isto, uma série antiga
  // parecia perdoada para mostrar, mas voltava inteira assim que o cartão era
  // ignorado novamente.
  memory.ignoredStreak = effectiveIgnoredStreak(now)
  memory.lastAskedAt = now
  if (!memory.asked.includes(postId)) {
    memory.asked = [...memory.asked, postId].slice(-ANSWERED_KEEP)
  }
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
  // Limitada ao tamanho da escala: sem isto uma série de 20 precisava de 60h
  // para voltar ao princípio, mesmo com a pausa já no máximo.
  memory.ignoredStreak = Math.min(IGNORE_PAUSE_MS.length, memory.ignoredStreak + 1)
  decisions.set(postId, false)
  persist()
}
