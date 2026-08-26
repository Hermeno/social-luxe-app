import { useEffect, useRef, useState } from 'react'
import { AppState } from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'

/**
 * A pele da navegação muda de sessão para sessão.
 *
 * `paper`  a faixa é papel branco e a tinta é preta — o estado familiar.
 * `clear`  a faixa desaparece e deixa passar o ecrã; a tinta fica branca.
 *
 * Porquê: a barra é o único elemento que está sempre no mesmo sítio, em todos
 * os ecrãs, o tempo todo. Uma app que se apresenta exactamente igual em todas
 * as aberturas deixa de se notar ao fim de uma semana. Mudar a pele de vez em
 * quando devolve-lhe presença sem mexer em nada do que a pessoa aprendeu: a
 * ordem dos separadores, os tamanhos e as posições ficam onde estavam.
 *
 * ── Regra ───────────────────────────────────────────────────────────────────
 *
 * Ciclo de quatro aberturas: a primeira é `paper`, as três seguintes `clear`.
 * A primeira abertura de sempre é `paper` de propósito — quem instala a app vê
 * primeiro a versão sóbria, e a variação só começa depois de a barra já ter
 * sido aprendida.
 *
 * A escolha fixa-se no arranque e não muda durante a sessão. Uma barra que
 * trocasse de pele com a app aberta leria-se como falha de renderização, não
 * como intenção.
 *
 * Regressar de segundo plano ao fim de meia hora conta como abertura nova: a
 * pessoa foi fazer outra coisa e volta a chegar à app.
 */

export type NavSkin = 'paper' | 'clear'

const KEY = 'nav_skin_opens'
/** Aberturas por volta do ciclo. */
const CYCLE = 4
/** Ausência a partir da qual voltar conta como abrir de novo. */
const AWAY = 30 * 60_000

function skinFor(openCount: number): NavSkin {
  // 1.ª, 5.ª, 9.ª … são de papel; as restantes deixam passar o ecrã.
  return openCount % CYCLE === 1 ? 'paper' : 'clear'
}

export default function useNavSkin(): NavSkin {
  // Arranca sempre em `paper`: é o estado seguro em qualquer fundo, e evita um
  // salto de cor caso a leitura do disco demore um frame.
  const [skin, setSkin] = useState<NavSkin>('paper')
  const leftAt = useRef<number | null>(null)

  useEffect(() => {
    let alive = true

    async function roll() {
      try {
        const raw = await AsyncStorage.getItem(KEY)
        const next = (Number(raw) || 0) + 1
        await AsyncStorage.setItem(KEY, String(next))
        if (alive) setSkin(skinFor(next))
      } catch {
        // Sem disco não há ciclo — fica em papel, que funciona em todo o lado.
      }
    }

    roll()

    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'background' || state === 'inactive') {
        leftAt.current = Date.now()
        return
      }
      if (state === 'active' && leftAt.current && Date.now() - leftAt.current > AWAY) {
        leftAt.current = null
        roll()
      }
    })

    return () => { alive = false; sub.remove() }
  }, [])

  return skin
}
