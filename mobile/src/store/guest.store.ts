import { create } from 'zustand'
import { PublicPost } from '../types'
import { getPublicFeed } from '../services/public.service'

/**
 * Como é que a app se abre a quem não tem sessão.
 *
 *   checking → à espera de saber se há acervo público
 *   guest    → há posts merecidos; entra-se a ver
 *   auth     → não há (ou a pessoa quis avançar); entrada normal com conta
 *
 * `auth` é o destino de qualquer gesto que exija identidade. Só se volta a
 * `checking` num novo arranque — depois de pedir conta, não se recua sozinho.
 */
type GuestMode = 'checking' | 'guest' | 'auth'

/** Teto do que o arranque espera pela feed pública antes de desistir dela. */
const BOOTSTRAP_DEADLINE_MS = 2500

interface GuestStore {
  mode: GuestMode
  posts: PublicPost[]
  page: number
  loadingMore: boolean
  exhausted: boolean
  /** Decide o modo de arranque. Qualquer falha cai na entrada normal. */
  bootstrap: () => Promise<void>
  loadMore: () => Promise<void>
  /** Um gesto que precisa de conta — leva à entrada normal. */
  requireAccount: () => void
  /** Sair do modo convidado. Depois de entrar — ou de sair — a porta é a normal. */
  leaveGuest: () => void
}

export const useGuestStore = create<GuestStore>((set, get) => ({
  mode: 'checking',
  posts: [],
  page: 1,
  loadingMore: false,
  exhausted: false,

  bootstrap: async () => {
    try {
      // O arranque espera por isto, por isso não pode esperar muito. Rede lenta
      // ou API em baixo: segue-se para a entrada normal e ninguém fica a olhar
      // para a splash. A vitrina é um bónus, não uma dependência do arranque.
      const posts = await Promise.race([
        getPublicFeed(1),
        new Promise<PublicPost[]>((resolve) => setTimeout(() => resolve([]), BOOTSTRAP_DEADLINE_MS)),
      ])
      set(posts.length > 0
        ? { mode: 'guest', posts, page: 1, exhausted: posts.length < 10 }
        : { mode: 'auth' })
    } catch {
      set({ mode: 'auth' })
    }
  },

  loadMore: async () => {
    const { loadingMore, exhausted, page, posts, mode } = get()
    if (mode !== 'guest' || loadingMore || exhausted) return
    set({ loadingMore: true })
    try {
      const next = await getPublicFeed(page + 1)
      const seen = new Set(posts.map((p) => p.id))
      const fresh = next.filter((p) => !seen.has(p.id))
      set({
        posts: [...posts, ...fresh],
        page: page + 1,
        exhausted: fresh.length === 0,
        loadingMore: false,
      })
    } catch {
      set({ loadingMore: false })
    }
  },

  requireAccount: () => set({ mode: 'auth' }),

  // Nunca volta a 'checking': quem termina sessão quer o ecrã de entrada, não
  // a vitrina de estranhos. A vitrina é só para quem chega de novo.
  leaveGuest: () => set({ mode: 'auth', posts: [], page: 1, exhausted: false, loadingMore: false }),
}))
