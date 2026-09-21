import { create } from 'zustand'

import * as circle from '../services/circle.service'
import type { CircleJoinRequest } from '../services/circle.service'

/**
 * Entrar num Círculo depois de ele acontecer.
 *
 * Dois lados do mesmo pedido, num só sítio:
 *
 *   · quem pede — `pending` diz em que Círculos tenho um pedido à espera, para
 *     o botão dizer "pedido enviado" em vez de convidar outra vez;
 *   · quem decide — `incoming` são os pedidos à espera do anfitrião, com a
 *     fotografia de cada um.
 *
 * E as duas superfícies que se abrem por cima de qualquer ecrã: a câmara para
 * tirar a fotografia do pedido (`joinTarget`) e a folha onde o anfitrião aceita
 * ou recusa (`reviewMomentId`). Vivem aqui para não montar uma câmara dentro de
 * cada publicação da lista.
 */

export interface JoinTarget {
  momentId: string
  /** O nome de quem vai decidir, para a câmara dizer a quem se está a pedir. */
  hostName: string | null
}

/** A folha de decisão aberta para todos os Círculos de uma vez. */
export const ALL_MOMENTS = '*'

interface CircleJoinState {
  incoming: CircleJoinRequest[]
  /** momentId → id do meu pedido à espera nesse Círculo. */
  pending: Record<string, string>
  joinTarget: JoinTarget | null
  reviewMomentId: string | null

  load: () => Promise<void>
  loadIncoming: () => Promise<void>
  loadMine: () => Promise<void>
  openJoin: (target: JoinTarget) => void
  closeJoin: () => void
  openReview: (momentId?: string) => void
  closeReview: () => void
  /** O meu pedido saiu: o Círculo passa a mostrá-lo como enviado. */
  markSent: (momentId: string, requestId: string) => void
  /** Desistir do meu pedido num Círculo. */
  cancel: (momentId: string) => Promise<void>
  /** O anfitrião decide. O pedido sai da lista mal o servidor confirma. */
  decide: (requestId: string, accept: boolean) => Promise<void>
  /** O anfitrião decidiu o meu pedido — em qualquer sentido, deixa de estar à espera. */
  resolveMine: (momentId: string) => void
  reset: () => void
}

const INITIAL = {
  incoming: [] as CircleJoinRequest[],
  pending: {} as Record<string, string>,
  joinTarget: null as JoinTarget | null,
  reviewMomentId: null as string | null,
}

export const useCircleJoinStore = create<CircleJoinState>((set, get) => ({
  ...INITIAL,

  load: async () => {
    await Promise.allSettled([get().loadIncoming(), get().loadMine()])
  },

  loadIncoming: async () => {
    const incoming = await circle.getIncomingJoinRequests()
    set({ incoming })
  },

  loadMine: async () => {
    const mine = await circle.getMyJoinRequests()
    const pending: Record<string, string> = {}
    for (const request of mine) pending[request.momentId] = request.id
    set({ pending })
  },

  openJoin: (target) => set({ joinTarget: target }),
  closeJoin: () => set({ joinTarget: null }),
  openReview: (momentId) => set({ reviewMomentId: momentId ?? ALL_MOMENTS }),
  closeReview: () => set({ reviewMomentId: null }),

  markSent: (momentId, requestId) => set((state) => ({
    pending: { ...state.pending, [momentId]: requestId },
  })),

  cancel: async (momentId) => {
    const requestId = get().pending[momentId]
    if (!requestId) return
    await circle.cancelJoinRequest(requestId)
    get().resolveMine(momentId)
  },

  decide: async (requestId, accept) => {
    await circle.decideJoinRequest(requestId, accept)
    set((state) => ({ incoming: state.incoming.filter((request) => request.id !== requestId) }))
  },

  resolveMine: (momentId) => set((state) => {
    if (!state.pending[momentId]) return state
    const pending = { ...state.pending }
    delete pending[momentId]
    return { pending }
  }),

  reset: () => set({ ...INITIAL, pending: {}, incoming: [] }),
}))
