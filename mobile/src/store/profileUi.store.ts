import { create } from 'zustand'

/**
 * Sinal entre controlos externos ao perfil (por exemplo, a TabBar) e a folha
 * de ligações que pertence ao próprio ProfileScreen.
 */
interface ProfileUiStore {
  connectionsRequested: number
  requestConnections: () => void
  reset: () => void
}

export const useProfileUiStore = create<ProfileUiStore>((set) => ({
  connectionsRequested: 0,
  requestConnections: () => set((s) => ({
    connectionsRequested: s.connectionsRequested + 1,
  })),
  reset: () => set({ connectionsRequested: 0 }),
}))
