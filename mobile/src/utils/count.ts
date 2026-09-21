/**
 * O contador de uma acção — gostos, comentários, reposts, partilhas.
 *
 * Estava escrito duas vezes, palavra por palavra: uma na coluna da feed
 * imersiva (`ActionBar.fmt`) e outra na fila da Home (`HomePostAction.metric`).
 * Duas cópias do mesmo arredondamento é uma divergência à espera de acontecer —
 * basta alguém corrigir o limiar num lado.
 *
 * O corte é o mesmo que já estava em produção: milhares e milhões com uma casa
 * decimal. A especificação do Feed System pede o formato longo do português
 * ("1,2 mil") mas, na mesma frase, manda usar a função existente e não inventar
 * locale — e é isso que se faz aqui. Trocar para forma longa é uma decisão de
 * produto por idioma, não um detalhe de layout, e teria de passar pelo i18n.
 */
export function formatCount(value: number): string {
  const n = Math.max(0, Math.round(value))
  if (n >= 1_000_000) return `${+(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000)     return `${+(n / 1_000).toFixed(1)}K`
  return String(n)
}

/** O mesmo número, ou nada quando não há actividade para mostrar. */
export function formatCountOrNone(value: number): string | undefined {
  return value > 0 ? formatCount(value) : undefined
}
