export { brandPalette, colors, gradients, sheet } from './colors'
export {
  normalizePostColor,
  postBackgroundFor,
  postBackgroundOptions,
  postGradientColors,
  type PostBackgroundKey,
} from './postColors'

export const fonts = {
  light: 'Jakarta-Light',
  regular: 'Jakarta-Regular',
  medium: 'Jakarta-Medium',
  semiBold: 'Jakarta-SemiBold',
  bold: 'Jakarta-Bold',
  extraBold: 'Jakarta-ExtraBold',
}

/**
 * A escada de espaço.
 *
 * Tinha seis degraus e saltava de 4 para 8 e de 8 para 16 — vãos onde a
 * interface real precisa mesmo de assentar. O resultado via-se no código: a Feed
 * usava catorze valores de `gap` e vinte e dois de `padding`, quase todos a cair
 * dentro desses vãos (6, 9, 10, 11, 12, 14). Não era falta de disciplina; era a
 * escada a não ter o degrau, e quem precisa de um degrau que não existe põe lá
 * um número.
 *
 * Os meios-degraus — `xs2`, `sm2`, `md2` — saem de onde os valores crus já se
 * agrupavam. Com eles a distância máxima entre um valor real e o degrau mais
 * próximo passa a ser 2px, e a escada deixa de ser contornável.
 *
 * Nada foi renomeado: `sm`, `md`, `lg` e `xl` valem o que sempre valeram nos
 * catorze ficheiros que já os usam.
 */
export const spacing = {
  xxs: 2,
  xs:  4,
  xs2: 6,
  sm:  8,
  sm2: 12,
  md:  16,
  md2: 20,
  lg:  24,
  xl:  32,
  xxl: 48,
}

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  full: 999,
}

/**
 * A escada de texto da app.
 *
 * Antes disto havia 32 tamanhos diferentes espalhados por 81 ficheiros, e o
 * mesmo papel escrito de três maneiras: um `sub` era 12 num ecrã, 12,5 noutro e
 * 13 num terceiro. A escada não foi inventada — sai dos tamanhos que já
 * dominavam o código, com os vizinhos a colapsar no degrau mais próximo.
 *
 * Cinco degraus com salto real entre eles. Uma régua de 1 em 1 (13, 14, 15) não
 * é escada nenhuma: os degraus fazem o mesmo trabalho e a escolha passa a ser
 * gosto do momento.
 *
 * `badge` é a excepção deliberada: texto dentro de uma forma de tamanho fixo —
 * um emblema de 17pt, um contador num círculo. Aí o tamanho é ditado pela forma
 * e não pela leitura, e forçá-lo para `meta` rebentava a caixa.
 */
export const typography = {
  badge:     9,    // dentro de uma forma fixa
  meta:      11,   // contadores, temporizadores, rótulos de secção
  secondary: 13,   // subtítulos, legendas, rótulos de botão
  body:      15,   // nomes, campos, o texto que se lê
  section:   17,   // título de secção dentro de um ecrã
  screen:    22,   // título de ecrã
  display:   28,   // números e frases grandes, isolados
}

/**
 * A entrelinha de cada degrau da escada.
 *
 * A `typography` dava o tamanho e calava-se sobre a altura da linha, e por isso
 * cada sítio inventava a sua: só a Feed tinha quinze — 11, 13, 14, 15, 16, 17,
 * 18, 19, 19.5, 20, 21, 22, 23, 24, 38. Um degrau de texto não é só um tamanho;
 * é um tamanho com o ar certo à volta. Faltando metade do par, a outra metade
 * passa a ser gosto do momento.
 *
 * A razão aperta à medida que o texto cresce, que é como o olho lê: `secondary`
 * é o degrau da legenda — texto pequeno e em várias linhas, o que mais precisa
 * de ar (1,46) — e de `body` para cima são nomes e títulos, quase sempre numa
 * linha só, onde o ar a mais só afasta as coisas (1,27–1,33).
 *
 * `display` fica em 38 por ser o valor que o texto grande da Feed já praticava;
 * não havia razão para o mexer só para arredondar uma razão.
 */
export const leading = {
  badge:     11,
  meta:      15,
  secondary: 19,
  body:      20,
  section:   22,
  screen:    28,
  display:   38,
}
