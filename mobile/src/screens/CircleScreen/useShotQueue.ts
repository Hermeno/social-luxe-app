import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * As fotografias do Círculo, do disparo até ao servidor.
 *
 * Uma fotografia fica guardada no momento em que é tirada — no telemóvel. O
 * ecrã mostra-a logo, a partir do ficheiro local, e a câmara fica pronta para a
 * seguinte. O servidor vem depois, sem ninguém ter de esperar por ele:
 *
 *   · a fila só arranca quando a pessoa pára de disparar (`idleMs` sem nova
 *     fotografia). Durante uma rajada nada compete com a câmara, e uma
 *     fotografia retirada logo a seguir nunca chega a subir;
 *   · os envios vão um a um, pela ordem em que foram tiradas. É o primeiro de
 *     um momento solo que cria a ronda, e os outros têm de sair com o id dela;
 *   · `flush` salta a espera e devolve quando não há nada por enviar — é o que
 *     o publicar chama antes de pedir o post.
 *
 * Não se espera pelo publicar para enviar tudo porque o Círculo é de várias
 * pessoas: quem publica primeiro leva as fotografias de toda a gente que já
 * chegaram ao servidor. Se as minhas só subissem quando eu publicasse, o post
 * dos outros sairia sem elas.
 */

export type ShotState =
  /** O obturador disparou e o ficheiro ainda está a ser escrito. */
  | 'capturing'
  /** Guardada no telemóvel, à espera da vez na fila. */
  | 'waiting'
  | 'sending'
  | 'saved'
  | 'failed'

export interface LocalShot {
  key: string
  sessionId: string
  /** null: um momento solo cuja ronda o primeiro envio ainda vai criar. */
  roundId: string | null
  slot: number
  uri: string | null
  state: ShotState
  /** O id da captura no servidor, depois de guardada lá. */
  captureId: string | null
  error: string | null
  /** Retirada pela pessoa enquanto subia: some do ecrã, e do servidor quando chegar. */
  removed: boolean
}

export interface ShotUploadResult {
  roundId: string
  captureId: string
}

interface Options {
  upload: (shot: LocalShot & { uri: string }) => Promise<ShotUploadResult>
  withdraw: (shot: LocalShot & { captureId: string }) => Promise<void>
  /** Quanto tempo sem disparar conta como "parou". */
  idleMs?: number
}

/** Pausa que conta como fim de rajada. */
const SYNC_IDLE_MS = 1500
/**
 * Se o ficheiro não aparecer, a fotografia não existiu. Acontece quando a câmara
 * desmonta entre o disparo e a escrita — sair do separador a meio, por exemplo.
 */
const CAPTURE_TIMEOUT_MS = 10_000
/** Esperas entre tentativas do mesmo envio, para uma rede que falhou de passagem. */
const RETRY_DELAYS_MS = [1000, 2500]

const PENDING: ReadonlySet<ShotState> = new Set(['capturing', 'waiting', 'sending'])

function wait(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms))
}

function errorMessage(err: unknown): string {
  const e = err as { response?: { data?: { message?: string } }; message?: string }
  return e?.response?.data?.message || e?.message || ''
}

/** Um 4xx é o servidor a dizer que não; repetir só o faria dizer não outra vez. */
function isFinal(err: unknown): boolean {
  const status = (err as { response?: { status?: number } })?.response?.status
  return typeof status === 'number' && status >= 400 && status < 500
}

export default function useShotQueue({ upload, withdraw, idleMs = SYNC_IDLE_MS }: Options) {
  // A lista vive num ref para a fila ler sempre a versão actual — um envio
  // demora segundos e o estado do React dessa altura já não é o de agora. O
  // estado é só o espelho que faz o ecrã desenhar.
  const listRef = useRef<LocalShot[]>([])
  const [shots, setShots] = useState<LocalShot[]>([])
  const uploadRef = useRef(upload)
  uploadRef.current = upload
  const withdrawRef = useRef(withdraw)
  withdrawRef.current = withdraw

  const mountedRef = useRef(true)
  const runningRef = useRef(false)
  const urgentRef = useRef(false)
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const captureTimersRef = useRef(new Map<string, ReturnType<typeof setTimeout>>())
  const waitersRef = useRef<Array<() => void>>([])
  const sequenceRef = useRef(0)

  const commit = useCallback((next: LocalShot[]) => {
    listRef.current = next
    if (mountedRef.current) setShots(next)
  }, [])

  const patch = useCallback((key: string, changes: Partial<LocalShot>) => {
    commit(listRef.current.map((shot) => (shot.key === key ? { ...shot, ...changes } : shot)))
  }, [commit])

  const settle = useCallback(() => {
    if (listRef.current.some((shot) => PENDING.has(shot.state))) return
    urgentRef.current = false
    const waiters = waitersRef.current
    waitersRef.current = []
    waiters.forEach((resolve) => resolve())
  }, [])

  const drop = useCallback((key: string) => {
    const timer = captureTimersRef.current.get(key)
    if (timer) {
      clearTimeout(timer)
      captureTimersRef.current.delete(key)
    }
    commit(listRef.current.filter((shot) => shot.key !== key))
    settle()
  }, [commit, settle])

  const send = useCallback(async (shot: LocalShot & { uri: string }): Promise<ShotUploadResult> => {
    for (let attempt = 0; ; attempt++) {
      try {
        return await uploadRef.current(shot)
      } catch (err) {
        if (isFinal(err) || attempt >= RETRY_DELAYS_MS.length) throw err
        await wait(RETRY_DELAYS_MS[attempt])
      }
    }
  }, [])

  const pump = useCallback(async () => {
    if (runningRef.current) return
    runningRef.current = true
    try {
      for (;;) {
        const next = listRef.current.find((shot) => shot.state === 'waiting' && !!shot.uri)
        if (!next) break
        patch(next.key, { state: 'sending', error: null })
        try {
          const result = await send({ ...next, uri: next.uri! })
          commit(listRef.current.map((shot) => {
            if (shot.key === next.key) {
              return { ...shot, state: 'saved', captureId: result.captureId, roundId: result.roundId }
            }
            // O primeiro envio de um momento solo acabou de criar a ronda: as
            // fotografias que esperavam por ela passam a pertencer-lhe.
            if (next.roundId === null && shot.roundId === null && shot.sessionId === next.sessionId) {
              return { ...shot, roundId: result.roundId }
            }
            return shot
          }))
          const current = listRef.current.find((shot) => shot.key === next.key)
          if (current?.removed) {
            drop(next.key)
            withdrawRef.current({ ...current, captureId: result.captureId }).catch(() => {})
          }
        } catch (err) {
          const current = listRef.current.find((shot) => shot.key === next.key)
          if (!current || current.removed) drop(next.key)
          else patch(next.key, { state: 'failed', error: errorMessage(err) || null })
        }
      }
    } finally {
      runningRef.current = false
      settle()
    }
  }, [commit, drop, patch, send, settle])

  const schedule = useCallback(() => {
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current)
    idleTimerRef.current = null
    if (urgentRef.current) {
      void pump()
      return
    }
    idleTimerRef.current = setTimeout(() => {
      idleTimerRef.current = null
      void pump()
    }, idleMs)
  }, [idleMs, pump])

  /** O obturador disparou. Devolve a chave com que o ficheiro vai ser entregue. */
  const add = useCallback((sessionId: string, roundId: string | null, slot: number) => {
    const key = `shot-${Date.now()}-${++sequenceRef.current}`
    // Uma fotografia nova quer dizer que a rajada continua: a fila espera.
    if (idleTimerRef.current) {
      clearTimeout(idleTimerRef.current)
      idleTimerRef.current = null
    }
    commit([...listRef.current, {
      key,
      sessionId,
      roundId,
      slot,
      uri: null,
      state: 'capturing',
      captureId: null,
      error: null,
      removed: false,
    }])
    captureTimersRef.current.set(key, setTimeout(() => {
      captureTimersRef.current.delete(key)
      if (listRef.current.find((shot) => shot.key === key)?.state === 'capturing') drop(key)
    }, CAPTURE_TIMEOUT_MS))
    return key
  }, [commit, drop])

  /** O ficheiro chegou: a fotografia está guardada no telemóvel. */
  const fill = useCallback((key: string, uri: string) => {
    const shot = listRef.current.find((item) => item.key === key)
    if (!shot || shot.state !== 'capturing') return
    const timer = captureTimersRef.current.get(key)
    if (timer) {
      clearTimeout(timer)
      captureTimersRef.current.delete(key)
    }
    patch(key, { uri, state: 'waiting' })
    schedule()
  }, [patch, schedule])

  /**
   * A pessoa retirou-a. Enquanto sobe, fica escondida e sai do servidor quando
   * lá chegar; já guardada, sai de lá agora. Se o servidor recusar, volta a
   * aparecer — e o erro sobe para quem chamou.
   */
  const remove = useCallback(async (key: string) => {
    const shot = listRef.current.find((item) => item.key === key)
    if (!shot) return
    if (shot.state === 'sending') {
      patch(key, { removed: true })
      return
    }
    if (shot.state === 'saved' && shot.captureId) {
      patch(key, { removed: true })
      try {
        await withdrawRef.current({ ...shot, captureId: shot.captureId })
        drop(key)
      } catch (err) {
        patch(key, { removed: false })
        throw err
      }
      return
    }
    drop(key)
  }, [drop, patch])

  /** Tentar outra vez uma que falhou. */
  const retry = useCallback((key: string) => {
    const shot = listRef.current.find((item) => item.key === key)
    if (!shot || shot.state !== 'failed') return
    patch(key, { state: 'waiting', error: null })
    void pump()
  }, [patch, pump])

  /**
   * Enviar já tudo o que falta, incluindo o que tinha falhado, e esperar.
   * Devolve quantas continuam por guardar no servidor.
   */
  const flush = useCallback(() => new Promise<number>((resolve) => {
    urgentRef.current = true
    if (idleTimerRef.current) {
      clearTimeout(idleTimerRef.current)
      idleTimerRef.current = null
    }
    commit(listRef.current.map((shot) => (
      shot.state === 'failed' && !shot.removed ? { ...shot, state: 'waiting', error: null } : shot
    )))
    waitersRef.current.push(() => {
      resolve(listRef.current.filter((shot) => shot.state === 'failed' && !shot.removed).length)
    })
    void pump()
    settle()
  }), [commit, pump, settle])

  /**
   * Esquecer as que já não pertencem ao momento — outra sessão, uma ronda que
   * fechou. Nunca a meio de um disparo ou de um envio; essas acabam primeiro.
   */
  const prune = useCallback((stale: (shot: LocalShot) => boolean) => {
    const keep = listRef.current.filter((shot) => (
      shot.state === 'capturing' || shot.state === 'sending' || !stale(shot)
    ))
    if (keep.length !== listRef.current.length) {
      commit(keep)
      settle()
    }
  }, [commit, settle])

  /** A lista de agora — para quem decide fora de um render, como o disparo. */
  const peek = useCallback(() => listRef.current, [])

  useEffect(() => {
    mountedRef.current = true
    const captureTimers = captureTimersRef.current
    return () => {
      mountedRef.current = false
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current)
      captureTimers.forEach(clearTimeout)
      captureTimers.clear()
    }
  }, [])

  return { shots, peek, add, fill, drop, remove, retry, flush, prune }
}
