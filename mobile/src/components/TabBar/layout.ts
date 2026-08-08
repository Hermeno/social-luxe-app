export const TAB_BAR_ROW_HEIGHT = 44
export const TAB_BAR_TOP_GAP = 4
export const TAB_BAR_MIN_BOTTOM_INSET = 8

export function tabBarBottomInset(safeBottom: number): number {
  return Math.max(safeBottom, TAB_BAR_MIN_BOTTOM_INSET)
}

export function tabBarOccupiedHeight(safeBottom: number): number {
  return TAB_BAR_TOP_GAP + TAB_BAR_ROW_HEIGHT + tabBarBottomInset(safeBottom)
}
