import { radius, spacing } from '../../theme'
import { ACTION_INK } from '../FeedScreen/tokens'

/**
 * A moldura da Home — a regra dos cantos, num sítio só.
 *
 * Duas coisas se fecham numa moldura nesta página: o Círculo e os cartões da
 * fila horizontal. Partilham o contorno e o raio porque são o mesmo objecto com
 * conteúdos diferentes — se cada um escolhesse o seu, a página passava a ter
 * duas ideias de canto.
 *
 * O raio não sai de um catálogo, sai de uma regra: **cantos concêntricos**. Uma
 * forma arredondada dentro de uma caixa arredondada só fica paralela ao contorno
 * se o raio de dentro for o de fora menos o afastamento. Daí `inner()`.
 *
 * E os dois casos confirmam-na, cada um com o seu afastamento:
 *
 *   Círculo   afastamento SIDE (16)  →  24 − 16 = 8, que é o `radius.sm`
 *   Cartão    afastamento BORDER (1) →  24 −  1 = 23, e é o recorte que o dá
 *
 * O primeiro cai em cima de um degrau da escada, o que é bom sinal: os números
 * fecham um no outro em vez de coexistirem.
 */

/** Fino: fecha o objecto sem o transformar num botão. */
export const FRAME_BORDER = 1

/**
 * O degrau mais alto da escada, e é preciso que seja.
 *
 * O que a moldura fecha é redondo — um anel de discos, ou uma fotografia que a
 * preenche toda. Um raio curto desenha quatro esquinas afiadas a discutir com
 * uma figura que não as tem. Vinte e quatro acompanha-a.
 */
export const FRAME_RADIUS = radius.xl

/** O contorno é a mesma tinta dos controlos: na página branca há um cinzento só. */
export const FRAME_INK = ACTION_INK

/** O raio que mantém uma forma interior paralela ao contorno. */
export const innerRadius = (inset: number) => Math.max(0, FRAME_RADIUS - inset)

/** Afastamento do conteúdo ao traço, quando o conteúdo não deve tocá-lo. */
export const FRAME_INSET = spacing.md
