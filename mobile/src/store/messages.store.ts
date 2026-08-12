import { create } from 'zustand'

/**
 * Sinais partilhados entre o ecrã de mensagens e controlos desenhados fora dele
 * (a TabBar). Mesmo padrão do `feed.store`: a barra pede, o ecrã é que abre.
 */
interface MessagesStore {
  /** Incrementa a cada pedido — o ecrã reage à mudança, não a um booleano. */
  suggestionsRequested: number
  requestSuggestions: () => void
  reset: () => void
}

export const useMessagesStore = create<MessagesStore>((set) => ({
  suggestionsRequested: 0,
  requestSuggestions: () => set((s) => ({ suggestionsRequested: s.suggestionsRequested + 1 })),
  reset: () => set({ suggestionsRequested: 0 }),
}))
