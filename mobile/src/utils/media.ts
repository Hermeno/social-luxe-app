import { API_BASE } from '../config'

/**
 * Endereço absoluto de uma mídia.
 *
 * A API devolve caminhos relativos para o que está guardado nela e URLs
 * completos para o que está no Cloudinary/R2; a câmara e o editor devolvem
 * `file://`. Os três chegam ao mesmo `<Image>`, por isso a conversão tem de
 * viver num sítio só.
 *
 * Nota honesta: esta função está escrita seis vezes dentro de `FeedScreen/`
 * (FeedItem, PostInfo, PostMedia, PostAlbumCarousel, AuthorPostsModal,
 * PostOptionsMenu), com pequenas diferenças entre elas — umas aceitam `file://`,
 * outras só `file`, outras nenhum. Esta é a versão para onde as outras devem
 * convergir; o código novo aponta para aqui em vez de fazer a sétima cópia.
 */
export function resolveMediaUrl(url: string | null | undefined): string {
  if (!url) return ''
  if (url.startsWith('http') || url.startsWith('file://')) return url
  return `${API_BASE}${url}`
}
