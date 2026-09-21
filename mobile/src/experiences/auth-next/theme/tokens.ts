/**
 * Os tokens da experiência de autenticação.
 *
 * Vivem aqui e não no `theme/` da aplicação por uma razão de contrato: este
 * módulo não pode editar o original. Mas a separação também é honesta — a
 * autenticação tem uma superfície própria (papel branco, um só acento, nenhuma
 * mídia por baixo) e o `theme/` da app carrega decisões da feed que aqui não se
 * aplicam.
 *
 * Nada de valores soltos nos ecrãs. Se um número não estiver nesta folha, não
 * existe.
 */

/** A progressão oficial da Luxey. Copiada por valor: o módulo não importa o theme antigo. */
export const brand = {
  blue:    '#2F49FD',
  indigo:  '#4F4AFB',
  violet:  '#7A47F5',
  purple:  '#A544ED',
  magenta: '#C846E2',
} as const

export type AccentKey = keyof typeof brand

export const ACCENT_ORDER: AccentKey[] = ['blue', 'indigo', 'violet', 'purple', 'magenta']

/**
 * A escada de espaço.
 *
 * Oito degraus, do detalhe à separação entre secções. 4 e 8 são folgas dentro de
 * um componente; 12 e 16 separam elementos irmãos; 20 e 24 separam blocos; 32 e
 * 40 separam o título da tarefa e a tarefa do rodapé.
 */
export const space = {
  xs:  4,
  sm:  8,
  md:  12,
  lg:  16,
  xl:  20,
  xxl: 24,
  block: 32,
  section: 40,
} as const

/**
 * A margem lateral da página.
 *
 * 24 na base de 390. Em ecrãs estreitos desce para 20 — abaixo disso um título
 * de duas palavras começa a partir-se em três linhas, e a página perde o ritmo
 * antes de ganhar largura útil.
 */
export const GUTTER = 24
export const GUTTER_NARROW = 20
export const NARROW_WIDTH = 370

/**
 * Raios.
 *
 * Dois, e chegam: 12 para tudo o que é caixa (campo, botão, cartão) e o pleno
 * para o que é mesmo redondo (avatar, radio, ponto de acento). Não há cápsulas
 * — um formulário inteiro em pílulas lê-se como um produto sem hierarquia.
 * A excepção é o chip de interesse, que é uma etiqueta e não uma caixa.
 */
export const radius = {
  box: 12,
  chip: 10,
  sheet: 20,
  full: 999,
} as const

/**
 * Alturas de controlo.
 *
 * Campo e botão medem o mesmo (54): numa coluna vertical de formulário, dois
 * controlos de alturas próximas mas diferentes lêem-se como um erro de
 * alinhamento, não como hierarquia.
 */
export const control = {
  height: 54,
  /** Alvo mínimo de toque: 44 no iOS, 48 no Android. Guardamos o maior. */
  target: 48,
} as const

/** Duração das transições. Curtas: nada aqui é espectáculo. */
export const motion = {
  fast: 150,
  base: 200,
  slow: 220,
} as const

/**
 * A escada tipográfica.
 *
 * Os pesos vivem com os tamanhos porque um tamanho sem peso não é um papel.
 * O título é 30 e não 40: orienta a tarefa, não compete com ela.
 */
export const type = {
  title:   { size: 30, line: 37, weight: '700' as const },
  /** Quando o título tem de caber em três linhas num ecrã estreito. */
  titleSm: { size: 26, line: 32, weight: '700' as const },
  intro:   { size: 15, line: 22, weight: '400' as const },
  label:   { size: 13, line: 18, weight: '600' as const },
  value:   { size: 16, line: 22, weight: '400' as const },
  help:    { size: 12, line: 17, weight: '400' as const },
  error:   { size: 13, line: 18, weight: '500' as const },
  action:  { size: 15, line: 20, weight: '600' as const },
  /** Nome numa lista, título de uma linha de escolha. */
  row:     { size: 15, line: 20, weight: '600' as const },
  rowSub:  { size: 13, line: 18, weight: '400' as const },
} as const

export type TypeRole = keyof typeof type

/**
 * Os cinco níveis de tamanho de texto do X01.
 *
 * Multiplicadores, não tamanhos: o que a pessoa escolhe é uma escala, e a
 * hierarquia entre título e ajuda mantém-se em qualquer nível. O nível 3 é 1,0
 * — o desenho aprovado é o meio da escada, não o seu mínimo.
 */
export const TEXT_SCALE = [0.88, 0.94, 1, 1.08, 1.18] as const
export const DEFAULT_TEXT_LEVEL = 3

export interface Palette {
  /** Fundo da página. */
  surface: string
  /** Uma superfície pousada sobre a página — folha, cartão de pré-visualização. */
  raised: string
  /** Fundo de um campo ou de um chip por escolher. */
  field: string
  /** Texto principal. */
  ink: string
  /** Texto de apoio, legenda, ajuda. */
  inkMuted: string
  /** Marca de água: placeholder, ícone de um lugar vazio. */
  inkFaint: string
  /** Contorno suave — separador, borda de campo em repouso. */
  line: string
  /** Contorno que precisa de se ver — campo focado, botão secundário. */
  lineStrong: string
  /** O comando principal. Neutro de propósito: o acento não é um CTA. */
  ctaBg: string
  ctaInk: string
  /** Estado de erro. */
  danger: string
  /** Fundo por trás de uma folha modal. */
  scrim: string
}

export const lightPalette: Palette = {
  surface:    '#FFFFFF',
  raised:     '#FFFFFF',
  field:      '#F7F7F7',
  ink:        '#111111',
  inkMuted:   '#737373',
  inkFaint:   '#A3A3A3',
  line:       '#E8E8E8',
  lineStrong: '#D8D8D8',
  ctaBg:      '#111111',
  ctaInk:     '#FFFFFF',
  danger:     '#B42318',
  scrim:      'rgba(17,17,17,0.44)',
}

/**
 * O escuro do módulo.
 *
 * Não é o `feedSurface` (#0B141A) da feed imersiva. Aquilo é uma superfície
 * funcional desenhada para ter fotografia por cima, com um desvio azul que a
 * separa da mídia; isto é papel escuro para ler texto. Confundi-los daria a um
 * formulário a cor de um leitor de vídeo.
 */
export const darkPalette: Palette = {
  surface:    '#101014',
  raised:     '#17171C',
  field:      '#1B1B21',
  ink:        '#F4F4F6',
  inkMuted:   '#9C9CA6',
  inkFaint:   '#6E6E78',
  line:       '#26262E',
  lineStrong: '#3A3A45',
  ctaBg:      '#F4F4F6',
  ctaInk:     '#111111',
  danger:     '#F2827A',
  scrim:      'rgba(0,0,0,0.6)',
}

/** A família da marca. O módulo usa as faces já carregadas pela aplicação. */
export const family = {
  regular:  'Jakarta-Regular',
  medium:   'Jakarta-Medium',
  semiBold: 'Jakarta-SemiBold',
  bold:     'Jakarta-Bold',
} as const

/** O peso do token tipográfico traduzido para uma face real. */
export function faceFor(weight: '400' | '500' | '600' | '700'): string {
  if (weight === '700') return family.bold
  if (weight === '600') return family.semiBold
  if (weight === '500') return family.medium
  return family.regular
}
