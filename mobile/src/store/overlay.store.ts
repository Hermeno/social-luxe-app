import { create } from 'zustand'

/**
 * Quantos overlays modais estão abertos (folha de comentários, etc.).
 *
 * A barra de separadores é irmã do ecrã dentro do navegador, por isso pinta por
 * cima de qualquer overlay do ecrã por muito zIndex que ele tenha — e no Android,
 * com softwareKeyboardLayoutMode "pan", ainda sobe com o teclado e aterra em
 * cima do campo de escrever. Quem abre um overlay regista-se aqui e a barra
 * desaparece enquanto durar.
 *
 * É um contador e não um booleano para que dois overlays sobrepostos não se
 * desliguem um ao outro ao fechar.
 */
interface OverlayStore {
  count: number
  push: () => void
  pop: () => void
}

export const useOverlayStore = create<OverlayStore>((set) => ({
  count: 0,
  push: () => set((s) => ({ count: s.count + 1 })),
  pop:  () => set((s) => ({ count: Math.max(0, s.count - 1) })),
}))
