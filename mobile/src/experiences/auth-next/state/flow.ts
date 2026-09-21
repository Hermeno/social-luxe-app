import type { Country } from '../data/countries'

/**
 * Os passos desta experiência, e nada mais.
 *
 * Não há aqui Home, feed, perfil nem navegação principal: o módulo termina e
 * devolve o controlo a quem o montou. `done` é a saída, não um ecrã.
 */
export type Step =
  | 'boot'      // A00
  | 'phone'     // A01  (A02 é uma folha por cima deste)
  | 'signIn'    // A03
  | 'password'  // A04
  | 'identity'  // A05
  | 'photo'     // P01
  | 'interests' // P02
  | 'suggestions' // P03
  | 'language'  // L01
  | 'appearance' // X01
  | 'done'

/**
 * O rascunho do percurso.
 *
 * A separação em três níveis é deliberada e está escrita no tipo:
 *
 *   efémero    a senha. Vive em memória, entre A04 e o registo em A05, e é
 *              apagada no instante em que a conta existe. Nunca toca em disco:
 *              nem AsyncStorage, nem SQLite, nem log.
 *   rascunho   telefone, país, nome, identificador escolhido, pré-visualização
 *              da foto, interesses ainda por guardar. Perde-se se a app morrer,
 *              e não faz mal nenhum — são dados que a pessoa reintroduz em
 *              segundos e que não valem o risco de ficarem guardados.
 *   persistido só o que um servidor confirmou, ou o que é preferência
 *              (idioma, tema) — e esse trabalho pertence aos adaptadores.
 */
export interface Draft {
  country: Country
  /** Só dígitos locais, sem indicativo. */
  localNumber: string
  /** Nome tal como escrito, por aparar só na submissão. */
  name: string
  /** Identificador escolhido nas sugestões. `null` = continuar sem. */
  handle: string | null
  /** URI local da fotografia escolhida. Não é prova de envio. */
  photoUri: string | null
}

/** O número em E.164, como a API o espera. */
export function e164(draft: Pick<Draft, 'country' | 'localNumber'>): string {
  return `${draft.country.code}${draft.localNumber.replace(/\D/g, '')}`
}

/**
 * Quantos dígitos bastam para deixar continuar.
 *
 * Sete é o que o produto já pratica. Não valida nada: não é uma máscara
 * internacional nem uma promessa de que o número existe — é só o ponto a partir
 * do qual vale a pena perguntar ao servidor. Dizer o contrário à pessoa seria
 * prometer uma verificação que não acontece.
 */
export const MIN_LOCAL_DIGITS = 7

export function phoneReady(draft: Pick<Draft, 'localNumber'>): boolean {
  return draft.localNumber.replace(/\D/g, '').length >= MIN_LOCAL_DIGITS
}

/** Máscara de leitura do número já conhecido, no A03. */
export function maskedPhone(value: string): string {
  const digits = value.replace(/[^\d+]/g, '')
  if (digits.length <= 6) return digits
  const head = digits.slice(0, digits.length - 6)
  const tail = digits.slice(-3)
  return `${head} ••• ${tail}`
}

/** As três regras de senha que a aplicação já aplica. Nem mais, nem menos. */
export const PASSWORD_RULES = [
  { id: 'length', test: (value: string) => value.length >= 8 },
  { id: 'number', test: (value: string) => /[0-9]/.test(value) },
  { id: 'upper',  test: (value: string) => /[A-Z]/.test(value) },
] as const

export function passwordReady(value: string): boolean {
  return PASSWORD_RULES.every((rule) => rule.test(value))
}

export const NAME_MIN = 2
export const NAME_MAX = 30

export function nameReady(value: string): boolean {
  const trimmed = value.trim()
  return trimmed.length >= NAME_MIN && trimmed.length <= NAME_MAX
}
