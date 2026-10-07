/**
 * A geometria da figura de um Círculo.
 *
 * É a assinatura visual da Luxey: as fotografias de quem esteve junto não são
 * uma grelha nem um carrossel — são discos que se tocam e formam uma só figura.
 *
 * ── Como se chegou aqui ───────────────────────────────────────────────────────
 *
 * A primeira versão calculava um anel por trigonometria, com o tamanho de cada
 * disco a variar a partir de uma semente tirada do id. Foi substituída por uma
 * tabela de posições fixas — 2 lado a lado, 3 em triângulo, 4 em grelha 2×2, 5 e
 * 6 com centro e satélites — porque uma tabela se lê contra a especificação sem
 * executar nada.
 *
 * Mas uma tabela fixa dá a toda a app a mesma figura: duas publicações com
 * quatro fotografias desenhavam exactamente o mesmo quadrado, e a feed ficava a
 * repetir-se. A pedido, a figura volta a ser semeada — e com ela a vida que a
 * tabela tinha tirado:
 *
 *   · cada publicação tem o seu arranjo. Com duas fotografias, numas o par fica
 *     na diagonal, noutras uma em cima e a outra em baixo;
 *   · os discos espalham-se pelas duas medidas da caixa, em vez de deixarem meio
 *     ecrã vazio por baixo;
 *   · ângulo, raio e tamanho variam um pouco disco a disco, para a figura ser
 *     orgânica em vez de um compasso.
 *
 * As proporções da tabela ficaram: o centro continua a pesar 1.42 do satélite
 * (148/104 da spec) e quem chega depois do sexto entra a 0.7 dele. É isso que
 * faz a figura nova pertencer à mesma família da antiga.
 *
 * ── A regra que não se negocia ────────────────────────────────────────────────
 *
 * A semente é a identidade da publicação — nunca o relógio, nunca o render. A
 * mesma publicação desenha a mesma figura em qualquer telefone, na Home, na
 * imersiva e ao voltar de lá. Sem isto as fotografias saltavam de lugar a cada
 * scroll, que é a diferença entre uma figura viva e um ecrã nervoso.
 *
 * Dadas a contagem, a caixa e a semente, o resultado é sempre o mesmo. É o que
 * torna isto verificável, e é o que os testes exercitam.
 */

/** Largura do palco de referência da Home. */
export const CIRCLE_STAGE_WIDTH = 390
/** Altura do palco de referência da Home — a proporção da figura na página. */
export const CIRCLE_STAGE_HEIGHT = 316

/**
 * Quantas fotografias a figura mostra ao mesmo tempo, no máximo.
 *
 * Esteve em seis, com um `+N` por cima da última a dizer quantas ficavam de
 * fora — e não havia maneira nenhuma de as ver. Onze é o que a figura aguenta
 * sem um rosto deixar de se reconhecer: o centro, cinco à volta e cinco nos
 * vãos entre esses. O `+N` fica para o que ele sempre quis dizer de facto:
 * gente que esteve no momento e não fotografou.
 */
export const CIRCLE_MAX_SLOTS = 11

export interface ClusterDisc {
  /** Canto superior esquerdo, em pontos, relativo à caixa da figura. */
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

export interface ClusterRequest {
  /** Quantas fotografias a figura tem de desenhar. */
  count: number
  /** Largura disponível. */
  width: number
  /**
   * Altura a encher. Sem ela a figura toma a proporção do palco da Home, que é
   * o que mantém uma publicação do tamanho de uma publicação na página.
   */
  height?: number
  /**
   * A identidade da publicação. É daqui que sai o arranjo: a mesma publicação, a
   * mesma figura, sempre. Sem semente, todas as publicações ficam iguais.
   */
  seed?: string
}

// ─── A semente ────────────────────────────────────────────────────────────────

/** FNV-1a: curto, estável entre plataformas, e chega para semear um arranjo. */
function hashSeed(seed: string): number {
  let hash = 0x811c9dc5
  for (let index = 0; index < seed.length; index++) {
    hash ^= seed.charCodeAt(index)
    hash = Math.imul(hash, 0x01000193)
  }
  return hash >>> 0
}

/** mulberry32: pequeno e determinístico — mesma semente, mesma série. */
function prng(state: number): () => number {
  let value = state || 1
  return () => {
    value = (value + 0x6d2b79f5) >>> 0
    let t = Math.imul(value ^ (value >>> 15), 1 | value)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// ─── As proporções da figura ──────────────────────────────────────────────────
//
// A tabela que aqui esteve dava a cada contagem uma composição fixa. O que fica
// dela é a hierarquia — a primeira fotografia pesa mais que a última, como o
// centro pesava 1.42 do satélite na spec — e a sobreposição: discos que se
// tocam, nunca discos soltos.

/**
 * Quanto da caixa a tinta ocupa enquanto os lugares se escolhem.
 *
 * Não é o tamanho final: no fim há sempre um factor que ajusta a figura à caixa,
 * por isso o que aqui se decide é só a liberdade de colocação. Com os discos
 * demasiado grandes nesta fase, duas fotografias não tinham onde assentar como
 * par e caíam uma sobre a outra.
 */
const COVER = 0.4
/**
 * A primeira fotografia e a última, em fracção do diâmetro médio — mas só com a
 * figura cheia.
 *
 * A hierarquia cresce com a contagem: duas fotografias são um par e leem-se como
 * iguais; onze pedem uma ordem, senão a figura é uma mancha sem entrada. Entre
 * as duas pontas a diferença abre devagar, e é `hierarchy` que a mede.
 */
const SIZE_FIRST = 1.24
const SIZE_LAST = 0.74
/** Com quantas fotografias a hierarquia está no máximo. */
const HIERARCHY_FULL = 11
/** Variação de tamanho disco a disco, para a figura não parecer um compasso. */
const SIZE_JITTER = 0.06

/**
 * Onde um disco novo assenta: a `0.86` da soma dos raios do vizinho a que se
 * encosta. Entram 14% um no outro — tocam-se sem se comerem, que é o que faz a
 * figura ler-se como uma coisa só.
 */
const TOUCH = 0.86
/** Mais perto do que isto é um disco a comer o outro. */
const MIN_GAP = 0.74
/**
 * Quantos lugares se experimentam por fotografia antes de escolher o melhor.
 *
 * Metade saem de um vizinho ao acaso, metade na direcção que foge do centro da
 * figura: é essa segunda metade que leva os discos às bordas em vez de os
 * amontoar no meio.
 */
const CANDIDATES = 48
/** O quanto a primeira fotografia se afasta do centro da caixa. */
const FIRST_DRIFT = 0.22
/**
 * Quantas figuras completas se constroem antes de escolher.
 *
 * A colocação é gulosa: cada disco escolhe o melhor lugar sabendo só o que já
 * está posto, e um primeiro disco mal posto estraga o resto. Cinco começos
 * diferentes, e fica a melhor — com um só, o pior caso ficava nos 78% da altura.
 */
const RESTARTS = 5
/**
 * Voltas de polimento depois de a figura estar montada.
 *
 * Cada volta oferece a cada disco outro lugar e só o troca se a figura melhorar.
 * Nunca piora, e é o que desencalha os casos maus: com as duas voltas, a pior
 * figura de todas as contagens e sementes testadas enche 95% das duas medidas.
 *
 * O conjunto — 48 lugares por disco, 5 começos, 2 voltas — custa 0.4ms numa
 * figura de seis e 1.2ms numa de onze, uma vez por publicação.
 */
const POLISH_ROUNDS = 2

/** As figuras com centro têm o primeiro slot no disco maior; as outras não. */
export function circleHasCentre(count: number): boolean {
  return count >= 5
}

/**
 * Quantas fotografias esta figura desenha, e quantas pessoas ficam de fora.
 *
 * `extra` é o `+N` que o último disco recebe por cima — e só existe acima de
 * onze fotografias, porque até lá cabem todas.
 */
export function circleSlotCount(people: number): { slots: number; extra: number } {
  const n = Math.max(1, people)
  if (n <= CIRCLE_MAX_SLOTS) return { slots: n, extra: 0 }
  return { slots: CIRCLE_MAX_SLOTS, extra: n - CIRCLE_MAX_SLOTS }
}

interface Placed {
  cx: number
  cy: number
  r: number
}

/** A caixa que um conjunto de discos ocupa, em bordas. */
interface Extent {
  left: number
  right: number
  top: number
  bottom: number
}

/** A caixa que os discos ocupam. */
function spanOf(discs: Placed[]) {
  const left = Math.min(...discs.map((disc) => disc.cx - disc.r))
  const right = Math.max(...discs.map((disc) => disc.cx + disc.r))
  const top = Math.min(...discs.map((disc) => disc.cy - disc.r))
  const bottom = Math.max(...discs.map((disc) => disc.cy + disc.r))
  return { left, right, top, bottom, width: right - left, height: bottom - top }
}

/**
 * A figura, em pontos, para o espaço disponível.
 *
 * Os discos crescem como bolhas: a primeira fotografia nasce perto do centro da
 * caixa e cada uma das seguintes encosta-se a uma das que já lá estão. De cada
 * vez experimentam-se vários lugares e fica o que faz a figura cobrir mais da
 * caixa — é isso que a leva às quatro bordas em vez de a deixar meio ecrã vazio.
 *
 * Três regras travam o que a semente propõe: nenhum disco sai da caixa, nenhum
 * entra noutro mais do que `MIN_GAP`, e cada um tem de tocar quem já lá está. A
 * figura fica orgânica sem se desfazer em ilhas nem virar uma mancha.
 *
 * No fim, uma prova de caber: um factor uniforme e a figura centrada no que
 * sobra. Os diâmetros são diâmetros — a caixa decide onde os discos ficam,
 * nunca a forma deles. Um disco oval não é uma fotografia num Círculo.
 */
export function circleClusterLayout({ count, width, height, seed }: ClusterRequest): ClusterLayout {
  const { slots } = circleSlotCount(count)
  const boxHeight = height && height > 0
    ? height
    : width * (CIRCLE_STAGE_HEIGHT / CIRCLE_STAGE_WIDTH)
  if (width <= 0 || boxHeight <= 0 || slots <= 0) return { width, height: 0, discs: [] }

  const rand = prng(hashSeed(seed ?? 'luxey'))

  // ── Os tamanhos ───────────────────────────────────────────────────────────
  // Uma descida da primeira para a última, normalizada para a tinta ocupar
  // `COVER` da caixa: mais fotografias, discos menores, mancha igual.
  const hierarchy = Math.min(1, (slots - 1) / (HIERARCHY_FULL - 1))
  const first = 1 + (SIZE_FIRST - 1) * hierarchy
  const last = 1 + (SIZE_LAST - 1) * hierarchy
  const ratios: number[] = []
  for (let index = 0; index < slots; index++) {
    const along = slots === 1 ? 0 : index / (slots - 1)
    const ratio = first + (last - first) * along
    ratios.push(ratio * (1 + (rand() * 2 - 1) * SIZE_JITTER))
  }
  const area = ratios.reduce((sum, ratio) => sum + ratio * ratio, 0)
  const unit = Math.sqrt((COVER * width * boxHeight) / area)
  // Nenhum disco pode ser maior do que a caixa, por muito poucos que sejam.
  const cap = Math.min(width, boxHeight) / Math.max(...ratios)
  const radii = ratios.map((ratio) => (ratio * Math.min(unit, cap)) / 2)

  // ── Os lugares ────────────────────────────────────────────────────────────
  const inBox = (disc: Placed) => (
    disc.cx - disc.r >= 0 && disc.cx + disc.r <= width
    && disc.cy - disc.r >= 0 && disc.cy + disc.r <= boxHeight
  )
  const collides = (disc: Placed, others: Placed[]) => others.some((other) => {
    const distance = Math.hypot(disc.cx - other.cx, disc.cy - other.cy)
    return distance < (disc.r + other.r) * MIN_GAP
  })

  /**
   * O que faz um arranjo melhor que outro.
   *
   * Duas medidas, multiplicadas:
   *
   *   proporção   a caixa dos discos tem de ter a forma da caixa disponível. É
   *               isto que enche as duas medidas — uma figura com a proporção
   *               certa, ampliada no fim, toca as quatro bordas. Era o que
   *               faltava: um par na horizontal nunca enche um ecrã alto.
   *   densidade   a tinta a dividir pela caixa que ela ocupa. Sem isto o melhor
   *               arranjo seria um colar de discos em linha, que tem a
   *               proporção certa e não é figura nenhuma.
   *
   * O produto das duas escolhe um aglomerado denso com a forma do espaço.
   */
  const target = width / boxHeight
  // A conta é incremental de propósito: a caixa e a tinta do que já está posto
  // somam-se com um disco novo em tempo constante. A versão que montava um array
  // por candidato custava 6ms por figura — dez publicações na Home eram dois
  // frames perdidos a rolar.
  const scoreOf = (box: Extent, ink: number) => {
    const spanWidth = box.right - box.left
    const spanHeight = box.bottom - box.top
    if (spanWidth <= 0 || spanHeight <= 0) return 0
    const ratio = spanWidth / spanHeight
    const shape = Math.min(ratio / target, target / ratio)
    const density = ink / (spanWidth * spanHeight)
    // A proporção ao quadrado: entre uma figura um pouco mais densa e uma que
    // chega às bordas, é a que chega às bordas que se quer.
    return shape * shape * density
  }
  const withDisc = (box: Extent, disc: Placed): Extent => ({
    left: Math.min(box.left, disc.cx - disc.r),
    right: Math.max(box.right, disc.cx + disc.r),
    top: Math.min(box.top, disc.cy - disc.r),
    bottom: Math.max(box.bottom, disc.cy + disc.r),
  })
  const extentOf = (discs: Placed[]): Extent => discs.reduce(withDisc, {
    left: Infinity, right: -Infinity, top: Infinity, bottom: -Infinity,
  })
  const inkOf = (discs: Placed[]) => discs.reduce((sum, disc) => sum + Math.PI * disc.r * disc.r, 0)
  const arrangementScore = (discs: Placed[]) => scoreOf(extentOf(discs), inkOf(discs))

  const build = (): Placed[] => {
  const placed: Placed[] = [{
    cx: width / 2 + (rand() * 2 - 1) * width * FIRST_DRIFT,
    cy: boxHeight / 2 + (rand() * 2 - 1) * boxHeight * FIRST_DRIFT,
    r: radii[0],
  }]
  // A primeira tem de caber onde nasceu, mesmo com o desvio.
  placed[0].cx = Math.min(Math.max(placed[0].cx, radii[0]), width - radii[0])
  placed[0].cy = Math.min(Math.max(placed[0].cy, radii[0]), boxHeight - radii[0])

  let box = withDisc({ left: Infinity, right: -Infinity, top: Infinity, bottom: -Infinity }, placed[0])
  let ink = Math.PI * placed[0].r * placed[0].r

  for (let index = 1; index < slots; index++) {
    const r = radii[index]
    const area = Math.PI * r * r
    let best: Placed | null = null
    let bestScore = -Infinity
    let fallback: Placed | null = null
    let fallbackScore = -Infinity

    const midX = (box.left + box.right) / 2
    const midY = (box.top + box.bottom) / 2

    for (let attempt = 0; attempt < CANDIDATES; attempt++) {
      const anchor = placed[Math.floor(rand() * placed.length)]
      // Metade das tentativas foge do meio da figura — pela direcção do vizinho
      // escolhido, com meia volta de folga para a semente ainda decidir.
      const outward = attempt % 2 === 1
      const away = Math.atan2(anchor.cy - midY, anchor.cx - midX)
      const angle = outward && (anchor.cx !== midX || anchor.cy !== midY)
        ? away + (rand() * 2 - 1) * (Math.PI / 2)
        : rand() * Math.PI * 2
      const distance = (anchor.r + r) * TOUCH
      const candidate: Placed = {
        cx: anchor.cx + Math.cos(angle) * distance,
        cy: anchor.cy + Math.sin(angle) * distance,
        r,
      }
      const score = scoreOf(withDisc(box, candidate), ink + area)
      if (!inBox(candidate)) continue
      if (collides(candidate, placed)) {
        if (score > fallbackScore) { fallback = candidate; fallbackScore = score }
        continue
      }
      if (score > bestScore) { best = candidate; bestScore = score }
    }

    // Sem lugar limpo, aceita-se o menos mau: uma fotografia a mais sobreposta
    // é melhor do que uma fotografia que não aparece.
    const chosen = best ?? fallback ?? {
      cx: Math.min(Math.max(placed[0].cx, r), width - r),
      cy: Math.min(Math.max(placed[0].cy, r), boxHeight - r),
      r,
    }
    placed.push(chosen)
    box = withDisc(box, chosen)
    ink += area
  }
    return placed
  }

  let placed = build()
  let placedScore = arrangementScore(placed)
  for (let attempt = 1; attempt < RESTARTS; attempt++) {
    const candidate = build()
    const score = arrangementScore(candidate)
    if (score > placedScore) {
      placed = candidate
      placedScore = score
    }
  }

  // ── O polimento ───────────────────────────────────────────────────────────
  for (let round = 0; round < POLISH_ROUNDS; round++) {
    for (let index = 1; index < placed.length; index++) {
      const others = placed.filter((_, other) => other !== index)
      const othersBox = extentOf(others)
      const othersInk = inkOf(others)
      const r = placed[index].r
      const area = Math.PI * r * r
      for (let attempt = 0; attempt < CANDIDATES / 2; attempt++) {
        const anchor = others[Math.floor(rand() * others.length)]
        const angle = rand() * Math.PI * 2
        const distance = (anchor.r + r) * TOUCH
        const candidate: Placed = {
          cx: anchor.cx + Math.cos(angle) * distance,
          cy: anchor.cy + Math.sin(angle) * distance,
          r,
        }
        if (!inBox(candidate) || collides(candidate, others)) continue
        const score = scoreOf(withDisc(othersBox, candidate), othersInk + area)
        if (score <= placedScore) continue
        placed[index] = candidate
        placedScore = score
      }
    }
  }

  // ── A prova de caber ──────────────────────────────────────────────────────
  const span = spanOf(placed)
  const fit = Math.min(width / span.width, boxHeight / span.height)
  const offsetX = (width - span.width * fit) / 2

  const discs: ClusterDisc[] = placed.map((disc, index) => ({
    x: (disc.cx - disc.r - span.left) * fit + offsetX,
    y: (disc.cy - disc.r - span.top) * fit,
    d: disc.r * 2 * fit,
    // A primeira fotografia por cima de todas, e as últimas por trás: quem
    // chega depois encosta-se atrás de quem já lá estava.
    z: slots - index,
  }))

  return { width, height: span.height * fit, discs }
}
