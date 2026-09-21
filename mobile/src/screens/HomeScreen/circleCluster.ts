/**
 * A geometria da composição circular de um Círculo.
 *
 * É a assinatura visual da Luxey: as fotografias de quem esteve junto não são
 * uma grelha nem um carrossel — são discos que se tocam e formam uma só figura.
 *
 * A versão anterior desenhava um anel calculado por trigonometria, com o
 * tamanho de cada disco a variar ±7% a partir de uma semente tirada do id. Era
 * determinística, mas de uma maneira que não se podia verificar: para saber
 * onde ficava o terceiro disco de um Círculo de cinco era preciso correr a
 * função. E o anel puro não tinha centro — cinco pessoas liam-se como um donut,
 * sem ninguém em primeiro plano.
 *
 * O Feed System v1.0 fixa as composições uma a uma, em unidades de um palco de
 * **390×316**, e é isso que está aqui. A tabela é a especificação: cada número
 * abaixo pode ser lido contra o documento sem executar nada. Fora da base 390 a
 * figura inteira escala pelo mesmo factor — nunca se reorganiza, nunca recorta.
 *
 *   2 pessoas   dois discos de 196, lado a lado, sobreposição parcial
 *   3 pessoas   três de 156 em triângulo
 *   4 pessoas   quatro de 138 numa grelha 2×2 sobreposta
 *   5 pessoas   um centro de 156 e quatro satélites de 112
 *   6+          um centro de 148 e cinco satélites de 104
 *
 * A partir de seis participantes a figura deixa de crescer: seis fotografias
 * simultâneas é o limite em que um rosto ainda se reconhece. O sexto slot
 * continua a ser **uma fotografia real** — nunca um ponto abstracto — e recebe
 * por cima a contagem de quem não coube.
 *
 * Não há aleatoriedade nenhuma, nem sequer semeada: a mesma publicação desenha
 * a mesma figura em qualquer telefone, na Home e ao voltar da imersiva.
 */

/** Largura do palco de referência. Todas as medidas abaixo vivem nesta base. */
export const CIRCLE_STAGE_WIDTH = 390
/** Altura do palco de referência. */
export const CIRCLE_STAGE_HEIGHT = 316

/** Quantas fotografias a figura mostra ao mesmo tempo, no máximo. */
export const CIRCLE_MAX_SLOTS = 6

export interface ClusterDisc {
  /** Canto superior esquerdo, em pontos, relativo à caixa da composição. */
  x: number
  y: number
  /** Diâmetro. */
  d: number
  /** Ordem de pintura. O disco central fica sempre por cima. */
  z: number
}

export interface ClusterLayout {
  width: number
  height: number
  discs: ClusterDisc[]
}

/** Um disco na base 390×316: centro e diâmetro, que é como a spec o escreve. */
type Spot = readonly [cx: number, cy: number, d: number]

const CENTRE_X = CIRCLE_STAGE_WIDTH / 2   // 195
const CENTRE_Y = CIRCLE_STAGE_HEIGHT / 2  // 158

/**
 * Um só participante — o disco é a publicação.
 *
 * A spec não cobre este caso (um Círculo pede duas pessoas), mas os dados
 * cobrem-no: uma ronda pode acabar com uma única captura. Fica centrado e no
 * tamanho que a altura do palco permite.
 */
const ONE: Spot[] = [[CENTRE_X, CENTRE_Y, 220]]

const TWO: Spot[] = [
  [135, CENTRE_Y, 196],
  [255, CENTRE_Y, 196],
]

const THREE: Spot[] = [
  [125, 112, 156],
  [265, 112, 156],
  [195, 226, 156],
]

const FOUR: Spot[] = [
  [126, 108, 138],
  [264, 108, 138],
  [126, 226, 138],
  [264, 226, 138],
]

/** Centro primeiro; os satélites seguem no sentido da leitura. */
const FIVE: Spot[] = [
  [CENTRE_X, CENTRE_Y, 156],
  [ 80,  90, 112],
  [310,  94, 112],
  [102, 236, 112],
  [290, 236, 112],
]

/**
 * Seis slots: um centro de 148 e cinco satélites de 104 numa elipse.
 *
 * Os satélites saem de `rx: 132`, `ry: 100` a partir de -90° — a elipse mais
 * larga que mantém os cinco dentro do palco com o raio de 52 de cada um. Os
 * valores estão escritos e não calculados, pela mesma razão que os restantes:
 * uma tabela lê-se contra a especificação, uma fórmula não.
 */
const SIX: Spot[] = [
  [CENTRE_X, CENTRE_Y, 148],
  [195,  58, 104],
  [320, 127, 104],
  [273, 239, 104],
  [117, 239, 104],
  [ 69, 127, 104],
]

const TABLE: Record<number, Spot[]> = { 1: ONE, 2: TWO, 3: THREE, 4: FOUR, 5: FIVE }

/** As composições com centro têm o primeiro slot no meio; as outras não. */
export function circleHasCentre(count: number): boolean {
  return count >= 5
}

/**
 * Quantas fotografias esta figura desenha, e quantas pessoas ficam de fora.
 *
 * `extra` é o `+N` que o último slot recebe por cima — e só existe acima de
 * seis participantes, porque até lá cabem todos.
 */
export function circleSlotCount(people: number): { slots: number; extra: number } {
  const n = Math.max(1, people)
  if (n <= CIRCLE_MAX_SLOTS) return { slots: n, extra: 0 }
  return { slots: CIRCLE_MAX_SLOTS, extra: n - CIRCLE_MAX_SLOTS }
}

/**
 * A figura, em pontos, para a largura disponível.
 *
 * `width` é a largura real da coluna; tudo escala a partir de 390. A altura sai
 * da composição — a caixa é aparada à tinta, para o palco não reservar ar que
 * nenhum disco ocupa.
 */
export function circleClusterLayout(count: number, width: number): ClusterLayout {
  const { slots } = circleSlotCount(count)
  const spots = TABLE[slots] ?? SIX
  const scale = width / CIRCLE_STAGE_WIDTH
  const centred = circleHasCentre(slots)

  const discs: ClusterDisc[] = spots.map(([cx, cy, d], index) => ({
    x: (cx - d / 2) * scale,
    y: (cy - d / 2) * scale,
    d: d * scale,
    // O centro em cima de tudo; os satélites por ordem de participante, para
    // que dois vizinhos se sobreponham sempre no mesmo sentido.
    z: centred && index === 0 ? spots.length : index,
  }))

  const top = Math.min(...discs.map((disc) => disc.y))
  const bottom = Math.max(...discs.map((disc) => disc.y + disc.d))
  for (const disc of discs) disc.y -= top

  return { width, height: bottom - top, discs }
}
