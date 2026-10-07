// Os outros separadores conservam a altura da navegação. Na imersiva, a mesma
// faixa fica inteiramente com o campo de comentário.
export const TAB_BAR_ROW_HEIGHT = 48
export const FEED_COMPOSER_HEIGHT = 56
/** Linha das ações da publicação, entre a mídia e o compositor branco. */
export const FEED_ACTION_ROW_HEIGHT = 52
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
 * A barra da imersiva ocupa uma única fila: o campo branco e a safe area.
 * As ações e o traço do vídeo são posicionados pela própria célula da Feed.
 */
export function feedBarOccupiedHeight(safeBottom: number): number {
  return FEED_COMPOSER_HEIGHT + tabBarBottomInset(safeBottom)
}
