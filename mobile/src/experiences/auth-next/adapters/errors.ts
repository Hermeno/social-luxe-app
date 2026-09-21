import { isConnected } from '../../../services/netinfo.service'
import type { Strings } from '../i18n'

/**
 * O que se pode e o que não se pode dizer sobre uma falha.
 *
 * Há aqui um limite real do código existente, e vale a pena escrevê-lo: o
 * interceptor do `services/api.ts` rejeita **sempre** com `new Error(mensagem)`.
 * O `status` HTTP não sobrevive à travessia. Quem consome `login()` recebe uma
 * frase, não um código — e por isso não é possível, deste lado, distinguir com
 * certeza um 401 de um 500.
 *
 * A resposta a isso não é adivinhar. É dizer só o que se sabe:
 *
 *   offline    a rede local está em baixo — sabemos pelo NetInfo, não pela API
 *   timeout    a mensagem fixa que o interceptor produz quando não há resposta
 *   server     o servidor explicou-se; mostramos a explicação dele, tal e qual
 *   unknown    não houve mensagem utilizável
 *
 * O que NÃO fazemos é transformar qualquer falha de login em "senha incorreta".
 * Dizer a alguém que a senha está errada quando o serviço é que caiu leva a
 * pessoa a mudar uma senha que estava certa.
 */
export type FailureKind = 'offline' | 'timeout' | 'server' | 'unknown'

export interface Failure {
  kind: FailureKind
  /** Mensagem pronta a mostrar. Em `server`, é a frase do próprio servidor. */
  message: string
}

/** A frase exacta que o interceptor usa quando não houve resposta nenhuma. */
const TIMEOUT_MARKERS = ['demorou demasiado', 'timed out', 'timeout']

export function classify(error: unknown, t: Strings, fallback: string): Failure {
  if (!isConnected()) return { kind: 'offline', message: t.errOffline }

  const raw = error instanceof Error ? error.message.trim() : ''
  if (!raw) return { kind: 'unknown', message: fallback || t.errUnknown }

  const lower = raw.toLowerCase()
  if (TIMEOUT_MARKERS.some((marker) => lower.includes(marker))) {
    return { kind: 'timeout', message: t.errTimeout }
  }

  // "Erro de rede" é o texto genérico do interceptor quando não há mensagem do
  // servidor — não é uma explicação, é a ausência de uma.
  if (lower === 'erro de rede') return { kind: 'unknown', message: fallback || t.errUnknown }

  return { kind: 'server', message: raw }
}
