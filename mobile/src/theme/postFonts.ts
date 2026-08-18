// Fontes das publicações de texto.
//
// Só a chave curta ('sans' | 'script' | 'hand') viaja até ao servidor e volta
// em cada post. O nome real da família nunca sai daqui: trocar o ficheiro de
// uma fonte um dia não obriga a migrar linhas na base de dados.

import { fonts } from './index'

export type PostFontKey = 'sans' | 'script' | 'hand'

type PostFont = {
  /** Família tal como fica registada no `Font.loadAsync`. */
  family: string
  /** As cursivas desenham mais pequeno ao mesmo corpo — compensa-se aqui. */
  sizeScale: number
  /** Ascendentes e descendentes altos precisam de mais entrelinha, senão cortam. */
  lineHeightScale: number
  /** Amostra mostrada no seletor do compositor. */
  sample: string
  /** A `sans` já vem no arranque; as cursivas chegam depois, em segundo plano. */
  lazy: boolean
}

export const POST_FONTS: Record<PostFontKey, PostFont> = {
  sans:   { family: fonts.bold,           sizeScale: 1,    lineHeightScale: 1,    sample: 'Aa', lazy: false },
  script: { family: 'DancingScript-Bold', sizeScale: 1.32, lineHeightScale: 1.24, sample: 'Aa', lazy: true  },
  hand:   { family: 'Caveat-Bold',        sizeScale: 1.38, lineHeightScale: 1.14, sample: 'Aa', lazy: true  },
}

export const POST_FONT_KEYS = Object.keys(POST_FONTS) as PostFontKey[]

export const DEFAULT_POST_FONT: PostFontKey = 'sans'

/**
 * Posts anteriores a esta funcionalidade não têm `fontKey`, e uma versão mais
 * nova do servidor pode servir uma chave que esta app ainda não conhece.
 * Ambos os casos caem na `sans` em vez de partirem o render.
 */
export function parsePostFontKey(raw: unknown): PostFontKey {
  return typeof raw === 'string' && raw in POST_FONTS
    ? (raw as PostFontKey)
    : DEFAULT_POST_FONT
}

/**
 * Estilo de texto de uma publicação, derivado das medidas da `sans`.
 *
 * `ready` vem do `postFonts.store`: enquanto o ficheiro não chegou devolve a
 * `sans`. Referir uma família ainda não carregada não é seguro no Android, e
 * mesmo no iOS o fallback silencioso dava um salto de tipo a meio da leitura.
 */
export function postFontStyle(
  key: PostFontKey,
  baseSize: number,
  baseLineHeight: number,
  ready: boolean,
): { fontFamily: string; fontSize: number; lineHeight: number } {
  const font = POST_FONTS[key]

  if (font.lazy && !ready) {
    return {
      fontFamily: POST_FONTS.sans.family,
      fontSize:   baseSize,
      lineHeight: baseLineHeight,
    }
  }

  return {
    fontFamily: font.family,
    fontSize:   Math.round(baseSize * font.sizeScale),
    lineHeight: Math.round(baseLineHeight * font.lineHeightScale),
  }
}
