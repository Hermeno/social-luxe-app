import type { CircleSlot } from '../../components/CircleMediaComposition'
import type { CollectiveMomentCapture, CollectiveMomentParticipant, Post } from '../../types'
import { resolveMediaUrl } from '../../utils/media'
import { videoPosterUrl } from '../../utils/video'

/**
 * A API envia uma miniatura de vídeo fortemente desfocada para servir de LQIP.
 * Na Home ela é a imagem principal até a pessoa abrir o vídeo, portanto precisa
 * de ser um frame real. Cloudinary extrai-o no CDN, sem descarregar o vídeo nem
 * criar um player por célula; outros storages usam a capa que a API fornecer.
 */
export interface HomePostShape {
  kind: 'circle' | 'album' | 'image' | 'video' | 'text'
  urls: string[]
  /** Só em Círculo: fotografia + autoria de cada perspetiva, já ordenadas. */
  slots: CircleSlot[]
  /** Só em vídeo: o ficheiro que toca, distinto do cartaz em `urls[0]`. */
  videoUri?: string
  people: number
}

/**
 * A ordem das perspetivas de um Círculo.
 *
 * Tem de ser estável: a mesma publicação desenha a mesma figura na Home, na
 * imersiva e ao voltar de lá. O momento da captura é a ordem natural — foi por
 * ela que as fotografias aconteceram — e o `userId` desempata quando dois
 * carimbos coincidem ou faltam, que é o único critério que não depende da ordem
 * em que o servidor devolveu o array.
 */
function captureOrder(
  a: { createdAt?: string; userId: string },
  b: { createdAt?: string; userId: string },
): number {
  const ta = Date.parse(a.createdAt ?? '')
  const tb = Date.parse(b.createdAt ?? '')
  if (Number.isFinite(ta) && Number.isFinite(tb) && ta !== tb) return ta - tb
  return a.userId < b.userId ? -1 : a.userId > b.userId ? 1 : 0
}

/** Uma perspetiva de um Círculo: a captura, a fotografia já resolvida e quem a tirou. */
export interface CirclePerspective {
  capture: CollectiveMomentCapture
  url: string
  /** Dimensões da fotografia, quando o servidor as mandou. */
  size: { w: number | null; h: number | null }
  participant?: CollectiveMomentParticipant
}

/**
 * As perspetivas de um Círculo, na ordem em que a figura as desenha.
 *
 * É a única fonte dessa ordem — a Home e a imersiva leem daqui, e é isso que
 * faz a mesma publicação desenhar a mesma figura dos dois lados.
 *
 * A fotografia resolve-se ANTES de ordenar: sem `mediaIndex`, a captura aponta
 * para a posição que ocupava no array do servidor, e depois de ordenar o índice
 * já seria o de outra pessoa.
 */
export function circlePerspectives(post: Post): CirclePerspective[] {
  const captures = Array.isArray(post.collectiveMoment?.captures)
    ? post.collectiveMoment.captures
    : []
  const participants = Array.isArray(post.collectiveMoment?.participants)
    ? post.collectiveMoment.participants
    : []
  // Quem entrou depois também tem nome e rosto — só não conta como presente.
  const latecomers = Array.isArray(post.collectiveMoment?.latecomers)
    ? post.collectiveMoment.latecomers
    : []
  const byId = new Map([...latecomers, ...participants].map((person) => [person.id, person]))

  return captures
    .map((capture, index) => {
      const media = capture.mediaIndex ?? index
      return {
        capture,
        url: resolveMediaUrl(post.mediaUrls?.[media] ?? capture.mediaUrl),
        size: post.mediaSizes?.[media] ?? { w: null, h: null },
        participant: byId.get(capture.userId),
      }
    })
    .sort((a, b) => captureOrder(a.capture, b.capture))
}

/**
 * Lê a publicação e decide o que ela é, uma vez só.
 *
 * O modelo não tem um campo "tipo": um Círculo reconhece-se por ter capturas
 * colectivas, um álbum por trazer mais de uma fotografia, um vídeo pelo
 * `mediaType`. A leitura vive aqui para a lista, a célula, o rótulo de contexto
 * e a altura estimada não poderem discordar sobre o que estão a desenhar.
 */
export function readPost(post: Post): HomePostShape {
  const captures = Array.isArray(post.collectiveMoment?.captures)
    ? post.collectiveMoment.captures
    : []
  const participants = Array.isArray(post.collectiveMoment?.participants)
    ? post.collectiveMoment.participants
    : []

  if (post.mediaType === 'TEXT') {
    return { kind: 'text', urls: [], slots: [], people: 0 }
  }

  if (post.mediaType !== 'VIDEO' && captures.length > 0) {
    const slots: CircleSlot[] = circlePerspectives(post).map((perspective) => ({
      url: perspective.url,
      name: perspective.participant?.name ?? null,
      late: perspective.capture.late === true,
    }))
    return {
      kind: 'circle',
      urls: slots.map((slot) => slot.url),
      slots,
      people: participants.length || slots.length,
    }
  }

  if (post.mediaType === 'VIDEO') {
    // O cartaz e a mídia são endereços diferentes: um é o frame estático que
    // desenha enquanto o leitor não existe, o outro é o ficheiro que toca.
    return {
      kind: 'video',
      urls: [videoPosterUrl(post.mediaUrl, post.thumbnailUrl, 1080)],
      slots: [],
      videoUri: resolveMediaUrl(post.mediaUrl),
      people: 0,
    }
  }

  const urls = (post.mediaUrls?.length ? post.mediaUrls : [post.mediaUrl]).map(resolveMediaUrl)
  return { kind: urls.length > 1 ? 'album' : 'image', urls, slots: [], people: 0 }
}

/**
 * Onde quem está a ver fica em relação a um Círculo publicado.
 *
 * É o que decide o que o Círculo lhe oferece: ao anfitrião, os pedidos para
 * decidir; a quem não esteve lá mas segue alguém que esteve, entrar depois; a
 * quem já lá está, retirar as próprias fotografias.
 */
export interface CircleRelation {
  momentId: string
  hostId: string
  hostName: string | null
  isHost: boolean
  /** Esteve no disparo, ou já tem uma fotografia no Círculo. */
  inCircle: boolean
  /** Quem esteve no disparo — são estas as pessoas que se tem de seguir para pedir. */
  participantIds: string[]
  /** As minhas fotografias neste Círculo. */
  myCaptureIds: string[]
  /** Fotografias tardias, que o anfitrião também pode retirar. */
  lateCaptureIds: string[]
}

export function circleRelation(post: Post, viewerId: string | null | undefined): CircleRelation | null {
  const moment = post.collectiveMoment
  if (!moment || typeof moment.id !== 'string' || !Array.isArray(moment.captures)) return null
  const participants = Array.isArray(moment.participants) ? moment.participants : []
  const host = participants.find((person) => person.id === moment.creatorId)
  const myCaptureIds = viewerId
    ? moment.captures.filter((capture) => capture.userId === viewerId).map((capture) => capture.id)
    : []
  return {
    momentId: moment.id,
    hostId: moment.creatorId,
    hostName: host?.name ?? null,
    isHost: !!viewerId && moment.creatorId === viewerId,
    inCircle: !!viewerId && (
      participants.some((person) => person.id === viewerId) || myCaptureIds.length > 0
    ),
    participantIds: participants.map((person) => person.id),
    myCaptureIds,
    lateCaptureIds: moment.captures.filter((capture) => capture.late).map((capture) => capture.id),
  }
}
