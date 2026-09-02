import React from 'react'

import FeedIcon from './FeedIcon'

export type PostActionIconName =
  | 'like'
  | 'comment'
  | 'repost'
  | 'share'
  | 'options'
  | 'author-posts'

interface Props {
  name: PostActionIconName
  size: number
  color: string
  /** Só muda a forma onde existe um estado semântico próprio, como o gosto. */
  selected?: boolean
}

/**
 * Traço da fila de acções: 1.70px numa caixa de 28 — 6.07% do lado.
 *
 * O número não foi escolhido, foi encontrado. É o que o `share` e o `repost` já
 * praticavam, e são eles a referência porque foram os dois que ninguém achou nem
 * pesados nem apagados enquanto o coração, o balão e o menu andaram acima.
 *
 * É uma FRACÇÃO e não um número de px, e é aí que está a correcção. O `boostPx`
 * conta em px do tamanho renderizado, por isso um reforço fixo de 0.5 valia o
 * mesmo a 28 e a 32 — a fila da Home ficava certa e a da imersiva, 14% maior,
 * ficava com os preenchidos leves e o coração pesado. Uma fila só pode ter uma
 * espessura relativa, senão muda de peso ao mudar de ecrã.
 */
const STROKE_RATIO = 1.7 / 28

/**
 * A banda com que cada desenho preenchido nasce, na mesma fracção.
 *
 * Estes três trazem o contorno cozido no `fill`, e não medem o mesmo à saída:
 * o balão nasce grosso, a seta fina, o repost quase no alvo. Medido por
 * 2·área/perímetro sobre o render real — a conta está em
 * `design/feed-icons/build.mjs` e os valores em `measurements.json`.
 *
 * É por isto que não pode haver um reforço único. `0.5` nos três punha o balão
 * em 1.94 e a seta em 1.69, com o mesmo número a fazer coisas diferentes.
 */
const NATIVE_BAND = {
  comment: 1.44 / 28,
  share: 1.19 / 28,
  repost: 1.62 / 28,
} as const

/**
 * O reforço que falta a um preenchido para chegar ao traço da fila.
 *
 * O `boostPx` contorna a forma com a própria cor: metade cresce para fora, metade
 * para dentro do que já está pintado, e a banda sobe exactamente o valor dado.
 * Nunca desce — daí o corte a zero para um desenho que já nasça acima do alvo.
 */
const boostFor = (name: keyof typeof NATIVE_BAND, size: number) =>
  Math.max(0, (STROKE_RATIO - NATIVE_BAND[name]) * size)

/**
 * Contrato visual das ações de uma publicação.
 *
 * Todos recebem a mesma caixa e saem com o mesmo traço, venham de onde vierem.
 * Cada um chega lá por onde pode, porque os desenhos não são do mesmo tipo:
 *
 *   like          traçado, no ficheiro  → `stroke-width` no `heart.svg`
 *   options       barras preenchidas    → altura do rect no `option.svg`
 *   comment       contorno no `fill`    → `boostPx`, aqui
 *   share         contorno no `fill`    → `boostPx`, aqui
 *   repost        contorno no `fill`    → `boostPx`, aqui
 *   author-posts  traçado               → `strokePx`, aqui
 *
 * Os dois primeiros não levam nada porque a espessura vive no próprio desenho e
 * escala com ele. Mexer neles é mexer no SVG, num sítio só, e não a partir de
 * cada ecrã que os desenha.
 */
export default function PostActionIcon({ name, size, color, selected = false }: Props) {
  if (name === 'like') {
    return <FeedIcon name={selected ? 'heart-solid' : 'heart'} size={size} color={color} />
  }

  if (name === 'options') {
    return <FeedIcon name="option" size={size} color={color} weight="regular" />
  }

  if (name === 'author-posts') {
    return <FeedIcon name="author-posts" size={size} color={color} strokePx={STROKE_RATIO * size} />
  }

  return <FeedIcon name={GLYPH[name]} size={size} color={color} boostPx={boostFor(name, size)} />
}

const GLYPH = {
  comment: 'chat-outline',
  share: 'share',
  repost: 'repost',
} as const
