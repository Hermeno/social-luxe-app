/**
 * A geometria da composição circular de um Círculo.
 *
 * É a assinatura visual da Luxey: as fotografias de quem esteve junto não são
 * uma grelha nem um carrossel — são discos que se tocam e formam uma só figura.
 * Por isso a disposição não pode ser aleatória (mudava a cada render e a mesma
 * publicação nunca seria a mesma) nem rígida (com passo perfeito lê-se como um
 * diagrama, não como um momento).
 *
 * O compromisso é este: a estrutura é determinística — anel, ângulo e raio saem
 * de contas fechadas — e só o tamanho de cada disco varia, dentro de ±7%, a
 * partir de uma semente tirada do id da publicação. A mesma publicação desenha-se
 * sempre igual, em qualquer telefone e a qualquer momento; publicações diferentes
 * não se parecem umas com as outras.
 *
 * Suporta de 2 a ~20 participantes sem nunca sair da largura disponível: quando
 * o anel calculado transborda, tudo encolhe pelo mesmo factor em vez de recortar
 * ou empilhar.
 */

export interface ClusterDisc {
  /** Canto superior esquerdo, em pontos, relativo à caixa da composição. */
  x: number
  y: number
  /** Diâmetro. */
  d: number
  /** Ordem de pintura: os discos maiores ficam por baixo. */
  z: number
}

export interface ClusterLayout {
  width: number
  height: number
  discs: ClusterDisc[]
}

/**
 * Semente estável a partir do id — o mesmo texto dá sempre o mesmo número.
 * (djb2: barato, boa dispersão para o pouco que aqui se pede.)
 */
function seedOf(key: string): number {
  let hash = 5381
  for (let i = 0; i < key.length; i++) hash = ((hash << 5) + hash + key.charCodeAt(i)) >>> 0
  return hash
}

/** Ruído determinístico em [0,1) para o índice `i` desta semente. */
function noise(seed: number, i: number): number {
  const x = Math.sin(seed * 0.0001 + i * 12.9898) * 43758.5453
  return x - Math.floor(x)
}

/**
 * Fracção da largura que cada disco ocupa, por número de discos no anel.
 *
 * Desce à medida que o anel enche: com muitos discos do mesmo tamanho a figura
 * fecha-se num donut e o vazio do meio passa a ser a forma dominante. Os valores
 * saem da referência (cinco discos ≈ 42% da largura) e do que continua legível
 * em baixo — abaixo de 26% um rosto deixa de se reconhecer.
 */
function discFraction(ringCount: number): number {
  if (ringCount <= 3) return 0.50
  if (ringCount === 4) return 0.46
  if (ringCount === 5) return 0.42
  if (ringCount === 6) return 0.38
  if (ringCount <= 8) return 0.33
  return 0.28
}

/** Como os discos se repartem entre o anel de fora e o de dentro. */
function split(count: number): { outer: number; inner: number } {
  if (count <= 6) return { outer: count, inner: 0 }
  if (count <= 9) return { outer: 6, inner: count - 6 }
  if (count <= 14) return { outer: 8, inner: count - 8 }
  return { outer: 9, inner: count - 9 }
}

/** Sobreposição entre vizinhos do mesmo anel: 22% do diâmetro. */
const NEIGHBOUR_OVERLAP = 0.78
/** Variação de tamanho disco a disco. */
const SIZE_JITTER = 0.07

export function circleClusterLayout(count: number, width: number, key: string): ClusterLayout {
  const n = Math.max(1, Math.min(count, 20))
  const seed = seedOf(key)

  // ── Um só: o disco é a publicação ────────────────────────────────────────
  if (n === 1) {
    const d = width * 0.70
    return { width, height: d, discs: [{ x: (width - d) / 2, y: 0, d, z: 0 }] }
  }

  // ── Dois: lado a lado, com um desnível mínimo para não parecerem um símbolo
  //    de infinito. É o caso mais comum de um Círculo e o que mais se nota. ──
  if (n === 2) {
    const d = width * 0.54
    const gap = d * NEIGHBOUR_OVERLAP
    const drop = d * 0.07
    const left = (width - (d + gap)) / 2
    return {
      width,
      height: d + drop,
      discs: [
        { x: left, y: 0, d, z: 0 },
        { x: left + gap, y: drop, d, z: 1 },
      ],
    }
  }

  const { outer, inner } = split(n)
  const base = width * discFraction(outer)

  // Raio que põe os vizinhos do anel a sobreporem-se exactamente
  // `NEIGHBOUR_OVERLAP`: a corda entre dois centros vale 2·R·sen(π/k).
  const ringRadius = (base * NEIGHBOUR_OVERLAP) / (2 * Math.sin(Math.PI / outer))

  // Se o anel transbordar a largura, encolhe tudo pelo mesmo factor — a figura
  // mantém-se, só fica menor. Nunca recorta e nunca reorganiza.
  //
  // A conta usa o disco no seu tamanho MÁXIMO, não no base: a variação de ±7%
  // aplica-se depois desta linha, e medir pelo base deixava o maior disco sair
  // 2 a 4pt pela margem em alguns números de participantes.
  const span = 2 * ringRadius + base * (1 + SIZE_JITTER)
  const scale = span > width ? width / span : 1
  const d0 = base * scale
  const R = ringRadius * scale

  const cx = width / 2
  const cy = R + d0 / 2
  const discs: ClusterDisc[] = []

  const place = (index: number, total: number, radius: number, sizeFactor: number, angleOffset: number) => {
    const angle = -Math.PI / 2 + angleOffset + (index / total) * Math.PI * 2
    const d = d0 * sizeFactor * (1 + (noise(seed, discs.length) - 0.5) * 2 * SIZE_JITTER)
    discs.push({
      x: cx + Math.cos(angle) * radius - d / 2,
      y: cy + Math.sin(angle) * radius - d / 2,
      d,
      z: 0,
    })
  }

  for (let i = 0; i < outer; i++) place(i, outer, R, 1, 0)
  // O anel de dentro roda meio passo para os discos caírem nos intervalos do de
  // fora em vez de atrás deles.
  for (let i = 0; i < inner; i++) place(i, inner, R * 0.42, 0.82, Math.PI / Math.max(inner, 1))

  // Os maiores por baixo: um disco pequeno tapado por um grande desaparece, ao
  // contrário do inverso. É o que dá profundidade à figura sem sombra nenhuma.
  const order = [...discs].sort((a, b) => b.d - a.d)
  order.forEach((disc, index) => { disc.z = index })

  const top = Math.min(...discs.map((disc) => disc.y))
  const bottom = Math.max(...discs.map((disc) => disc.y + disc.d))
  for (const disc of discs) disc.y -= top

  return { width, height: bottom - top, discs }
}
