export { colors, gradients } from './colors'

export const fonts = {
  light: 'Jakarta-Light',
  regular: 'Jakarta-Regular',
  medium: 'Jakarta-Medium',
  semiBold: 'Jakarta-SemiBold',
  bold: 'Jakarta-Bold',
  extraBold: 'Jakarta-ExtraBold',
}

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
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
