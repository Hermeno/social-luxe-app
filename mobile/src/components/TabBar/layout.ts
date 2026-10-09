// Os outros separadores conservam a altura da navegação. Na imersiva, a mesma
// faixa reserva espaço para a cápsula de comentário centralizada.
export const TAB_BAR_ROW_HEIGHT = 48
export const FEED_COMPOSER_HEIGHT = 56
/**
 * Linha das ações da publicação, entre a mídia e o campo de comentário.
 *
 * 44 é o que se desenha: o glifo mede 32 e sobram 6 de ar acima e abaixo.
 *
 * O alvo de toque não desce com ela. A faixa era, ela própria, o rectângulo que
 * respondia ao dedo, e encolhê-la punha as acções abaixo dos 48 do Android —
 * por isso cada célula recupera os que faltam com `hitSlop` vertical (ver
 * `FEED_ACTION_TOUCH_SLOP`). É a excepção que o topo não pode fazer, porque lá
 * o alvo tem de assentar na régua da página; aqui o que o dedo ganha são 2pt
 * para dentro da mídia, que ninguém vê e nada disputa.
 *
 * Esteve em 52, depois 48. O que sai volta para a mídia: toda a pilha da célula
 * — traço do vídeo, legenda, moldura — é calculada a partir desta constante.
 */
export const FEED_ACTION_ROW_HEIGHT = 44
/** O que falta a cada célula da fila para o alvo somar os 48 do Android. */
export const FEED_ACTION_TOUCH_SLOP = 2
export const TAB_BAR_STAGE_HEIGHT = Math.max(TAB_BAR_ROW_HEIGHT, FEED_COMPOSER_HEIGHT)
export const TAB_BAR_TOP_GAP = 4
/**
 * Quanto os ícones sobem em relação ao centro da faixa.
 *
 * Centrados na altura toda ficavam a olhar para o vazio da safe area: por baixo
 * deles há o indicador de gestos, que já é margem, e por cima nada. O peso ótico
 * da linha pede que assentem acima do meio geométrico.
 */
export const TAB_BAR_ICON_LIFT = 5
export const TAB_BAR_MIN_BOTTOM_INSET = 8

export function tabBarBottomInset(safeBottom: number): number {
  return Math.max(safeBottom, TAB_BAR_MIN_BOTTOM_INSET)
}

export function tabBarOccupiedHeight(safeBottom: number): number {
  return TAB_BAR_TOP_GAP + TAB_BAR_STAGE_HEIGHT + tabBarBottomInset(safeBottom)
}

/**
 * A barra da imersiva ocupa uma única fila: o campo de comentário e a safe area.
 * As ações e o traço do vídeo são posicionados pela própria célula da Feed.
 */
export function feedBarOccupiedHeight(safeBottom: number): number {
  return FEED_COMPOSER_HEIGHT + tabBarBottomInset(safeBottom)
}
