import { useEffect, useRef, useState } from 'react'

/**
 * O compositor da Feed abre espaço, de vez em quando, para os atalhos de criar.
 *
 * O problema que isto resolve: em modo imersivo a barra é só o campo de
 * comentar, e criar um post ou um círculo deixa de ter porta — a pessoa tem de
 * sair da imersão para lá chegar. Pôr os atalhos permanentemente ao lado do
 * campo resolvia o acesso e estragava o desenho: o campo encolhia para sempre
 * por causa de duas acções que se usam uma vez por sessão.
 *
 * A solução é o campo ceder espaço por períodos curtos e voltar a fechar. O
 * atalho aparece, quem quiser usa-o, e o desenho volta ao que era.
 *
 * ── Política ────────────────────────────────────────────────────────────────
 *
 *   nível 0   campo inteiro                        (o estado normal)
 *   nível 1   abre para um atalho: círculo
 *   nível 2   abre para dois: círculo e novo post
 *
 * Alterna entre 1 e 2 em vez de sortear. Uma barra que se comporta ao acaso
 * não se aprende; alternando, a segunda vez que alguém vê a abertura já sabe o
 * que esperar da terceira.
 *
 * A primeira abertura demora mais do que as seguintes: nos primeiros minutos a
 * pessoa está a ler a feed, e interromper aí é ruído.
 */

/**
 * Ensaio: com isto a `true` o ciclo corre em segundos em vez de minutos, para
 * se poder ver a abertura, a alternância e o fecho sem esperar sete minutos por
 * cada passagem. Não muda mais nada — animações, níveis e travas de toque são
 * exactamente as mesmas. Deve ficar sempre a `false` no que se publica.
 */
const REHEARSAL = false

/** Intervalo entre aberturas. */
const EVERY = REHEARSAL ? 30_000 : 5 * 60_000
/** Espera antes da primeira — mais longa, para não interromper a chegada. */
const FIRST = REHEARSAL ? 5_000 : 7 * 60_000
/** Quanto tempo o atalho fica à vista. */
const HOLD = REHEARSAL ? 10_000 : 30_000

export type RevealLevel = 0 | 1 | 2

export interface ComposerRevealOptions {
  /** Só corre quando o compositor está à vista; noutro estado não há o que abrir. */
  active: boolean
  /**
   * Trava o ciclo. Uma abertura a meio de um toque desloca o alvo debaixo do
   * dedo — e uma que feche enquanto alguém lá vai é pior do que nunca ter
   * aberto. Enquanto isto for `true`, o nível fica onde está.
   */
  busy?: boolean
  /**
   * Com movimento reduzido não se abre nada. A abertura é uma sugestão, não uma
   * função — e o custo de a perder é zero para quem pediu menos movimento.
   */
  reduceMotion?: boolean
}

/**
 * Devolve o nível de abertura actual. Quem chama trata de o animar.
 */
export default function useComposerReveal({
  active, busy = false, reduceMotion = false,
}: ComposerRevealOptions): RevealLevel {
  const [level, setLevel] = useState<RevealLevel>(0)
  // Alterna 1 → 2 → 1 …  Fica fora do estado porque mudá-lo não redesenha nada.
  const next = useRef<Exclude<RevealLevel, 0>>(1)
  const busyRef = useRef(busy)
  busyRef.current = busy

  useEffect(() => {
    if (!active || reduceMotion) {
      setLevel(0)
      return
    }

    let openTimer: ReturnType<typeof setTimeout>
    let closeTimer: ReturnType<typeof setTimeout>

    function scheduleOpen(delay: number) {
      openTimer = setTimeout(() => {
        // Ocupado: não força a abertura, tenta outra vez daqui a pouco. Assim o
        // ciclo não se perde só porque a pessoa estava a tocar naquele segundo.
        if (busyRef.current) { scheduleOpen(15_000); return }

        setLevel(next.current)
        next.current = next.current === 1 ? 2 : 1

        closeTimer = setTimeout(function close() {
          // Também não fecha por cima de um toque: espera que a mão saia.
          if (busyRef.current) { closeTimer = setTimeout(close, 4_000); return }
          setLevel(0)
          scheduleOpen(EVERY)
        }, HOLD)
      }, delay)
    }

    scheduleOpen(FIRST)
    return () => {
      clearTimeout(openTimer)
      clearTimeout(closeTimer)
    }
  }, [active, reduceMotion])

  return level
}
