// Whitelist das fontes de publicação de texto.
//
// O cliente escolhe de uma lista, mas o pedido é só JSON — nada impede alguém
// de enviar outra coisa. Como esta chave acaba a decidir que família a app
// desenha, aceita-se exclusivamente o que está aqui: qualquer outro valor
// (incluindo vazio, número ou objeto) vira `null`, e `null` é a fonte padrão.
//
// Manter em espelho com `mobile/src/theme/postFonts.ts`. Acrescentar uma fonte
// é acrescentar a chave aqui e a família lá — nunca só de um lado, ou o post
// grava-se e volta sem estilo.

const POST_FONT_KEYS = ['sans', 'script', 'hand'] as const

export type PostFontKey = (typeof POST_FONT_KEYS)[number]

/**
 * Devolve a chave se for conhecida, senão `null`.
 *
 * A `sans` também dá `null`: é o valor por omissão e guardá-la explicitamente
 * só criaria duas maneiras de dizer a mesma coisa na base de dados.
 */
export function parsePostFontKey(raw: unknown): PostFontKey | null {
  if (typeof raw !== 'string') return null
  if (!(POST_FONT_KEYS as readonly string[]).includes(raw)) return null
  return raw === 'sans' ? null : (raw as PostFontKey)
}
