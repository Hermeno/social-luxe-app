import type { Post } from '../../types'
import { resolveMediaUrl } from '../../utils/media'
import { videoPosterUrl } from '../../utils/video'

/**
 * A API envia uma miniatura de vídeo fortemente desfocada para servir de LQIP.
 * Na Home ela é a imagem principal até a pessoa abrir o vídeo, portanto precisa
 * de ser um frame real. Cloudinary extrai-o no CDN, sem descarregar o vídeo nem
 * criar um player por célula; outros storages usam a capa que a API fornecer.
 */
export interface HomePostShape {
  kind: 'circle' | 'image' | 'video'
  urls: string[]
  /** Só em vídeo: o ficheiro que toca, distinto do cartaz em `urls[0]`. */
  videoUri?: string
  people: number
}

/**
 * Lê a publicação e decide o que ela é, uma vez só.
 *
 * O modelo não tem um campo "tipo": um Círculo reconhece-se por ter capturas
 * colectivas, um vídeo pelo `mediaType`. A leitura vive aqui para a lista, a
 * célula e a altura estimada não poderem discordar sobre o que estão a desenhar.
 */
export function readPost(post: Post): HomePostShape {
  const captures = Array.isArray(post.collectiveMoment?.captures)
    ? post.collectiveMoment.captures
    : []
  const participants = Array.isArray(post.collectiveMoment?.participants)
    ? post.collectiveMoment.participants
    : []

  if (post.mediaType !== 'VIDEO' && post.mediaType !== 'TEXT' && captures.length > 0) {
    return {
      kind: 'circle',
      urls: captures.map((capture, index) => resolveMediaUrl(
        post.mediaUrls?.[capture.mediaIndex ?? index] ?? capture.mediaUrl,
      )),
      people: participants.length || captures.length,
    }
  }

  if (post.mediaType === 'VIDEO') {
    // O cartaz e a mídia são endereços diferentes: um é o frame estático que
    // desenha enquanto o leitor não existe, o outro é o ficheiro que toca.
    return {
      kind: 'video',
      urls: [videoPosterUrl(post.mediaUrl, post.thumbnailUrl, 1080)],
      videoUri: resolveMediaUrl(post.mediaUrl),
      people: 0,
    }
  }

  return {
    kind: 'image',
    urls: (post.mediaUrls?.length ? post.mediaUrls : [post.mediaUrl]).map(resolveMediaUrl),
    people: 0,
  }
}
