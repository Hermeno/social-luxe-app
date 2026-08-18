// As cursivas não entram no `useFonts` do arranque.
//
// São ~200 KB que só interessam a quem escreve ou lê uma publicação de texto,
// e o `useFonts` do App.tsx segura o splash até tudo terminar. Aqui carrega-se
// em segundo plano: o ecrã que já está montado volta a desenhar quando as
// fontes chegarem, e até lá o texto aparece na `sans`.

import { create } from 'zustand'
import * as Font from 'expo-font'

type PostFontsState = {
  /** true quando as famílias cursivas podem ser referidas com segurança. */
  ready: boolean
  ensureLoaded: () => Promise<void>
}

// Fora do store: vários ecrãs pedem isto ao mesmo tempo (App ao arrancar,
// compositor ao abrir, feed ao encontrar o primeiro post cursivo) e uma só
// promessa evita ler o mesmo ficheiro três vezes.
let inflight: Promise<void> | null = null

export const usePostFontsStore = create<PostFontsState>((set, get) => ({
  ready: false,

  ensureLoaded: async () => {
    if (get().ready) return
    if (!inflight) {
      inflight = Font.loadAsync({
        'DancingScript-Bold': require('@expo-google-fonts/dancing-script/700Bold/DancingScript_700Bold.ttf'),
        'Caveat-Bold':        require('@expo-google-fonts/caveat/700Bold/Caveat_700Bold.ttf'),
      })
        .then(() => { set({ ready: true }) })
        // Falhar aqui não é motivo para partir nada: fica tudo na `sans` e a
        // próxima chamada tenta de novo, porque o `inflight` é limpo abaixo.
        // Mas em silêncio total isto é indistinguível de "o post não tem fonte
        // escolhida" — e essa ambiguidade custa uma sessão de depuração.
        .catch((error) => {
          if (__DEV__) console.warn('[postFonts] cursivas não carregaram; fica a fonte padrão:', error)
        })
        .finally(() => { inflight = null })
    }
    return inflight
  },
}))

/** Atalho para componentes que só querem saber se já podem usar a cursiva. */
export function usePostFontsReady(): boolean {
  return usePostFontsStore((s) => s.ready)
}
