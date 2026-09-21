import { INTERESTS as CATALOGUE } from '../../../screens/OnboardingScreen'
import type { Lang } from '../i18n'

/**
 * O catálogo de interesses.
 *
 * Os identificadores NÃO são escritos aqui: vêm do catálogo que a aplicação já
 * publica, importado tal como está. É deliberado — estes valores são
 * persistidos por pessoa e enviados para `/users/interests`, e uma segunda
 * lista copiada à mão seria uma divergência à espera de acontecer: bastava
 * alguém acrescentar um interesse de um lado para as duas deixarem de bater.
 *
 * O que este ficheiro faz é a única coisa que falta — apresentar. O `id` é já o
 * rótulo português (é assim que o produto o guarda); o inglês vem do mesmo
 * catálogo. O emoji fica de fora: um emoji ao lado de cada etiqueta lê-se como
 * decoração e a app tem uma família de ícones própria para quando é preciso
 * desenhar alguma coisa.
 */
export interface Interest {
  /** Valor persistido. Nunca traduzido, nunca renomeado. */
  id: string
  pt: string
  en: string
}

export const INTERESTS: Interest[] = CATALOGUE.map(({ id, en }) => ({ id, pt: id, en }))

export function interestLabel(interest: Interest, lang: Lang): string {
  return lang === 'pt' ? interest.pt : interest.en
}

/** Rótulo de um id solto — usado nos "interesses em comum" das sugestões. */
export function labelForId(id: string, lang: Lang): string {
  const found = INTERESTS.find((item) => item.id === id)
  return found ? interestLabel(found, lang) : id
}

/** A regra real do produto: três é o mínimo, não o máximo. */
export const MIN_INTERESTS = 3
